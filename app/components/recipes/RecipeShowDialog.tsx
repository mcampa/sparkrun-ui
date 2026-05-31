"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Rocket } from "lucide-react";
import { Dialog } from "@/app/components/ui/Dialog";
import { Button } from "@/app/components/ui/Button";
import { CodeBlock } from "@/app/components/ui/CodeBlock";
import { rpc } from "@/lib/rpc/client";

const cache = new Map<string, string>();

export function RecipeShowDialog({
  name,
  open,
  onOpenChange,
}: {
  name: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [text, setText] = useState<string | null>(() => cache.get(name) ?? null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const cached = cache.get(name);
    if (cached) {
      setText(cached);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    rpc.recipes
      .show({ name })
      .then((r) => {
        if (cancelled) return;
        cache.set(name, r.text);
        setText(r.text);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, name]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Dialog.Content title={name} size="xl" description="sparkrun recipe show">
        <Dialog.Body>
          {loading && !text ? (
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <Loader2 size={14} className="animate-spin" /> loading…
            </div>
          ) : error ? (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          ) : text ? (
            <CodeBlock className="max-h-[60vh]">{text}</CodeBlock>
          ) : null}
        </Dialog.Body>
        <Dialog.Footer>
          <Dialog.Close
            render={
              <Button variant="ghost" type="button">
                Close
              </Button>
            }
          />
          <Link href={`/launch?recipe=${encodeURIComponent(name)}`}>
            <Button variant="primary">
              <Rocket size={14} />
              Launch
            </Button>
          </Link>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  );
}
