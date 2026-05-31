import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseRecipeVramJson } from "./recipes";

const FIX = join(__dirname, "../../__fixtures__");

describe("parseRecipeVramJson", () => {
  it("parses numeric vram output from fixture", async () => {
    const raw = JSON.parse(await readFile(join(FIX, "recipe-vram.json"), "utf8"));
    const vram = parseRecipeVramJson(raw);
    expect(vram.recipe).toBe("@mcampa/qwen3.6-27b-fp8");
    expect(vram.model_weights_gb).toBeCloseTo(25.14570951461792);
    expect(vram.tensor_parallel).toBe(1);
    expect(vram.fits_dgx_spark).toBe(true);
  });

  it("coerces string-typed numeric fields before Zod validation", async () => {
    const raw = JSON.parse(await readFile(join(FIX, "recipe-vram.json"), "utf8"));
    const stringified = {
      ...raw,
      model_weights_gb: String(raw.model_weights_gb),
      kv_cache_total_gb: "8",
      total_per_gpu_gb: String(raw.total_per_gpu_gb),
      max_model_len: "32768",
      tensor_parallel: "1",
      model_params: "27000000000",
      num_layers: "64",
      num_kv_heads: "4",
      head_dim: "256",
      gpu_memory_utilization: "0.75",
      usable_gpu_memory_gb: String(raw.usable_gpu_memory_gb),
      available_kv_gb: String(raw.available_kv_gb),
      max_context_tokens: "268715",
      context_multiplier: String(raw.context_multiplier),
    };

    const vram = parseRecipeVramJson(stringified);
    expect(vram.model_weights_gb).toBeCloseTo(25.14570951461792);
    expect(vram.kv_cache_total_gb).toBe(8);
    expect(vram.max_model_len).toBe(32768);
    expect(vram.tensor_parallel).toBe(1);
    expect(vram.gpu_memory_utilization).toBe(0.75);
    expect(vram.model_dtype).toBe("fp8");
  });

  it("rejects output that fails schema after coercion", () => {
    expect(() => parseRecipeVramJson({ recipe: 123, model: "x", runtime: "vllm" })).toThrow();
  });
});
