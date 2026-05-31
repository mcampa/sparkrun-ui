"use client";
import { useEffect, useState } from "react";
import { rpc } from "@/lib/rpc/client";
import type { ClusterStatus } from "@/lib/schemas";
import { Card, CardBody } from "@/app/components/ui/Card";
import { Badge } from "@/app/components/ui/Badge";
import { WorkloadCard } from "./WorkloadCard";
import { AggregateStats } from "./AggregateStats";

export function DashboardLive({ initial }: { initial: ClusterStatus }) {
  const [status, setStatus] = useState<ClusterStatus>(initial);
  const [connected, setConnected] = useState(true);

  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;
    (async () => {
      try {
        const iter = await rpc.status.stream({ intervalMs: 3000 }, { signal: ac.signal });
        for await (const next of iter) {
          if (cancelled) break;
          setStatus(next);
          setConnected(true);
        }
      } catch (err) {
        if (!cancelled) setConnected(false);
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          console.error("[status.stream]", err);
        }
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <div className="flex items-center gap-2 text-sm">
          <Badge tone="sky">
            {status.host_count} host{status.host_count === 1 ? "" : "s"}
          </Badge>
          <Badge tone="green">{status.total_containers} running</Badge>
          <Badge tone={connected ? "neutral" : "amber"}>
            {connected ? "live" : "reconnecting…"}
          </Badge>
        </div>
      </div>

      <AggregateStats />

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Workloads</h2>
        {status.solo_entries.length === 0 ? (
          <Card>
            <CardBody className="text-sm text-zinc-500 dark:text-zinc-400">
              No workloads are currently running.
            </CardBody>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {status.solo_entries.map((w) => (
              <WorkloadCard key={w.cluster_id} workload={w} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
