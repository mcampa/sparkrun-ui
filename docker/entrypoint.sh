#!/bin/bash
# Drop privileges to the `app` user after fixing up the docker socket group.
#
# When a sparkrun cluster targets 127.0.0.1, sparkrun runs `docker` locally
# (no SSH). Inside this container that means we need access to the host's
# docker daemon via a bind-mounted /var/run/docker.sock. The socket is owned
# by root:docker on the host, and the host's docker GID is unpredictable, so
# we read it from the mounted socket and grant the app user access at start.
set -e

if [ -S /var/run/docker.sock ]; then
  SOCK_GID=$(stat -c '%g' /var/run/docker.sock)
  if [ -n "$SOCK_GID" ] && [ "$SOCK_GID" != "0" ]; then
    if ! getent group "$SOCK_GID" >/dev/null; then
      groupadd -g "$SOCK_GID" docker-host
    fi
    GROUP_NAME=$(getent group "$SOCK_GID" | head -n1 | cut -d: -f1)
    usermod -aG "$GROUP_NAME" app
  fi
fi

# Ensure sparkrun knows the host user for SSH.  sparkrun always uses SSH
# for cluster monitoring (even for 127.0.0.1), so the container's default
# OS user (app) won't authenticate against the host unless we configure
# the real host user in sparkrun's config.
if [ -n "${HOST_USER}" ] && [ "${HOST_USER}" != "app" ]; then
  SPARKRUN_CONFIG="$HOME/.config/sparkrun/config.yaml"
  if [ ! -f "$SPARKRUN_CONFIG" ]; then
    mkdir -p "$(dirname "$SPARKRUN_CONFIG")"
    printf 'ssh:\n  user: %s\n' "$HOST_USER" > "$SPARKRUN_CONFIG"
  fi
fi

exec gosu app "$@"
