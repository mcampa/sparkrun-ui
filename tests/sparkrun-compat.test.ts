/**
 * Live compatibility tests against the installed `sparkrun` CLI.
 * Asserts that our zod schemas parse real CLI output so we catch
 * upstream breakage early.
 *
 * Gated by RUN_LIVE_TESTS=1 (or always-on when sparkrun is on PATH
 * AND CI sets SPARKRUN_LIVE=1). Skipped if sparkrun isn't installed.
 */
import { spawnSync } from "node:child_process";
import { describe, expect, it, beforeAll } from "vitest";
import { ClusterEntrySchema, ClusterStatusSchema, RecipeListSchema } from "@/lib/schemas";
import { z } from "zod";

const SPARKRUN = process.env.SPARKRUN_BIN || "sparkrun";

function run(args: string[]): { code: number; stdout: string; stderr: string } {
  const r = spawnSync(SPARKRUN, args, { encoding: "utf8" });
  return { code: r.status ?? -1, stdout: r.stdout, stderr: r.stderr };
}

function isInstalled(): boolean {
  const r = spawnSync(SPARKRUN, ["--version"], { encoding: "utf8" });
  return r.status === 0;
}

const ENABLED = isInstalled();
const describeLive = ENABLED ? describe : describe.skip;

describeLive("sparkrun CLI compatibility", () => {
  beforeAll(() => {
    const r = run(["--version"]);
    console.log(`[compat] using ${r.stdout.trim()}`);
  });

  it("--version succeeds", () => {
    const r = run(["--version"]);
    expect(r.code).toBe(0);
    expect(r.stdout).toMatch(/sparkrun.*version/i);
  });

  it("list --all --json parses as RecipeListSchema", () => {
    const r = run(["list", "--all", "--json"]);
    expect(r.code, r.stderr).toBe(0);
    const data = JSON.parse(r.stdout);
    const parsed = RecipeListSchema.parse(data);
    expect(parsed.length).toBeGreaterThan(0);
    const sample = parsed[0];
    expect(sample.name.startsWith("@")).toBe(true);
    expect(sample.registry).toBeTruthy();
    expect(sample.runtime).toBeTruthy();
  });

  it("cluster status --json parses as ClusterStatusSchema", () => {
    // CI runners don't have a default cluster — pass --hosts explicitly.
    // The CLI returns a valid (empty) status even if no docker is running.
    const r = run(["cluster", "status", "--json", "--hosts", "127.0.0.1"]);
    expect(r.code, r.stderr).toBe(0);
    const parsed = ClusterStatusSchema.parse(JSON.parse(r.stdout));
    expect(typeof parsed.host_count).toBe("number");
    expect(Array.isArray(parsed.solo_entries)).toBe(true);
  });

  it("cluster list --json parses", () => {
    const r = run(["cluster", "list", "--json"]);
    expect(r.code, r.stderr).toBe(0);
    const data = JSON.parse(r.stdout);
    const arr = z
      .array(
        z.object({
          name: z.string(),
          hosts: z.array(z.string()).default([]),
          description: z.string().optional(),
          default: z.boolean().default(false),
        }),
      )
      .parse(data);
    for (const e of arr) {
      const ok = ClusterEntrySchema.safeParse({
        name: e.name,
        hosts: e.hosts,
        description: e.description ?? "",
        is_default: e.default,
      });
      expect(ok.success).toBe(true);
    }
  });

  it("recipe vram --json has expected fields", () => {
    const listRes = run(["list", "--all", "--json"]);
    expect(listRes.code).toBe(0);
    const recipes = JSON.parse(listRes.stdout) as { name: string }[];
    if (!recipes.length) return;
    const r = run(["recipe", "vram", recipes[0].name, "--json"]);
    expect(r.code, r.stderr).toBe(0);
    const data = JSON.parse(r.stdout);
    expect(typeof data.recipe).toBe("string");
    expect(typeof data.model_weights_gb).toBe("number");
    expect(typeof data.total_per_gpu_gb).toBe("number");
  });
});
