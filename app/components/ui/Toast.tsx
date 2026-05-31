"use client";
import { Toast as BaseToast } from "@base-ui/react/toast";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/cn";

const toastManager = BaseToast.createToastManager();

export function ToastProvider({ children }: { children: React.ReactNode }) {
  return (
    <BaseToast.Provider toastManager={toastManager}>
      {children}
      <BaseToast.Portal>
        <BaseToast.Viewport className="fixed bottom-4 right-4 z-[60] flex w-[360px] flex-col gap-2">
          <ToastList />
        </BaseToast.Viewport>
      </BaseToast.Portal>
    </BaseToast.Provider>
  );
}

function ToastList() {
  const { toasts } = BaseToast.useToastManager();
  return toasts.map((toast) => <ToastItem key={toast.id} toast={toast} />);
}

const toneStyles = {
  success:
    "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100",
  error:
    "border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100",
  info:
    "border-zinc-200 bg-white text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100",
};

const icons = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};

function ToastItem({ toast }: { toast: BaseToast.Root.ToastObject }) {
  const tone = (toast.data as { tone?: keyof typeof toneStyles } | undefined)?.tone ?? "info";
  const Icon = icons[tone];
  return (
    <BaseToast.Root
      toast={toast}
      className={cn(
        "flex items-start gap-3 rounded-md border p-3 shadow-md transition-all",
        "data-[ending-style]:translate-x-2 data-[ending-style]:opacity-0",
        "data-[starting-style]:translate-x-2 data-[starting-style]:opacity-0",
        toneStyles[tone],
      )}
    >
      <Icon size={18} className="mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <BaseToast.Title className="text-sm font-medium">{toast.title}</BaseToast.Title>
        {toast.description && (
          <BaseToast.Description className="mt-0.5 text-xs opacity-80">
            {toast.description}
          </BaseToast.Description>
        )}
      </div>
      <BaseToast.Close className="rounded p-0.5 opacity-60 hover:opacity-100">
        <X size={14} />
      </BaseToast.Close>
    </BaseToast.Root>
  );
}

type Tone = keyof typeof toneStyles;

export const toast = {
  success: (title: string, description?: string) =>
    toastManager.add({ title, description, data: { tone: "success" as Tone }, timeout: 4000 }),
  error: (title: string, description?: string) =>
    toastManager.add({ title, description, data: { tone: "error" as Tone }, timeout: 7000 }),
  info: (title: string, description?: string) =>
    toastManager.add({ title, description, data: { tone: "info" as Tone }, timeout: 4000 }),
};
