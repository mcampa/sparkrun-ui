import { readDraftMeta } from "./draft";
import type { RecipeListItem, Workload } from "./schemas";

export const DRAFT_RECIPE_PATH_RE = /sparkrun-ui-drafts\/(.+)\.yaml$/;

export type DraftMetaReader = (draftId: string) => Promise<Record<string, string> | null>;

export function getRecipeStateRawName(recipeState: unknown): string | undefined {
  const rawName = (
    (recipeState as Record<string, unknown> | undefined)?._raw as
      | Record<string, unknown>
      | undefined
  )?.name;
  return typeof rawName === "string" ? rawName : undefined;
}

export function extractDraftId(recipePath: string): string | null {
  return recipePath.match(DRAFT_RECIPE_PATH_RE)?.[1] ?? null;
}

export function resolveRunningRecipeNameByPath(
  recipePath: string,
  recipes: RecipeListItem[],
): string | null {
  return recipes.find((r) => r.path === recipePath)?.name ?? null;
}

export function resolveRunningRecipeNameByFile(
  file: string,
  recipes: RecipeListItem[],
): string | null {
  return recipes.find((r) => r.file === file)?.name ?? null;
}

export async function resolveRunningRecipeName(
  workload: Workload,
  recipes: RecipeListItem[],
  readMeta: DraftMetaReader = readDraftMeta,
): Promise<string | null> {
  const recipePath = workload.meta?.recipe;
  if (!recipePath) return null;

  const byPath = resolveRunningRecipeNameByPath(recipePath, recipes);
  if (byPath) return byPath;

  const draftId = extractDraftId(recipePath);
  if (draftId) {
    const meta = await readMeta(draftId);
    if (meta?.recipeName) return meta.recipeName;
  }

  const rawName = getRecipeStateRawName(workload.meta?.recipe_state);
  if (rawName) return resolveRunningRecipeNameByFile(rawName, recipes);

  return null;
}

export async function collectRunningRecipeNames(
  soloEntries: Workload[],
  recipes: RecipeListItem[],
  readMeta: DraftMetaReader = readDraftMeta,
): Promise<string[]> {
  const runningRecipes: string[] = [];
  for (const w of soloEntries) {
    const name = await resolveRunningRecipeName(w, recipes, readMeta);
    if (name) runningRecipes.push(name);
  }
  return runningRecipes;
}
