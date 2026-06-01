import { serverClient } from "@/lib/rpc/server";
import { ChatPage } from "@/app/components/chat/ChatPage";

export const dynamic = "force-dynamic";

export default async function ChatRoute({
  searchParams,
}: {
  searchParams: Promise<{ clusterId?: string }>;
}) {
  const [initial, sp] = await Promise.all([serverClient.status.get(), searchParams]);
  return <ChatPage initial={initial} initialClusterId={sp.clusterId} />;
}
