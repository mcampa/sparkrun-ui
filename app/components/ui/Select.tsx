"use client";
import { useState, useMemo } from "react";
import { Select as BaseSelect } from "@base-ui/react/select";
import { ChevronDown, Check, Search } from "lucide-react";
import { cn } from "@/lib/cn";

export type SelectOption = {
  value: string;
  label: string;
  description?: string;
  badge?: { text: string; tone?: "green" | "sky" | "amber" | "red" | "neutral" };
};

export function Select({
  value,
  onValueChange,
  options,
  placeholder,
  className,
  disabled,
  searchable,
}: {
  value: string | null;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  searchable?: boolean;
}) {
  const [filter, setFilter] = useState("");

  const filtered = useMemo(() => {
    if (!searchable) return options;
    const term = filter.trim().toLowerCase();
    if (!term) return options;
    return options.filter((opt) => {
      const hay = `${opt.label} ${opt.description ?? ""}`.toLowerCase();
      return hay.includes(term);
    });
  }, [options, filter, searchable]);

  return (
    <BaseSelect.Root
      value={value}
      onValueChange={(v) => {
        if (v != null) onValueChange(String(v));
        setFilter("");
      }}
      disabled={disabled}
    >
      <BaseSelect.Trigger
        className={cn(
          "inline-flex h-9 w-full items-center justify-between rounded-md border border-zinc-300 bg-white px-3 text-sm",
          "text-zinc-900 hover:bg-zinc-50 focus:ring-2 focus:ring-sky-500/30 focus:outline-none",
          "dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800",
          disabled && "cursor-not-allowed opacity-50",
          className,
        )}
      >
        <BaseSelect.Value placeholder={placeholder} />
        <BaseSelect.Icon>
          <ChevronDown size={14} className="text-zinc-500" />
        </BaseSelect.Icon>
      </BaseSelect.Trigger>
      <BaseSelect.Portal>
        <BaseSelect.Positioner sideOffset={4} className="z-50">
          <BaseSelect.Popup className="max-h-80 min-w-[var(--anchor-width)] overflow-auto rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
            {searchable && (
              <div className="sticky top-0 border-b border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="relative">
                  <Search
                    size={12}
                    className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-zinc-400"
                  />
                  <input
                    type="text"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder="Filter…"
                    className="w-full rounded bg-zinc-100 py-1.5 pr-2 pl-7 text-xs text-zinc-900 outline-none dark:bg-zinc-800 dark:text-zinc-100"
                    // Keep focus inside the popup
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                </div>
              </div>
            )}
            <div className="p-1">
              {filtered.map((opt) => (
                <BaseSelect.Item
                  key={opt.value}
                  value={opt.value}
                  className="flex cursor-pointer items-start gap-2 rounded px-2 py-1.5 text-sm data-[highlighted]:bg-sky-50 dark:data-[highlighted]:bg-sky-950"
                >
                  <BaseSelect.ItemIndicator className="mt-0.5">
                    <Check size={14} className="text-sky-600" />
                  </BaseSelect.ItemIndicator>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <BaseSelect.ItemText className="truncate text-zinc-900 dark:text-zinc-100">
                      {opt.label}
                    </BaseSelect.ItemText>
                    {opt.description && (
                      <span className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                        {opt.description}
                      </span>
                    )}
                  </div>
                  {opt.badge && (
                    <span
                      className={`ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[10px] leading-none font-medium ${
                        opt.badge.tone === "green"
                          ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                          : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                      }`}
                    >
                      {opt.badge.text}
                    </span>
                  )}
                </BaseSelect.Item>
              ))}
              {searchable && filtered.length === 0 && (
                <p className="px-2 py-1.5 text-xs text-zinc-500">No results</p>
              )}
            </div>
          </BaseSelect.Popup>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </BaseSelect.Root>
  );
}
