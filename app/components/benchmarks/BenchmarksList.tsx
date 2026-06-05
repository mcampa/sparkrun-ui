"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Card, CardBody } from "@/app/components/ui/Card";
import { Badge } from "@/app/components/ui/Badge";
import { Button } from "@/app/components/ui/Button";
import { Switch } from "@/app/components/ui/Switch";
import { LocalTime } from "@/app/components/ui/LocalTime";

type BenchmarkSummary = {
  id: string;
  recipe: string | null;
  framework: string | null;
  status: "completed" | "running" | "partial" | "failed" | "unknown";
  startedAt: string | null;
  updatedAt: string | null;
  scheduleCount: number;
  completedCount: number;
  failedCount: number;
};

const statusTones = {
  completed: "green",
  running: "sky",
  partial: "amber",
  failed: "red",
  unknown: "neutral",
} as const;

export function BenchmarksList({ benchmarks }: { benchmarks: BenchmarkSummary[] }) {
  const [includeFailed, setIncludeFailed] = useState(false);
  const failedCount = useMemo(
    () => benchmarks.filter((b) => b.status === "failed").length,
    [benchmarks],
  );
  const visible = useMemo(
    () => (includeFailed ? benchmarks : benchmarks.filter((b) => b.status !== "failed")),
    [benchmarks, includeFailed],
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-baseline justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Benchmarks</h1>
        <div className="flex items-center gap-2">
          {failedCount > 0 && (
            <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-xs text-zinc-600 select-none hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800">
              <Switch checked={includeFailed} onCheckedChange={setIncludeFailed} />
              Include failed
              <span className="text-zinc-400">({failedCount})</span>
            </label>
          )}
          <Link href="/benchmarks/new">
            <Button variant="primary">
              <Plus size={14} />
              New benchmark
            </Button>
          </Link>
        </div>
      </div>

      {visible.length === 0 ? (
        <Card>
          <CardBody className="text-sm text-zinc-500 dark:text-zinc-400">
            {benchmarks.length === 0
              ? "No benchmarks have been run yet."
              : "No benchmarks to show. Toggle “Include failed” to see failed runs."}
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardBody className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-left text-xs font-medium tracking-wider text-zinc-500 uppercase dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
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
                {visible.map((b) => (
                  <tr key={b.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-950">
                    <td className="px-4 py-2 font-mono text-xs">
                      <Link
                        href={`/benchmarks/${b.id}`}
                        className="text-sky-600 hover:underline dark:text-sky-400"
                      >
                        {b.id}
                      </Link>
                    </td>
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
                      <LocalTime iso={b.updatedAt} />
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
