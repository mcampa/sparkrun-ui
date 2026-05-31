import type { ConsolidatedRow } from "@/lib/state";

type MetricKey = "tg_throughput" | "pp_throughput" | "ttfr" | "peak_throughput";

const METRICS: { key: MetricKey; label: string; unit: string }[] = [
  { key: "tg_throughput", label: "Token gen throughput", unit: "tok/s" },
  { key: "pp_throughput", label: "Prompt processing throughput", unit: "tok/s" },
  { key: "peak_throughput", label: "Peak throughput", unit: "tok/s" },
  { key: "ttfr", label: "Time to first response", unit: "ms" },
];

const BAR_W = 44;
const GAP = 28;
const TOP = 20;
const BOTTOM = 28;
const CHART_H = 140;

export function BenchmarkChart({ rows }: { rows: ConsolidatedRow[] }) {
  if (!rows.length) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">No consolidated metrics yet.</p>;
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
  const svgW = values.length * (BAR_W + GAP) + GAP;

  return (
    <div className="flex flex-col gap-2 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">{unit}</span>
      </div>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${svgW} ${CHART_H + TOP + BOTTOM}`}
          width={svgW}
          height={CHART_H + TOP + BOTTOM}
          className="mx-auto max-w-full"
          role="img"
          aria-label={`${label} chart`}
        >
          <line
            x1={GAP / 2}
            y1={TOP}
            x2={GAP / 2}
            y2={TOP + CHART_H}
            className="stroke-zinc-300 dark:stroke-zinc-700"
            strokeWidth={1}
          />
          <line
            x1={GAP / 2}
            y1={TOP + CHART_H}
            x2={svgW}
            y2={TOP + CHART_H}
            className="stroke-zinc-300 dark:stroke-zinc-700"
            strokeWidth={1}
          />

          {values.map((v, i) => {
            const barH = max > 0 ? (v.mean / max) * CHART_H : 0;
            const errH = max > 0 ? (v.std / max) * CHART_H : 0;
            const x = GAP + i * (BAR_W + GAP);
            const barY = TOP + CHART_H - barH;

            return (
              <g key={i}>
                <rect
                  x={x}
                  y={barY}
                  width={BAR_W}
                  height={Math.max(barH, 0.5)}
                  rx={3}
                  className="fill-sky-500 dark:fill-sky-400"
                />
                {errH > 1 && (
                  <>
                    <line
                      x1={x + BAR_W / 2}
                      x2={x + BAR_W / 2}
                      y1={barY - errH}
                      y2={barY + barH + errH}
                      className="stroke-zinc-700 dark:stroke-zinc-200"
                      strokeWidth={1.5}
                    />
                    <line
                      x1={x + BAR_W / 2 - 4}
                      x2={x + BAR_W / 2 + 4}
                      y1={barY - errH}
                      y2={barY - errH}
                      className="stroke-zinc-700 dark:stroke-zinc-200"
                      strokeWidth={1}
                    />
                    <line
                      x1={x + BAR_W / 2 - 4}
                      x2={x + BAR_W / 2 + 4}
                      y1={barY + barH + errH}
                      y2={barY + barH + errH}
                      className="stroke-zinc-700 dark:stroke-zinc-200"
                      strokeWidth={1}
                    />
                  </>
                )}
                <text
                  x={x + BAR_W / 2}
                  y={TOP + CHART_H + 16}
                  textAnchor="middle"
                  className="fill-zinc-500 text-[10px] dark:fill-zinc-400"
                >
                  c={v.concurrency}
                </text>
                <text
                  x={x + BAR_W / 2}
                  y={barY - errH - 6}
                  textAnchor="middle"
                  className="fill-zinc-700 text-[10px] font-medium dark:fill-zinc-200"
                >
                  {v.mean < 10 ? v.mean.toFixed(1) : Math.round(v.mean)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
