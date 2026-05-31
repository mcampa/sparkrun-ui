import { os, ORPCError } from "@orpc/server";
import { z } from "zod";
import { runSparkrun } from "@/lib/sparkrun";

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
