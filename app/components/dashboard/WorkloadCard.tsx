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
import type { Workload } from "@/lib/schemas";

export function WorkloadCard({ workload }: { workload: Workload }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const tp = (workload.meta.overrides as { tensor_parallel?: number } | undefined)?.tensor_parallel;
  const recipe = workload.meta.recipe ?? workload.cluster_id;

  const handleStop = () => {
    startTransition(async () => {
      try {
        await rpc.workloads.stop({ clusterId: workload.cluster_id });
        toast.success("Stop requested", `${recipe} is shutting down`);
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
          <CardTitle className="font-mono text-sm">{recipe}</CardTitle>
          <CardDescription>{workload.meta.model ?? ""}</CardDescription>
        </CardHeader>
        <CardBody className="flex flex-col gap-3 text-sm">
          <div className="flex flex-wrap gap-2">
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
            <span className="block font-mono">{recipe}</span>
            <span className="mt-2 block">
              The container will be terminated on {workload.host ?? "the target host"}.
            </span>
          </>
        }
        confirmLabel="Stop"
        destructive
        onConfirm={handleStop}
      />
    </>
  );
}
