"use client";
import { Field as BaseField } from "@base-ui/react/field";
import * as React from "react";
import { cn } from "@/lib/cn";

export function Field({
  label,
  help,
  error,
  className,
  children,
}: {
  label?: React.ReactNode;
  help?: React.ReactNode;
  error?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <BaseField.Root className={cn("flex flex-col gap-1", className)}>
      {label && (
        <BaseField.Label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
          {label}
        </BaseField.Label>
      )}
      {children}
      {help && !error && (
        <BaseField.Description className="text-xs text-zinc-500 dark:text-zinc-500">
          {help}
        </BaseField.Description>
      )}
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </BaseField.Root>
  );
}

export const inputCls =
  "h-9 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm " +
  "text-zinc-900 shadow-sm placeholder:text-zinc-400 " +
  "focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30 " +
  "dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return <input ref={ref} className={cn(inputCls, className)} {...rest} />;
  },
);
