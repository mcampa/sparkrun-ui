"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { ScrollText } from "lucide-react";
import { rpc } from "@/lib/rpc/client";
import { Switch } from "@/app/components/ui/Switch";
import { parseAnsi, type AnsiColor, type AnsiSegment } from "@/lib/ansi";

type Line = { line: string; ts: string; stream?: "out" | "err" | "meta" };

// ANSI fg colors mapped to Tailwind utilities tuned for the black terminal
// background. Bright variants are slightly lighter than their standard
// counterparts; "black" maps to a mid gray so dim text doesn't disappear.
const FG: Record<AnsiColor, string> = {
  "0": "text-zinc-600",
  "1": "text-red-400",
  "2": "text-emerald-400",
  "3": "text-yellow-300",
  "4": "text-blue-400",
  "5": "text-fuchsia-400",
  "6": "text-cyan-300",
  "7": "text-zinc-100",
  b0: "text-zinc-500",
  b1: "text-red-300",
  b2: "text-emerald-300",
  b3: "text-yellow-200",
  b4: "text-blue-300",
  b5: "text-fuchsia-300",
  b6: "text-cyan-200",
  b7: "text-white",
};

function classesFor(seg: AnsiSegment): string {
  const out: string[] = [];
  if (seg.bold) out.push("font-bold");
  if (seg.dim) out.push("opacity-60");
  if (seg.italic) out.push("italic");
  if (seg.underline) out.push("underline");
  if (seg.fg) out.push(FG[seg.fg]);
  return out.join(" ");
}

export function LogStream({ clusterId, tail = 200 }: { clusterId: string; tail?: number }) {
  const [lines, setLines] = useState<Line[]>([]);
  const [follow, setFollow] = useState(true);
  const [connected, setConnected] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;
    (async () => {
      setLines([]);
      setConnected(false);
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
          lines.map((l, i) => <LogLine key={i} line={l} />)
        )}
      </div>
    </div>
  );
}

function LogLine({ line }: { line: Line }) {
  const segments = useMemo(() => parseAnsi(line.line), [line.line]);
  const lineTone =
    line.stream === "meta" ? "text-zinc-500 italic" : line.stream === "err" ? "text-red-300" : "";
  return (
    <div className={`whitespace-pre-wrap ${lineTone}`}>
      {segments.map((seg, i) => {
        const cls = classesFor(seg);
        return cls ? (
          <span key={i} className={cls}>
            {seg.text}
          </span>
        ) : (
          <span key={i}>{seg.text}</span>
        );
      })}
    </div>
  );
}
