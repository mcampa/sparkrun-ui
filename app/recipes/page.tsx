import { serverClient } from "@/lib/rpc/server";
import { collectRunningRecipeNames } from "@/lib/runningRecipes";
import { RecipesBrowser } from "@/app/components/recipes/RecipesBrowser";

export const dynamic = "force-dynamic";

export default async function RecipesPage() {
  const [recipes, status] = await Promise.all([
    serverClient.recipes.list({ all: true }),
    serverClient.status.get().catch(() => null),
  ]);
  const runningRecipes = status
    ? await collectRunningRecipeNames(status.solo_entries, recipes)
    : [];
  return <RecipesBrowser recipes={recipes} runningRecipes={runningRecipes} />;
}
