#!/bin/bash
set -euo pipefail

: "${DATABASE_CA_BOOTSTRAP_SECRET:?DATABASE_CA_BOOTSTRAP_SECRET is required}"
if ! [[ "$DATABASE_CA_BOOTSTRAP_SECRET" =~ ^[0-9a-fA-F]{64}$ ]]; then
  echo "DATABASE_CA_BOOTSTRAP_SECRET must be 32 random bytes encoded as hex" >&2
  exit 1
fi

(
  while [ ! -s /var/lib/postgresql/data/certs/root.crt ]; do sleep 1; done
  exec socat TCP6-LISTEN:8081,ipv6only=0,reuseaddr,fork,su=postgres \
    EXEC:/usr/local/bin/relay-serve-ca.sh
) &

exec /usr/local/bin/docker-entrypoint.sh \
  postgres -p 5432 -c 'listen_addresses=*'
