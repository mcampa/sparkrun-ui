# Contributing & development

Notes for hacking on sparkrun-ui, building from source, and troubleshooting
the Docker setup.

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

## Local development

Without Docker, for hacking on the UI itself:

```bash
pnpm install
pnpm dev          # binds 0.0.0.0:5678 so LAN clients can reach it
```

Open <http://localhost:5678> (or the LAN IP from another machine).

### Requirements

- Node.js 22+
- pnpm 10+
- `sparkrun` CLI on `PATH` (`SPARKRUN_BIN` env var to override)
- A reachable cluster — either the default cluster
  (`sparkrun cluster default`) or one resolvable via `--cluster` / `--hosts`

### Checks before pushing

```bash
pnpm format:ci    # prettier
pnpm lint         # eslint
pnpm typecheck    # tsc --noEmit
pnpm test         # vitest
```

CI runs the same four plus `pnpm build`.

### Production build (no Docker)

```bash
pnpm build
pnpm start
```

`pnpm build` produces a standalone Next.js bundle in `.next/standalone/`.
`scripts/pack-standalone.mjs` (used by `prepack` for npm publish) arranges
that bundle plus `.next/static` and `public/` into `dist/`.

## Docker volume mounts

| Mount                                              | Purpose                                                                                                              |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `~/.local/bin/sparkrun` (ro)                       | Host's sparkrun launcher script                                                                                      |
| `~/.local/share/uv/tools/sparkrun` (ro, same path) | Host's sparkrun venv (Python + site-packages)                                                                        |
| `~/.ssh` (ro)                                      | SSH private key + known_hosts so sparkrun can reach cluster hosts                                                    |
| `~/.config/sparkrun`                               | Saved clusters, registries config                                                                                    |
| `~/.cache/sparkrun`                                | Recipe registries, job manifests, benchmark results — shared with the host's `sparkrun` CLI so both see the same state |

The sparkrun tool dir must be mounted at the **same absolute path** inside the
container (`$HOME/.local/share/uv/tools/sparkrun` on both sides). The shim's
shebang hardcodes that path, so the venv resolves correctly.

## Troubleshooting

### Python version mismatch

If `python3 --version` on the host is not 3.12, the bind-mounted venv won't
work in the container (the C-extension wheels in `site-packages` were built
against the host's Python ABI). Two options:

1. Reinstall sparkrun on the host pinning Python 3.12:
   `uv tool install --python 3.12 --force sparkrun`
2. Build the image yourself targeting your Python version: edit `Dockerfile`
   and change `FROM python:3.12-slim-bookworm` and the symlink target.

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
  chat/                          # /chat — ChatGPT-style UI
  components/
    ui/                          # Base UI wrappers (Button, Dialog, ...)
    dashboard/ recipes/ launch/  # feature components
    benchmarks/ logs/ monitor/
    chat/

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
  ansi.ts                        # SGR escape parser for the log viewer

bin/
  sparkrun-ui.mjs                # `npx sparkrun-ui` launcher (parses flags + boots dist/)

scripts/
  pack-standalone.mjs            # arranges .next/standalone into dist/ for npm publish
```
