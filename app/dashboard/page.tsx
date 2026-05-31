import { serverClient } from "@/lib/rpc/server";
import { DashboardLive } from "@/app/components/dashboard/DashboardLive";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const initial = await serverClient.status.get();
  return <DashboardLive initial={initial} />;
}
