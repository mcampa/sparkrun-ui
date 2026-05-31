import Link from "next/link";
import { Rocket } from "lucide-react";
import { serverClient } from "@/lib/rpc/server";
import { Card, CardBody } from "@/app/components/ui/Card";
import { Badge } from "@/app/components/ui/Badge";
import { Button } from "@/app/components/ui/Button";

export const dynamic = "force-dynamic";

export default async function RecipesPage() {
  const recipes = await serverClient.recipes.list({ all: true });
  const byRegistry = new Map<string, typeof recipes>();
  for (const r of recipes) {
    const arr = byRegistry.get(r.registry) ?? [];
    arr.push(r);
    byRegistry.set(r.registry, arr);
  }
  const registries = Array.from(byRegistry.keys()).sort();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Recipes</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {recipes.length} recipes across {registries.length} registries
        </p>
      </div>

      {registries.map((reg) => (
        <section key={reg} className="flex flex-col gap-3">
          <h2 className="font-mono text-sm font-medium text-zinc-700 dark:text-zinc-300">
            @{reg}
          </h2>
          <Card>
            <CardBody className="p-0">
              <table className="w-full text-sm">
                <thead className="border-b border-zinc-200 bg-zinc-50 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
                  <tr>
                    <th className="px-4 py-2">Name</th>
                    <th className="px-4 py-2">Model</th>
                    <th className="px-4 py-2">Runtime</th>
                    <th className="px-4 py-2">Nodes</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {(byRegistry.get(reg) ?? []).map((r) => (
                    <tr key={r.name} className="hover:bg-zinc-50 dark:hover:bg-zinc-950">
                      <td className="px-4 py-2 font-mono text-xs">{r.file}</td>
                      <td className="px-4 py-2 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                        {r.model}
                      </td>
                      <td className="px-4 py-2">
                        <Badge tone="sky">{r.runtime}</Badge>
                      </td>
                      <td className="px-4 py-2 text-xs text-zinc-600 dark:text-zinc-400">
                        {r.min_nodes}
                        {r.tp && r.tp !== "" && ` · tp=${r.tp}`}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <Link href={`/launch?recipe=${encodeURIComponent(r.name)}`}>
                          <Button size="sm" variant="primary">
                            <Rocket size={12} />
                            Launch
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardBody>
          </Card>
        </section>
      ))}
    </div>
  );
}
