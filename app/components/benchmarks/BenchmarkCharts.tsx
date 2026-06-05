"use client";
import {
  CartesianGrid,
  ErrorBar,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Consolidated, ConsolidatedRow } from "@/lib/state";

const THROUGHPUT_METRICS = [
  { key: "tg_throughput", label: "TG", color: "#0ea5e9" },
  { key: "pp_throughput", label: "PP", color: "#a855f7" },
  { key: "peak_throughput", label: "Peak", color: "#f59e0b" },
] as const;

const LATENCY_METRICS = [
  { key: "ttfr", label: "TTFR", color: "#10b981" },
  { key: "est_ppt", label: "Est PPT", color: "#ef4444" },
] as const;

type MetricKey =
  | (typeof THROUGHPUT_METRICS)[number]["key"]
  | (typeof LATENCY_METRICS)[number]["key"];

type ChartPoint = { concurrency: number } & Partial<Record<MetricKey | `${MetricKey}_std`, number>>;

function buildPoints(rows: ConsolidatedRow[]): ChartPoint[] {
  return [...rows]
    .sort((a, b) => a.concurrency - b.concurrency)
    .map((r) => {
      const p: ChartPoint = { concurrency: r.concurrency };
      for (const { key } of [...THROUGHPUT_METRICS, ...LATENCY_METRICS]) {
        const m = r[key];
        if (m) {
          p[key] = m.mean;
          p[`${key}_std`] = m.std;
        }
      }
      return p;
    });
}

export function BenchmarkCharts({ consolidated }: { consolidated: Consolidated | null }) {
  if (!consolidated || !consolidated.benchmarks.length) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">No consolidated metrics yet.</p>;
  }

  const points = buildPoints(consolidated.benchmarks);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Throughput vs concurrency" unit="tok/s">
          <MetricsChart points={points} metrics={THROUGHPUT_METRICS} />
        </ChartCard>
        <ChartCard title="Latency vs concurrency" unit="ms">
          <MetricsChart points={points} metrics={LATENCY_METRICS} />
        </ChartCard>
      </div>
      <SummaryTable rows={consolidated.benchmarks} />
    </div>
  );
}

function ChartCard({
  title,
  unit,
  children,
}: {
  title: string;
  unit: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium">{title}</span>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">{unit}</span>
      </div>
      <div className="h-72 w-full">{children}</div>
    </div>
  );
}

function MetricsChart({
  points,
  metrics,
}: {
  points: ChartPoint[];
  metrics: readonly { key: MetricKey; label: string; color: string }[];
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={points} margin={{ top: 8, right: 16, bottom: 4, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-800" />
        <XAxis
          dataKey="concurrency"
          type="number"
          domain={["dataMin", "dataMax"]}
          tick={{ fontSize: 11 }}
          className="fill-zinc-500 dark:fill-zinc-400"
          label={{ value: "concurrency", position: "insideBottom", offset: -2, fontSize: 11 }}
        />
        <YAxis tick={{ fontSize: 11 }} className="fill-zinc-500 dark:fill-zinc-400" />
        <Tooltip
          contentStyle={{
            fontSize: 12,
            background: "var(--tooltip-bg, white)",
            border: "1px solid #e4e4e7",
            borderRadius: 6,
          }}
          formatter={(value) => (typeof value === "number" ? value.toFixed(2) : String(value))}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {metrics.map((m) => (
          <Line
            key={m.key}
            type="monotone"
            dataKey={m.key}
            name={m.label}
            stroke={m.color}
            strokeWidth={2}
            dot={{ r: 3 }}
            isAnimationActive={false}
          >
            <ErrorBar dataKey={`${m.key}_std`} stroke={m.color} strokeOpacity={0.5} width={6} />
          </Line>
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

function fmt(v: number | undefined): string {
  if (v === undefined) return "—";
  if (Math.abs(v) < 10) return v.toFixed(2);
  if (Math.abs(v) < 1000) return v.toFixed(1);
  return Math.round(v).toLocaleString();
}

function MetricCell({ mean, std }: { mean?: number; std?: number }) {
  if (mean === undefined) return <span className="text-zinc-400">—</span>;
  return (
    <span>
      {fmt(mean)}
      {std !== undefined && std > 0 && <span className="text-zinc-400"> ± {fmt(std)}</span>}
    </span>
  );
}

function SummaryTable({ rows }: { rows: ConsolidatedRow[] }) {
  const sorted = [...rows].sort((a, b) => a.concurrency - b.concurrency);
  return (
    <div className="overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-800">
      <table className="w-full text-xs">
        <thead className="bg-zinc-50 dark:bg-zinc-900">
          <tr className="text-left">
            <th className="px-3 py-2 font-medium">concurrency</th>
            <th className="px-3 py-2 font-medium">prompt/response</th>
            <th className="px-3 py-2 font-medium">TG (tok/s)</th>
            <th className="px-3 py-2 font-medium">PP (tok/s)</th>
            <th className="px-3 py-2 font-medium">Peak (tok/s)</th>
            <th className="px-3 py-2 font-medium">TTFR (ms)</th>
            <th className="px-3 py-2 font-medium">Est PPT (ms)</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.concurrency} className="border-t border-zinc-200 dark:border-zinc-800">
              <td className="px-3 py-2 font-mono">{r.concurrency}</td>
              <td className="px-3 py-2 font-mono text-zinc-500 dark:text-zinc-400">
                {r.prompt_size}/{r.response_size}
              </td>
              <td className="px-3 py-2">
                <MetricCell mean={r.tg_throughput?.mean} std={r.tg_throughput?.std} />
              </td>
              <td className="px-3 py-2">
                <MetricCell mean={r.pp_throughput?.mean} std={r.pp_throughput?.std} />
              </td>
              <td className="px-3 py-2">
                <MetricCell mean={r.peak_throughput?.mean} std={r.peak_throughput?.std} />
              </td>
              <td className="px-3 py-2">
                <MetricCell mean={r.ttfr?.mean} std={r.ttfr?.std} />
              </td>
              <td className="px-3 py-2">
                <MetricCell mean={r.est_ppt?.mean} std={r.est_ppt?.std} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
