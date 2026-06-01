#!/usr/bin/env node
// Arranges the Next.js standalone build into ./dist for npm publish.
// Run automatically by the `prepack` script after `next build`.

import { cp, readdir, rm, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const STANDALONE = resolve(ROOT, ".next/standalone");
const STATIC = resolve(ROOT, ".next/static");
const PUBLIC = resolve(ROOT, "public");
const DIST = resolve(ROOT, "dist");

// Entries inside .next/standalone that we actually need at runtime. The Next
// standalone tracer leaves a lot of repo flotsam behind (source dirs, Docker
// files, configs, lockfiles, tsbuildinfo); we only ship the runtime essentials.
const STANDALONE_KEEP = new Set(["server.js", "package.json", "node_modules", ".next"]);

async function exists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

if (!(await exists(STANDALONE))) {
  console.error(`pack-standalone: ${STANDALONE} not found — run \`pnpm build\` first.`);
  process.exit(1);
}

await rm(DIST, { recursive: true, force: true });

for (const entry of await readdir(STANDALONE)) {
  if (!STANDALONE_KEEP.has(entry)) continue;
  await cp(resolve(STANDALONE, entry), resolve(DIST, entry), { recursive: true });
}

await cp(STATIC, resolve(DIST, ".next/static"), { recursive: true });
if (await exists(PUBLIC)) {
  await cp(PUBLIC, resolve(DIST, "public"), { recursive: true });
}

console.log("pack-standalone: dist/ ready (server.js, .next, node_modules, public)");
