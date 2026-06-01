import { serverClient } from "@/lib/rpc/server";
import { resolveRunningRecipeDisplay, type RunningRecipeDisplay } from "@/lib/runningRecipes";
import { DashboardLive } from "@/app/components/dashboard/DashboardLive";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [initial, recipes] = await Promise.all([
    serverClient.status.get(),
    serverClient.recipes.list({ all: true }),
  ]);
  const recipeByCluster = new Map<string, RunningRecipeDisplay>();
  for (const w of initial.solo_entries) {
    const display = await resolveRunningRecipeDisplay(w, recipes);
    if (display) recipeByCluster.set(w.cluster_id, display);
  }
  return <DashboardLive initial={initial} recipeByCluster={recipeByCluster} />;
}
