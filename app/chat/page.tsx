import { serverClient } from "@/lib/rpc/server";
import { ChatPage } from "@/app/components/chat/ChatPage";

export const dynamic = "force-dynamic";

export default async function ChatRoute() {
  const initial = await serverClient.status.get();
  return <ChatPage initial={initial} />;
}
