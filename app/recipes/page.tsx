import { serverClient } from "@/lib/rpc/server";
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
      if (w.meta?.recipe) runningRecipes.push(w.meta.recipe);
    }
  }
  return <RecipesBrowser recipes={recipes} runningRecipes={runningRecipes} />;
}
