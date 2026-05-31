"use client";
import { useState, useTransition } from "react";
import { Square, ScrollText } from "lucide-react";
import Link from "next/link";
import { Card, CardBody, CardHeader, CardTitle, CardDescription } from "@/app/components/ui/Card";
import { Badge } from "@/app/components/ui/Badge";
import { Button } from "@/app/components/ui/Button";
import { AlertDialog } from "@/app/components/ui/Dialog";
import { toast } from "@/app/components/ui/Toast";
import { rpc } from "@/lib/rpc/client";
import { RecipeShowDialog } from "@/app/components/recipes/RecipeShowDialog";
import type { Workload } from "@/lib/schemas";

export function WorkloadCard({
  workload,
  recipeName,
}: {
  workload: Workload;
  recipeName?: string;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [recipeOpen, setRecipeOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const tp = (workload.meta.overrides as { tensor_parallel?: number } | undefined)?.tensor_parallel;
  const label = workload.meta.model || workload.meta.recipe || workload.cluster_id;
  const sub = workload.meta.model ? (workload.meta.recipe ?? workload.cluster_id) : undefined;

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
          <CardTitle className="font-mono text-sm">{label}</CardTitle>
          {sub && <CardDescription>{sub}</CardDescription>}
        </CardHeader>
        <CardBody className="flex flex-col gap-3 text-sm">
          <div className="flex flex-wrap gap-2">
            {recipeName && (
              <button
                type="button"
                onClick={() => setRecipeOpen(true)}
                className="inline-flex cursor-pointer items-center gap-1 rounded bg-sky-100 px-1.5 py-0.5 text-xs font-medium text-sky-700 hover:underline dark:bg-sky-950 dark:text-sky-300"
              >
                {recipeName}
              </button>
            )}
            {workload.meta.port && <Badge tone="purple">port {workload.meta.port}</Badge>}
            {tp && <Badge tone="sky">tp={tp}</Badge>}
            {workload.host && <Badge tone="neutral">{workload.host}</Badge>}
            {workload.status && <Badge tone="green">{workload.status}</Badge>}
          </div>
          <div className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
            {workload.cluster_id}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Link href={`/logs/${workload.cluster_id}`}>
              <Button variant="ghost" size="sm">
                <ScrollText size={14} />
                Logs
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
      {recipeName && (
        <RecipeShowDialog
          name={recipeName}
          open={recipeOpen}
          onOpenChange={(o) => !o && setRecipeOpen(false)}
        />
      )}
    </>
  );
}
