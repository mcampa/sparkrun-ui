"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/app/components/ui/Card";
import { Badge } from "@/app/components/ui/Badge";
import { BenchmarkCharts } from "@/app/components/benchmarks/BenchmarkCharts";
import { rpc } from "@/lib/rpc/client";
import type { BenchmarkState, Consolidated } from "@/lib/state";

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

type Status = "running" | "completed" | "partial" | "failed" | "unknown";

function deriveStatus(state: BenchmarkState | null): Status {
  if (!state) return "unknown";
  const last = state.sessions?.[state.sessions.length - 1];
  if (!last) return "unknown";
  if (last.status === "completed") return "completed";
  if (last.status === "running") return "running";
  if (last.status === "partial") {
    if (!last.ended_at) return "running";
    return state.failed_indices?.length ? "failed" : "partial";
  }
  if (last.status === "failed") return "failed";
  if (!last.ended_at) return "running";
  return "unknown";
}

function statusTone(s: Status): "green" | "amber" | "red" | "sky" {
  switch (s) {
    case "completed":
      return "green";
    case "running":
      return "sky";
    case "failed":
      return "red";
    case "partial":
    case "unknown":
    default:
      return "amber";
  }
}

export function BenchmarkDetail({
  id,
  initialState,
  initialConsolidated,
}: {
  id: string;
  initialState: BenchmarkState | null;
  initialConsolidated: Consolidated | null;
}) {
  const [state, setState] = useState<BenchmarkState | null>(initialState);
  const [consolidated, setConsolidated] = useState<Consolidated | null>(initialConsolidated);
  const [logLines, setLogLines] = useState<string[]>([]);
  const [streamDone, setStreamDone] = useState(false);
  const [logOpen, setLogOpen] = useState(true);
  const logBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;

    (async () => {
      try {
        const iter = await rpc.benchmarks.watch({ id }, { signal: ac.signal });
        for await (const ev of iter) {
          if (cancelled) break;
          if (ev.type === "log") {
            setLogLines((prev) => {
              const next = [...prev, ev.line];
              return next.length > 1000 ? next.slice(-1000) : next;
            });
          } else if (ev.type === "state") {
            setState(ev.state as BenchmarkState);
          } else if (ev.type === "metrics") {
            setConsolidated((ev.consolidated as Consolidated | null) ?? null);
          } else if (ev.type === "done") {
            setStreamDone(true);
            break;
          } else if (ev.type === "error") {
            setStreamDone(true);
            break;
          }
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    })();

    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [id]);

  useEffect(() => {
    if (logOpen) {
      logBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [logLines, logOpen]);

  const status = deriveStatus(state);
  const isLive = !streamDone && status === "running";

  const total = state?.schedule?.length ?? 0;
  const completed = state?.completed_indices?.length ?? 0;
  const failed = state?.failed_indices?.length ?? 0;
  const finished = completed + failed;
  const pct = total > 0 ? Math.min(100, Math.round((finished / total) * 100)) : 0;

  const baseArgs = useMemo(() => Object.entries(state?.base_args ?? {}), [state?.base_args]);

  if (!state) {
    return (
      <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
        <Loader2 size={14} className="animate-spin" />
        Loading benchmark…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="font-mono text-lg font-semibold">{state.benchmark_id}</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {state.recipe_qualified_name}
          </p>
        </div>
        <div className="flex gap-2">
          {state.framework && <Badge tone="sky">{state.framework}</Badge>}
          <Badge tone={statusTone(status)}>
            {isLive && <Loader2 size={10} className="mr-1 animate-spin" />}
            {status}
          </Badge>
        </div>
      </div>

      {isLive && total > 0 && (
        <Card>
          <CardBody className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-medium">Progress</span>
              <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
                {finished} / {total}
                {failed > 0 && <span className="text-red-500"> ({failed} failed)</span>}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
              <div
                className="h-full bg-sky-500 transition-all dark:bg-sky-400"
                style={{ width: `${pct}%` }}
              />
            </div>
          </CardBody>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Run info</CardTitle>
          </CardHeader>
          <CardBody className="flex flex-col gap-2 text-sm">
            <Row label="Cluster" value={state.cluster_id ?? "—"} mono />
            <Row label="Started" value={fmtTime(state.created_at)} />
            <Row label="Updated" value={fmtTime(state.updated_at)} />
            <Row label="Sessions" value={String(state.session_count ?? 0)} />
            <Row
              label="Schedule"
              value={`${completed}/${total} completed${failed ? `, ${failed} failed` : ""}`}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Base args</CardTitle>
          </CardHeader>
          <CardBody className="flex flex-col gap-1 text-sm">
            {baseArgs.length === 0 && <span className="text-zinc-500 dark:text-zinc-400">—</span>}
            {baseArgs.map(([k, v]) => (
              <Row key={k} label={k} value={JSON.stringify(v)} mono />
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sessions</CardTitle>
          </CardHeader>
          <CardBody className="flex flex-col gap-2 text-sm">
            {state.sessions?.length ? (
              state.sessions.map((s) => (
                <div
                  key={s.session}
                  className="flex flex-col gap-0.5 rounded-md border border-zinc-200 px-2 py-1.5 dark:border-zinc-800"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs">#{s.session}</span>
                    <Badge tone={s.status === "completed" ? "green" : "amber"}>{s.status}</Badge>
                  </div>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {fmtTime(s.started_at)} → {fmtTime(s.ended_at)}
                  </span>
                </div>
              ))
            ) : (
              <span className="text-zinc-500 dark:text-zinc-400">—</span>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Throughput & latency</CardTitle>
        </CardHeader>
        <CardBody>
          {consolidated && consolidated.benchmarks.length > 0 ? (
            <BenchmarkCharts consolidated={consolidated} />
          ) : (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              No consolidated metrics yet.{" "}
              {failed > 0 && !isLive
                ? "Run failed before metrics were captured."
                : "Benchmark may still be running."}
            </p>
          )}
        </CardBody>
      </Card>

      {logLines.length > 0 && (
        <Card>
          <CardHeader>
            <button
              type="button"
              onClick={() => setLogOpen((v) => !v)}
              className="flex w-full items-center gap-2 text-left"
            >
              {logOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <CardTitle>Log ({logLines.length})</CardTitle>
            </button>
          </CardHeader>
          {logOpen && (
            <CardBody>
              <div className="max-h-96 overflow-auto rounded-lg bg-zinc-950 p-3 font-mono text-xs text-green-400">
                {logLines.map((line, i) => (
                  <div key={i} className="whitespace-pre-wrap">
                    {line}
                  </div>
                ))}
                <div ref={logBottomRef} />
              </div>
            </CardBody>
          )}
        </Card>
      )}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-2 text-sm">
      <span className="text-zinc-500 dark:text-zinc-400">{label}</span>
      <span className={mono ? "font-mono text-xs" : ""}>{value}</span>
    </div>
  );
}
