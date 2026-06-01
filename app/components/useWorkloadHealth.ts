"use client";
import { useEffect, useState } from "react";
import { rpc } from "@/lib/rpc/client";
import type { Health } from "@/lib/rpc/procedures/workloads";

export type WorkloadHealth = Health | { ready: false; state: "loading"; reason?: string };

// Poll the workload's readiness endpoint until it reports ready, then keep
// polling so we catch the workload going unhealthy.
export function useWorkloadHealth(clusterId: string | null | undefined): WorkloadHealth {
  const [polled, setPolled] = useState<Health | null>(null);
  const [prevId, setPrevId] = useState<string | null | undefined>(clusterId);

  // Reset polled state when the tracked cluster changes (docs-blessed
  // "adjusting state during render" pattern).
  if (clusterId !== prevId) {
    setPrevId(clusterId);
    setPolled(null);
  }

  useEffect(() => {
    if (!clusterId) return;
    let cancelled = false;
    const ac = new AbortController();

    const tick = async () => {
      try {
        const res = await rpc.workloads.health({ clusterId }, { signal: ac.signal });
        if (!cancelled) setPolled(res);
      } catch {
        // Network blip — keep the last known state.
      }
    };

    void tick();
    const interval = setInterval(tick, 5000);
    return () => {
      cancelled = true;
      ac.abort();
      clearInterval(interval);
    };
  }, [clusterId]);

  return polled ?? { ready: false, state: "loading" };
}
