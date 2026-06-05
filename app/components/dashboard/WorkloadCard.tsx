"use client";
import { useState, useTransition } from "react";
import { Gauge, MessageSquare, Square, ScrollText, Loader2 } from "lucide-react";
import Link from "next/link";
import { Card, CardBody, CardHeader, CardTitle } from "@/app/components/ui/Card";
import { Button } from "@/app/components/ui/Button";
import { AlertDialog } from "@/app/components/ui/Dialog";
import { toast } from "@/app/components/ui/Toast";
import { rpc } from "@/lib/rpc/client";
import { RecipeShowDialog } from "@/app/components/recipes/RecipeShowDialog";
import { useWorkloadHealth } from "@/app/components/useWorkloadHealth";
import type { Workload } from "@/lib/schemas";
import type { RunningRecipeDisplay } from "@/lib/runningRecipes";
import { parseWorkloadUptime } from "@/lib/workloadStatus";

export function WorkloadCard({
  workload,
  recipe,
}: {
  workload: Workload;
  recipe?: RunningRecipeDisplay;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [recipeOpen, setRecipeOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const health = useWorkloadHealth(workload.cluster_id);

  const label = workload.meta.model || workload.meta.recipe || workload.cluster_id;
  const uptime = parseWorkloadUptime(workload.status);
  const recipeShowKey = recipe?.registeredName ?? workload.meta.recipe;

  const handleStop = () => {
    startTransition(async () => {
      try {
        await rpc.workloads.stop({ clusterId: workload.cluster_id });
        toast.success("Stop requested", `${label} is shutting down`);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        toast.error("Stop failed", message);
      }
    });
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">{label}</CardTitle>
        </CardHeader>
        <CardBody className="flex flex-col gap-3 text-sm">
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
            {recipe && (
              <>
                <dt className="text-zinc-500 dark:text-zinc-400">Recipe</dt>
                <dd>
                  {recipeShowKey ? (
                    <button
                      type="button"
                      onClick={() => setRecipeOpen(true)}
                      className="cursor-pointer font-medium text-sky-600 hover:underline dark:text-sky-400"
                    >
                      {recipe.label}
                    </button>
                  ) : (
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">
                      {recipe.label}
                    </span>
                  )}
                </dd>
              </>
            )}
            {workload.meta.port && (
              <>
                <dt className="text-zinc-500 dark:text-zinc-400">Port</dt>
                <dd className="font-mono text-zinc-700 dark:text-zinc-300">{workload.meta.port}</dd>
              </>
            )}
            {workload.host && (
              <>
                <dt className="text-zinc-500 dark:text-zinc-400">Host</dt>
                <dd className="font-mono text-zinc-700 dark:text-zinc-300">{workload.host}</dd>
              </>
            )}
            {uptime && (
              <>
                <dt className="text-zinc-500 dark:text-zinc-400">Uptime</dt>
                <dd className="text-zinc-700 dark:text-zinc-300">{uptime}</dd>
              </>
            )}
            <dt className="text-zinc-500 dark:text-zinc-400">Status</dt>
            <dd>
              <ReadyBadge health={health} containerStatus={workload.status} />
            </dd>
          </dl>
          <div className="flex justify-end gap-2 pt-2">
            {workload.host && workload.meta.port && (
              <Link href={`/chat?clusterId=${encodeURIComponent(workload.cluster_id)}`}>
                <Button variant="ghost" size="sm">
                  <MessageSquare size={14} />
                  Chat
                </Button>
              </Link>
            )}
            <Link href={`/logs/${workload.cluster_id}`}>
              <Button variant="ghost" size="sm">
                <ScrollText size={14} />
                Logs
              </Button>
            </Link>
            <Link href={buildBenchmarkHref(recipe)}>
              <Button variant="ghost" size="sm">
                <Gauge size={14} />
                Benchmark
              </Button>
            </Link>
            <Button
              variant="danger"
              size="sm"
              onClick={() => setConfirmOpen(true)}
              disabled={isPending}
            >
              <Square size={14} />
              {isPending ? "Stopping…" : "Stop"}
            </Button>
          </div>
        </CardBody>
      </Card>
      <AlertDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Stop this workload?"
        description={
          <>
            <span className="block font-mono">{label}</span>
            <span className="mt-2 block">
              The container will be terminated on {workload.host ?? "the target host"}.
            </span>
          </>
        }
        confirmLabel="Stop"
        destructive
        onConfirm={handleStop}
      />
      {recipe && recipeShowKey && (
        <RecipeShowDialog
          name={recipeShowKey}
          title={recipe.label}
          open={recipeOpen}
          onOpenChange={(o) => !o && setRecipeOpen(false)}
          showLaunch={false}
        />
      )}
    </>
  );
}

function buildBenchmarkHref(recipe?: RunningRecipeDisplay): string {
  const name = recipe?.registeredName ?? recipe?.label;
  const params = new URLSearchParams();
  if (name) params.set("recipe", name);
  params.set("skipRun", "1");
  return `/benchmarks/new?${params.toString()}`;
}

function ReadyBadge({
  health,
  containerStatus,
}: {
  health: ReturnType<typeof useWorkloadHealth>;
  containerStatus?: string;
}) {
  if (health.ready) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        <span className="text-zinc-700 dark:text-zinc-300">Ready</span>
      </span>
    );
  }
  if (health.state === "loading") {
    // First probe in flight — show the docker status if we have it so the
    // card isn't blank during the initial poll.
    return (
      <span className="inline-flex items-center gap-1.5">
        <Loader2 size={10} className="animate-spin text-zinc-400" />
        <span className="text-zinc-500 capitalize dark:text-zinc-400">
          {containerStatus ?? "Checking…"}
        </span>
      </span>
    );
  }
  if (health.state === "starting") {
    return (
      <span className="inline-flex items-center gap-1.5">
        <Loader2 size={10} className="animate-spin text-amber-500" />
        <span className="text-amber-700 dark:text-amber-300">Starting…</span>
      </span>
    );
  }
  // unreachable / not_found
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
      <span className="text-red-700 dark:text-red-300" title={health.reason ?? undefined}>
        Unreachable
      </span>
    </span>
  );
}
