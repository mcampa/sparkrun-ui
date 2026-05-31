import { serverClient } from "@/lib/rpc/server";
import { NewBenchmarkForm } from "@/app/components/benchmarks/NewBenchmarkForm";

export const dynamic = "force-dynamic";

export default async function NewBenchmarkPage() {
  const [recipes, clusters, def, profiles, status] = await Promise.all([
    serverClient.recipes.list({ all: true }),
    serverClient.clusters.list(),
    serverClient.clusters.getDefault(),
    serverClient.benchmarks.profiles(),
    serverClient.status.get().catch(() => null),
  ]);
  const runningRecipes: string[] = [];
  if (status) {
    for (const w of status.solo_entries) {
      if (w.meta?.recipe) runningRecipes.push(w.meta.recipe);
    }
  }
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Run a benchmark</h1>
      <NewBenchmarkForm
        recipes={recipes}
        clusters={clusters}
        profiles={profiles}
        defaultClusterName={def?.name ?? null}
        runningRecipes={runningRecipes}
      />
    </div>
  );
}
