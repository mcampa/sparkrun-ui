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
    const recipes = (await runSparkrunJson<unknown>(["list", "--all", "--json"])) as RecipeListItem[];
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
      const portNode = doc.getIn(["defaults", "port"], true) as { value?: unknown; range?: [number, number] } | undefined;
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
        solo_entries?: { cluster_id: string; host?: string; meta?: { port?: number; recipe?: string } }[];
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
