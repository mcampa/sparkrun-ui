import { serverClient } from "@/lib/rpc/server";
import { readDraftMeta } from "@/lib/draft";
import { DashboardLive } from "@/app/components/dashboard/DashboardLive";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [initial, recipes] = await Promise.all([
    serverClient.status.get(),
    serverClient.recipes.list({ all: true }),
  ]);
  const recipeNameByCluster = new Map<string, string>();
  for (const w of initial.solo_entries) {
    const recipePath = w.meta?.recipe;
    if (!recipePath) continue;
    // Try direct path match
    const byPath = recipes.find((r) => r.path === recipePath);
    if (byPath) {
      recipeNameByCluster.set(w.cluster_id, byPath.name);
      continue;
    }
    // Try draft sidecar meta
    const draftMatch = recipePath.match(/sparkrun-ui-drafts\/(.+)\.yaml$/);
    if (draftMatch) {
      const meta = await readDraftMeta(draftMatch[1]);
      if (meta?.recipeName) {
        recipeNameByCluster.set(w.cluster_id, meta.recipeName);
        continue;
      }
    }
    // Fallback: match by recipe_state._raw.name -> r.file
    const rawName = (
      (w.meta?.recipe_state as Record<string, unknown> | undefined)?._raw as
        | Record<string, unknown>
        | undefined
    )?.name;
    if (typeof rawName === "string") {
      const byFile = recipes.find((r) => r.file === rawName);
      if (byFile) recipeNameByCluster.set(w.cluster_id, byFile.name);
    }
  }
  return <DashboardLive initial={initial} recipeNameByCluster={recipeNameByCluster} />;
}
