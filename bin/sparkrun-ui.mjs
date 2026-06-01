#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = JSON.parse(readFileSync(resolve(HERE, "../package.json"), "utf8"));

const USAGE = `sparkrun-ui ${PKG.version}

Web UI for sparkrun — launch and monitor inference workloads on NVIDIA DGX Spark.

Usage:
  npx sparkrun-ui [options]

Options:
  -p, --port <port>           Port to listen on (default: 5678)
  -H, --host <host>           Host/interface to bind (default: 0.0.0.0)
      --sparkrun-bin <path>   Path to the sparkrun CLI (default: \`sparkrun\` on PATH)
  -h, --help                  Show this message
  -v, --version               Print the version
`;

let parsed;
try {
  parsed = parseArgs({
    options: {
      port: { type: "string", short: "p" },
      host: { type: "string", short: "H" },
      "sparkrun-bin": { type: "string" },
      help: { type: "boolean", short: "h" },
      version: { type: "boolean", short: "v" },
    },
    strict: true,
    allowPositionals: false,
  });
} catch (err) {
  process.stderr.write(`sparkrun-ui: ${err.message}\n\n${USAGE}`);
  process.exit(2);
}

const { values } = parsed;

if (values.help) {
  process.stdout.write(USAGE);
  process.exit(0);
}
if (values.version) {
  process.stdout.write(`${PKG.version}\n`);
  process.exit(0);
}

const port = values.port ?? process.env.PORT ?? "5678";
if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
  process.stderr.write(`sparkrun-ui: invalid --port value: ${port}\n`);
  process.exit(2);
}

process.env.PORT = port;
process.env.HOSTNAME = values.host ?? process.env.HOSTNAME ?? "0.0.0.0";
if (values["sparkrun-bin"]) process.env.SPARKRUN_BIN = values["sparkrun-bin"];

// Friendly heads-up if the sparkrun CLI isn't reachable. Don't hard-fail —
// the UI still renders and surfaces RPC errors with actionable messages.
const sparkrunBin = process.env.SPARKRUN_BIN || "sparkrun";
const probe = spawnSync(sparkrunBin, ["--version"], { stdio: "ignore" });
if (probe.error || probe.status !== 0) {
  process.stderr.write(
    `sparkrun-ui: warning — could not run \`${sparkrunBin} --version\`.\n` +
      "  Install sparkrun (https://github.com/mcampa/sparkrun) or pass --sparkrun-bin.\n",
  );
}

// Published npm tarball ships the prebuilt bundle under `dist/`. When this
// script is invoked from a source checkout (e.g. `npx sparkrun-ui` inside the
// repo), there is no `dist/` — fall back to the raw Next.js standalone output
// so a `pnpm build` is enough to run without a separate `pack:standalone`.
const projectRoot = resolve(HERE, "..");
const distEntry = resolve(projectRoot, "dist/server.js");
const standaloneEntry = resolve(projectRoot, ".next/standalone/server.js");

let serverEntry = [distEntry, standaloneEntry].find((p) => existsSync(p));

if (!serverEntry) {
  // Source checkout without a build yet — bootstrap it. Detect "source
  // checkout" by the presence of next.config.ts so we never try to build
  // inside a broken install of the published tarball.
  if (!existsSync(resolve(projectRoot, "next.config.ts"))) {
    process.stderr.write("sparkrun-ui: could not find a built server.\n");
    process.exit(1);
  }
  const pnpmProbe = spawnSync("pnpm", ["--version"], { stdio: "ignore" });
  if (pnpmProbe.error?.code === "ENOENT" || pnpmProbe.status !== 0) {
    process.stderr.write(
      "sparkrun-ui: no build found and `pnpm` is not on PATH.\n" +
        "  Install pnpm (https://pnpm.io/installation) and retry, or run `pnpm build` manually.\n",
    );
    process.exit(1);
  }
  const run = (cmd, args) => {
    process.stdout.write(`sparkrun-ui: running \`${cmd} ${args.join(" ")}\`\n`);
    const r = spawnSync(cmd, args, { cwd: projectRoot, stdio: "inherit" });
    if (r.status !== 0) {
      process.stderr.write(`sparkrun-ui: \`${cmd} ${args.join(" ")}\` failed\n`);
      process.exit(r.status ?? 1);
    }
  };
  run("pnpm", ["install"]);
  run("pnpm", ["build"]);
  if (!existsSync(standaloneEntry)) {
    process.stderr.write(`sparkrun-ui: build did not produce ${standaloneEntry}\n`);
    process.exit(1);
  }
  serverEntry = standaloneEntry;
}

process.stdout.write(
  `sparkrun-ui ${PKG.version} listening on http://${process.env.HOSTNAME}:${port}\n`,
);
await import(pathToFileURL(serverEntry).href);
