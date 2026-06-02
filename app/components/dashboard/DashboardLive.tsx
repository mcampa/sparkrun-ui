"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Rocket } from "lucide-react";
import { rpc } from "@/lib/rpc/client";
import type { ClusterStatus } from "@/lib/schemas";
import type { RunningRecipeDisplay } from "@/lib/runningRecipes";
import { Card, CardBody } from "@/app/components/ui/Card";
import { Badge } from "@/app/components/ui/Badge";
import { Button } from "@/app/components/ui/Button";
import { WorkloadCard } from "./WorkloadCard";
import { AggregateStats } from "./AggregateStats";

function formatHostError(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "message" in value) {
    return String((value as { message: unknown }).message);
  }
  return JSON.stringify(value);
}

export function DashboardLive({
  initial,
  recipeByCluster,
}: {
  initial: ClusterStatus;
  recipeByCluster: Map<string, RunningRecipeDisplay>;
}) {
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

      {Object.keys(status.errors).length > 0 && (
        <Card className="border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40">
          <CardBody className="flex gap-3">
            <AlertTriangle
              className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400"
              size={18}
            />
            <div className="flex flex-col gap-1 text-sm">
              <h3 className="font-medium text-amber-900 dark:text-amber-200">
                Cluster status reported errors
              </h3>
              <ul className="flex flex-col gap-1 text-amber-800 dark:text-amber-300">
                {Object.entries(status.errors).map(([host, err]) => (
                  <li key={host} className="font-mono text-xs">
                    <span className="font-semibold">{host}:</span> {formatHostError(err)}
                  </li>
                ))}
              </ul>
            </div>
          </CardBody>
        </Card>
      )}

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Workloads</h2>
        {status.solo_entries.length === 0 ? (
          <Card>
            <CardBody className="flex flex-col items-center gap-4 py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-50 text-sky-600 dark:bg-sky-950 dark:text-sky-400">
                <Rocket size={22} />
              </div>
              <div className="flex flex-col gap-1">
                <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  No workloads running
                </h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Launch a recipe to start an inference workload on your cluster.
                </p>
              </div>
              <Link href="/launch">
                <Button variant="primary">
                  <Rocket size={14} />
                  Launch a recipe
                </Button>
              </Link>
            </CardBody>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {status.solo_entries.map((w) => (
              <WorkloadCard
                key={w.cluster_id}
                workload={w}
                recipe={recipeByCluster.get(w.cluster_id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
