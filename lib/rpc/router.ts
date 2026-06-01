import * as status from "./procedures/status";
import * as workloads from "./procedures/workloads";
import * as recipes from "./procedures/recipes";
import * as clusters from "./procedures/clusters";
import * as run from "./procedures/run";
import * as benchmarks from "./procedures/benchmarks";
import * as logs from "./procedures/logs";
import * as monitor from "./procedures/monitor";
import * as chat from "./procedures/chat";
import * as update from "./procedures/update";

export const router = {
  status: {
    get: status.get,
    stream: status.stream,
  },
  workloads: {
    stop: workloads.stop,
    health: workloads.health,
  },
  recipes: {
    list: recipes.list,
    readYaml: recipes.readYaml,
    show: recipes.show,
    info: recipes.info,
    validate: recipes.validate,
    dryRun: recipes.dryRun,
  },
  clusters: {
    list: clusters.list,
    getDefault: clusters.getDefault,
  },
  run: {
    start: run.start,
  },
  benchmarks: {
    list: benchmarks.list,
    get: benchmarks.get,
    profiles: benchmarks.profiles,
    run: benchmarks.run,
  },
  logs: {
    stream: logs.stream,
  },
  monitor: {
    stream: monitor.stream,
  },
  chat: {
    stream: chat.stream,
  },
  update: {
    stream: update.stream,
  },
};

export type AppRouter = typeof router;
