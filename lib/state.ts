import { readFile, readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";

const BENCH_DIR = join(homedir(), ".cache", "sparkrun", "benchmarks");

export type BenchmarkState = {
  benchmark_id: string;
  cluster_id?: string;
  recipe_qualified_name?: string;
  framework?: string;
  profile?: string | null;
  base_args?: Record<string, unknown>;
  schedule?: { depth?: number; concurrency?: number }[];
  completed_indices?: number[];
  failed_indices?: number[];
  crash_count?: number;
  session_count?: number;
  sessions?: { session: number; started_at: string; status: string; ended_at?: string }[];
  extras?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
};

export type ConsolidatedMetric = { mean: number; std: number; values: number[] };

export type ConsolidatedRow = {
  concurrency: number;
  context_size: number;
  prompt_size: number;
  response_size: number;
  pp_throughput?: ConsolidatedMetric;
  pp_req_throughput?: ConsolidatedMetric;
  tg_throughput?: ConsolidatedMetric;
  tg_req_throughput?: ConsolidatedMetric;
  peak_throughput?: ConsolidatedMetric;
  peak_req_throughput?: ConsolidatedMetric;
  ttfr?: ConsolidatedMetric;
  est_ppt?: ConsolidatedMetric;
};

export type Consolidated = {
  model: string;
  max_concurrency: number;
  benchmarks: ConsolidatedRow[];
};

export type BenchmarkSummary = {
  id: string;
  recipe: string | null;
  framework: string | null;
  status: "running" | "completed" | "partial" | "failed" | "unknown";
  startedAt: string | null;
  updatedAt: string | null;
  scheduleCount: number;
  completedCount: number;
  failedCount: number;
};

export async function listBenchmarks(): Promise<BenchmarkSummary[]> {
  let dirs: string[] = [];
  try {
    dirs = await readdir(BENCH_DIR);
  } catch {
    return [];
  }
  const results = await Promise.all(
    dirs
      .filter((d) => d.startsWith("bench_"))
      .map(async (d): Promise<BenchmarkSummary | null> => {
        try {
          const path = join(BENCH_DIR, d, "state.yaml");
          const raw = await readFile(path, "utf8");
          const state = parseYaml(raw) as BenchmarkState;
          const lastSession = state.sessions?.[state.sessions.length - 1];
          return {
            id: state.benchmark_id ?? d,
            recipe: state.recipe_qualified_name ?? null,
            framework: state.framework ?? null,
            status: deriveStatus(state),
            startedAt: state.created_at ?? lastSession?.started_at ?? null,
            updatedAt: state.updated_at ?? lastSession?.ended_at ?? null,
            scheduleCount: state.schedule?.length ?? 0,
            completedCount: state.completed_indices?.length ?? 0,
            failedCount: state.failed_indices?.length ?? 0,
          };
        } catch {
          return null;
        }
      }),
  );
  return results
    .filter((r): r is BenchmarkSummary => r !== null)
    .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
}

export async function getBenchmark(id: string): Promise<{
  state: BenchmarkState;
  consolidated: Consolidated | null;
} | null> {
  if (!/^bench_[a-z0-9]+$/.test(id)) return null;
  const dir = join(BENCH_DIR, id);
  try {
    await stat(dir);
  } catch {
    return null;
  }
  const state = parseYaml(await readFile(join(dir, "state.yaml"), "utf8")) as BenchmarkState;
  let consolidated: Consolidated | null = null;
  try {
    const cRaw = await readFile(join(dir, "consolidated.json"), "utf8");
    consolidated = JSON.parse(cRaw) as Consolidated;
  } catch {
    consolidated = null;
  }
  return { state, consolidated };
}

function deriveStatus(state: BenchmarkState): BenchmarkSummary["status"] {
  const last = state.sessions?.[state.sessions.length - 1];
  if (!last) return "unknown";
  if (last.status === "completed") return "completed";
  if (last.status === "partial") {
    if (!last.ended_at) return "running";
    return state.failed_indices?.length ? "failed" : "partial";
  }
  if (last.status === "failed") return "failed";
  return "unknown";
}
