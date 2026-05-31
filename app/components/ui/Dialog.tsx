"use client";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { AlertDialog as BaseAlertDialog } from "@base-ui/react/alert-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "./Button";

const backdropCls =
  "fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] " +
  "transition-opacity duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0";

const popupCls =
  "fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 " +
  "w-[92vw] max-w-lg rounded-lg border border-zinc-200 bg-white shadow-xl " +
  "dark:border-zinc-800 dark:bg-zinc-900 " +
  "transition-all duration-150 " +
  "data-[ending-style]:opacity-0 data-[ending-style]:scale-[0.97] " +
  "data-[starting-style]:opacity-0 data-[starting-style]:scale-[0.97]";

export function Dialog({
  open,
  onOpenChange,
  children,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <BaseDialog.Root open={open} onOpenChange={onOpenChange}>
      {children}
    </BaseDialog.Root>
  );
}

Dialog.Trigger = BaseDialog.Trigger;

Dialog.Content = function DialogContent({
  className,
  title,
  description,
  children,
  size = "md",
}: {
  className?: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  size?: "md" | "lg" | "xl";
}) {
  const sizes = {
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  };
  return (
    <BaseDialog.Portal>
      <BaseDialog.Backdrop className={backdropCls} />
      <BaseDialog.Popup className={cn(popupCls, sizes[size], className)}>
        {(title || description) && (
          <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
            <div className="flex flex-col gap-1">
              {title && (
                <BaseDialog.Title className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  {title}
                </BaseDialog.Title>
              )}
              {description && (
                <BaseDialog.Description className="text-sm text-zinc-500 dark:text-zinc-400">
                  {description}
                </BaseDialog.Description>
              )}
            </div>
            <BaseDialog.Close className="rounded p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100">
              <X size={16} />
            </BaseDialog.Close>
          </div>
        )}
        {children}
      </BaseDialog.Popup>
    </BaseDialog.Portal>
  );
};

Dialog.Body = function DialogBody({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("px-6 py-5", className)}>{children}</div>;
};

Dialog.Footer = function DialogFooter({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-end gap-2 border-t border-zinc-200 px-6 py-3 dark:border-zinc-800",
        className,
      )}
    >
      {children}
    </div>
  );
};

Dialog.Close = BaseDialog.Close;

export function AlertDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
}) {
  return (
    <BaseAlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <BaseAlertDialog.Portal>
        <BaseAlertDialog.Backdrop className={backdropCls} />
        <BaseAlertDialog.Popup className={cn(popupCls, "max-w-md")}>
          <div className="px-6 py-5">
            <BaseAlertDialog.Title className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              {title}
            </BaseAlertDialog.Title>
            {description && (
              <BaseAlertDialog.Description className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                {description}
              </BaseAlertDialog.Description>
            )}
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-zinc-200 px-6 py-3 dark:border-zinc-800">
            <BaseAlertDialog.Close
              render={<Button variant="ghost">{cancelLabel}</Button>}
            />
            <Button
              variant={destructive ? "danger" : "primary"}
              onClick={async () => {
                await onConfirm();
                onOpenChange(false);
              }}
            >
              {confirmLabel}
            </Button>
          </div>
        </BaseAlertDialog.Popup>
      </BaseAlertDialog.Portal>
    </BaseAlertDialog.Root>
  );
}
