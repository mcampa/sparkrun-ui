"use client";
import { useEffect, useRef, useState } from "react";
import { Card, CardBody } from "@/app/components/ui/Card";
import { Badge } from "@/app/components/ui/Badge";
import { rpc } from "@/lib/rpc/client";
import { HostCard, type HostHistory, type HostMetrics } from "./HostCard";

const HISTORY_LIMIT = 30;

type Tick = { timestamp: number; hosts: Record<string, HostMetrics> };

function num(s: string | undefined): number {
  if (s == null || s === "") return 0;
  const v = parseFloat(s);
  return Number.isFinite(v) ? v : 0;
}

export function MonitorLive() {
  const [tick, setTick] = useState<Tick | null>(null);
  const [connected, setConnected] = useState(false);
  const history = useRef<Record<string, HostHistory>>({});

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
          for (const [host, m] of Object.entries(next.hosts)) {
            const h = history.current[host] ?? { cpu: [], gpu: [], mem: [], power: [] };
            h.cpu = push(h.cpu, num((m as HostMetrics).cpu_usage_pct));
            h.gpu = push(h.gpu, num((m as HostMetrics).gpu_util_pct));
            h.mem = push(h.mem, num((m as HostMetrics).mem_used_pct));
            h.power = push(h.power, num((m as HostMetrics).gpu_power_w));
            history.current[host] = h;
          }
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

  const hosts = tick ? Object.entries(tick.hosts) : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Cluster monitor</h1>
        <div className="flex items-center gap-2">
          <Badge tone={connected ? "green" : "amber"}>{connected ? "live" : "reconnecting…"}</Badge>
          {tick && <Badge tone="neutral">{hosts.length} host{hosts.length === 1 ? "" : "s"}</Badge>}
        </div>
      </div>

      {!tick ? (
        <Card>
          <CardBody className="text-sm text-zinc-500 dark:text-zinc-400">
            Waiting for first monitor sample…
          </CardBody>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {hosts.map(([host, metrics]) => (
            <HostCard
              key={host}
              host={host}
              metrics={metrics}
              history={history.current[host] ?? { cpu: [], gpu: [], mem: [], power: [] }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function push(arr: number[], v: number): number[] {
  const next = arr.concat(v);
  return next.length > HISTORY_LIMIT ? next.slice(-HISTORY_LIMIT) : next;
}
