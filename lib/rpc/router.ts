import * as status from "./procedures/status";
import * as workloads from "./procedures/workloads";
import * as recipes from "./procedures/recipes";
import * as clusters from "./procedures/clusters";
import * as run from "./procedures/run";

export const router = {
  status: {
    get: status.get,
    stream: status.stream,
  },
  workloads: {
    stop: workloads.stop,
  },
  recipes: {
    list: recipes.list,
    readYaml: recipes.readYaml,
    show: recipes.show,
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
};

export type AppRouter = typeof router;
