import { runSparkrunJson } from "@/lib/sparkrun";

type ClusterEntry = { name: string; hosts: string[]; default: boolean };

export async function resolveTargetHosts(
  hosts?: string[],
  cluster?: string,
): Promise<string[]> {
  if (hosts && hosts.length) return hosts;
  if (cluster) {
    const list = await runSparkrunJson<ClusterEntry[]>(["cluster", "list", "--json"]);
    const c = list.find((e) => e.name === cluster);
    if (!c) throw new Error(`Cluster ${cluster} not found`);
    return c.hosts;
  }
  const def = await runSparkrunJson<ClusterEntry>(["cluster", "default", "--json"]);
  return def.hosts;
}
