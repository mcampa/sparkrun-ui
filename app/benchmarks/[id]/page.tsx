import { serverClient } from "@/lib/rpc/server";
import { BenchmarkDetail } from "@/app/components/benchmarks/BenchmarkDetail";
import type { BenchmarkState, Consolidated } from "@/lib/state";

export const dynamic = "force-dynamic";

export default async function BenchmarkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Best-effort initial fetch so SSR has content; client stream will keep it updated.
  // If the benchmark dir doesn't exist yet (just-started run racing the redirect),
  // initial state is null and the client takes over via watch().
  const data = await serverClient.benchmarks.get({ id }).catch(() => null);

  return (
    <BenchmarkDetail
      id={id}
      initialState={(data?.state as BenchmarkState) ?? null}
      initialConsolidated={(data?.consolidated as Consolidated | null) ?? null}
    />
  );
}
