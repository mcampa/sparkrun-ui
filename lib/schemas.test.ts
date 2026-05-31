import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ClusterEntrySchema,
  ClusterStatusSchema,
  MonitorTickSchema,
  RecipeListSchema,
  RecipeValidateResultSchema,
} from "./schemas";

const FIX = join(__dirname, "__fixtures__");

async function readJson(name: string): Promise<unknown> {
  return JSON.parse(await readFile(join(FIX, name), "utf8"));
}

describe("schemas parse real sparkrun --json fixtures", () => {
  it("cluster status", async () => {
    const data = await readJson("cluster-status.json");
    const parsed = ClusterStatusSchema.parse(data);
    expect(parsed.host_count).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(parsed.solo_entries)).toBe(true);
    for (const w of parsed.solo_entries) {
      expect(w.cluster_id).toMatch(/^sparkrun_/);
      expect(typeof w.meta).toBe("object");
    }
  });

  it("recipe list", async () => {
    const data = await readJson("recipes-list.json");
    const parsed = RecipeListSchema.parse(data);
    expect(parsed.length).toBeGreaterThan(0);
    for (const r of parsed.slice(0, 5)) {
      expect(r.name.startsWith("@")).toBe(true);
      expect(r.registry).toBeTruthy();
      expect(r.runtime).toBeTruthy();
      expect(r.path).toBeTruthy();
    }
  });

  it("recipe validate result", async () => {
    const data = await readJson("recipe-validate.json");
    const parsed = RecipeValidateResultSchema.parse(data);
    expect(typeof parsed.valid).toBe("boolean");
  });

  it("cluster list", async () => {
    const data = await readJson("clusters.json");
    const arr = z.array(rawCluster).parse(data);
    expect(arr.length).toBeGreaterThan(0);
    const transformed = arr.map((c) => ({
      name: c.name,
      hosts: c.hosts,
      description: c.description ?? "",
      is_default: c.default,
    }));
    for (const e of transformed) {
      expect(ClusterEntrySchema.safeParse(e).success).toBe(true);
    }
  });

  it("cluster default", async () => {
    const data = await readJson("cluster-default.json");
    const parsed = rawCluster.parse(data);
    expect(typeof parsed.name).toBe("string");
    expect(Array.isArray(parsed.hosts)).toBe(true);
  });

  it("monitor ndjson stream parses every tick", async () => {
    const text = await readFile(join(FIX, "monitor-stream.ndjson"), "utf8");
    const lines = text.split("\n").filter((l) => l.trim());
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      const obj = JSON.parse(line);
      expect(typeof obj.timestamp).toBe("number");
      expect(typeof obj.hosts).toBe("object");
      // Per-host metrics should parse as our flexible (loose) schema
      for (const host of Object.values(obj.hosts as Record<string, unknown>)) {
        MonitorTickSchema.parse({ host: "x", ...(host as object) });
      }
    }
  });

  it("recipe vram --json shape", async () => {
    const data = (await readJson("recipe-vram.json")) as Record<string, unknown>;
    expect(typeof data.recipe).toBe("string");
    expect(typeof data.model).toBe("string");
    expect(typeof data.model_weights_gb).toBe("number");
    expect(typeof data.total_per_gpu_gb).toBe("number");
    expect(typeof data.fits_dgx_spark).toBe("boolean");
  });
});

import { z } from "zod";
const rawCluster = z.object({
  name: z.string(),
  hosts: z.array(z.string()).default([]),
  description: z.string().optional(),
  default: z.boolean().default(false),
});
