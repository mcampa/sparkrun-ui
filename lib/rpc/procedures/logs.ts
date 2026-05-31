import { os, eventIterator } from "@orpc/server";
import { z } from "zod";
import { runSparkrunJson, streamSparkrunLines } from "@/lib/sparkrun";
import type { ClusterStatus } from "@/lib/schemas";
import { ClusterStatusSchema } from "@/lib/schemas";

const ARGS_INPUT = z.object({
  clusterId: z.string().regex(/^[a-zA-Z0-9_]+$/),
  tail: z.number().int().min(0).max(10_000).default(200),
});

const LogEventSchema = z.object({
  line: z.string(),
  ts: z.string(),
  stream: z.enum(["out", "err", "meta"]).default("out"),
});

async function resolveHostsForCluster(clusterId: string): Promise<string[]> {
  const raw = await runSparkrunJson<unknown>(["cluster", "status", "--json"]);
  const status: ClusterStatus = ClusterStatusSchema.parse(raw);
  const w = status.solo_entries.find((e) => e.cluster_id === clusterId);
  if (!w) return [];
  if (w.meta.hosts?.length) return w.meta.hosts;
  if (w.host) return [w.host];
  return [];
}

export const stream = os
  .input(ARGS_INPUT)
  .output(eventIterator(LogEventSchema))
  .handler(async function* ({ input, signal }) {
    const now = () => new Date().toISOString();

    const hosts = await resolveHostsForCluster(input.clusterId);
    if (!hosts.length) {
      yield {
        line: `[meta] Could not resolve hosts for ${input.clusterId} — is it still running?`,
        ts: now(),
        stream: "meta" as const,
      };
      return;
    }

    const args = [
      "logs",
      input.clusterId,
      "--hosts",
      hosts.join(","),
      "--tail",
      String(input.tail),
    ];
    yield {
      line: `[meta] attaching to ${input.clusterId} on ${hosts.join(", ")} (tail=${input.tail})`,
      ts: now(),
      stream: "meta" as const,
    };

    try {
      for await (const line of streamSparkrunLines(args, { signal, includeStderr: true })) {
        if (signal?.aborted) break;
        yield { line, ts: now(), stream: "out" as const };
      }
    } catch (err) {
      yield { line: `[stream error] ${(err as Error).message}`, ts: now(), stream: "err" as const };
    }
  });
