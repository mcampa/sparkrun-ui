import { serverClient } from "@/lib/rpc/server";
import { BenchmarksList } from "@/app/components/benchmarks/BenchmarksList";

export const dynamic = "force-dynamic";

export default async function BenchmarksPage() {
  const benchmarks = await serverClient.benchmarks.list();
  return <BenchmarksList benchmarks={benchmarks} />;
}
