import { serverClient } from "@/lib/rpc/server";
import { readDraftMeta } from "@/lib/draft";
import { RecipesBrowser } from "@/app/components/recipes/RecipesBrowser";

export const dynamic = "force-dynamic";

export default async function RecipesPage() {
  const [recipes, status] = await Promise.all([
    serverClient.recipes.list({ all: true }),
    serverClient.status.get().catch(() => null),
  ]);
  const runningRecipes: string[] = [];
  if (status) {
    for (const w of status.solo_entries) {
      const recipePath = w.meta?.recipe;
      if (!recipePath) continue;
      // Try direct path match against known recipe paths
      const byPath = recipes.find((r) => r.path === recipePath);
      if (byPath) {
        runningRecipes.push(byPath.name);
        continue;
      }
      // Try draft sidecar meta
      const draftMatch = recipePath.match(/sparkrun-ui-drafts\/(.+)\.yaml$/);
      if (draftMatch) {
        const meta = await readDraftMeta(draftMatch[1]);
        if (meta?.recipeName) {
          runningRecipes.push(meta.recipeName);
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
        if (byFile) runningRecipes.push(byFile.name);
      }
    }
  }
  return <RecipesBrowser recipes={recipes} runningRecipes={runningRecipes} />;
}
