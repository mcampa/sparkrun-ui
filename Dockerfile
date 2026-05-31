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
       tini \
  && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
  && apt-get install --no-install-recommends -y nodejs \
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

USER app
WORKDIR /home/app/app
ENV HOME=/home/app \
    NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    SPARKRUN_BIN=sparkrun

# Standalone Next.js server bundle + static + public.
COPY --chown=app:app --from=builder /app/.next/standalone ./
COPY --chown=app:app --from=builder /app/.next/static ./.next/static
COPY --chown=app:app --from=builder /app/public ./public

EXPOSE 3000

# tini reaps zombies from sparkrun child processes (ssh, docker, etc.).
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "server.js"]
