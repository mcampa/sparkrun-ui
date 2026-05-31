"use client";
import { useEffect, useRef, useState } from "react";
import { ScrollText } from "lucide-react";
import { rpc } from "@/lib/rpc/client";
import { Switch } from "@/app/components/ui/Switch";

type Line = { line: string; ts: string; stream?: "out" | "err" | "meta" };

export function LogStream({ clusterId, tail = 200 }: { clusterId: string; tail?: number }) {
  const [lines, setLines] = useState<Line[]>([]);
  const [follow, setFollow] = useState(true);
  const [connected, setConnected] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;
    // Reset between subscriptions when clusterId/tail change.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLines([]);
    setConnected(false);
    (async () => {
      try {
        const iter = await rpc.logs.stream({ clusterId, tail }, { signal: ac.signal });
        setConnected(true);
        for await (const event of iter) {
          if (cancelled) break;
          setLines((prev) => {
            const next = [...prev, event];
            return next.length > 5000 ? next.slice(-5000) : next;
          });
        }
      } catch (err) {
        if (!cancelled && !(err instanceof DOMException && err.name === "AbortError")) {
          console.error("[logs.stream]", err);
        }
      } finally {
        if (!cancelled) setConnected(false);
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [clusterId, tail]);

  useEffect(() => {
    if (!follow || !scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [lines, follow]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <ScrollText size={16} className="text-zinc-500" />
          <span className="font-mono text-xs">{clusterId}</span>
          <span
            className={
              "ml-2 rounded-full px-2 py-0.5 text-xs " +
              (connected
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400")
            }
          >
            {connected ? "streaming" : "disconnected"}
          </span>
        </div>
        <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
          <Switch checked={follow} onCheckedChange={setFollow} />
          Auto-follow
        </label>
      </div>
      <div
        ref={scrollRef}
        className="h-[70vh] overflow-auto rounded-md border border-zinc-200 bg-black p-3 font-mono text-xs leading-relaxed text-zinc-100 dark:border-zinc-800"
      >
        {lines.length === 0 ? (
          <p className="text-zinc-500">Waiting for log output…</p>
        ) : (
          lines.map((l, i) => (
            <div
              key={i}
              className={
                "whitespace-pre-wrap " +
                (l.stream === "meta"
                  ? "text-zinc-500 italic"
                  : l.stream === "err"
                    ? "text-red-300"
                    : "")
              }
            >
              {l.line}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
