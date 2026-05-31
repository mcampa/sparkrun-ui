import "server-only";
import { createRouterClient } from "@orpc/server";
import { router } from "./router";

export const serverClient = createRouterClient(router, { context: {} });
