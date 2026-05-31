import { os, eventIterator } from "@orpc/server";
import { z } from "zod";
import { ClusterStatusSchema, type ClusterStatus } from "@/lib/schemas";
import { runSparkrunJson } from "@/lib/sparkrun";

async function fetchStatus(): Promise<ClusterStatus> {
  const raw = await runSparkrunJson<unknown>(["cluster", "status", "--json"]);
  return ClusterStatusSchema.parse(raw);
}

export const get = os.output(ClusterStatusSchema).handler(fetchStatus);

export const stream = os
  .input(z.object({ intervalMs: z.number().int().min(500).max(30_000).default(3000) }).optional())
  .output(eventIterator(ClusterStatusSchema))
  .handler(async function* ({ input, signal }) {
    const interval = input?.intervalMs ?? 3000;
    while (!signal?.aborted) {
      try {
        yield await fetchStatus();
      } catch (err) {
        console.error("[status.stream]", err);
      }
      await new Promise((r) => setTimeout(r, interval));
    }
  });
