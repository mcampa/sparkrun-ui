import { readFile } from "node:fs/promises";
import { os, ORPCError } from "@orpc/server";
import { z } from "zod";
import { parseDocument } from "yaml";
import {
  RecipeListSchema,
  RecipeValidateResultSchema,
  ValidationIssueSchema,
  type RecipeListItem,
  type ValidationIssue,
} from "@/lib/schemas";
import { runSparkrun, runSparkrunJson } from "@/lib/sparkrun";
import { writeDraft } from "@/lib/draft";
import { probePortsParallel } from "@/lib/portCheck";
import { resolveTargetHosts } from "./helpers";

export const list = os
  .input(z.object({ all: z.boolean().default(true) }).optional())
  .output(RecipeListSchema)
  .handler(async ({ input }) => {
    const args = ["list", "--json"];
    if (input?.all !== false) args.push("--all");
    const raw = await runSparkrunJson<unknown>(args);
    return RecipeListSchema.parse(raw);
  });

export const readYaml = os
  .input(z.object({ name: z.string().min(1) }))
  .output(z.object({ yaml: z.string(), path: z.string(), recipe: z.string() }))
  .handler(async ({ input }) => {
    const recipes = (await runSparkrunJson<unknown>([
      "list",
      "--all",
      "--json",
    ])) as RecipeListItem[];
    const found = recipes.find((r) => r.name === input.name);
    if (!found) {
      throw new ORPCError("NOT_FOUND", { message: `Recipe ${input.name} not found` });
    }
    const yaml = await readFile(found.path, "utf8");
    return { yaml, path: found.path, recipe: found.name };
  });

export const show = os
  .input(z.object({ name: z.string().min(1) }))
  .output(z.object({ text: z.string() }))
  .handler(async ({ input }) => {
    const r = await runSparkrun(["recipe", "show", input.name]);
    if (r.code !== 0) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: `sparkrun recipe show failed`,
        data: { stderr: r.stderr.trim() },
      });
    }
    return { text: r.stdout };
  });

const numericFields = [
  "model_weights_gb",
  "kv_cache_total_gb",
  "total_per_gpu_gb",
  "max_model_len",
  "tensor_parallel",
  "model_params",
  "num_layers",
  "num_kv_heads",
  "head_dim",
  "gpu_memory_utilization",
  "usable_gpu_memory_gb",
  "available_kv_gb",
  "max_context_tokens",
  "context_multiplier",
];

function coerceNumbers(obj: unknown): unknown {
  if (obj == null || typeof obj !== "object") return obj;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (v == null) continue;
    if (typeof v === "string" && numericFields.includes(k)) {
      const n = Number(v);
      out[k] = Number.isFinite(n) ? n : v;
    } else {
      out[k] = v;
    }
  }
  return out;
}

const VramSchema = z.object({
  recipe: z.string(),
  model: z.string(),
  runtime: z.string(),
  model_weights_gb: z.number().optional(),
  kv_cache_total_gb: z.number().optional(),
  total_per_gpu_gb: z.number().optional(),
  max_model_len: z.number().optional(),
  tensor_parallel: z.number().optional(),
  model_params: z.number().optional(),
  model_dtype: z.string().optional(),
  kv_dtype: z.string().optional(),
  num_layers: z.number().optional(),
  num_kv_heads: z.number().optional(),
  head_dim: z.number().optional(),
  gpu_memory_utilization: z.number().optional(),
  usable_gpu_memory_gb: z.number().optional(),
  available_kv_gb: z.number().optional(),
  max_context_tokens: z.number().optional(),
  context_multiplier: z.number().optional(),
  fits_dgx_spark: z.boolean().optional(),
  warnings: z.array(z.string()).default([]),
});

/** Parse sparkrun `recipe vram --json` output, coercing string-typed numbers. */
export function parseRecipeVramJson(raw: unknown) {
  return VramSchema.parse(coerceNumbers(raw));
}

export const info = os
  .input(z.object({ name: z.string().min(1), tp: z.number().int().min(1).optional() }))
  .output(
    z.object({
      name: z.string(),
      description: z.string(),
      registry: z.string(),
      vram: VramSchema.nullable(),
      vramError: z.string().nullable(),
    }),
  )
  .handler(async ({ input }) => {
    const recipes = (await runSparkrunJson<unknown>([
      "list",
      "--all",
      "--json",
    ])) as RecipeListItem[];
    const found = recipes.find((r) => r.name === input.name);
    const description = found?.description ?? "";
    const registry = found?.registry ?? "";

    const args = ["recipe", "vram", input.name, "--json"];
    if (input.tp) args.push("--tp", String(input.tp));
    const r = await runSparkrun(args);
    if (r.code !== 0) {
      return {
        name: input.name,
        description,
        registry,
        vram: null,
        vramError: r.stderr.trim() || "vram failed",
      };
    }
    try {
      const raw = JSON.parse(r.stdout);
      const vram = parseRecipeVramJson(raw);
      return { name: input.name, description, registry, vram, vramError: null };
    } catch {
      return {
        name: input.name,
        description,
        registry,
        vram: null,
        vramError: "could not parse vram output",
      };
    }
  });

export const validate = os
  .input(
    z.object({
      yaml: z.string(),
      draftId: z.string().regex(/^[a-zA-Z0-9_-]+$/),
      hosts: z.array(z.string()).optional(),
      cluster: z.string().optional(),
    }),
  )
  .output(z.object({ valid: z.boolean(), issues: z.array(ValidationIssueSchema) }))
  .handler(async ({ input }) => {
    const path = await writeDraft(input.draftId, input.yaml);
    const issues: ValidationIssue[] = [];

    const r = await runSparkrun(["recipe", "validate", path, "--json"]);
    if (r.code === 0) {
      try {
        const parsed = RecipeValidateResultSchema.parse(JSON.parse(r.stdout));
        if (!parsed.valid) {
          for (const i of parsed.issues) {
            if (typeof i === "string") {
              issues.push({ severity: "error", message: i });
            } else {
              issues.push({
                severity: i.severity ?? "error",
                message: i.message,
                field: i.path,
              });
            }
          }
        }
      } catch {
        issues.push({ severity: "error", message: r.stdout.trim() || "Validation parse error" });
      }
    } else {
      issues.push({
        severity: "error",
        message: r.stderr.trim() || `Validation exited ${r.code}`,
      });
    }

    let port: number | undefined;
    let portLine: number | undefined;
    try {
      const doc = parseDocument(input.yaml);
      const portNode = doc.getIn(["defaults", "port"], true) as
        | { value?: unknown; range?: [number, number] }
        | undefined;
      const portValue = doc.getIn(["defaults", "port"]);
      if (typeof portValue === "number") {
        port = portValue;
        if (portNode?.range) {
          const lineOffset = input.yaml.slice(0, portNode.range[0]).split("\n").length;
          portLine = lineOffset;
        }
      }
    } catch {
      // YAML parse error covered by sparkrun validate
    }

    const hosts = await resolveTargetHosts(input.hosts, input.cluster);

    if (port && hosts.length) {
      const status = await runSparkrunJson<{
        solo_entries?: {
          cluster_id: string;
          host?: string;
          meta?: { port?: number; recipe?: string };
        }[];
      }>(["cluster", "status", "--json"]);
      const running = status.solo_entries ?? [];
      for (const w of running) {
        if (w.meta?.port === port && w.host && hosts.includes(w.host)) {
          issues.push({
            severity: "error",
            message: `Port ${port} is already used on ${w.host} by ${w.meta?.recipe ?? w.cluster_id}`,
            field: "defaults.port",
            line: portLine,
            conflictingClusterId: w.cluster_id,
            conflictingRecipe: w.meta?.recipe,
          });
        }
      }

      const probes = await probePortsParallel(hosts, port);
      for (const p of probes) {
        const alreadyReportedSparkrun = running.some(
          (w) => w.meta?.port === port && w.host === p.host,
        );
        if (p.inUse && !alreadyReportedSparkrun) {
          issues.push({
            severity: "error",
            message: `Port ${port} on ${p.host} is held by another process`,
            field: "defaults.port",
            line: portLine,
          });
        }
      }
    }

    const valid = issues.every((i) => i.severity !== "error");
    return { valid, issues };
  });

export const dryRun = os
  .input(
    z.object({
      yaml: z.string(),
      draftId: z.string().regex(/^[a-zA-Z0-9_-]+$/),
      hosts: z.array(z.string()).optional(),
      cluster: z.string().optional(),
      tp: z.number().int().min(1).optional(),
    }),
  )
  .output(z.object({ ok: z.boolean(), stdout: z.string(), stderr: z.string() }))
  .handler(async ({ input }) => {
    const path = await writeDraft(input.draftId, input.yaml);
    const args = ["run", path, "--dry-run"];
    if (input.cluster) args.push("--cluster", input.cluster);
    else if (input.hosts?.length) args.push("--hosts", input.hosts.join(","));
    if (input.tp) args.push("--tp", String(input.tp));
    const r = await runSparkrun(args);
    return { ok: r.code === 0, stdout: r.stdout, stderr: r.stderr };
  });
