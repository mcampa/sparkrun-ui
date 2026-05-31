"use client";
import { Tabs as BaseTabs } from "@base-ui/react/tabs";
import { cn } from "@/lib/cn";

export function Tabs({
  value,
  onValueChange,
  children,
  className,
}: {
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <BaseTabs.Root
      value={value}
      onValueChange={(v) => onValueChange(String(v))}
      className={className}
    >
      {children}
    </BaseTabs.Root>
  );
}

Tabs.List = function TabsList({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <BaseTabs.List
      className={cn(
        "relative inline-flex items-center gap-1 border-b border-zinc-200 dark:border-zinc-800",
        className,
      )}
    >
      {children}
    </BaseTabs.List>
  );
};

Tabs.Tab = function TabsTab({ value, children }: { value: string; children: React.ReactNode }) {
  return (
    <BaseTabs.Tab
      value={value}
      className={cn(
        "relative px-3 py-2 text-sm font-medium text-zinc-500 transition-colors",
        "hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100",
        "data-[selected]:text-zinc-900 dark:data-[selected]:text-zinc-100",
        "data-[selected]:after:absolute data-[selected]:after:inset-x-0 data-[selected]:after:-bottom-px",
        "data-[selected]:after:h-0.5 data-[selected]:after:bg-sky-600 dark:data-[selected]:after:bg-sky-400",
      )}
    >
      {children}
    </BaseTabs.Tab>
  );
};

Tabs.Panel = function TabsPanel({
  value,
  children,
  className,
}: {
  value: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <BaseTabs.Panel value={value} className={cn("pt-4", className)}>
      {children}
    </BaseTabs.Panel>
  );
};
