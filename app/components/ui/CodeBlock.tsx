import * as React from "react";
import { cn } from "@/lib/cn";

export function CodeBlock({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <pre
      className={cn(
        "max-h-[60vh] overflow-auto rounded-md border border-zinc-200 bg-zinc-50 p-3",
        "font-mono text-xs text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200",
        className,
      )}
    >
      {children}
    </pre>
  );
}
