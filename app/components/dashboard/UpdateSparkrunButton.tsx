"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { RefreshCw } from "lucide-react";
import { rpc } from "@/lib/rpc/client";
import { Button } from "@/app/components/ui/Button";
import { Dialog } from "@/app/components/ui/Dialog";

export function UpdateSparkrunButton() {
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const acRef = useRef<AbortController | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  const runUpdate = useCallback(async () => {
    setOpen(true);
    setRunning(true);
    setLines([]);
    setDone(false);

    const ac = new AbortController();
    acRef.current = ac;

    try {
      const iter = await rpc.update.stream(undefined as never, { signal: ac.signal });
      for await (const event of iter) {
        if (event.done) {
          setDone(true);
          setRunning(false);
          break;
        }
        if (event.line) {
          setLines((prev) => [...prev, event.line]);
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setLines((prev) => [...prev, `Error: ${(err as Error).message}`]);
      setDone(true);
      setRunning(false);
    }
  }, []);

  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen && running) {
        acRef.current?.abort();
        setRunning(false);
      }
      setOpen(newOpen);
    },
    [running],
  );

  return (
    <>
      <Button variant="secondary" onClick={runUpdate} disabled={running}>
        <RefreshCw size={14} className={running ? "animate-spin" : ""} />
        {running ? "Updating…" : "Update"}
      </Button>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <Dialog.Content title="Sparkrun Update" size="lg">
          <Dialog.Body>
            <div className="h-80 overflow-auto rounded-lg bg-zinc-950 p-4 font-mono text-xs text-green-400">
              {lines.length === 0 && running && (
                <div className="animate-pulse">Starting update…</div>
              )}
              {lines.map((line, i) => (
                <div key={i} className="whitespace-pre-wrap">
                  {line}
                </div>
              ))}
              {running && lines.length > 0 && <div className="animate-pulse text-green-600">…</div>}
              <div ref={bottomRef} />
            </div>
          </Dialog.Body>
          <Dialog.Footer>
            <Dialog.Close
              render={
                <Button variant={done ? "primary" : "ghost"} disabled={running}>
                  Close
                </Button>
              }
            />
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog>
    </>
  );
}
