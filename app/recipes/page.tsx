import { serverClient } from "@/lib/rpc/server";
import { RecipesBrowser } from "@/app/components/recipes/RecipesBrowser";

export const dynamic = "force-dynamic";

export default async function RecipesPage() {
  const recipes = await serverClient.recipes.list({ all: true });
  return <RecipesBrowser recipes={recipes} />;
}
