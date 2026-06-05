"use client";
import { useState, useMemo, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Play, Loader2, X, AlertTriangle } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/app/components/ui/Card";
import { Field, Input } from "@/app/components/ui/Field";
import { Select } from "@/app/components/ui/Select";
import { Button } from "@/app/components/ui/Button";
import { Switch } from "@/app/components/ui/Switch";
import { toast } from "@/app/components/ui/Toast";
import { rpc } from "@/lib/rpc/client";
import type { ClusterEntry, RecipeListItem } from "@/lib/schemas";

type Profile = { name: string; registry: string; framework: string };

type PresetValues = { concurrency: string; pp: string; tg: string; depth: string };
const PRESETS: Record<string, PresetValues & { label: string; description: string }> = {
  smoke: {
    label: "Smoke",
    description: "1 task — quick sanity check",
    concurrency: "1",
    pp: "2048",
    tg: "128",
    depth: "0",
  },
  arena: {
    label: "Arena v2",
    description: "28 tasks — matches @official/spark-arena-v2",
    concurrency: "1,2,5,10",
    pp: "2048",
    tg: "128",
    depth: "0,4096,8192,16384,32768,65535,100000",
  },
  sweep: {
    label: "Sweep",
    description: "48 tasks — broader matrix",
    concurrency: "1,2,4,8",
    pp: "1024,2048,4096",
    tg: "128",
    depth: "0,8192,32768,100000",
  },
};

function parseList(s: string, allowZero: boolean): number[] {
  return s
    .split(",")
    .map((p) => parseInt(p.trim(), 10))
    .filter((n) => Number.isFinite(n) && (allowZero ? n >= 0 : n > 0));
}

function buildCommandPreview({
  recipe,
  cluster,
  profile,
  skipRun,
  concList,
  ppList,
  tgList,
  depthList,
  servedModelName,
}: {
  recipe: string | null;
  cluster: string;
  profile: string | null;
  skipRun: boolean;
  concList: number[];
  ppList: number[];
  tgList: number[];
  depthList: number[];
  servedModelName: string | null;
}): string {
  if (!recipe) return "";
  const args = ["sparkrun", "benchmark", "run", recipe];
  if (cluster) args.push("--cluster", cluster);
  if (profile) args.push("--profile", profile);
  if (skipRun) args.push("--skip-run");
  if (concList.length) args.push("-b", `concurrency=${concList.join(",")}`);
  if (ppList.length) args.push("-b", `pp=${ppList.join(",")}`);
  if (tgList.length) args.push("-b", `tg=${tgList.join(",")}`);
  if (depthList.length) args.push("-b", `depth=${depthList.join(",")}`);
  if (servedModelName) args.push("-b", `served_model_name=${servedModelName}`);
  args.push("--fresh");
  return args.join(" ");
}

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
  const [concurrency, setConcurrency] = useState(PRESETS.arena.concurrency);
  const [pp, setPp] = useState(PRESETS.arena.pp);
  const [tg, setTg] = useState(PRESETS.arena.tg);
  const [depth, setDepth] = useState(PRESETS.arena.depth);
  const [skipRun, setSkipRun] = useState(
    skipRunLocked || (initialRecipe !== null && running.has(initialRecipe)),
  );
  const [submitting, setSubmitting] = useState(false);

  const applyPreset = (key: keyof typeof PRESETS) => {
    const p = PRESETS[key];
    setConcurrency(p.concurrency);
    setPp(p.pp);
    setTg(p.tg);
    setDepth(p.depth);
  };

  const concList = parseList(concurrency, false);
  const ppList = parseList(pp, false);
  const tgList = parseList(tg, false);
  const depthList = parseList(depth, true);
  const taskCount = concList.length * ppList.length * tgList.length * depthList.length;

  const [recipeInfo, setRecipeInfo] = useState<{
    recipe: string | null;
    maxModelLen: number | null;
  }>({ recipe: null, maxModelLen: null });
  useEffect(() => {
    if (!recipe) return;
    let cancelled = false;
    rpc.recipes
      .info({ name: recipe })
      .then((r) => {
        if (!cancelled) setRecipeInfo({ recipe, maxModelLen: r.vram?.max_model_len ?? null });
      })
      .catch(() => {
        if (!cancelled) setRecipeInfo({ recipe, maxModelLen: null });
      });
    return () => {
      cancelled = true;
    };
  }, [recipe]);
  const maxModelLen = recipeInfo.recipe === recipe ? recipeInfo.maxModelLen : null;

  // Worst-case context request the matrix could send: largest depth + largest pp + largest tg.
  const worstContext =
    depthList.length && ppList.length && tgList.length
      ? Math.max(...depthList) + Math.max(...ppList) + Math.max(...tgList)
      : 0;
  const exceedsModelLen = maxModelLen !== null && worstContext > maxModelLen;

  const removeFromList = (
    csv: string,
    setter: (s: string) => void,
    index: number,
    allowZero: boolean,
  ) => {
    const next = parseList(csv, allowZero)
      .filter((_, i) => i !== index)
      .join(",");
    setter(next);
  };

  const previewCmd = buildCommandPreview({
    recipe,
    cluster,
    profile,
    skipRun,
    concList,
    ppList,
    tgList,
    depthList,
    servedModelName: servedModelNameParam,
  });

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
      const { id } = await rpc.benchmarks.run({
        recipe,
        cluster: cluster || undefined,
        profile: profile || undefined,
        concurrency: concList.length ? concList : undefined,
        pp: ppList.length ? ppList : undefined,
        tg: tgList.length ? tgList : undefined,
        depth: depthList.length ? depthList : undefined,
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
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Benchmark schedule
            </span>
            <div className="flex gap-1">
              {(Object.keys(PRESETS) as Array<keyof typeof PRESETS>).map((k) => (
                <Button
                  key={k}
                  variant="ghost"
                  size="sm"
                  onClick={() => applyPreset(k)}
                  title={PRESETS[k].description}
                >
                  {PRESETS[k].label}
                </Button>
              ))}
            </div>
          </div>
          {profile && (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Profile <span className="font-mono">{profile}</span> defines its own schedule; the
              values below override it via <span className="font-mono">-b</span> flags.
            </p>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ListField
              label="Concurrency"
              help="Parallel requests — comma-separated"
              value={concurrency}
              parsed={concList}
              onChange={setConcurrency}
              onRemove={(i) => removeFromList(concurrency, setConcurrency, i, false)}
            />
            <ListField
              label="Prompt processing (pp)"
              help="Input token counts — comma-separated"
              value={pp}
              parsed={ppList}
              onChange={setPp}
              onRemove={(i) => removeFromList(pp, setPp, i, false)}
            />
            <ListField
              label="Token generation (tg)"
              help="Output token counts — comma-separated"
              value={tg}
              parsed={tgList}
              onChange={setTg}
              onRemove={(i) => removeFromList(tg, setTg, i, false)}
            />
            <ListField
              label="Context depth"
              help={
                exceedsModelLen
                  ? `Largest depth+pp+tg (${worstContext.toLocaleString()}) exceeds recipe max_model_len (${maxModelLen?.toLocaleString()})`
                  : "Prior conversation tokens — comma-separated"
              }
              value={depth}
              parsed={depthList}
              allowZero
              warn={exceedsModelLen}
              onChange={setDepth}
              onRemove={(i) => removeFromList(depth, setDepth, i, true)}
            />
          </div>
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
        {recipe && (
          <div className="flex flex-col gap-2 rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Command</span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {taskCount > 0
                  ? `Will run ${taskCount} task${taskCount === 1 ? "" : "s"}`
                  : "No tasks — fix empty fields"}
              </span>
            </div>
            <code className="block overflow-x-auto font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
              {previewCmd}
            </code>
          </div>
        )}
        <div className="flex justify-end">
          <Button
            variant="primary"
            disabled={!recipe || submitting || taskCount === 0}
            onClick={submit}
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            {submitting ? "Starting…" : "Start benchmark"}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

function ListField({
  label,
  help,
  value,
  parsed,
  warn,
  allowZero,
  onChange,
  onRemove,
}: {
  label: string;
  help: string;
  value: string;
  parsed: number[];
  warn?: boolean;
  allowZero?: boolean;
  onChange: (s: string) => void;
  onRemove: (i: number) => void;
}) {
  const trimmed = value.trim();
  const empty = parsed.length === 0;
  const error = !empty
    ? undefined
    : trimmed === ""
      ? "Enter at least one number"
      : allowZero
        ? "No valid non-negative numbers"
        : "No valid positive numbers";
  const helpEl = warn ? (
    <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
      <AlertTriangle size={12} />
      {help}
    </span>
  ) : (
    help
  );

  return (
    <Field label={label} help={error ? undefined : helpEl} error={error}>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
      {parsed.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {parsed.map((n, i) => (
            <span
              key={`${i}-${n}`}
              className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px] text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            >
              {n.toLocaleString()}
              <button
                type="button"
                onClick={() => onRemove(i)}
                aria-label={`Remove ${n}`}
                className="text-zinc-400 hover:text-red-600 dark:text-zinc-500 dark:hover:text-red-400"
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}
    </Field>
  );
}
