"use client";
import { NumberField as BaseNumberField } from "@base-ui/react/number-field";
import { cn } from "@/lib/cn";
import { inputCls } from "./Field";

export function NumberField({
  value,
  onValueChange,
  min,
  max,
  step,
  className,
}: {
  value: number | null;
  onValueChange: (value: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
}) {
  return (
    <BaseNumberField.Root
      value={value}
      onValueChange={onValueChange}
      min={min}
      max={max}
      step={step}
      className={cn("inline-flex w-full", className)}
    >
      <BaseNumberField.Group className="flex w-full">
        <BaseNumberField.Decrement className="rounded-l-md border border-r-0 border-zinc-300 bg-zinc-50 px-2 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700">
          −
        </BaseNumberField.Decrement>
        <BaseNumberField.Input className={cn(inputCls, "rounded-none border-x-0 text-center")} />
        <BaseNumberField.Increment className="rounded-r-md border border-l-0 border-zinc-300 bg-zinc-50 px-2 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700">
          +
        </BaseNumberField.Increment>
      </BaseNumberField.Group>
    </BaseNumberField.Root>
  );
}
