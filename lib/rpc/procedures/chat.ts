import { os, eventIterator } from "@orpc/server";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { runSparkrunJson } from "@/lib/sparkrun";
import { ClusterStatusSchema } from "@/lib/schemas";

const ChatMessageSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string(),
});

const CHAT_INPUT = z.object({
  clusterId: z.string(),
  messages: z.array(ChatMessageSchema),
  model: z.string().optional(),
});

export const stream = os
  .input(CHAT_INPUT)
  .output(eventIterator(z.string()))
  .handler(async function* ({ input, signal }) {
    const { clusterId, messages, model } = input;

    // Resolve host:port from status
    const status = ClusterStatusSchema.parse(
      await runSparkrunJson(["cluster", "status", "--json"]),
    );
    const workload = status.solo_entries.find((w) => w.cluster_id === clusterId);
    if (!workload) {
      throw new ORPCError("NOT_FOUND", {
        message: `Workload "${clusterId}" not found — it may have been stopped.`,
      });
    }
    const host = workload.host;
    const port = workload.meta.port;
    if (!host || !port) {
      throw new ORPCError("NOT_FOUND", {
        message: `Workload "${clusterId}" has no accessible host:port.`,
      });
    }

    const baseUrl = `http://${host}:${port}`;
    const resolvedModel = model ?? (await fetchServedModel(baseUrl, signal));
    if (!resolvedModel) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: `Could not determine the served model name for ${clusterId}.`,
      });
    }

    const body = {
      model: resolvedModel,
      messages,
      stream: true,
      max_tokens: 2048,
    };

    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => "");
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: `vLLM returned ${response.status}: ${errBody.slice(0, 500)}`,
      });
    }

    if (!response.body) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "No response body from vLLM" });
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done || signal?.aborted) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const json = trimmed.slice(5).trim();
          if (json === "[DONE]") continue;

          try {
            const parsed = JSON.parse(json);
            const content = parsed.choices?.[0]?.delta?.content;
            if (typeof content === "string" && content.length > 0) {
              yield content;
            }
          } catch {
            // skip malformed JSON chunks
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  });

async function fetchServedModel(baseUrl: string, signal?: AbortSignal): Promise<string | null> {
  try {
    const res = await fetch(`${baseUrl}/v1/models`, { signal });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    if (
      data &&
      typeof data === "object" &&
      "data" in data &&
      Array.isArray((data as { data: unknown[] }).data)
    ) {
      const first = (data as { data: Array<{ id?: unknown }> }).data[0];
      if (first && typeof first.id === "string") return first.id;
    }
    return null;
  } catch {
    return null;
  }
}
