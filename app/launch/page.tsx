import { serverClient } from "@/lib/rpc/server";
import { LaunchWizard } from "@/app/components/launch/LaunchWizard";

export const dynamic = "force-dynamic";

export default async function LaunchPage({
  searchParams,
}: {
  searchParams: Promise<{ recipe?: string }>;
}) {
  const [recipes, clusters, def] = await Promise.all([
    serverClient.recipes.list({ all: true }),
    serverClient.clusters.list(),
    serverClient.clusters.getDefault(),
  ]);
  const sp = await searchParams;
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Launch a recipe</h1>
      <LaunchWizard
        recipes={recipes}
        clusters={clusters}
        defaultClusterName={def?.name ?? null}
        initialRecipe={sp.recipe}
      />
    </div>
  );
}
