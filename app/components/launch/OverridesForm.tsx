"use client";
import { useMemo } from "react";
import { parseDocument } from "yaml";
import { Field, Input } from "@/app/components/ui/Field";
import { NumberField } from "@/app/components/ui/NumberField";
import { Switch } from "@/app/components/ui/Switch";

type FieldDef = {
  key: string;
  kind: "number" | "boolean" | "string";
  min?: number;
  max?: number;
  step?: number;
  help?: string;
};

const KNOWN: Record<string, Omit<FieldDef, "key" | "kind">> = {
  tensor_parallel: { min: 1, max: 8, step: 1, help: "Tensor parallel size (= node count)" },
  pipeline_parallel: { min: 1, max: 8, step: 1 },
  port: { min: 1024, max: 65535, step: 1 },
  gpu_memory_utilization: { min: 0.05, max: 0.95, step: 0.05 },
  max_model_len: { min: 1024, step: 1024 },
  max_num_batched_tokens: { min: 256, step: 256 },
  max_num_seqs: { min: 1 },
};

export function OverridesForm({
  yaml,
  onYamlChange,
}: {
  yaml: string;
  onYamlChange: (yaml: string) => void;
}) {
  const { defaults, fields } = useMemo(() => parseDefaults(yaml), [yaml]);

  const setValue = (key: string, value: unknown) => {
    try {
      const doc = parseDocument(yaml);
      doc.setIn(["defaults", key], value);
      onYamlChange(String(doc));
    } catch {
      // ignore parse errors — editor will surface them
    }
  };

  if (!fields.length) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        This recipe has no <code className="font-mono">defaults</code> block.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {fields.map((f) => {
        const value = defaults[f.key];
        if (f.kind === "boolean") {
          return (
            <Field key={f.key} label={f.key} help={f.help}>
              <Switch
                checked={Boolean(value)}
                onCheckedChange={(checked) => setValue(f.key, checked)}
              />
            </Field>
          );
        }
        if (f.kind === "number") {
          return (
            <Field key={f.key} label={f.key} help={f.help}>
              <NumberField
                value={typeof value === "number" ? value : null}
                onValueChange={(v) => v != null && setValue(f.key, v)}
                min={f.min}
                max={f.max}
                step={f.step}
              />
            </Field>
          );
        }
        return (
          <Field key={f.key} label={f.key} help={f.help}>
            <Input
              value={value == null ? "" : String(value)}
              onChange={(e) => setValue(f.key, e.target.value)}
            />
          </Field>
        );
      })}
    </div>
  );
}

function parseDefaults(yamlText: string): {
  defaults: Record<string, unknown>;
  fields: FieldDef[];
} {
  try {
    const doc = parseDocument(yamlText);
    const defaults = (doc.get("defaults") as { toJSON?: () => unknown } | undefined)?.toJSON?.() as
      | Record<string, unknown>
      | undefined;
    if (!defaults || typeof defaults !== "object") return { defaults: {}, fields: [] };
    const fields: FieldDef[] = Object.keys(defaults).map((key) => {
      const value = defaults[key];
      const known = KNOWN[key] ?? {};
      const kind: FieldDef["kind"] =
        typeof value === "boolean" ? "boolean" : typeof value === "number" ? "number" : "string";
      return { key, kind, ...known };
    });
    return { defaults, fields };
  } catch {
    return { defaults: {}, fields: [] };
  }
}
