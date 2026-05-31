import { os, ORPCError } from "@orpc/server";
import { z } from "zod";
import { runSparkrun, fireAndForgetSparkrun } from "@/lib/sparkrun";
import { listBenchmarks, getBenchmark } from "@/lib/state";

const SummarySchema = z.object({
  id: z.string(),
  recipe: z.string().nullable(),
  framework: z.string().nullable(),
  status: z.enum(["running", "completed", "partial", "failed", "unknown"]),
  startedAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
  scheduleCount: z.number(),
  completedCount: z.number(),
  failedCount: z.number(),
});

const ProfileSchema = z.object({
  name: z.string(),
  registry: z.string(),
  framework: z.string(),
});

export const list = os.output(z.array(SummarySchema)).handler(async () => {
  return listBenchmarks();
});

export const get = os
  .input(z.object({ id: z.string() }))
  .output(z.object({ state: z.unknown(), consolidated: z.unknown().nullable() }).nullable())
  .handler(async ({ input }) => {
    return (await getBenchmark(input.id)) ?? null;
  });

export const profiles = os.output(z.array(ProfileSchema)).handler(async () => {
  const r = await runSparkrun(["registry", "list-benchmark-profiles"]);
  if (r.code !== 0) return [];
  const out: { name: string; registry: string; framework: string }[] = [];
  const lines = r.stdout.split("\n");
  for (const line of lines) {
    if (!line.trim() || line.startsWith("Profile") || line.startsWith("-")) continue;
    const cols = line.trim().split(/\s{2,}/);
    if (cols.length >= 2) {
      out.push({
        name: cols[0],
        registry: cols[1] ?? "",
        framework: cols[2] ?? "",
      });
    }
  }
  return out;
});

export const run = os
  .input(
    z.object({
      recipe: z.string().min(1),
      cluster: z.string().optional(),
      hosts: z.array(z.string()).optional(),
      tp: z.number().int().min(1).optional(),
      profile: z.string().optional(),
      framework: z.string().optional(),
      skipRun: z.boolean().default(false),
      concurrency: z.array(z.number().int().positive()).optional(),
    }),
  )
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input }) => {
    const args = ["benchmark", "run", input.recipe];
    if (input.cluster) args.push("--cluster", input.cluster);
    else if (input.hosts?.length) args.push("--hosts", input.hosts.join(","));
    if (input.tp) args.push("--tp", String(input.tp));
    if (input.profile) args.push("--profile", input.profile);
    if (input.framework) args.push("--framework", input.framework);
    if (input.skipRun) args.push("--skip-run");
    if (input.concurrency?.length) {
      args.push("-b", `concurrency=${input.concurrency.join(",")}`);
    }
    if (args.length === 3) {
      throw new ORPCError("BAD_REQUEST", { message: "Must specify at least cluster, hosts, or profile" });
    }
    fireAndForgetSparkrun(args);
    return { ok: true as const };
  });
