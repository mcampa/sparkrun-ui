import Link from "next/link";
import { Plus } from "lucide-react";
import { serverClient } from "@/lib/rpc/server";
import { Card, CardBody } from "@/app/components/ui/Card";
import { Badge } from "@/app/components/ui/Badge";
import { Button } from "@/app/components/ui/Button";

export const dynamic = "force-dynamic";

const statusTones = {
  completed: "green",
  running: "sky",
  partial: "amber",
  failed: "red",
  unknown: "neutral",
} as const;

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default async function BenchmarksPage() {
  const benchmarks = await serverClient.benchmarks.list();
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Benchmarks</h1>
        <Link href="/benchmarks/new">
          <Button variant="primary">
            <Plus size={14} />
            New benchmark
          </Button>
        </Link>
      </div>

      {benchmarks.length === 0 ? (
        <Card>
          <CardBody className="text-sm text-zinc-500 dark:text-zinc-400">
            No benchmarks have been run yet.
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardBody className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-2">ID</th>
                  <th className="px-4 py-2">Recipe</th>
                  <th className="px-4 py-2">Framework</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Schedule</th>
                  <th className="px-4 py-2">Updated</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {benchmarks.map((b) => (
                  <tr key={b.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-950">
                    <td className="px-4 py-2 font-mono text-xs">{b.id}</td>
                    <td className="px-4 py-2 font-mono text-xs">{b.recipe ?? "—"}</td>
                    <td className="px-4 py-2 text-xs">{b.framework ?? "—"}</td>
                    <td className="px-4 py-2">
                      <Badge tone={statusTones[b.status]}>{b.status}</Badge>
                    </td>
                    <td className="px-4 py-2 text-xs">
                      {b.completedCount}/{b.scheduleCount}
                      {b.failedCount > 0 && (
                        <span className="ml-1 text-red-600 dark:text-red-400">
                          ({b.failedCount} failed)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-xs text-zinc-500 dark:text-zinc-400">
                      {fmtTime(b.updatedAt)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Link href={`/benchmarks/${b.id}`}>
                        <Button size="sm">Open</Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
