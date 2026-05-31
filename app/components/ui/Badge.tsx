import * as React from "react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "sky" | "green" | "amber" | "red" | "purple";

const tones: Record<Tone, string> = {
  neutral: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  sky: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  green: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  red: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  purple: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
};

export function Badge({
  tone = "neutral",
  className,
  ...rest
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
      {...rest}
    />
  );
}
