import { os } from "@orpc/server";
import { ClusterStatusSchema } from "@/lib/schemas";
import { runSparkrunJson } from "@/lib/sparkrun";

const getStatus = os
  .output(ClusterStatusSchema)
  .handler(async () =>
    runSparkrunJson(["cluster", "status", "--json"]),
  );

export const router = {
  status: {
    get: getStatus,
  },
};

export type AppRouter = typeof router;
