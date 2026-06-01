"use client";
import { useEffect, useRef, useState } from "react";
import { rpc } from "@/lib/rpc/client";
import { Button } from "@/app/components/ui/Button";
import { Dialog } from "@/app/components/ui/Dialog";

export function LaunchProgressDialog({
  open,
  onOpenChange,
  onSuccess,
  yaml,
  draftId,
  cluster,
  recipeName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  yaml: string;
  draftId: string;
  cluster?: string;
  recipeName?: string;
}) {
  const [lines, setLines] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const acRef = useRef<AbortController | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  useEffect(() => {
    if (!open || startedRef.current) return;
    startedRef.current = true;

    setRunning(true);
    setLines([]);
    setDone(false);
    setError(null);

    const ac = new AbortController();
    acRef.current = ac;

    (async () => {
      try {
        const iter = await rpc.run.startStream(
          {
            yaml,
            draftId,
            cluster,
            recipeName,
          },
          { signal: ac.signal },
        );
        for await (const event of iter) {
          if (event.done) {
            setDone(true);
            setRunning(false);
            if (event.ok === false && event.error) {
              setError(event.error);
            }
            break;
          }
          if (event.line) {
            setLines((prev) => [...prev, event.line]);
          }
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        const msg = err instanceof Error ? err.message : String(err);
        setLines((prev) => [...prev, `Error: ${msg}`]);
        setError(msg);
        setDone(true);
        setRunning(false);
      }
    })();

    return () => {
      ac.abort();
    };
  }, [open, yaml, draftId, cluster, recipeName]);

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && running) {
      acRef.current?.abort();
      setRunning(false);
    }
    if (!newOpen) {
      startedRef.current = false;
      if (done && !error) {
        onSuccess();
      }
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Dialog.Content
        title={recipeName ? `Launching ${recipeName}` : "Launching recipe"}
        description={cluster ? `Cluster: ${cluster}` : undefined}
        size="lg"
      >
        <Dialog.Body>
          <div className="h-80 overflow-auto rounded-lg bg-zinc-950 p-4 font-mono text-xs text-green-400">
            {lines.length === 0 && running && <div className="animate-pulse">Starting…</div>}
            {lines.map((line, i) => (
              <div key={i} className="whitespace-pre-wrap">
                {line}
              </div>
            ))}
            {running && lines.length > 0 && <div className="animate-pulse text-green-600">…</div>}
            {done && !error && <div className="mt-1 text-sky-400">Done. Moving to logs…</div>}
            {error && <div className="mt-1 text-red-400">Failed: {error}</div>}
            <div ref={bottomRef} />
          </div>
        </Dialog.Body>
        <Dialog.Footer>
          <Dialog.Close
            render={
              <Button variant={done ? "primary" : "ghost"} disabled={running}>
                {done && !error ? "View logs" : "Close"}
              </Button>
            }
          />
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  );
}
