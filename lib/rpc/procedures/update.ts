import { os, eventIterator } from "@orpc/server";
import { z } from "zod";
import { streamSparkrunLines } from "@/lib/sparkrun";

const UpdateEventSchema = z.object({
  line: z.string(),
  done: z.boolean().optional(),
});

export const stream = os.output(eventIterator(UpdateEventSchema)).handler(async function* ({
  signal,
}) {
  try {
    for await (const line of streamSparkrunLines(["update"], { signal, includeStderr: true })) {
      if (signal?.aborted) break;
      yield { line };
    }
  } catch (err) {
    yield { line: `Error: ${(err as Error).message}` };
  }
  yield { line: "", done: true };
});
