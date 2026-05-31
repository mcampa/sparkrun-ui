"use client";
import { Switch as BaseSwitch } from "@base-ui/react/switch";
import { cn } from "@/lib/cn";

export function Switch({
  checked,
  onCheckedChange,
  disabled,
  className,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <BaseSwitch.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      className={cn(
        "inline-flex h-5 w-9 cursor-pointer items-center rounded-full p-0.5 transition-colors",
        "bg-zinc-300 data-[checked]:bg-sky-600 dark:bg-zinc-700 dark:data-[checked]:bg-sky-500",
        "disabled:opacity-50",
        className,
      )}
    >
      <BaseSwitch.Thumb className="h-4 w-4 rounded-full bg-white shadow transition-transform data-[checked]:translate-x-4" />
    </BaseSwitch.Root>
  );
}
