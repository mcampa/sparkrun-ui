import { os, ORPCError, eventIterator } from "@orpc/server";
import { z } from "zod";
import {
  runSparkrun,
  startBenchmark,
  getBenchmarkProc,
  subscribeBenchmarkLog,
} from "@/lib/sparkrun";
import {
  listBenchmarks,
  getBenchmark,
  watchBenchmarkFiles,
  deriveStatus,
  isTerminalStatus,
  type BenchmarkState,
} from "@/lib/state";

const SummarySchema = z.object({
  id: z.string(),
  recipe: z.string().nullable(),
  framework: z.string().nullable(),
  status: z.enum(["running", "completed", "partial", "failed", "unknown"]),
  startedAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
  scheduleCount: z.number(),
  completedCount: z.number(),
  failedCount: z.number(),
});

const ProfileSchema = z.object({
  name: z.string(),
  registry: z.string(),
  framework: z.string(),
});

export const list = os.output(z.array(SummarySchema)).handler(async () => {
  return listBenchmarks();
});

export const get = os
  .input(z.object({ id: z.string() }))
  .output(z.object({ state: z.unknown(), consolidated: z.unknown().nullable() }).nullable())
  .handler(async ({ input }) => {
    return (await getBenchmark(input.id)) ?? null;
  });

export const profiles = os.output(z.array(ProfileSchema)).handler(async () => {
  const r = await runSparkrun(["registry", "list-benchmark-profiles"]);
  if (r.code !== 0) return [];
  const out: { name: string; registry: string; framework: string }[] = [];
  const lines = r.stdout.split("\n");
  for (const line of lines) {
    if (!line.trim() || line.startsWith("Profile") || line.startsWith("-")) continue;
    const cols = line.trim().split(/\s{2,}/);
    if (cols.length >= 2) {
      out.push({
        name: cols[0],
        registry: cols[1] ?? "",
        framework: cols[2] ?? "",
      });
    }
  }
  return out;
});

export const run = os
  .input(
    z.object({
      recipe: z.string().min(1),
      cluster: z.string().optional(),
      hosts: z.array(z.string()).optional(),
      tp: z.number().int().min(1).optional(),
      profile: z.string().optional(),
      framework: z.string().optional(),
      skipRun: z.boolean().default(false),
      concurrency: z.array(z.number().int().positive()).optional(),
      pp: z.array(z.number().int().positive()).optional(),
      tg: z.array(z.number().int().positive()).optional(),
      depth: z.array(z.number().int().nonnegative()).optional(),
      servedModelName: z.string().optional(),
    }),
  )
  .output(z.object({ id: z.string() }))
  .handler(async ({ input }) => {
    const args = ["benchmark", "run", input.recipe];
    if (input.cluster) args.push("--cluster", input.cluster);
    else if (input.hosts?.length) args.push("--hosts", input.hosts.join(","));
    if (input.tp) args.push("--tp", String(input.tp));
    if (input.profile) args.push("--profile", input.profile);
    if (input.framework) args.push("--framework", input.framework);
    if (input.skipRun) args.push("--skip-run");
    if (input.concurrency?.length) {
      args.push("-b", `concurrency=${input.concurrency.join(",")}`);
    }
    if (input.pp?.length) {
      args.push("-b", `pp=${input.pp.join(",")}`);
    }
    if (input.tg?.length) {
      args.push("-b", `tg=${input.tg.join(",")}`);
    }
    if (input.depth?.length) {
      args.push("-b", `depth=${input.depth.join(",")}`);
    }
    if (input.servedModelName) {
      // Force the API model identifier llama-benchy sends in requests. Recipes
      // can rename the served model via --served-model-name, which makes the
      // recipe's `model:` field (the HF id) a 404 against the live endpoint.
      args.push("-b", `served_model_name=${input.servedModelName}`);
    }
    // Always start fresh: sparkrun otherwise prompts "Resume? [Y/n]" when
    // it finds incomplete state from a prior failed run, which hangs the
    // non-interactive child process.
    args.push("--fresh");
    if (args.length === 3) {
      throw new ORPCError("BAD_REQUEST", {
        message: "Must specify at least cluster, hosts, or profile",
      });
    }
    try {
      const { id } = await startBenchmark(args);
      return { id };
    } catch (err) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: err instanceof Error ? err.message : "Failed to start benchmark",
      });
    }
  });

const WatchEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("log"), line: z.string() }),
  z.object({ type: z.literal("state"), state: z.unknown() }),
  z.object({ type: z.literal("metrics"), consolidated: z.unknown().nullable() }),
  z.object({ type: z.literal("done"), ok: z.boolean() }),
  z.object({ type: z.literal("error"), error: z.string() }),
]);

type WatchEvent = z.infer<typeof WatchEventSchema>;

export const watch = os
  .input(z.object({ id: z.string() }))
  .output(eventIterator(WatchEventSchema))
  .handler(async function* ({ input, signal }) {
    const { id } = input;

    const initial = await getBenchmark(id);
    let latestState: BenchmarkState | null = initial?.state ?? null;
    if (initial) {
      yield { type: "state", state: initial.state } satisfies WatchEvent;
      yield {
        type: "metrics",
        consolidated: initial.consolidated,
      } satisfies WatchEvent;

      if (!getBenchmarkProc(id) && isTerminalStatus(deriveStatus(initial.state))) {
        yield {
          type: "done",
          ok: deriveStatus(initial.state) === "completed",
        } satisfies WatchEvent;
        return;
      }
    }

    const queue: WatchEvent[] = [];
    let resolveNext: (() => void) | null = null;
    const wake = () => {
      const r = resolveNext;
      resolveNext = null;
      r?.();
    };

    const proc = getBenchmarkProc(id);
    let unsubscribe: (() => void) | null = null;
    if (proc) {
      for (const line of proc.buffer) {
        queue.push({ type: "log", line });
      }
      unsubscribe = subscribeBenchmarkLog(id, (line) => {
        queue.push({ type: "log", line });
        wake();
      });
    }

    const fileAc = new AbortController();
    const onAbort = () => {
      fileAc.abort();
      wake();
    };
    signal?.addEventListener("abort", onAbort, { once: true });

    let watcherDone = false;
    (async () => {
      try {
        for await (const ev of watchBenchmarkFiles(id, { signal: fileAc.signal })) {
          if (ev.state) {
            latestState = ev.state;
            queue.push({ type: "state", state: ev.state });
          }
          if (ev.consolidated !== undefined) {
            queue.push({ type: "metrics", consolidated: ev.consolidated });
          }
          wake();
        }
      } catch {
        // swallow — watcher errors are non-fatal
      } finally {
        watcherDone = true;
        wake();
      }
    })();

    try {
      while (!signal?.aborted) {
        if (queue.length) {
          const ev = queue.shift()!;
          yield ev;
          if (ev.type === "state") {
            const status = deriveStatus(ev.state as BenchmarkState);
            const live = getBenchmarkProc(id);
            if (isTerminalStatus(status) && (!live || live.done)) {
              yield {
                type: "done",
                ok: status === "completed",
              } satisfies WatchEvent;
              return;
            }
          }
          continue;
        }
        if (watcherDone && !getBenchmarkProc(id)) {
          if (latestState) {
            const status = deriveStatus(latestState);
            yield {
              type: "done",
              ok: status === "completed",
            } satisfies WatchEvent;
          } else {
            yield { type: "done", ok: false } satisfies WatchEvent;
          }
          return;
        }
        await new Promise<void>((r) => {
          resolveNext = r;
        });
      }
    } finally {
      signal?.removeEventListener("abort", onAbort);
      fileAc.abort();
      unsubscribe?.();
    }
  });
