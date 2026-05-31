import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LogStream } from "@/app/components/logs/LogStream";
import { Button } from "@/app/components/ui/Button";

export const dynamic = "force-dynamic";

export default async function LogsPage({
  params,
}: {
  params: Promise<{ clusterId: string }>;
}) {
  const { clusterId } = await params;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link href="/dashboard">
          <Button variant="ghost" size="sm">
            <ArrowLeft size={14} />
            Dashboard
          </Button>
        </Link>
        <h1 className="text-xl font-semibold tracking-tight">Logs</h1>
      </div>
      <LogStream clusterId={clusterId} tail={200} />
    </div>
  );
}
