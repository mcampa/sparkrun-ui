"use client";
import { Cpu, Server, Thermometer, Zap } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle, CardDescription } from "@/app/components/ui/Card";
import { Badge } from "@/app/components/ui/Badge";

export type HostHistory = {
  cpu: number[];
  gpu: number[];
  mem: number[];
  power: number[];
};

export type HostMetrics = Record<string, string | undefined>;

function num(s: string | undefined): number | null {
  if (s == null || s === "") return null;
  const v = parseFloat(s);
  return Number.isFinite(v) ? v : null;
}

export function HostCard({
  host,
  metrics,
  history,
}: {
  host: string;
  metrics: HostMetrics;
  history: HostHistory;
}) {
  const cpu = num(metrics.cpu_usage_pct) ?? 0;
  const gpu = num(metrics.gpu_util_pct) ?? 0;
  const memUsed = num(metrics.mem_used_mb) ?? 0;
  const memTotal = num(metrics.mem_total_mb) ?? 1;
  const memPct = (memUsed / memTotal) * 100;
  const gpuMemUsed = num(metrics.gpu_mem_used_mb);
  const gpuMemTotal = num(metrics.gpu_mem_total_mb);
  const gpuMemPct = gpuMemUsed != null && gpuMemTotal ? (gpuMemUsed / gpuMemTotal) * 100 : null;
  const cpuTemp = num(metrics.cpu_temp_c);
  const gpuTemp = num(metrics.gpu_temp_c);
  const power = num(metrics.gpu_power_w);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Server size={16} className="text-zinc-500" />
          {host}
        </CardTitle>
        <CardDescription>
          {metrics.hostname} · {metrics.gpu_name ?? "—"}
        </CardDescription>
      </CardHeader>
      <CardBody className="flex flex-col gap-3">
        <Meter
          label="CPU"
          pct={cpu}
          history={history.cpu}
          icon={<Cpu size={14} />}
          tone="sky"
          right={cpuTemp != null && `${cpuTemp.toFixed(1)}°C`}
        />
        <Meter
          label="GPU"
          pct={gpu}
          history={history.gpu}
          icon={<Zap size={14} />}
          tone="purple"
          right={gpuTemp != null && `${gpuTemp.toFixed(0)}°C`}
        />
        <Meter
          label="Memory"
          pct={memPct}
          history={history.mem}
          icon={<Thermometer size={14} />}
          tone="green"
          right={`${(memUsed / 1024).toFixed(1)}/${(memTotal / 1024).toFixed(0)} GB`}
        />
        {gpuMemPct != null && (
          <Meter
            label="GPU memory"
            pct={gpuMemPct}
            history={[]}
            icon={<Zap size={14} />}
            tone="amber"
            right={
              gpuMemUsed != null && gpuMemTotal
                ? `${(gpuMemUsed / 1024).toFixed(1)}/${(gpuMemTotal / 1024).toFixed(0)} GB`
                : null
            }
          />
        )}
        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-zinc-500 dark:text-zinc-400">
          {power != null && <Badge tone="neutral">{power.toFixed(1)} W</Badge>}
          {metrics.sparkrun_jobs && metrics.sparkrun_jobs !== "0" && (
            <Badge tone="sky">
              {metrics.sparkrun_jobs} job{metrics.sparkrun_jobs === "1" ? "" : "s"}
            </Badge>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

const toneColors = {
  sky: "text-sky-500 dark:text-sky-400",
  purple: "text-purple-500 dark:text-purple-400",
  green: "text-emerald-500 dark:text-emerald-400",
  amber: "text-amber-500 dark:text-amber-400",
};

function Meter({
  label,
  pct,
  history,
  icon,
  tone,
  right,
}: {
  label: string;
  pct: number;
  history: number[];
  icon: React.ReactNode;
  tone: keyof typeof toneColors;
  right?: React.ReactNode;
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
          {icon}
          {label}
        </span>
        <span className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
          {right}
          <span className="font-mono text-zinc-700 dark:text-zinc-200">{clamped.toFixed(0)}%</span>
        </span>
      </div>
      <div className="flex items-center gap-2">
        <div className="h-2 flex-1 overflow-hidden rounded bg-zinc-200 dark:bg-zinc-800">
          <div
            className={
              "h-full transition-all duration-300 " +
              (tone === "sky"
                ? "bg-sky-500 dark:bg-sky-400"
                : tone === "purple"
                  ? "bg-purple-500 dark:bg-purple-400"
                  : tone === "green"
                    ? "bg-emerald-500 dark:bg-emerald-400"
                    : "bg-amber-500 dark:bg-amber-400")
            }
            style={{ width: `${clamped}%` }}
          />
        </div>
        {history.length > 2 && <Sparkline values={history} className={toneColors[tone]} />}
      </div>
    </div>
  );
}

function Sparkline({ values, className }: { values: number[]; className: string }) {
  if (values.length < 2) return null;
  const w = 80;
  const h = 16;
  const max = Math.max(100, ...values);
  const step = w / Math.max(1, values.length - 1);
  const points = values.map((v, i) => `${i * step},${h - (v / max) * h}`);
  const lastX = (values.length - 1) * step;
  // Area path properly closed along the baseline. Without the explicit
  // `L lastX,h L 0,h Z` SVG implicitly closes back to the first point,
  // producing a diagonal slash through the chart.
  const areaPath = `M 0,${h} L ${points.join(" L ")} L ${lastX},${h} Z`;
  const linePath = `M ${points.join(" L ")}`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className={`flex-shrink-0 ${className}`}>
      <path d={areaPath} fill="currentColor" stroke="none" opacity={0.35} />
      <path d={linePath} fill="none" stroke="currentColor" strokeWidth={1} />
    </svg>
  );
}
