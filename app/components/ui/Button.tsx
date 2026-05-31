import * as React from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors cursor-pointer " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 " +
  "focus-visible:ring-offset-zinc-50 dark:focus-visible:ring-offset-zinc-950 " +
  "focus-visible:ring-sky-500 disabled:opacity-50 disabled:cursor-not-allowed";

const variants: Record<Variant, string> = {
  primary:
    "bg-sky-600 text-white hover:bg-sky-500 active:bg-sky-700 " +
    "dark:bg-sky-500 dark:hover:bg-sky-400",
  secondary:
    "bg-zinc-100 text-zinc-900 hover:bg-zinc-200 active:bg-zinc-300 " +
    "dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700 dark:active:bg-zinc-600 " +
    "border border-zinc-200 dark:border-zinc-700",
  ghost:
    "text-zinc-700 hover:bg-zinc-100 active:bg-zinc-200 " +
    "dark:text-zinc-300 dark:hover:bg-zinc-800 dark:active:bg-zinc-700",
  danger:
    "bg-red-600 text-white hover:bg-red-500 active:bg-red-700 " +
    "dark:bg-red-500 dark:hover:bg-red-400",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-9 px-4 text-sm",
  lg: "h-10 px-5 text-base",
};

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button({ variant = "secondary", size = "md", className, ...rest }, ref) {
    return (
      <button
        ref={ref}
        className={cn(base, variants[variant], sizes[size], className)}
        {...rest}
      />
    );
  },
);
