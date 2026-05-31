"use client";
import { AlertCircle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/cn";
import type { ValidationIssue } from "@/lib/schemas";

export function IssueList({ issues }: { issues: ValidationIssue[] }) {
  if (!issues.length) {
    return (
      <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
        Recipe is valid.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {issues.map((issue, i) => {
        const Icon = issue.severity === "error" ? AlertCircle : AlertTriangle;
        return (
          <li
            key={i}
            className={cn(
              "flex items-start gap-2 rounded-md border px-3 py-2 text-sm",
              issue.severity === "error"
                ? "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
                : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200",
            )}
          >
            <Icon size={16} className="mt-0.5 flex-shrink-0" />
            <div className="flex flex-col">
              <span>{issue.message}</span>
              {(issue.field || issue.line) && (
                <span className="mt-0.5 font-mono text-[11px] opacity-70">
                  {issue.field}
                  {issue.line ? ` · line ${issue.line}` : ""}
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
