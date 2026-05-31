"use client";
import { useEffect, useState } from "react";
import { Cpu, MemoryStick, Server, Zap } from "lucide-react";
import { Card, CardBody } from "@/app/components/ui/Card";
import { rpc } from "@/lib/rpc/client";

type HostMetrics = Record<string, string | undefined>;
type Tick = { timestamp: number; hosts: Record<string, HostMetrics> };

const HISTORY = 40;

type Aggregate = {
  hostCount: number;
  cpuAvg: number;
  gpuAvg: number;
  memUsedGb: number;
  memTotalGb: number;
  gpuMemUsedGb: number;
  gpuMemTotalGb: number;
  powerW: number;
  jobsTotal: number;
};

function num(s: string | undefined): number {
  if (!s) return 0;
  const v = parseFloat(s);
  return Number.isFinite(v) ? v : 0;
}

function aggregate(tick: Tick | null): Aggregate {
  if (!tick) {
    return {
      hostCount: 0,
      cpuAvg: 0,
      gpuAvg: 0,
      memUsedGb: 0,
      memTotalGb: 0,
      gpuMemUsedGb: 0,
      gpuMemTotalGb: 0,
      powerW: 0,
      jobsTotal: 0,
    };
  }
  const hosts = Object.values(tick.hosts);
  let cpuSum = 0;
  let gpuSum = 0;
  let memUsed = 0;
  let memTotal = 0;
  let gpuMemUsed = 0;
  let gpuMemTotal = 0;
  let power = 0;
  let jobs = 0;
  for (const m of hosts) {
    cpuSum += num(m.cpu_usage_pct);
    gpuSum += num(m.gpu_util_pct);
    memUsed += num(m.mem_used_mb);
    memTotal += num(m.mem_total_mb);
    gpuMemUsed += num(m.gpu_mem_used_mb);
    gpuMemTotal += num(m.gpu_mem_total_mb);
    power += num(m.gpu_power_w);
    jobs += num(m.sparkrun_jobs);
  }
  const n = hosts.length || 1;
  return {
    hostCount: hosts.length,
    cpuAvg: cpuSum / n,
    gpuAvg: gpuSum / n,
    memUsedGb: memUsed / 1024,
    memTotalGb: memTotal / 1024,
    gpuMemUsedGb: gpuMemUsed / 1024,
    gpuMemTotalGb: gpuMemTotal / 1024,
    powerW: power,
    jobsTotal: jobs,
  };
}

export function AggregateStats() {
  const [tick, setTick] = useState<Tick | null>(null);
  const [hist, setHist] = useState<{ cpu: number[]; gpu: number[] }>({ cpu: [], gpu: [] });
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;
    (async () => {
      try {
        const iter = await rpc.monitor.stream({ intervalSec: 2 }, { signal: ac.signal });
        setConnected(true);
        for await (const next of iter) {
          if (cancelled) break;
          setTick(next as Tick);
          const agg = aggregate(next as Tick);
          setHist((prev) => ({
            cpu: push(prev.cpu, agg.cpuAvg),
            gpu: push(prev.gpu, agg.gpuAvg),
          }));
        }
      } catch (err) {
        if (!cancelled && !(err instanceof DOMException && err.name === "AbortError")) {
          console.error("[monitor.stream]", err);
        }
      } finally {
        if (!cancelled) setConnected(false);
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, []);

  const agg = aggregate(tick);
  const memPct = agg.memTotalGb ? (agg.memUsedGb / agg.memTotalGb) * 100 : 0;
  const gpuMemPct = agg.gpuMemTotalGb ? (agg.gpuMemUsedGb / agg.gpuMemTotalGb) * 100 : 0;

  return (
    <Card>
      <CardBody className="p-5">
        <div className="mb-4 flex items-baseline justify-between">
          <div className="flex items-center gap-2">
            <Server size={14} className="text-zinc-500" />
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Cluster overview
            </span>
            <span className="text-xs text-zinc-500">
              · {agg.hostCount || "—"} host{agg.hostCount === 1 ? "" : "s"} ·{" "}
              {agg.jobsTotal} job{agg.jobsTotal === 1 ? "" : "s"}
            </span>
          </div>
          <span
            className={
              "inline-flex h-2 w-2 rounded-full " +
              (connected ? "bg-emerald-500 animate-pulse" : "bg-zinc-300")
            }
            title={connected ? "live" : "reconnecting"}
          />
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Stat
            icon={<Cpu size={14} />}
            tone="sky"
            label="CPU"
            value={`${agg.cpuAvg.toFixed(1)}%`}
            sub={`avg across ${agg.hostCount || 0}`}
            pct={agg.cpuAvg}
            spark={hist.cpu}
          />
          <Stat
            icon={<Zap size={14} />}
            tone="purple"
            label="GPU"
            value={`${agg.gpuAvg.toFixed(0)}%`}
            sub={`avg across ${agg.hostCount || 0}`}
            pct={agg.gpuAvg}
            spark={hist.gpu}
          />
          <Stat
            icon={<MemoryStick size={14} />}
            tone="green"
            label="Memory"
            value={`${agg.memUsedGb.toFixed(0)} / ${agg.memTotalGb.toFixed(0)} GB`}
            sub={`${memPct.toFixed(0)}% used`}
            pct={memPct}
          />
          <Stat
            icon={<Zap size={14} />}
            tone="amber"
            label="Power"
            value={`${agg.powerW.toFixed(1)} W`}
            sub={
              agg.gpuMemTotalGb
                ? `GPU mem ${agg.gpuMemUsedGb.toFixed(0)}/${agg.gpuMemTotalGb.toFixed(0)} GB`
                : "total GPU draw"
            }
            pct={gpuMemPct}
          />
        </div>
      </CardBody>
    </Card>
  );
}

function push(arr: number[], v: number): number[] {
  const next = arr.concat(v);
  return next.length > HISTORY ? next.slice(-HISTORY) : next;
}

const toneBg: Record<string, string> = {
  sky: "bg-sky-500 dark:bg-sky-400",
  purple: "bg-purple-500 dark:bg-purple-400",
  green: "bg-emerald-500 dark:bg-emerald-400",
  amber: "bg-amber-500 dark:bg-amber-400",
};
const toneStroke: Record<string, string> = {
  sky: "stroke-sky-500 dark:stroke-sky-400",
  purple: "stroke-purple-500 dark:stroke-purple-400",
  green: "stroke-emerald-500 dark:stroke-emerald-400",
  amber: "stroke-amber-500 dark:stroke-amber-400",
};
const toneText: Record<string, string> = {
  sky: "text-sky-600 dark:text-sky-400",
  purple: "text-purple-600 dark:text-purple-400",
  green: "text-emerald-600 dark:text-emerald-400",
  amber: "text-amber-600 dark:text-amber-400",
};

function Stat({
  icon,
  label,
  value,
  sub,
  pct,
  tone,
  spark,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  pct: number;
  tone: string;
  spark?: number[];
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <div className={`flex items-center gap-1.5 text-xs font-medium ${toneText[tone]}`}>
          {icon}
          {label}
        </div>
        {spark && spark.length > 2 && <Sparkline values={spark} className={toneStroke[tone]} />}
      </div>
      <div className="font-mono text-xl font-semibold text-zinc-900 dark:text-zinc-100">
        {value}
      </div>
      <div className="h-1.5 overflow-hidden rounded bg-zinc-100 dark:bg-zinc-800">
        <div
          className={`${toneBg[tone]} h-full transition-all duration-300`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <div className="text-[11px] text-zinc-500 dark:text-zinc-400">{sub}</div>
    </div>
  );
}

function Sparkline({ values, className }: { values: number[]; className: string }) {
  const w = 56;
  const h = 16;
  const max = Math.max(100, ...values);
  const step = w / Math.max(1, values.length - 1);
  const path = values
    .map((v, i) => `${i === 0 ? "M" : "L"} ${i * step} ${h - (v / max) * h}`)
    .join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="flex-shrink-0">
      <path d={path} fill="none" strokeWidth={1.25} className={className} />
    </svg>
  );
}
