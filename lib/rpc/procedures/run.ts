import { os, ORPCError } from "@orpc/server";
import { z } from "zod";
import { writeDraft, writeDraftMeta } from "@/lib/draft";
import { runSparkrun } from "@/lib/sparkrun";

export const start = os
  .input(
    z.object({
      yaml: z.string(),
      draftId: z.string().regex(/^[a-zA-Z0-9_-]+$/),
      hosts: z.array(z.string()).optional(),
      cluster: z.string().optional(),
      tp: z.number().int().min(1).optional(),
      recipeName: z.string().optional(),
    }),
  )
  .output(z.object({ ok: z.literal(true), draftPath: z.string() }))
  .handler(async ({ input }) => {
    const path = await writeDraft(input.draftId, input.yaml);
    if (input.recipeName) {
      await writeDraftMeta(input.draftId, { recipeName: input.recipeName });
    }

    const validate = await runSparkrun(["recipe", "validate", path, "--json"]);
    if (validate.code !== 0) {
      throw new ORPCError("BAD_REQUEST", {
        message: "Recipe failed validation",
        data: { stderr: validate.stderr.trim() },
      });
    }

    const args = ["run", path, "--no-follow"];
    if (input.cluster) args.push("--cluster", input.cluster);
    else if (input.hosts?.length) args.push("--hosts", input.hosts.join(","));
    if (input.tp) args.push("--tp", String(input.tp));

    // Wait for sparkrun to finish kicking off the container. With --no-follow
    // it returns once the workload is detached, so this is short for cached
    // images and may take longer when pulling. We previously fire-and-forgot
    // this, which silently swallowed crashes and stranded the UI on "waiting
    // for the workload to start…" forever (issue #67).
    const result = await runSparkrun(args, { timeoutMs: 180_000 });
    if (result.code !== 0) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: `sparkrun run failed (exit ${result.code})`,
        data: {
          stderr: result.stderr.trim().slice(-4000),
          stdout: result.stdout.trim().slice(-2000),
        },
      });
    }
    return { ok: true as const, draftPath: path };
  });
