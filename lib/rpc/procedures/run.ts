import { os, ORPCError, eventIterator } from "@orpc/server";
import { z } from "zod";
import { writeDraft, writeDraftMeta } from "@/lib/draft";
import { runSparkrun, streamSparkrunLines } from "@/lib/sparkrun";

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

const LaunchEventSchema = z.object({
  line: z.string(),
  done: z.boolean().optional(),
  ok: z.boolean().optional(),
  draftPath: z.string().optional(),
  error: z.string().optional(),
});

export const startStream = os
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
  .output(eventIterator(LaunchEventSchema))
  .handler(async function* ({ input, signal }) {
    yield { line: "Writing draft…" };

    const path = await writeDraft(input.draftId, input.yaml);
    if (input.recipeName) {
      await writeDraftMeta(input.draftId, { recipeName: input.recipeName });
    }

    yield { line: "Validating recipe…" };

    const validate = await runSparkrun(["recipe", "validate", path, "--json"]);
    if (validate.code !== 0) {
      yield {
        line: "",
        done: true,
        ok: false,
        error: validate.stderr.trim() || "Recipe validation failed",
      };
      return;
    }

    const args = ["run", path, "--no-follow"];
    if (input.cluster) args.push("--cluster", input.cluster);
    else if (input.hosts?.length) args.push("--hosts", input.hosts.join(","));
    if (input.tp) args.push("--tp", String(input.tp));

    yield { line: `Running: sparkrun ${args.join(" ")}` };

    try {
      for await (const line of streamSparkrunLines(args, { signal, includeStderr: true })) {
        if (signal?.aborted) break;
        yield { line };
      }
    } catch (err) {
      yield { line: `Error: ${(err as Error).message}` };
      yield { line: "", done: true, ok: false, error: (err as Error).message };
      return;
    }

    yield { line: "", done: true };
  });
