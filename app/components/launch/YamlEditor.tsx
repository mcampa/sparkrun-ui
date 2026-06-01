"use client";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import { EditorState, Compartment } from "@codemirror/state";
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  drawSelection,
} from "@codemirror/view";
import { yaml } from "@codemirror/lang-yaml";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { linter, lintGutter, type Diagnostic } from "@codemirror/lint";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import type { ValidationIssue } from "@/lib/schemas";

// YAML token colors are driven by CSS variables (defined in globals.css)
// so the same HighlightStyle reads well on both the light and dark
// editor backgrounds without needing to swap rules at runtime.
const yamlHighlight = HighlightStyle.define([
  { tag: t.propertyName, color: "var(--cm-property)" },
  { tag: [t.string, t.content], color: "var(--cm-string)" },
  { tag: t.attributeValue, color: "var(--cm-atom)" },
  { tag: [t.lineComment, t.comment], color: "var(--cm-comment)", fontStyle: "italic" },
  { tag: t.keyword, color: "var(--cm-keyword)" },
  { tag: [t.meta, t.typeName], color: "var(--cm-meta)" },
  { tag: [t.punctuation, t.separator, t.brace, t.squareBracket], color: "var(--cm-punct)" },
]);

const baseExtensions = [
  lineNumbers(),
  history(),
  drawSelection(),
  highlightActiveLine(),
  keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
  yaml(),
  syntaxHighlighting(yamlHighlight, { fallback: true }),
  lintGutter(),
  EditorView.theme({
    "&": { fontSize: "12px", height: "100%" },
    ".cm-content": {
      fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
      padding: "8px 0",
    },
    ".cm-gutters": {
      backgroundColor: "transparent",
      color: "rgb(161 161 170)",
      border: "none",
    },
    "&.cm-focused": { outline: "none" },
    ".cm-lintRange-error": { backgroundImage: "none", borderBottom: "2px wavy rgb(220 38 38)" },
    ".cm-tooltip": {
      backgroundColor: "rgb(24 24 27)",
      color: "rgb(250 250 250)",
      border: "1px solid rgb(63 63 70)",
      borderRadius: "6px",
      padding: "4px 8px",
      fontSize: "12px",
      maxWidth: "320px",
    },
    ".cm-tooltip.cm-tooltip-lint": {},
  }),
];

export function YamlEditor({
  value,
  onChange,
  issues = [],
  readOnly = false,
  className,
}: {
  value: string;
  onChange?: (value: string) => void;
  issues?: ValidationIssue[];
  readOnly?: boolean;
  className?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const issuesRef = useRef(issues);
  const onChangeRef = useRef(onChange);
  const linterCompartment = useRef(new Compartment());
  const readOnlyCompartment = useRef(new Compartment());

  useEffect(() => {
    issuesRef.current = issues;
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    if (!hostRef.current) return;

    const linterExt = linter((view) => buildDiagnostics(view, issuesRef.current));

    const state = EditorState.create({
      doc: value,
      extensions: [
        ...baseExtensions,
        readOnlyCompartment.current.of(EditorState.readOnly.of(readOnly)),
        linterCompartment.current.of(linterExt),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current?.(update.state.doc.toString());
          }
        }),
      ],
    });

    const view = new EditorView({ state, parent: hostRef.current });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== value) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      });
    }
  }, [value]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: linterCompartment.current.reconfigure(
        linter((v) => buildDiagnostics(v, issuesRef.current)),
      ),
    });
  }, [issues]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: readOnlyCompartment.current.reconfigure(EditorState.readOnly.of(readOnly)),
    });
  }, [readOnly]);

  return (
    <div
      ref={hostRef}
      className={cn(
        "h-[420px] overflow-hidden rounded-md border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950",
        className,
      )}
    />
  );
}

function buildDiagnostics(view: EditorView, issues: ValidationIssue[]): Diagnostic[] {
  const docLines = view.state.doc.lines;
  return issues
    .filter(
      (i): i is ValidationIssue & { line: number } => typeof i.line === "number" && i.line > 0,
    )
    .map((i) => {
      const lineNum = Math.min(i.line, docLines);
      const line = view.state.doc.line(lineNum);
      return {
        from: line.from,
        to: line.to,
        severity: i.severity === "warning" ? "warning" : "error",
        message: i.message,
      } satisfies Diagnostic;
    });
}
