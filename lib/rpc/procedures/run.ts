import { os, ORPCError } from "@orpc/server";
import { z } from "zod";
import { writeDraft } from "@/lib/draft";
import { fireAndForgetSparkrun, runSparkrun } from "@/lib/sparkrun";

export const start = os
  .input(
    z.object({
      yaml: z.string(),
      draftId: z.string().regex(/^[a-zA-Z0-9_-]+$/),
      hosts: z.array(z.string()).optional(),
      cluster: z.string().optional(),
      tp: z.number().int().min(1).optional(),
    }),
  )
  .output(z.object({ ok: z.literal(true), draftPath: z.string() }))
  .handler(async ({ input }) => {
    const path = await writeDraft(input.draftId, input.yaml);

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

    fireAndForgetSparkrun(args);
    return { ok: true as const, draftPath: path };
  });
