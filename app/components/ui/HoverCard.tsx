"use client";
import { PreviewCard } from "@base-ui/react/preview-card";
import { cn } from "@/lib/cn";

const popupCls =
  "z-50 rounded-md border border-zinc-200 bg-white shadow-lg " +
  "dark:border-zinc-800 dark:bg-zinc-900 " +
  "transition-all duration-100 " +
  "data-[ending-style]:opacity-0 data-[ending-style]:scale-[0.97] " +
  "data-[starting-style]:opacity-0 data-[starting-style]:scale-[0.97]";

export function HoverCard({
  trigger,
  children,
  side = "right",
  align = "start",
  className,
  onOpenChange,
}: {
  trigger: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  className?: string;
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <PreviewCard.Root onOpenChange={(open) => onOpenChange?.(open)}>
      <PreviewCard.Trigger
        render={<span className="inline-block" />}
        delay={250}
        closeDelay={150}
      >
        {trigger}
      </PreviewCard.Trigger>
      <PreviewCard.Portal>
        <PreviewCard.Positioner side={side} align={align} sideOffset={8}>
          <PreviewCard.Popup className={cn(popupCls, className)}>{children}</PreviewCard.Popup>
        </PreviewCard.Positioner>
      </PreviewCard.Portal>
    </PreviewCard.Root>
  );
}
