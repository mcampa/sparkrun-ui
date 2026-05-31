"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { HoverCard } from "@/app/components/ui/HoverCard";
import { Badge } from "@/app/components/ui/Badge";
import { rpc } from "@/lib/rpc/client";

type Info = Awaited<ReturnType<typeof rpc.recipes.info>>;

const cache = new Map<string, Info | Promise<Info>>();

export function RecipeInfoPopover({
  name,
  children,
}: {
  name: string;
  children: React.ReactNode;
}) {
  const [info, setInfo] = useState<Info | null>(() => {
    const cached = cache.get(name);
    return cached && !("then" in cached) ? cached : null;
  });
  const [loading, setLoading] = useState(false);
  const aliveRef = useRef(true);

  useEffect(() => {
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    const cached = cache.get(name);
    if (cached && !("then" in cached)) {
      setInfo(cached);
      return;
    }
    setLoading(true);
    try {
      const p = cached ?? rpc.recipes.info({ name });
      if (!cached) cache.set(name, p);
      const res = await p;
      cache.set(name, res);
      if (aliveRef.current) setInfo(res);
    } catch {
      cache.delete(name);
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  }, [name]);

  return (
    <HoverCard
      side="right"
      align="start"
      className="w-[340px] max-w-[90vw] p-0"
      onOpenChange={(o) => {
        if (o && !info) load();
      }}
      trigger={children}
    >
      <div className="flex flex-col gap-3 p-3">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-xs text-zinc-900 dark:text-zinc-100">{name}</span>
          {info?.description ? (
            <span className="text-xs text-zinc-600 dark:text-zinc-400">{info.description}</span>
          ) : info && !loading ? (
            <span className="text-xs italic text-zinc-400">No description</span>
          ) : null}
        </div>

        {loading && !info && (
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Loader2 size={12} className="animate-spin" /> loading…
          </div>
        )}

        {info?.vram && (
          <div className="flex flex-col gap-2 rounded border border-zinc-200 p-2 dark:border-zinc-800">
            <div className="flex items-center justify-between text-xs font-medium text-zinc-700 dark:text-zinc-300">
              <span>VRAM estimation</span>
              {info.vram.fits_dgx_spark != null && (
                <Badge tone={info.vram.fits_dgx_spark ? "green" : "red"}>
                  {info.vram.fits_dgx_spark ? "fits DGX Spark" : "won't fit"}
                </Badge>
              )}
            </div>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
              <Row label="Model dtype" value={info.vram.model_dtype} />
              <Row label="Params" value={fmtParams(info.vram.model_params)} />
              <Row label="Architecture" value={fmtArch(info.vram)} />
              <Row label="TP" value={info.vram.tensor_parallel} />
              <Row label="Weights" value={fmtGb(info.vram.model_weights_gb)} />
              <Row label="KV cache" value={fmtGb(info.vram.kv_cache_total_gb)} />
              <Row label="Max model len" value={fmtNum(info.vram.max_model_len)} />
              <Row label="Per-GPU total" value={fmtGb(info.vram.total_per_gpu_gb)} bold />
            </dl>
          </div>
        )}

        {info?.vram && (
          <div className="flex flex-col gap-2 rounded border border-zinc-200 p-2 dark:border-zinc-800">
            <div className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              GPU memory budget
            </div>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
              <Row
                label="gpu_memory_utilization"
                value={
                  info.vram.gpu_memory_utilization != null
                    ? `${(info.vram.gpu_memory_utilization * 100).toFixed(0)}%`
                    : null
                }
              />
              <Row label="Usable" value={fmtGb(info.vram.usable_gpu_memory_gb)} />
              <Row label="Available KV" value={fmtGb(info.vram.available_kv_gb)} />
              <Row label="Max context" value={fmtNum(info.vram.max_context_tokens)} />
              <Row
                label="Context multiplier"
                value={
                  info.vram.context_multiplier != null
                    ? `${info.vram.context_multiplier.toFixed(1)}x`
                    : null
                }
              />
            </dl>
          </div>
        )}

        {info?.vramError && (
          <p className="text-xs text-red-600 dark:text-red-400">{info.vramError}</p>
        )}
      </div>
    </HoverCard>
  );
}

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: string | number | null | undefined;
  bold?: boolean;
}) {
  if (value == null || value === "") return null;
  return (
    <>
      <dt className="text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd
        className={
          "text-right font-mono " +
          (bold ? "text-zinc-900 dark:text-zinc-100 font-semibold" : "text-zinc-700 dark:text-zinc-300")
        }
      >
        {value}
      </dd>
    </>
  );
}

function fmtGb(n: number | undefined): string | null {
  if (n == null) return null;
  return `${n.toFixed(2)} GB`;
}
function fmtNum(n: number | undefined): string | null {
  if (n == null) return null;
  return n.toLocaleString();
}
function fmtParams(n: number | undefined): string | null {
  if (n == null) return null;
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  return n.toLocaleString();
}
function fmtArch(v: {
  num_layers?: number;
  num_kv_heads?: number;
  head_dim?: number;
}): string | null {
  if (!v.num_layers) return null;
  return `${v.num_layers}L · ${v.num_kv_heads}KV · d=${v.head_dim}`;
}
