import { RPCHandler } from "@orpc/server/fetch";
import { onError } from "@orpc/server";
import { router } from "@/lib/rpc/router";

const handler = new RPCHandler(router, {
  interceptors: [
    onError((error) => {
      console.error("[rpc]", error);
    }),
  ],
});

async function handle(request: Request): Promise<Response> {
  const { response } = await handler.handle(request, {
    prefix: "/rpc",
    context: {},
  });
  return response ?? new Response("Not found", { status: 404 });
}

export const HEAD = handle;
export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
