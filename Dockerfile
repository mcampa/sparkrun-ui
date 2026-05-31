# syntax=docker/dockerfile:1.7

# -----------------------------------------------------------------------------
# Builder: install JS deps + compile Next.js to a standalone server bundle.
# -----------------------------------------------------------------------------
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Enable corepack so pnpm matches the version pinned in package.json.
RUN corepack enable

# Copy manifest files first so `pnpm install` is cached when source changes.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc* ./
RUN pnpm install --frozen-lockfile

# Copy the rest and build.
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# -----------------------------------------------------------------------------
# Runtime: Node + Python + uv + sparkrun + ssh client.
# Final layout uses Next's standalone output so we don't ship node_modules.
# -----------------------------------------------------------------------------
FROM node:22-bookworm-slim AS runtime

# python3 / pip / venv for uv; openssh-client so sparkrun can ssh to hosts;
# ca-certificates + curl for the uv installer.
RUN apt-get update \
  && apt-get install --no-install-recommends -y \
       python3 \
       python3-venv \
       openssh-client \
       ca-certificates \
       curl \
       tini \
  && rm -rf /var/lib/apt/lists/*

# Install uv (single static binary) into /usr/local/bin so it's on PATH for all
# users. Pinning to the latest stable installer script.
RUN curl -LsSf https://astral.sh/uv/install.sh | env UV_INSTALL_DIR=/usr/local/bin sh

# Non-root user so the mounted ~/.ssh keys (typically uid 1000) line up.
ARG APP_UID=1000
ARG APP_GID=1000
RUN groupadd --system --gid ${APP_GID} app \
  && useradd --system --uid ${APP_UID} --gid app --create-home --home-dir /home/app --shell /bin/bash app

USER app
WORKDIR /home/app/app
ENV HOME=/home/app \
    PATH=/home/app/.local/bin:/usr/local/bin:/usr/bin:/bin \
    NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Install sparkrun as the app user so its tool dir lives under /home/app.
RUN uv tool install sparkrun

# Copy the standalone Next.js server bundle, static assets and public dir.
# `output: 'standalone'` puts a self-contained runner at .next/standalone.
COPY --chown=app:app --from=builder /app/.next/standalone ./
COPY --chown=app:app --from=builder /app/.next/static ./.next/static
COPY --chown=app:app --from=builder /app/public ./public

EXPOSE 3000

# tini reaps zombies from sparkrun child processes (ssh, docker, etc.).
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "server.js"]
