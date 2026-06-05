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

function matchRecipeParam(param: string | null, recipes: RecipeListItem[]): string | null {
  if (!param) return null;
  const byName = recipes.find((r) => r.name === param);
  if (byName) return byName.name;
  const byFile = recipes.find((r) => r.file === param || r.file.replace(/\.ya?ml$/i, "") === param);
  if (byFile) return byFile.name;
  const bySuffix = recipes.find(
    (r) => r.name.endsWith(`/${param}`) || param.endsWith(`/${r.name}`),
  );
  return bySuffix?.name ?? null;
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
  const clusterParam = searchParams.get("cluster");
  const skipRunParam = searchParams.get("skipRun");
  const skipRunLocked = skipRunParam === "1" || skipRunParam === "true";
  const initialRecipe = matchRecipeParam(recipeParam, recipes) ?? firstRunning(recipes, running);
  const initialCluster =
    (clusterParam && clusters.some((c) => c.name === clusterParam) ? clusterParam : null) ??
    defaultClusterName ??
    clusters[0]?.name ??
    "";
  const [recipe, setRecipe] = useState<string | null>(initialRecipe);
  const [cluster, setCluster] = useState<string>(initialCluster);
  const [profile, setProfile] = useState<string | null>(null);
  const [concurrency, setConcurrency] = useState("5");
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
      const concList = concurrency
        .split(",")
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => Number.isFinite(n) && n > 0);
      const { id } = await rpc.benchmarks.run({
        recipe,
        cluster: cluster || undefined,
        profile: profile || undefined,
        concurrency: concList.length ? concList : undefined,
        skipRun,
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
        <Field
          label="Concurrency (comma-separated)"
          help="e.g. 1,5,10 — overrides benchmark concurrency schedule"
        >
          <Input value={concurrency} onChange={(e) => setConcurrency(e.target.value)} />
        </Field>
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
