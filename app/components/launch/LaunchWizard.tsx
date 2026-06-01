"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Loader2, Play, RefreshCw } from "lucide-react";
import { Button } from "@/app/components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/app/components/ui/Card";
import { Badge } from "@/app/components/ui/Badge";
import { Tabs } from "@/app/components/ui/Tabs";
import { Select } from "@/app/components/ui/Select";
import { CodeBlock } from "@/app/components/ui/CodeBlock";
import { toast } from "@/app/components/ui/Toast";
import { rpc } from "@/lib/rpc/client";
import type { ClusterEntry, RecipeListItem, ValidationIssue } from "@/lib/schemas";
import { YamlEditor } from "./YamlEditor";
import { OverridesForm } from "./OverridesForm";
import { IssueList } from "./IssueList";
import { LogStream } from "@/app/components/logs/LogStream";

type Step = "select" | "edit" | "preview" | "logs";

const STEPS: { id: Step; label: string }[] = [
  { id: "select", label: "Select recipe" },
  { id: "edit", label: "Edit & validate" },
  { id: "preview", label: "Preview" },
  { id: "logs", label: "Logs" },
];

function genDraftId(): string {
  return `d_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

export function LaunchWizard({
  recipes,
  clusters,
  defaultClusterName,
  initialRecipe,
}: {
  recipes: RecipeListItem[];
  clusters: ClusterEntry[];
  defaultClusterName: string | null;
  initialRecipe?: string;
}) {
  const [step, setStep] = useState<Step>(initialRecipe ? "edit" : "select");
  const [selected, setSelected] = useState<string | null>(initialRecipe ?? null);
  const [yamlText, setYamlText] = useState<string>("");
  const [cluster, setCluster] = useState<string>(defaultClusterName ?? clusters[0]?.name ?? "");
  const [draftId] = useState(() => genDraftId());

  const [editorTab, setEditorTab] = useState<string>("form");
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [validating, setValidating] = useState(false);
  const [validatedOnce, setValidatedOnce] = useState(false);

  const [preview, setPreview] = useState<{ ok: boolean; stdout: string; stderr: string } | null>(
    null,
  );
  const [previewing, setPreviewing] = useState(false);

  const [launching, setLaunching] = useState(false);
  const [launchedClusterId, setLaunchedClusterId] = useState<string | null>(null);
  const [stoppingId, setStoppingId] = useState<string | null>(null);

  const portConflicts = useMemo(
    () =>
      issues.filter(
        (i) =>
          i.severity === "error" &&
          i.conflictingClusterId &&
          i.message.includes("Port") &&
          i.message.includes("already used"),
      ),
    [issues],
  );

  const recipesByName = useMemo(
    () => Object.fromEntries(recipes.map((r) => [r.name, r])),
    [recipes],
  );
  const recipeOptions = useMemo(
    () =>
      recipes.map((r) => ({
        value: r.name,
        label: r.name,
        description: `${r.runtime} · ${r.model}${r.min_nodes > 1 ? ` · ${r.min_nodes} nodes` : ""}`,
      })),
    [recipes],
  );
  const clusterOptions = useMemo(
    () =>
      clusters.map((c) => ({
        value: c.name,
        label: c.name + (c.is_default ? " (default)" : ""),
        description: c.hosts.join(", "),
      })),
    [clusters],
  );

  const loadRecipe = useCallback(async (name: string) => {
    try {
      const result = await rpc.recipes.readYaml({ name });
      setYamlText(result.yaml);
      setIssues([]);
      setValidatedOnce(false);
      setPreview(null);
      setStep("edit");
    } catch (err) {
      toast.error("Could not load recipe", err instanceof Error ? err.message : String(err));
    }
  }, []);

  // One-shot: if the page was opened with ?recipe=… (initialRecipe),
  // fetch the YAML on mount.
  useEffect(() => {
    if (initialRecipe) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadRecipe(initialRecipe);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runValidation = useCallback(async () => {
    if (!yamlText) return;
    setValidating(true);
    try {
      const r = await rpc.recipes.validate({
        yaml: yamlText,
        draftId,
        cluster: cluster || undefined,
      });
      setIssues(r.issues);
      setValidatedOnce(true);
    } catch (err) {
      toast.error("Validation failed", err instanceof Error ? err.message : String(err));
    } finally {
      setValidating(false);
    }
  }, [yamlText, draftId, cluster]);

  useEffect(() => {
    if (!yamlText) return;
    if (validateTimer.current) clearTimeout(validateTimer.current);
    validateTimer.current = setTimeout(runValidation, 400);
    return () => {
      if (validateTimer.current) clearTimeout(validateTimer.current);
    };
  }, [yamlText, runValidation]);

  const stopConflicting = useCallback(
    async (clusterId: string) => {
      setStoppingId(clusterId);
      try {
        await rpc.workloads.stop({ clusterId });
        toast.success("Instance stopped", `Stopped ${clusterId}`);
        await runValidation();
      } catch (err) {
        toast.error("Failed to stop instance", err instanceof Error ? err.message : String(err));
      } finally {
        setStoppingId(null);
      }
    },
    [runValidation],
  );

  const generatePreview = useCallback(async () => {
    setPreviewing(true);
    try {
      const r = await rpc.recipes.dryRun({
        yaml: yamlText,
        draftId,
        cluster: cluster || undefined,
      });
      setPreview(r);
    } catch (err) {
      toast.error("Dry-run failed", err instanceof Error ? err.message : String(err));
    } finally {
      setPreviewing(false);
    }
  }, [yamlText, draftId, cluster]);

  const launch = useCallback(async () => {
    setLaunching(true);
    try {
      await rpc.run.start({
        yaml: yamlText,
        draftId,
        cluster: cluster || undefined,
        recipeName: selected ?? undefined,
      });
      toast.success(
        "Launch requested",
        `${selected} is starting on ${cluster || "default cluster"}`,
      );
      setStep("logs");
    } catch (err) {
      toast.error("Launch failed", err instanceof Error ? err.message : String(err));
    } finally {
      setLaunching(false);
    }
  }, [yamlText, draftId, cluster, selected]);

  // Once on the logs step, poll status until the workload for this draft shows up
  // (sparkrun assigns the cluster_id asynchronously after `run` is invoked).
  useEffect(() => {
    if (step !== "logs" || launchedClusterId) return;
    const ac = new AbortController();
    let cancelled = false;
    (async () => {
      try {
        const iter = await rpc.status.stream({ intervalMs: 1500 }, { signal: ac.signal });
        for await (const next of iter) {
          if (cancelled) break;
          const match = next.solo_entries.find((w) => w.meta.recipe?.includes(draftId));
          if (match) {
            setLaunchedClusterId(match.cluster_id);
            break;
          }
        }
      } catch {
        // silent on abort
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [step, launchedClusterId, draftId]);

  const hasErrors = issues.some((i) => i.severity === "error");
  const canAdvanceFromEdit = validatedOnce && !hasErrors;

  return (
    <div className="flex flex-col gap-6">
      <Steps current={step} />

      {step === "select" && (
        <Card>
          <CardHeader>
            <CardTitle>Pick a recipe</CardTitle>
          </CardHeader>
          <CardBody className="flex flex-col gap-3">
            <Select
              value={selected}
              onValueChange={(v) => {
                setSelected(v);
                setYamlText("");
                loadRecipe(v);
              }}
              options={recipeOptions}
              placeholder="Search recipes…"
            />
            {selected && recipesByName[selected] && (
              <div className="flex items-center gap-2">
                <Badge tone="sky">{recipesByName[selected].runtime}</Badge>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {recipesByName[selected].description || recipesByName[selected].model}
                </p>
              </div>
            )}
            <div className="flex justify-end pt-2">
              <Button
                variant="primary"
                disabled={!selected}
                onClick={() => selected && loadRecipe(selected)}
              >
                Continue
                <ArrowRight size={14} />
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {step === "edit" && yamlText && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="font-mono text-sm">{selected}</CardTitle>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  {recipesByName[selected ?? ""]?.model}
                </p>
              </div>
              <div className="w-48">
                <Select
                  value={cluster || null}
                  onValueChange={setCluster}
                  options={clusterOptions}
                  placeholder="Cluster"
                />
              </div>
            </CardHeader>
            <CardBody className="flex flex-col gap-4">
              <Tabs value={editorTab} onValueChange={setEditorTab}>
                <Tabs.List>
                  <Tabs.Tab value="form">Overrides</Tabs.Tab>
                  <Tabs.Tab value="yaml">YAML</Tabs.Tab>
                </Tabs.List>
                <Tabs.Panel value="form">
                  <OverridesForm yaml={yamlText} onYamlChange={setYamlText} />
                </Tabs.Panel>
                <Tabs.Panel value="yaml">
                  <YamlEditor value={yamlText} onChange={setYamlText} issues={issues} />
                </Tabs.Panel>
              </Tabs>
            </CardBody>
          </Card>

          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Validation</CardTitle>
                {validating && <Loader2 size={14} className="animate-spin text-zinc-500" />}
              </CardHeader>
              <CardBody>
                <IssueList issues={issues} />
                {portConflicts.length > 0 && (
                  <div className="mt-3 flex flex-col gap-2">
                    {portConflicts.map((issue) => (
                      <Button
                        key={issue.conflictingClusterId}
                        variant="secondary"
                        size="sm"
                        onClick={() => stopConflicting(issue.conflictingClusterId!)}
                        disabled={stoppingId === issue.conflictingClusterId}
                      >
                        {stoppingId === issue.conflictingClusterId ? (
                          <>
                            <Loader2 size={14} className="animate-spin" /> Stopping…
                          </>
                        ) : (
                          `Stop ${issue.conflictingClusterId}`
                        )}
                      </Button>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>
          </div>
        </div>
      )}

      {step === "preview" && yamlText && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="font-mono text-sm">{selected}</CardTitle>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                {recipesByName[selected ?? ""]?.model} · cluster{" "}
                <span className="font-mono">{cluster || "default"}</span>
              </p>
            </div>
            <Button size="sm" onClick={generatePreview} disabled={previewing}>
              {previewing ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <RefreshCw size={14} />
              )}
              {previewing ? "Generating…" : "Regenerate"}
            </Button>
          </CardHeader>
          <CardBody>
            <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
              Output of <span className="font-mono">sparkrun run --dry-run</span>
            </p>
            {preview ? (
              <CodeBlock>{preview.stdout || preview.stderr || "(no output)"}</CodeBlock>
            ) : (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {previewing ? "Generating…" : "No preview yet."}
              </p>
            )}
          </CardBody>
        </Card>
      )}

      {step === "logs" && (
        <Card>
          <CardHeader>
            <CardTitle className="font-mono text-sm">{selected}</CardTitle>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {recipesByName[selected ?? ""]?.model} · cluster{" "}
              <span className="font-mono">{cluster || "default"}</span>
            </p>
          </CardHeader>
          <CardBody>
            {launchedClusterId ? (
              <LogStream clusterId={launchedClusterId} tail={200} />
            ) : (
              <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                <Loader2 size={14} className="animate-spin" />
                Waiting for the workload to start…
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {step !== "select" && step !== "logs" && (
        <div className="flex items-center justify-between border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <Button
            variant="ghost"
            onClick={() => {
              const idx = STEPS.findIndex((s) => s.id === step);
              if (idx > 0) setStep(STEPS[idx - 1].id);
            }}
          >
            <ArrowLeft size={14} />
            Back
          </Button>
          <div className="flex gap-2">
            {step === "edit" && (
              <Button
                variant="primary"
                disabled={!canAdvanceFromEdit}
                onClick={() => {
                  setStep("preview");
                  if (!preview) generatePreview();
                }}
              >
                Continue to preview
                <ArrowRight size={14} />
              </Button>
            )}
            {step === "preview" && (
              <Button
                variant="primary"
                onClick={launch}
                disabled={launching || hasErrors || !preview?.ok}
              >
                {launching ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                {launching ? "Launching…" : `Launch on ${cluster || "default"}`}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Steps({ current }: { current: Step }) {
  const currentIdx = STEPS.findIndex((s) => s.id === current);
  return (
    <ol className="flex items-center gap-2 text-sm">
      {STEPS.map((s, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <li key={s.id} className="flex items-center gap-2">
            <span
              className={
                "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium " +
                (done
                  ? "bg-sky-600 text-white"
                  : active
                    ? "bg-sky-600/20 text-sky-700 ring-1 ring-sky-600 dark:text-sky-300"
                    : "bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400")
              }
            >
              {i + 1}
            </span>
            <span
              className={
                active
                  ? "font-medium text-zinc-900 dark:text-zinc-100"
                  : "text-zinc-500 dark:text-zinc-400"
              }
            >
              {s.label}
            </span>
            {i < STEPS.length - 1 && <span className="text-zinc-300 dark:text-zinc-700">›</span>}
          </li>
        );
      })}
    </ol>
  );
}
