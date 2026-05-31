import { serverClient } from "@/lib/rpc/server";
import { Card, CardBody, CardHeader, CardTitle, CardDescription } from "@/app/components/ui/Card";
import { Badge } from "@/app/components/ui/Badge";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const status = await serverClient.status.get();
  const workloads = status.solo_entries;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <div className="flex gap-2 text-sm text-zinc-500 dark:text-zinc-400">
          <Badge tone="sky">{status.host_count} host{status.host_count === 1 ? "" : "s"}</Badge>
          <Badge tone="green">{status.total_containers} running</Badge>
        </div>
      </div>

      {workloads.length === 0 ? (
        <Card>
          <CardBody className="text-sm text-zinc-500 dark:text-zinc-400">
            No workloads are currently running.
          </CardBody>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {workloads.map((w) => {
            const tp = (w.meta.overrides as { tensor_parallel?: number } | undefined)
              ?.tensor_parallel;
            return (
              <Card key={w.cluster_id}>
                <CardHeader>
                  <CardTitle className="font-mono text-sm">
                    {w.meta.recipe ?? w.cluster_id}
                  </CardTitle>
                  <CardDescription>{w.meta.model ?? ""}</CardDescription>
                </CardHeader>
                <CardBody className="flex flex-col gap-2 text-sm">
                  <div className="flex flex-wrap gap-2">
                    {w.meta.port && <Badge tone="purple">port {w.meta.port}</Badge>}
                    {tp && <Badge tone="sky">tp={tp}</Badge>}
                    {w.host && <Badge tone="neutral">{w.host}</Badge>}
                    {w.status && <Badge tone="green">{w.status}</Badge>}
                  </div>
                  <div className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
                    {w.cluster_id}
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
