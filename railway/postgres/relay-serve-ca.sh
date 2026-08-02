#!/bin/bash
set -euo pipefail

nonce=""
while IFS= read -r line; do
  line="${line%$'\r'}"
  [ -z "$line" ] && break
  case "$line" in
    [Xx]-[Rr]elay-[Nn]once:*) nonce="${line#*: }" ;;
  esac
done

if ! [[ "$nonce" =~ ^[0-9a-f]{64}$ ]]; then
  printf 'HTTP/1.1 400 Bad Request\r\nContent-Length: 0\r\nConnection: close\r\n\r\n'
  exit 0
fi

ca=$(base64 -w0 /var/lib/postgresql/data/certs/root.crt)
hmac=$(printf '%s' "$nonce.$ca" | openssl dgst -sha256 \
  -mac HMAC -macopt "hexkey:$DATABASE_CA_BOOTSTRAP_SECRET" | awk '{print $2}')
body=$(printf '{"ca":"%s","hmac":"%s"}' "$ca" "$hmac")
printf 'HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: %s\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n%s' \
  "${#body}" "$body"
