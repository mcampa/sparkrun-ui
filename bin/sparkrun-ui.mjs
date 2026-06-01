#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
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
  -p, --port <port>           Port to listen on (default: 3000)
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

const port = values.port ?? process.env.PORT ?? "3000";
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

const serverEntry = resolve(HERE, "../dist/server.js");
process.stdout.write(
  `sparkrun-ui ${PKG.version} listening on http://${process.env.HOSTNAME}:${port}\n`,
);
await import(pathToFileURL(serverEntry).href);
