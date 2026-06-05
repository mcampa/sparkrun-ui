# syntax=docker/dockerfile:1.7

# -----------------------------------------------------------------------------
# Builder: install JS deps + compile Next.js to a standalone server bundle.
# -----------------------------------------------------------------------------
FROM node:22-bookworm-slim AS builder

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc* ./
RUN pnpm install --frozen-lockfile

COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# -----------------------------------------------------------------------------
# Runtime: Python 3.12 (to match the host's uv-installed sparkrun) + Node 22
# + ssh client + git. Sparkrun itself is NOT installed in the image — it is
# bind-mounted from the host so the container always uses the same version
# the user already has. Git is needed by sparkrun to clone/pull recipe
# registries.
# -----------------------------------------------------------------------------
FROM python:3.12-slim-bookworm AS runtime

RUN apt-get update \
  && apt-get install --no-install-recommends -y \
       curl \
       ca-certificates \
       openssh-client \
       git \
       gnupg \
       gosu \
       tini \
  && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
  && apt-get install --no-install-recommends -y nodejs \
  # Docker CLI is needed because sparkrun runs `docker` locally for any
  # cluster host that resolves to 127.0.0.1. The daemon stays on the host;
  # the container talks to it via a bind-mounted /var/run/docker.sock.
  && install -m 0755 -d /etc/apt/keyrings \
  && curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc \
  && chmod a+r /etc/apt/keyrings/docker.asc \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian bookworm stable" > /etc/apt/sources.list.d/docker.list \
  && apt-get update \
  && apt-get install --no-install-recommends -y docker-ce-cli \
  # uv is needed by sparkrun for self-upgrade and running tools via uvx.
  && curl -LsSf https://astral.sh/uv/install.sh | UV_INSTALL_DIR=/usr/local/bin sh \
  && apt-get purge -y --auto-remove gnupg curl \
  && rm -rf /var/lib/apt/lists/*

# The host's sparkrun venv shim symlinks `python -> /usr/bin/python3` (system
# Python). python:3.12-slim puts Python at /usr/local/bin/python3.12 so we
# alias it at /usr/bin/python3* for the shim to resolve cleanly.
RUN ln -sf /usr/local/bin/python3.12 /usr/bin/python3.12 \
  && ln -sf /usr/local/bin/python3.12 /usr/bin/python3

# Non-root user. uid 1000 matches the typical host login so bind-mounted
# ~/.ssh and ~/.cache/sparkrun keep correct ownership semantics.
ARG APP_UID=1000
ARG APP_GID=1000
RUN groupadd --system --gid ${APP_GID} app \
  && useradd --system --uid ${APP_UID} --gid app --create-home --home-dir /home/app --shell /bin/bash app

# Start as root so the entrypoint can sync the docker-socket group, then drop
# to `app` via gosu. The app process itself never runs as root.
WORKDIR /home/app/app
ENV HOME=/home/app \
    NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=5678 \
    HOSTNAME=0.0.0.0 \
    SPARKRUN_BIN=sparkrun

# Standalone Next.js server bundle + static + public.
COPY --chown=app:app --from=builder /app/.next/standalone ./
COPY --chown=app:app --from=builder /app/.next/static ./.next/static
COPY --chown=app:app --from=builder /app/public ./public

COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 5678

# tini reaps zombies from sparkrun child processes (ssh, docker, etc.).
ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/entrypoint.sh"]
CMD ["node", "server.js"]
