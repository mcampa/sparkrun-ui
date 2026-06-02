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

exec gosu app "$@"
