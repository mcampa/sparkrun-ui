"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Rocket } from "lucide-react";
import { Dialog } from "@/app/components/ui/Dialog";
import { Button } from "@/app/components/ui/Button";
import { Badge } from "@/app/components/ui/Badge";
import { YamlEditor } from "@/app/components/launch/YamlEditor";
import { rpc } from "@/lib/rpc/client";

const cache = new Map<string, string>();

export function RecipeShowDialog({
  name,
  title,
  open,
  onOpenChange,
  running = false,
  showLaunch = true,
}: {
  name: string;
  /** Optional display title (defaults to `name`). Useful when `name` is a file path. */
  title?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  running?: boolean;
  showLaunch?: boolean;
}) {
  const [text, setText] = useState<string | null>(() => cache.get(name) ?? null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const cached = cache.get(name);
    if (cached) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
      <Dialog.Content title={title ?? name} size="xl" description="sparkrun recipe show">
        <Dialog.Body>
          {loading && !text ? (
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <Loader2 size={14} className="animate-spin" /> loading…
            </div>
          ) : error ? (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          ) : text ? (
            <YamlEditor value={text} readOnly className="max-h-[60vh]" />
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
          {running ? (
            <Badge tone="green">already running</Badge>
          ) : showLaunch ? (
            <Link href={`/launch?recipe=${encodeURIComponent(name)}`}>
              <Button variant="primary">
                <Rocket size={14} />
                Launch
              </Button>
            </Link>
          ) : null}
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  );
}
