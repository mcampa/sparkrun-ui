import { spawn, type ChildProcessByStdio } from "node:child_process";
import type { Readable } from "node:stream";
import { createInterface } from "node:readline";
import { ORPCError } from "@orpc/server";

export const SPARKRUN_BIN = process.env.SPARKRUN_BIN || "sparkrun";

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
    const child = spawn(SPARKRUN_BIN, args, { stdio: ["ignore", "pipe", "pipe"] });
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
  return spawn(SPARKRUN_BIN, args, { stdio: ["ignore", "pipe", "pipe"] });
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
  const child = spawn(SPARKRUN_BIN, args, {
    stdio: "ignore",
    detached: true,
  });
  child.unref();
}
