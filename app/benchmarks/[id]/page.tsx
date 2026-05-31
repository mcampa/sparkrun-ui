import { notFound } from "next/navigation";
import { serverClient } from "@/lib/rpc/server";
import { Card, CardBody, CardHeader, CardTitle } from "@/app/components/ui/Card";
import { Badge } from "@/app/components/ui/Badge";
import { BenchmarkChart } from "@/app/components/benchmarks/BenchmarkChart";
import type { BenchmarkState, Consolidated } from "@/lib/state";

export const dynamic = "force-dynamic";

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default async function BenchmarkPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await serverClient.benchmarks.get({ id });
  if (!data) notFound();

  const state = data.state as BenchmarkState;
  const consolidated = data.consolidated as Consolidated | null;
  const lastSession = state.sessions?.[state.sessions.length - 1];

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
          {lastSession?.status && (
            <Badge tone={lastSession.status === "completed" ? "green" : "amber"}>
              {lastSession.status}
            </Badge>
          )}
        </div>
      </div>

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
              value={`${state.completed_indices?.length ?? 0}/${state.schedule?.length ?? 0} completed${
                state.failed_indices?.length ? `, ${state.failed_indices.length} failed` : ""
              }`}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Base args</CardTitle>
          </CardHeader>
          <CardBody className="flex flex-col gap-1 text-sm">
            {Object.entries(state.base_args ?? {}).map(([k, v]) => (
              <Row key={k} label={k} value={JSON.stringify(v)} mono />
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sessions</CardTitle>
          </CardHeader>
          <CardBody className="flex flex-col gap-2 text-sm">
            {state.sessions?.map((s) => (
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
            ))}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Throughput & latency</CardTitle>
        </CardHeader>
        <CardBody>
          {consolidated && consolidated.benchmarks.length > 0 ? (
            <BenchmarkChart rows={consolidated.benchmarks} />
          ) : (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              No consolidated metrics yet. {state.failed_indices?.length ? "Run failed before metrics were captured." : "Benchmark may still be running."}
            </p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between gap-2 text-sm">
      <span className="text-zinc-500 dark:text-zinc-400">{label}</span>
      <span className={mono ? "font-mono text-xs" : ""}>{value}</span>
    </div>
  );
}
