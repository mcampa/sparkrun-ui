<p align="center">
  <img src="public/logo.svg" alt="sparkrun" width="64" height="64" />
</p>

<h1 align="center">sparkrun-ui</h1>

<p align="center">
Web interface for <a href="https://github.com/mcampa/sparkrun">sparkrun</a> —
launch and monitor inference workloads on NVIDIA DGX Spark clusters from a
browser.
</p>

## Features

- **Dashboard** — live-updating view of currently running workloads with a
  one-click stop control. Backed by `sparkrun cluster status --json` polled
  through an SSE event iterator.
- **Recipes** — browse all recipes from every registry. Filter by registry and
  search by name / model / runtime. Hover a recipe to see its description and
  VRAM estimate; click for the full `sparkrun recipe show` output.
- **Launch wizard** — 4-step flow: pick a recipe, edit the YAML (with a
  CodeMirror editor and a dynamic overrides form that two-way binds to it,
  preserving comments), preview the dry-run command, then confirm and fire.
  Live validation checks recipe schema, port-in-use against the cluster, and
  TCP-probes the port on each target host.
- **Benchmarks** — browse benchmark history from `~/.cache/sparkrun/benchmarks`,
  open any run to see throughput / TTFR charts derived from
  `consolidated.json`, or kick off a new benchmark (recipe + profile +
  concurrency + skip-run toggle).
- **Logs** — terminal-style viewer streaming `sparkrun logs <cluster_id>`
  output (stdout + stderr interleaved) with auto-follow.
- **Cluster monitor** — live per-host CPU / GPU / memory bars and rolling
  sparkline history from `sparkrun cluster monitor --json`.

## Stack

- **Next.js 16** App Router (Turbopack)
- **React 19** with Server Components for initial paint and Client Components
  for interactive views
- **oRPC** for end-to-end type safety. One router at
  `lib/rpc/router.ts`, mounted at `app/rpc/[[...rest]]/route.ts`; RSCs call
  procedures directly via `createRouterClient`, client components call the
  same procedures over HTTP via `RPCLink`. Live views use oRPC's event
  iterators (server-sent events under the hood).
- **Base UI** for unstyled component primitives (Dialog, Select, Combobox,
  Tabs, NumberField, Switch, Toast, PreviewCard)
- **Tailwind CSS 4** for styling
- **CodeMirror 6** for the YAML editor with lint markers
- **`yaml`** for comment-preserving Document-API YAML edits
- **zod** for input validation and CLI JSON parsing

The backend is the `sparkrun` CLI itself, shelled out via
`child_process.spawn`. The UI also reads `~/.cache/sparkrun/{jobs,benchmarks}`
directly when richer state is needed.

## Run with Docker (recommended)

A multi-arch image (`linux/amd64` + `linux/arm64`) is published to
[`ghcr.io/mcampa/sparkrun-ui`](https://github.com/mcampa/sparkrun-ui/pkgs/container/sparkrun-ui)
on every push to `main`. The image bundles sparkrun (installed via `uv`) and
the SSH client it needs.

### Prerequisites

- An SSH key that can reach every host in your cluster (sparkrun ssh's to each
  host to run `docker ps`, `docker logs`, etc.)
- A saved sparkrun cluster definition. From the host run `sparkrun cluster
  create <name> --hosts <ip1>,<ip2>` once.
- Docker installed on every cluster host (not on the UI host).

### Quick start — single DGX (cluster contains `127.0.0.1`)

```bash
docker run -d --name sparkrun-ui \
  --restart unless-stopped \
  --network host \
  -v ~/.ssh:/home/app/.ssh:ro \
  -v ~/.config/sparkrun:/home/app/.config/sparkrun \
  -v ~/.cache/sparkrun:/home/app/.cache/sparkrun \
  ghcr.io/mcampa/sparkrun-ui:latest
```

Open <http://localhost:3000>.

`--network host` is required when your cluster references `127.0.0.1` — the
container's loopback otherwise points back at itself, not the host.

### Quick start — multi-host / remote cluster

If your sparkrun cluster definition uses LAN IPs (e.g. `192.168.0.40,
192.168.0.41`), bridge networking works fine:

```bash
docker run -d --name sparkrun-ui \
  --restart unless-stopped \
  -p 3000:3000 \
  -v ~/.ssh:/home/app/.ssh:ro \
  -v ~/.config/sparkrun:/home/app/.config/sparkrun \
  -v ~/.cache/sparkrun:/home/app/.cache/sparkrun \
  ghcr.io/mcampa/sparkrun-ui:latest
```

### docker compose

A ready-made [`docker-compose.yml`](./docker-compose.yml) lives at the repo
root with all the mounts pre-wired. Defaults assume the single-host case:

```bash
docker compose up -d
```

### What the volume mounts do

| Mount | Purpose |
| ----- | ------- |
| `~/.ssh` (ro) | SSH private key + known_hosts so sparkrun can reach cluster hosts |
| `~/.config/sparkrun` | Saved clusters, registries config |
| `~/.cache/sparkrun` | Recipe registries, job manifests, benchmark results — shared with the host's `sparkrun` CLI so both see the same state |

### Image tags

- `latest` — every push to `main`
- `sha-<short>` — every commit (immutable, pin this in production)
- `vX.Y.Z` / `vX.Y` — release tags

## Local development

Without Docker, for hacking on the UI itself:

```bash
pnpm install
pnpm dev          # binds 0.0.0.0:3000 so LAN clients can reach it
```

Open <http://localhost:3000> (or the LAN IP from another machine).

### Requirements

- Node.js 22+
- pnpm 10+
- `sparkrun` CLI on `PATH` (`SPARKRUN_BIN` env var to override)
- A reachable cluster — either the default cluster
  (`sparkrun cluster default`) or one resolvable via `--cluster` / `--hosts`

### Production build (no Docker)

```bash
pnpm build
pnpm start
```

## Configuration

- `SPARKRUN_BIN` — path to the sparkrun binary (default: `sparkrun`)
- `next.config.ts` — `allowedDevOrigins` accepts any LAN host in dev so HMR
  works from other machines

## Project layout

```
app/
  rpc/[[...rest]]/route.ts       # oRPC handler mount
  dashboard/                     # /dashboard — live workloads
  recipes/                       # /recipes — browse + filter
  launch/                        # /launch — 4-step wizard
  benchmarks/                    # /benchmarks — history, detail, new
  logs/[clusterId]/              # /logs/<id> — live tail
  monitor/                       # /monitor — per-host metrics
  components/
    ui/                          # Base UI wrappers (Button, Dialog, ...)
    dashboard/ recipes/ launch/  # feature components
    benchmarks/ logs/ monitor/

lib/
  rpc/
    router.ts                    # composed router
    server.ts                    # createRouterClient — for RSCs
    client.ts                    # RPCLink + createORPCClient — for client components
    procedures/                  # one file per feature
  sparkrun.ts                    # spawn helpers (one-shot + streaming)
  schemas.ts                     # zod schemas for CLI JSON shapes
  state.ts                       # ~/.cache/sparkrun/* disk readers
  draft.ts                       # per-draft tempfile lifecycle for the wizard
  portCheck.ts                   # TCP probe for port-in-use validation
```

## Caveats

- Long-running mutations (`run.start`, `benchmarks.run`) are fire-and-forget:
  the procedure spawns the CLI detached and returns immediately. The source
  of truth for "what's running" stays `sparkrun cluster status`, polled via
  `status.stream`.
- No persistence layer — every page reflects current CLI state and the
  sparkrun cache directly.
- No auth. Bind to a trusted network only.
