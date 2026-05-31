"use client";
import * as React from "react";
import { cn } from "@/lib/cn";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm " +
          "text-zinc-900 shadow-sm placeholder:text-zinc-400 " +
          "focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 focus:outline-none " +
          "dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 " +
          "resize-none",
        className,
      )}
      {...rest}
    />
  );
});
