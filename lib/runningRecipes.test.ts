import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { ClusterStatusSchema, RecipeListSchema, type Workload } from "./schemas";
import {
  collectRunningRecipeNames,
  extractDraftId,
  getRecipeStateRawName,
  resolveRunningRecipeName,
  resolveRunningRecipeNameByFile,
  resolveRunningRecipeNameByPath,
} from "./runningRecipes";

const FIX = join(__dirname, "__fixtures__");

async function readJson(name: string): Promise<unknown> {
  return JSON.parse(await readFile(join(FIX, name), "utf8"));
}

const sampleRecipe = {
  name: "@mcampa/qwen3.6-27b-prismascout-mtp",
  file: "qwen3.6-27b-prismascout-mtp",
  path: "/home/mcampa/.cache/sparkrun/registries/mcampa/recipes/qwen3.6-27b-prismascout-mtp.yaml",
  model: "rdtand/Qwen3.6-27B-PrismaSCOUT-Blackwell-NVFP4-BF16-vllm",
  description: "",
  runtime: "vllm-distributed",
  min_nodes: 1,
  registry: "mcampa",
};

describe("runningRecipes", () => {
  it("extractDraftId parses draft yaml paths", () => {
    expect(extractDraftId("/tmp/sparkrun-ui-drafts/d_x40tmp7hmpu62p61.yaml")).toBe(
      "d_x40tmp7hmpu62p61",
    );
    expect(extractDraftId("/registry/recipes/foo.yaml")).toBeNull();
  });

  it("getRecipeStateRawName reads nested _raw.name", () => {
    expect(getRecipeStateRawName({ _raw: { name: "qwen3.6-27b-prismascout-mtp" } })).toBe(
      "qwen3.6-27b-prismascout-mtp",
    );
    expect(getRecipeStateRawName({ _raw: { name: 42 } })).toBeUndefined();
  });

  it("resolveRunningRecipeNameByPath matches registry recipe paths", () => {
    expect(resolveRunningRecipeNameByPath(sampleRecipe.path, [sampleRecipe])).toBe(
      sampleRecipe.name,
    );
  });

  it("resolveRunningRecipeNameByFile matches recipe file slugs", () => {
    expect(resolveRunningRecipeNameByFile(sampleRecipe.file, [sampleRecipe])).toBe(
      sampleRecipe.name,
    );
  });

  it("resolveRunningRecipeName prefers draft meta over raw file fallback", async () => {
    const workload: Workload = {
      cluster_id: "sparkrun_test",
      meta: {
        overrides: {},
        recipe: "/tmp/sparkrun-ui-drafts/draft123.yaml",
        recipe_state: { _raw: { name: sampleRecipe.file } },
      },
    };
    const readMeta = vi.fn(async () => ({ recipeName: "@draft/custom-recipe" }));

    await expect(resolveRunningRecipeName(workload, [sampleRecipe], readMeta)).resolves.toBe(
      "@draft/custom-recipe",
    );
    expect(readMeta).toHaveBeenCalledWith("draft123");
  });

  it("resolveRunningRecipeName falls back to recipe_state._raw.name", async () => {
    const workload: Workload = {
      cluster_id: "sparkrun_test",
      meta: {
        overrides: {},
        recipe: "/tmp/sparkrun-ui-drafts/draft123.yaml",
        recipe_state: { _raw: { name: sampleRecipe.file } },
      },
    };

    await expect(
      resolveRunningRecipeName(workload, [sampleRecipe], async () => null),
    ).resolves.toBe(sampleRecipe.name);
  });

  it("collectRunningRecipeNames maps cluster status solo entries", async () => {
    const status = ClusterStatusSchema.parse(await readJson("cluster-status.json"));
    const recipes = RecipeListSchema.parse(await readJson("recipes-list.json"));

    await expect(
      collectRunningRecipeNames(status.solo_entries, recipes, async () => null),
    ).resolves.toEqual(["@mcampa/qwen3.6-27b-prismascout-mtp"]);
  });

  it("collectRunningRecipeNames skips workloads without recipe paths", async () => {
    const workload: Workload = { cluster_id: "sparkrun_test", meta: { overrides: {} } };
    await expect(collectRunningRecipeNames([workload], [sampleRecipe])).resolves.toEqual([]);
  });
});
