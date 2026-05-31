"use client";
import { useEffect, useRef } from "react";
import { EditorState, Compartment } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLine, drawSelection } from "@codemirror/view";
import { yaml } from "@codemirror/lang-yaml";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { linter, lintGutter, type Diagnostic } from "@codemirror/lint";
import type { ValidationIssue } from "@/lib/schemas";

const baseExtensions = [
  lineNumbers(),
  history(),
  drawSelection(),
  highlightActiveLine(),
  keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
  yaml(),
  lintGutter(),
  EditorView.theme({
    "&": { fontSize: "12px", height: "100%" },
    ".cm-content": { fontFamily: "var(--font-geist-mono), ui-monospace, monospace", padding: "8px 0" },
    ".cm-gutters": {
      backgroundColor: "transparent",
      color: "rgb(161 161 170)",
      border: "none",
    },
    "&.cm-focused": { outline: "none" },
    ".cm-lintRange-error": { backgroundImage: "none", borderBottom: "2px wavy rgb(220 38 38)" },
  }),
];

export function YamlEditor({
  value,
  onChange,
  issues = [],
  readOnly = false,
}: {
  value: string;
  onChange?: (value: string) => void;
  issues?: ValidationIssue[];
  readOnly?: boolean;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const issuesRef = useRef(issues);
  const onChangeRef = useRef(onChange);
  const linterCompartment = useRef(new Compartment());
  const readOnlyCompartment = useRef(new Compartment());

  issuesRef.current = issues;
  onChangeRef.current = onChange;

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
      className="h-[420px] overflow-hidden rounded-md border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
    />
  );
}

function buildDiagnostics(view: EditorView, issues: ValidationIssue[]): Diagnostic[] {
  const docLines = view.state.doc.lines;
  return issues
    .filter((i): i is ValidationIssue & { line: number } => typeof i.line === "number" && i.line > 0)
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
