"use client";
import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { Rocket, Search } from "lucide-react";
import { Card, CardBody } from "@/app/components/ui/Card";
import { Badge } from "@/app/components/ui/Badge";
import { Button } from "@/app/components/ui/Button";
import { Select } from "@/app/components/ui/Select";
import { Switch } from "@/app/components/ui/Switch";
import { Input } from "@/app/components/ui/Field";
import type { RecipeListItem } from "@/lib/schemas";
import { RecipeInfoPopover } from "./RecipeInfoPopover";
import { RecipeShowDialog } from "./RecipeShowDialog";

export function RecipesBrowser({
  recipes,
  runningRecipes,
}: {
  recipes: RecipeListItem[];
  runningRecipes: string[];
}) {
  const running = useMemo(() => new Set(runningRecipes), [runningRecipes]);
  const runningCount = useMemo(
    () => recipes.filter((r) => running.has(r.name)).length,
    [recipes, running],
  );
  const [registry, setRegistry] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("recipes-registry") ?? "all";
    }
    return "all";
  });
  const [search, setSearch] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("recipes-search") ?? "";
    }
    return "";
  });
  const [showRunningOnly, setShowRunningOnly] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("recipes-running-only") === "true";
    }
    return false;
  });

  useEffect(() => {
    localStorage.setItem("recipes-registry", registry);
  }, [registry]);

  useEffect(() => {
    localStorage.setItem("recipes-search", search);
  }, [search]);

  useEffect(() => {
    localStorage.setItem("recipes-running-only", String(showRunningOnly));
  }, [showRunningOnly]);

  const [openRecipe, setOpenRecipe] = useState<string | null>(null);

  const registries = useMemo(() => {
    const set = new Set<string>();
    for (const r of recipes) set.add(r.registry);
    return Array.from(set).sort();
  }, [recipes]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return recipes.filter((r) => {
      if (showRunningOnly && !running.has(r.name)) return false;
      if (registry !== "all" && r.registry !== registry) return false;
      if (!term) return true;
      const hay = `${r.name} ${r.model} ${r.description ?? ""} ${r.runtime}`.toLowerCase();
      return hay.includes(term);
    });
  }, [recipes, registry, search, showRunningOnly, running]);

  const byRegistry = useMemo(() => {
    const m = new Map<string, RecipeListItem[]>();
    for (const r of filtered) {
      const arr = m.get(r.registry) ?? [];
      arr.push(r);
      m.set(r.registry, arr);
    }
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const registryOptions = [
    { value: "all", label: "All registries", description: `${recipes.length} recipes` },
    ...registries.map((reg) => ({
      value: reg,
      label: `@${reg}`,
      description: `${recipes.filter((r) => r.registry === reg).length} recipes`,
    })),
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-baseline gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Recipes</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {filtered.length} of {recipes.length}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-44">
            <Select
              value={registry}
              onValueChange={setRegistry}
              options={registryOptions}
              placeholder="Registry"
            />
          </div>
          <div className="relative w-56">
            <Search
              size={14}
              className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-zinc-400"
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="pl-8"
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-600 select-none dark:text-zinc-400">
            <Switch checked={showRunningOnly} onCheckedChange={setShowRunningOnly} />
            Running
            {runningCount > 0 && <span className="text-zinc-400">({runningCount})</span>}
          </label>
        </div>
      </div>

      {openRecipe && (
        <RecipeShowDialog
          name={openRecipe}
          open={true}
          onOpenChange={(o) => !o && setOpenRecipe(null)}
          running={running.has(openRecipe)}
        />
      )}

      {byRegistry.length === 0 ? (
        <Card>
          <CardBody className="text-sm text-zinc-500 dark:text-zinc-400">
            No recipes match these filters.
          </CardBody>
        </Card>
      ) : (
        byRegistry.map(([reg, rows]) => (
          <section key={reg} className="flex flex-col gap-3">
            <h2 className="font-mono text-sm font-medium text-zinc-700 dark:text-zinc-300">
              @{reg}
              <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-500">({rows.length})</span>
            </h2>
            <Card>
              <CardBody className="p-0">
                <table className="w-full text-sm">
                  <thead className="border-b border-zinc-200 bg-zinc-50 text-left text-xs font-medium tracking-wider text-zinc-500 uppercase dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
                    <tr>
                      <th className="px-4 py-2">Name</th>
                      <th className="px-4 py-2">Model</th>
                      <th className="px-4 py-2">Nodes</th>
                      <th className="px-4 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {rows.map((r) => (
                      <tr key={r.name} className="hover:bg-zinc-50 dark:hover:bg-zinc-950">
                        <td className="px-4 py-2 font-mono text-xs">
                          <div className="flex items-center gap-2">
                            <RecipeInfoPopover name={r.name}>
                              <button
                                type="button"
                                onClick={() => setOpenRecipe(r.name)}
                                className="cursor-pointer underline decoration-zinc-400 decoration-dotted underline-offset-2 hover:text-sky-600 dark:hover:text-sky-400"
                              >
                                {r.file}
                              </button>
                            </RecipeInfoPopover>
                            {running.has(r.name) && <Badge tone="green">running</Badge>}
                          </div>
                        </td>
                        <td className="px-4 py-2 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                          <div>{r.model}</div>
                          <Badge tone="sky">{r.runtime}</Badge>
                        </td>
                        <td className="px-4 py-2 text-xs text-zinc-600 dark:text-zinc-400">
                          <span
                            title="Minimum number of DGX Spark nodes required to run this recipe"
                            className="cursor-help underline decoration-zinc-400 decoration-dotted underline-offset-2"
                          >
                            {r.min_nodes}
                            {r.tp && r.tp !== "" && ` · tp=${r.tp}`}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right">
                          <Link href={`/launch?recipe=${encodeURIComponent(r.name)}`}>
                            <Button size="sm" variant="primary">
                              <Rocket size={12} />
                              Launch
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardBody>
            </Card>
          </section>
        ))
      )}
    </div>
  );
}
