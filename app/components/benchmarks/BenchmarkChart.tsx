import type { ConsolidatedRow } from "@/lib/state";

type MetricKey = "tg_throughput" | "pp_throughput" | "ttfr" | "peak_throughput";

const METRICS: { key: MetricKey; label: string; unit: string }[] = [
  { key: "tg_throughput", label: "Token gen throughput", unit: "tok/s" },
  { key: "pp_throughput", label: "Prompt processing throughput", unit: "tok/s" },
  { key: "peak_throughput", label: "Peak throughput", unit: "tok/s" },
  { key: "ttfr", label: "Time to first response", unit: "ms" },
];

export function BenchmarkChart({ rows }: { rows: ConsolidatedRow[] }) {
  if (!rows.length) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        No consolidated metrics yet.
      </p>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {METRICS.map(({ key, label, unit }) => (
        <Bars key={key} rows={rows} metric={key} label={label} unit={unit} />
      ))}
    </div>
  );
}

function Bars({
  rows,
  metric,
  label,
  unit,
}: {
  rows: ConsolidatedRow[];
  metric: MetricKey;
  label: string;
  unit: string;
}) {
  const values = rows.map((r) => ({
    concurrency: r.concurrency,
    mean: r[metric]?.mean ?? 0,
    std: r[metric]?.std ?? 0,
  }));
  const max = Math.max(...values.map((v) => v.mean + v.std), 1);
  return (
    <div className="flex flex-col gap-2 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">{unit}</span>
      </div>
      <svg viewBox={`0 0 ${values.length * 60} 140`} className="w-full" preserveAspectRatio="none">
        {values.map((v, i) => {
          const h = (v.mean / max) * 100;
          const errH = (v.std / max) * 100;
          const x = i * 60 + 10;
          return (
            <g key={i}>
              <rect
                x={x}
                y={120 - h}
                width={40}
                height={h}
                className="fill-sky-500 dark:fill-sky-400"
              />
              {errH > 1 && (
                <line
                  x1={x + 20}
                  x2={x + 20}
                  y1={120 - h - errH}
                  y2={120 - h + errH}
                  className="stroke-zinc-700 dark:stroke-zinc-200"
                  strokeWidth={1.5}
                />
              )}
              <text
                x={x + 20}
                y={135}
                textAnchor="middle"
                className="fill-zinc-500 text-[9px]"
              >
                c={v.concurrency}
              </text>
              <text
                x={x + 20}
                y={120 - h - errH - 4}
                textAnchor="middle"
                className="fill-zinc-700 text-[9px] font-medium dark:fill-zinc-200"
              >
                {v.mean < 10 ? v.mean.toFixed(1) : Math.round(v.mean)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
