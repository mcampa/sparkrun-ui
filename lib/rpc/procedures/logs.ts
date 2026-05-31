import { os, eventIterator } from "@orpc/server";
import { z } from "zod";
import { streamSparkrunLines } from "@/lib/sparkrun";

const ARGS_INPUT = z.object({
  clusterId: z.string().regex(/^[a-zA-Z0-9_]+$/),
  tail: z.number().int().min(0).max(10_000).default(200),
});

const LogEventSchema = z.object({
  line: z.string(),
  ts: z.string(),
});

export const stream = os
  .input(ARGS_INPUT)
  .output(eventIterator(LogEventSchema))
  .handler(async function* ({ input, signal }) {
    const args = ["logs", input.clusterId, "--tail", String(input.tail)];
    try {
      for await (const line of streamSparkrunLines(args, { signal })) {
        if (signal?.aborted) break;
        yield { line, ts: new Date().toISOString() };
      }
    } catch (err) {
      yield { line: `[stream error] ${(err as Error).message}`, ts: new Date().toISOString() };
    }
  });
