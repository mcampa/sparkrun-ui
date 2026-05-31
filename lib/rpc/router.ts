import * as status from "./procedures/status";
import * as workloads from "./procedures/workloads";

export const router = {
  status: {
    get: status.get,
    stream: status.stream,
  },
  workloads: {
    stop: workloads.stop,
  },
};

export type AppRouter = typeof router;
