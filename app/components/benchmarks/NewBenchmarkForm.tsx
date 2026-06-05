"use client";
import { useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Play, Loader2 } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/app/components/ui/Card";
import { Field, Input } from "@/app/components/ui/Field";
import { Select } from "@/app/components/ui/Select";
import { Button } from "@/app/components/ui/Button";
import { Switch } from "@/app/components/ui/Switch";
import { toast } from "@/app/components/ui/Toast";
import { rpc } from "@/lib/rpc/client";
import type { ClusterEntry, RecipeListItem } from "@/lib/schemas";

type Profile = { name: string; registry: string; framework: string };

function firstRunning(recipes: RecipeListItem[], running: Set<string>): string | null {
  for (const r of recipes) {
    if (running.has(r.name)) return r.name;
  }
  return null;
}

function matchRecipeParam(
  recipeParam: string | null,
  modelParam: string | null,
  recipes: RecipeListItem[],
  running: Set<string>,
): string | null {
  if (recipeParam) {
    const byName = recipes.find((r) => r.name === recipeParam);
    if (byName) return byName.name;
    const byFile = recipes.find(
      (r) => r.file === recipeParam || r.file.replace(/\.ya?ml$/i, "") === recipeParam,
    );
    if (byFile) return byFile.name;
    const bySuffix = recipes.find(
      (r) => r.name.endsWith(`/${recipeParam}`) || recipeParam.endsWith(`/${r.name}`),
    );
    if (bySuffix) return bySuffix.name;
  }
  if (modelParam) {
    const candidates = recipes.filter((r) => r.model === modelParam);
    const runningOne = candidates.find((r) => running.has(r.name));
    if (runningOne) return runningOne.name;
    if (candidates[0]) return candidates[0].name;
  }
  return null;
}

export function NewBenchmarkForm({
  recipes,
  clusters,
  profiles,
  defaultClusterName,
  runningRecipes,
}: {
  recipes: RecipeListItem[];
  clusters: ClusterEntry[];
  profiles: Profile[];
  defaultClusterName: string | null;
  runningRecipes: string[];
}) {
  const running = useMemo(() => new Set(runningRecipes), [runningRecipes]);
  const router = useRouter();
  const searchParams = useSearchParams();
  const recipeParam = searchParams.get("recipe");
  const modelParam = searchParams.get("model");
  const clusterParam = searchParams.get("cluster");
  const skipRunParam = searchParams.get("skipRun");
  const servedModelNameParam = searchParams.get("servedModelName");
  const skipRunLocked = skipRunParam === "1" || skipRunParam === "true";
  const initialRecipe =
    matchRecipeParam(recipeParam, modelParam, recipes, running) ?? firstRunning(recipes, running);
  const initialCluster =
    (clusterParam && clusters.some((c) => c.name === clusterParam) ? clusterParam : null) ??
    defaultClusterName ??
    clusters[0]?.name ??
    "";
  const [recipe, setRecipe] = useState<string | null>(initialRecipe);
  const [cluster, setCluster] = useState<string>(initialCluster);
  const [profile, setProfile] = useState<string | null>(null);
  const [concurrency, setConcurrency] = useState("1,2,5,10");
  const [pp, setPp] = useState("2048");
  const [tg, setTg] = useState("128");
  const [depth, setDepth] = useState("0,4096,8192,16384,32768,65535,100000");
  const [skipRun, setSkipRun] = useState(
    skipRunLocked || (initialRecipe !== null && running.has(initialRecipe)),
  );
  const [submitting, setSubmitting] = useState(false);

  const recipeOptions = recipes.map((r) => ({
    value: r.name,
    label: r.name,
    description: `${r.runtime} · ${r.model}`,
    badge: running.has(r.name) ? { text: "running", tone: "green" as const } : undefined,
  }));
  const clusterOptions = clusters.map((c) => ({
    value: c.name,
    label: c.name + (c.is_default ? " (default)" : ""),
    description: c.hosts.join(", "),
  }));
  const profileOptions = [
    { value: "", label: "(none)", description: "Use recipe / framework defaults" },
    ...profiles.map((p) => ({
      value: p.name,
      label: p.name,
      description: `${p.registry} · ${p.framework}`,
    })),
  ];

  const submit = async () => {
    if (!recipe) return;
    setSubmitting(true);
    try {
      const parseList = (s: string, allowZero: boolean): number[] =>
        s
          .split(",")
          .map((p) => parseInt(p.trim(), 10))
          .filter((n) => Number.isFinite(n) && (allowZero ? n >= 0 : n > 0));
      const { id } = await rpc.benchmarks.run({
        recipe,
        cluster: cluster || undefined,
        profile: profile || undefined,
        concurrency: parseList(concurrency, false).length
          ? parseList(concurrency, false)
          : undefined,
        pp: parseList(pp, false).length ? parseList(pp, false) : undefined,
        tg: parseList(tg, false).length ? parseList(tg, false) : undefined,
        depth: parseList(depth, true).length ? parseList(depth, true) : undefined,
        skipRun,
        servedModelName: servedModelNameParam || undefined,
      });
      toast.success("Benchmark started", `${recipe} on ${cluster || "default"}`);
      router.push(`/benchmarks/${id}`);
    } catch (err) {
      toast.error("Benchmark failed to start", err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>New benchmark</CardTitle>
      </CardHeader>
      <CardBody className="flex flex-col gap-4">
        <Field label="Recipe">
          <Select
            value={recipe}
            onValueChange={setRecipe}
            options={recipeOptions}
            placeholder="Pick a recipe…"
          />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Cluster">
            <Select
              value={cluster || null}
              onValueChange={setCluster}
              options={clusterOptions}
              placeholder="Pick a cluster…"
            />
          </Field>
          <Field label="Profile">
            <Select
              value={profile}
              onValueChange={(v) => setProfile(v || null)}
              options={profileOptions}
              placeholder="(none)"
            />
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Concurrency" help="Parallel requests — comma-separated">
            <Input value={concurrency} onChange={(e) => setConcurrency(e.target.value)} />
          </Field>
          <Field label="Prompt processing (pp)" help="Input token counts — comma-separated">
            <Input value={pp} onChange={(e) => setPp(e.target.value)} />
          </Field>
          <Field label="Token generation (tg)" help="Output token counts — comma-separated">
            <Input value={tg} onChange={(e) => setTg(e.target.value)} />
          </Field>
          <Field label="Context depth" help="Prior conversation tokens — comma-separated">
            <Input value={depth} onChange={(e) => setDepth(e.target.value)} />
          </Field>
        </div>
        <Field
          label="Skip launching inference"
          help={
            skipRunLocked
              ? "Locked because you launched from a running workload"
              : "Benchmark against an already-running instance"
          }
        >
          <Switch checked={skipRun} onCheckedChange={setSkipRun} disabled={skipRunLocked} />
        </Field>
        <div className="flex justify-end">
          <Button variant="primary" disabled={!recipe || submitting} onClick={submit}>
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            {submitting ? "Starting…" : "Start benchmark"}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
