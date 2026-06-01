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

- **Dashboard** — live-updating view of currently running workloads with one-click stop.
- **Recipes** — browse every registry; filter by name / model / runtime.
- **Launch wizard** — pick a recipe, edit YAML with live validation, preview the dry-run command, launch, then tail logs in-place.
- **Chat** — talk to any running model from the browser; the Send button stays disabled until the workload reports ready.
- **Benchmarks** — browse history, view throughput / TTFR charts, kick off new runs.
- **Logs** — terminal-style live tail with ANSI color rendering.
- **Cluster monitor** — live per-host CPU / GPU / memory bars and sparkline history.

## Screenshots

|                                                                                          |                                                                                          |                                                                                          |
| :--------------------------------------------------------------------------------------: | :--------------------------------------------------------------------------------------: | :--------------------------------------------------------------------------------------: |
|        ![Dashboard](https://placehold.co/600x375/09090b/fafafa/png?text=Dashboard)        |       ![Recipes](https://placehold.co/600x375/09090b/fafafa/png?text=Recipes)            |  ![Launch wizard](https://placehold.co/600x375/09090b/fafafa/png?text=Launch+wizard)     |
|                                       Dashboard                                          |                                       Recipes                                            |                                    Launch wizard                                         |
|          ![Logs](https://placehold.co/600x375/09090b/fafafa/png?text=Logs)               |    ![Benchmarks](https://placehold.co/600x375/09090b/fafafa/png?text=Benchmarks)         |       ![Monitor](https://placehold.co/600x375/09090b/fafafa/png?text=Monitor)            |
|                                          Logs                                            |                                     Benchmarks                                           |                                      Monitor                                             |
|          ![Chat](https://placehold.co/600x375/09090b/fafafa/png?text=Chat)               | ![Recipe details](https://placehold.co/600x375/09090b/fafafa/png?text=Recipe+details)    | ![Launch preview](https://placehold.co/600x375/09090b/fafafa/png?text=Launch+preview)    |
|                                          Chat                                            |                                  Recipe details                                          |                                  Launch preview                                          |
| ![Empty dashboard](https://placehold.co/600x375/09090b/fafafa/png?text=Empty+dashboard)  |  ![Recipe filters](https://placehold.co/600x375/09090b/fafafa/png?text=Recipe+filters)   |    ![Launch logs](https://placehold.co/600x375/09090b/fafafa/png?text=Launch+logs)       |
|                                  Empty dashboard                                         |                                   Recipe filters                                         |                                   Launch logs                                            |
|    ![New benchmark](https://placehold.co/600x375/09090b/fafafa/png?text=New+benchmark)   |  ![Chat — ready](https://placehold.co/600x375/09090b/fafafa/png?text=Chat+%E2%80%94+ready)  |  ![Monitor history](https://placehold.co/600x375/09090b/fafafa/png?text=Monitor+history) |
|                                    New benchmark                                         |                                     Chat — ready                                         |                                  Monitor history                                         |
|     ![Colored logs](https://placehold.co/600x375/09090b/fafafa/png?text=Colored+logs)    |  ![YAML highlighting](https://placehold.co/600x375/09090b/fafafa/png?text=YAML+highlight) | ![Workload cards](https://placehold.co/600x375/09090b/fafafa/png?text=Workload+cards)    |
|                                     Colored logs                                         |                                  YAML highlighting                                       |                                  Workload cards                                          |

## Run with npx

The fastest way to try it. Requires Node 20+ and `sparkrun` already on `$PATH`:

```bash
npx sparkrun-ui
# → http://0.0.0.0:3000 (reachable on the LAN; use --host 127.0.0.1 for loopback only)
```

Common flags:

```bash
npx sparkrun-ui --port 4000           # change the port
npx sparkrun-ui --host 127.0.0.1      # bind loopback only (not exposed on the network)
npx sparkrun-ui --sparkrun-bin /opt/sparkrun/bin/sparkrun
```

`--help` lists the full set. Behind the scenes this runs the same Next.js
standalone server that the Docker image uses; the package ships a precompiled
bundle so there is no build step on the user's machine.

## Run with Docker

A multi-arch image (`linux/amd64` + `linux/arm64`) is published to
[`ghcr.io/mcampa/sparkrun-ui`](https://github.com/mcampa/sparkrun-ui/pkgs/container/sparkrun-ui)
on every push to `main`.

**The image does not bundle sparkrun.** It bind-mounts the host's
uv-installed sparkrun into the container so the UI always uses the same
version you have on the host — no drift, no extra version to keep updated.

### Prerequisites

- Sparkrun installed on the host: `uv tool install sparkrun`
- Host Python is **3.12** — see [troubleshooting](CONTRIBUTING.md#python-version-mismatch) if not.
- An SSH key that can reach every host in your cluster.
- A saved sparkrun cluster definition: `sparkrun cluster create <name> --hosts <ip1>,<ip2>`.
- Docker installed on every cluster host (not the UI host).

### Single DGX (cluster contains `127.0.0.1`)

```bash
docker run -d --name sparkrun-ui \
  --restart unless-stopped \
  --network host \
  -v $HOME/.local/bin/sparkrun:/usr/local/bin/sparkrun:ro \
  -v $HOME/.local/share/uv/tools/sparkrun:$HOME/.local/share/uv/tools/sparkrun:ro \
  -v $HOME/.ssh:/home/app/.ssh:ro \
  -v $HOME/.config/sparkrun:/home/app/.config/sparkrun \
  -v $HOME/.cache/sparkrun:/home/app/.cache/sparkrun \
  ghcr.io/mcampa/sparkrun-ui:latest
```

Open <http://localhost:3000>. `--network host` is required when your cluster
references `127.0.0.1`. See [mount reference](CONTRIBUTING.md#docker-volume-mounts)
for what each volume does.

### Multi-host / remote cluster

If your cluster uses LAN IPs (e.g. `192.168.0.40, 192.168.0.41`), drop
`--network host` and publish port 3000:

```bash
docker run -d --name sparkrun-ui \
  --restart unless-stopped \
  -p 3000:3000 \
  -v $HOME/.local/bin/sparkrun:/usr/local/bin/sparkrun:ro \
  -v $HOME/.local/share/uv/tools/sparkrun:$HOME/.local/share/uv/tools/sparkrun:ro \
  -v $HOME/.ssh:/home/app/.ssh:ro \
  -v $HOME/.config/sparkrun:/home/app/.config/sparkrun \
  -v $HOME/.cache/sparkrun:/home/app/.cache/sparkrun \
  ghcr.io/mcampa/sparkrun-ui:latest
```

### docker compose

A ready-made [`docker-compose.yml`](./docker-compose.yml) lives at the repo
root with all the mounts pre-wired:

```bash
docker compose up -d
```

### Image tags

- `latest` — every push to `main`
- `sha-<short>` — every commit (immutable; pin this in production)
- `vX.Y.Z` / `vX.Y` — release tags

## Configuration

- `--port <port>` / `PORT` — port to listen on (default `3000`)
- `--host <host>` / `HOSTNAME` — interface to bind (default `0.0.0.0`)
- `--sparkrun-bin <path>` / `SPARKRUN_BIN` — path to the sparkrun binary
  (default: `sparkrun` on `$PATH`)

## Caveats

- **No auth.** Bind to a trusted network only. The UI has full access to
  the sparkrun CLI on the host machine.
- **No persistence layer.** Every page reflects current CLI state and the
  sparkrun cache directly.
- Long-running mutations (benchmarks) are fire-and-forget — the
  source of truth for "what's running" stays `sparkrun cluster status`.

## Contributing

Hacking on the UI, building from source, troubleshooting the Docker setup —
all in [CONTRIBUTING.md](CONTRIBUTING.md).

## License

Apache License 2.0 — see [LICENSE](LICENSE) for details.
