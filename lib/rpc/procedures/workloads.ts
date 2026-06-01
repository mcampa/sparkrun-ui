import { os, ORPCError } from "@orpc/server";
import { z } from "zod";
import { runSparkrun, runSparkrunJson } from "@/lib/sparkrun";
import { ClusterStatusSchema } from "@/lib/schemas";

export const stop = os
  .input(z.object({ clusterId: z.string().min(1) }))
  .output(z.object({ ok: z.literal(true), clusterId: z.string() }))
  .handler(async ({ input }) => {
    const r = await runSparkrun(["stop", input.clusterId]);
    if (r.code !== 0) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: `Failed to stop ${input.clusterId}`,
        data: { stderr: r.stderr.trim() },
      });
    }
    return { ok: true as const, clusterId: input.clusterId };
  });

export const HealthSchema = z.object({
  ready: z.boolean(),
  // "starting" | "ready" | "unreachable" | "not_found". Free-form to leave
  // room for future runtime-specific states without breaking clients.
  state: z.string(),
  reason: z.string().optional(),
});
export type Health = z.infer<typeof HealthSchema>;

export const health = os
  .input(z.object({ clusterId: z.string().min(1) }))
  .output(HealthSchema)
  .handler(async ({ input, signal }) => {
    const status = ClusterStatusSchema.parse(
      await runSparkrunJson(["cluster", "status", "--json"]),
    );
    const w = status.solo_entries.find((e) => e.cluster_id === input.clusterId);
    if (!w) {
      return { ready: false, state: "not_found", reason: "Workload no longer running." };
    }
    if (!w.host || !w.meta.port) {
      return { ready: false, state: "starting", reason: "Container has no host:port yet." };
    }
    return probeReady(w.host, w.meta.port, signal);
  });

async function probeReady(host: string, port: number, signal?: AbortSignal): Promise<Health> {
  const base = `http://${host}:${port}`;
  // vLLM exposes /health (returns 200 once the model is loaded). Probe it
  // with a short timeout so a hung container doesn't hold the RPC open.
  const ac = new AbortController();
  const cancel = () => ac.abort();
  signal?.addEventListener("abort", cancel, { once: true });
  const timer = setTimeout(cancel, 3000);
  try {
    const res = await fetch(`${base}/health`, { signal: ac.signal });
    if (res.ok) return { ready: true, state: "ready" };
    // /health returns 503 while loading. Fall through to /v1/models in case
    // the runtime doesn't implement /health at all.
    const models = await fetch(`${base}/v1/models`, { signal: ac.signal });
    if (models.ok) return { ready: true, state: "ready" };
    return { ready: false, state: "starting", reason: `HTTP ${res.status}` };
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return { ready: false, state: "starting", reason: "Probe timed out." };
    }
    return {
      ready: false,
      state: "unreachable",
      reason: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
  }
}
