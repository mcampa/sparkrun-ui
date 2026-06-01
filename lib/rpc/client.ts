"use client";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { RouterClient } from "@orpc/server";
import type { AppRouter } from "./router";

const baseUrl =
  typeof window !== "undefined" ? `${window.location.origin}/rpc` : "http://127.0.0.1:5678/rpc";

const link = new RPCLink({ url: baseUrl });

export const rpc: RouterClient<AppRouter> = createORPCClient(link);
