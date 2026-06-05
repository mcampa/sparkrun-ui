import type { ChildProcessByStdio, spawn as nodeSpawn } from "node:child_process";
import { createRequire } from "node:module";
import type { Readable } from "node:stream";
import { createInterface } from "node:readline";
import { ORPCError } from "@orpc/server";

// Build the spawn caller via Function constructor so Turbopack's NFT trace
// can't see the child_process.spawn invocation — otherwise any non-literal
// first argument (e.g. `process.env.SPARKRUN_BIN || "sparkrun"`) makes NFT
// fall back to whole-project tracing and bundles tests/, docs/,
// next.config.ts, etc. into `.next/standalone`. `cp` is typed as `unknown` so
// the static analyzer doesn't see a `.spawn` method on it either.
const cp: unknown = createRequire(import.meta.url)("node:child_process");
const spawnViaCp = new Function(
  "cp",
  "bin",
  "args",
  "opts",
  "return cp.spawn(bin, args, opts);",
) as (cp: unknown, ...rest: Parameters<typeof nodeSpawn>) => ReturnType<typeof nodeSpawn>;
const runChild: typeof nodeSpawn = ((...args: Parameters<typeof nodeSpawn>) =>
  spawnViaCp(cp, ...args)) as typeof nodeSpawn;

export function getSparkrunBin(): string {
  return process.env.SPARKRUN_BIN || "sparkrun";
}

export type SparkrunTarget = {
  cluster?: string;
  hosts?: string[];
};

export function targetArgs(t: SparkrunTarget | undefined): string[] {
  if (!t) return [];
  if (t.cluster) return ["--cluster", t.cluster];
  if (t.hosts && t.hosts.length) return ["--hosts", t.hosts.join(",")];
  return [];
}

type RunOpts = {
  signal?: AbortSignal;
  timeoutMs?: number;
};

export type SparkrunResult = {
  code: number;
  stdout: string;
  stderr: string;
};

export function runSparkrun(args: string[], opts: RunOpts = {}): Promise<SparkrunResult> {
  return new Promise((resolve, reject) => {
    const child = runChild(getSparkrunBin(), args, { stdio: ["ignore", "pipe", "pipe"] });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    const onAbort = () => child.kill("SIGTERM");
    opts.signal?.addEventListener("abort", onAbort, { once: true });
    const timer = opts.timeoutMs ? setTimeout(() => child.kill("SIGTERM"), opts.timeoutMs) : null;

    child.stdout.on("data", (c) => stdoutChunks.push(c));
    child.stderr.on("data", (c) => stderrChunks.push(c));

    child.on("error", (err) => {
      if (timer) clearTimeout(timer);
      opts.signal?.removeEventListener("abort", onAbort);
      reject(err);
    });

    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      opts.signal?.removeEventListener("abort", onAbort);
      resolve({
        code: code ?? -1,
        stdout: Buffer.concat(stdoutChunks).toString("utf8"),
        stderr: Buffer.concat(stderrChunks).toString("utf8"),
      });
    });
  });
}

export async function runSparkrunJson<T>(args: string[], opts: RunOpts = {}): Promise<T> {
  const r = await runSparkrun(args, opts);
  if (r.code !== 0) {
    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: `sparkrun ${args.join(" ")} exited ${r.code}`,
      data: { stderr: r.stderr.trim(), stdout: r.stdout.trim() },
    });
  }
  try {
    return JSON.parse(r.stdout) as T;
  } catch {
    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: `sparkrun returned non-JSON output`,
      data: { stdout: r.stdout.slice(0, 2000) },
    });
  }
}

export async function runSparkrunText(args: string[], opts: RunOpts = {}): Promise<SparkrunResult> {
  return runSparkrun(args, opts);
}

export type SparkrunChild = ChildProcessByStdio<null, Readable, Readable>;

export function spawnSparkrun(args: string[]): SparkrunChild {
  return runChild(getSparkrunBin(), args, { stdio: ["ignore", "pipe", "pipe"] });
}

export async function* streamSparkrunLines(
  args: string[],
  opts: { signal?: AbortSignal; includeStderr?: boolean } = {},
): AsyncGenerator<string> {
  const child = spawnSparkrun(args);
  const onAbort = () => child.kill("SIGTERM");
  opts.signal?.addEventListener("abort", onAbort, { once: true });

  const queue: string[] = [];
  let resolveNext: (() => void) | null = null;
  let done = false;

  const push = (line: string) => {
    queue.push(line);
    if (resolveNext) {
      const r = resolveNext;
      resolveNext = null;
      r();
    }
  };

  const stdoutRl = createInterface({ input: child.stdout });
  stdoutRl.on("line", push);
  stdoutRl.on("close", () => {
    if (!opts.includeStderr) {
      done = true;
      if (resolveNext) resolveNext();
    }
  });

  let stderrClosed = !opts.includeStderr;
  if (opts.includeStderr) {
    const stderrRl = createInterface({ input: child.stderr });
    stderrRl.on("line", push);
    stderrRl.on("close", () => {
      stderrClosed = true;
    });
  }

  child.on("close", () => {
    if (stderrClosed) {
      done = true;
      if (resolveNext) resolveNext();
    } else {
      // wait for stderr drain
      const check = setInterval(() => {
        if (stderrClosed) {
          clearInterval(check);
          done = true;
          if (resolveNext) resolveNext();
        }
      }, 50);
    }
  });

  try {
    while (true) {
      if (queue.length) {
        yield queue.shift()!;
        continue;
      }
      if (done) break;
      await new Promise<void>((r) => {
        resolveNext = r;
      });
    }
  } finally {
    opts.signal?.removeEventListener("abort", onAbort);
    if (!child.killed) child.kill("SIGTERM");
  }
}

export async function* streamSparkrunNdjson<T>(
  args: string[],
  opts: { signal?: AbortSignal } = {},
): AsyncGenerator<T> {
  for await (const line of streamSparkrunLines(args, opts)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      yield JSON.parse(trimmed) as T;
    } catch {
      // skip non-JSON lines (CLI may emit banners on first lines)
    }
  }
}

export function fireAndForgetSparkrun(args: string[]): void {
  const child = runChild(getSparkrunBin(), args, {
    stdio: "ignore",
    detached: true,
  });
  child.unref();
}

const BENCH_ID_RE = /^Benchmark ID:\s+(\S+)/;
const BENCH_LOG_CAP = 500;
const BENCH_GC_MS = 60_000;

type BenchmarkLogListener = (line: string) => void;
type BenchmarkProc = {
  child: SparkrunChild;
  buffer: string[];
  listeners: Set<BenchmarkLogListener>;
  done: boolean;
  exitCode: number | null;
  exitError: string | null;
};

const benchmarkProcs = new Map<string, BenchmarkProc>();

export function getBenchmarkProc(id: string): BenchmarkProc | null {
  return benchmarkProcs.get(id) ?? null;
}

export function subscribeBenchmarkLog(id: string, cb: BenchmarkLogListener): () => void {
  const proc = benchmarkProcs.get(id);
  if (!proc) return () => {};
  proc.listeners.add(cb);
  return () => {
    proc.listeners.delete(cb);
  };
}

export function startBenchmark(args: string[], timeoutMs = 30_000): Promise<{ id: string }> {
  return new Promise((resolve, reject) => {
    const child = spawnSparkrun(args);

    let settled = false;
    let id: string | null = null;
    const pending: string[] = [];

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        child.kill("SIGTERM");
      } catch {}
      reject(
        new Error(`sparkrun did not emit a benchmark id within ${Math.round(timeoutMs / 1000)}s`),
      );
    }, timeoutMs);

    const attach = (capturedId: string) => {
      const proc: BenchmarkProc = {
        child,
        buffer: pending.slice(-BENCH_LOG_CAP),
        listeners: new Set(),
        done: false,
        exitCode: null,
        exitError: null,
      };
      benchmarkProcs.set(capturedId, proc);
    };

    const pushLine = (line: string) => {
      if (id) {
        const proc = benchmarkProcs.get(id);
        if (!proc) return;
        proc.buffer.push(line);
        if (proc.buffer.length > BENCH_LOG_CAP) proc.buffer.shift();
        for (const l of proc.listeners) {
          try {
            l(line);
          } catch {}
        }
        return;
      }
      pending.push(line);
      if (pending.length > BENCH_LOG_CAP) pending.shift();
      const m = line.match(BENCH_ID_RE);
      if (m) {
        id = m[1];
        attach(id);
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve({ id });
        }
      }
    };

    const stdoutRl = createInterface({ input: child.stdout });
    stdoutRl.on("line", pushLine);
    const stderrRl = createInterface({ input: child.stderr });
    stderrRl.on("line", pushLine);

    child.on("error", (err) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(err);
        return;
      }
      if (id) {
        const proc = benchmarkProcs.get(id);
        if (proc) proc.exitError = err.message;
      }
    });

    child.on("close", (code) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(new Error(`sparkrun exited with code ${code ?? -1} before emitting a benchmark id`));
        return;
      }
      if (!id) return;
      const proc = benchmarkProcs.get(id);
      if (!proc) return;
      proc.done = true;
      proc.exitCode = code;
      for (const l of proc.listeners) {
        try {
          l(`[exit ${code ?? -1}]`);
        } catch {}
      }
      setTimeout(() => {
        benchmarkProcs.delete(id!);
      }, BENCH_GC_MS);
    });
  });
}
