#!/bin/bash
set -euo pipefail

SSL_DIR="/var/lib/postgresql/data/certs"
ROOT_KEY="$SSL_DIR/root.key"
ROOT_CERT="$SSL_DIR/root.crt"
SERVER_KEY="$SSL_DIR/server.key"
SERVER_CERT="$SSL_DIR/server.crt"
SERVER_CSR="$SSL_DIR/server.csr"
EXTENSIONS="$SSL_DIR/server.ext"
POSTGRES_CONF_FILE="$PGDATA/postgresql.conf"

sudo mkdir -p "$SSL_DIR"
sudo chown postgres:postgres "$SSL_DIR"

if [ ! -s "$ROOT_KEY" ] || [ ! -s "$ROOT_CERT" ]; then
  openssl genpkey -algorithm ED25519 -out "$ROOT_KEY"
  openssl req -new -x509 -key "$ROOT_KEY" -out "$ROOT_CERT" \
    -days "${RELAY_POSTGRES_CA_DAYS:-3650}" \
    -subj "/CN=Relay Console installation PostgreSQL CA" \
    -addext "basicConstraints=critical,CA:TRUE" \
    -addext "keyUsage=critical,keyCertSign,cRLSign"
elif ! openssl x509 -checkend 15552000 -noout -in "$ROOT_CERT"; then
  echo "PostgreSQL root CA expires within 180 days; rotate it deliberately before renewing the server certificate." >&2
  exit 1
fi

openssl genpkey -algorithm ED25519 -out "$SERVER_KEY"
openssl req -new -key "$SERVER_KEY" -out "$SERVER_CSR" -subj "/CN=localhost"
cat > "$EXTENSIONS" <<'EOF'
[server]
authorityKeyIdentifier=keyid,issuer
basicConstraints=critical,CA:FALSE
keyUsage=critical,digitalSignature
extendedKeyUsage=serverAuth
subjectAltName=DNS:localhost
EOF
openssl x509 -req -in "$SERVER_CSR" -CA "$ROOT_CERT" -CAkey "$ROOT_KEY" \
  -CAcreateserial -out "$SERVER_CERT" -days "${RELAY_POSTGRES_SERVER_CERT_DAYS:-397}" \
  -extfile "$EXTENSIONS" -extensions server

chown postgres:postgres "$ROOT_CERT" "$SERVER_CERT" "$SERVER_KEY"
chmod 0600 "$ROOT_KEY" "$SERVER_KEY"
chmod 0644 "$ROOT_CERT" "$SERVER_CERT"

if ! grep -q "^ssl_cert_file = '$SERVER_CERT'" "$POSTGRES_CONF_FILE" 2>/dev/null; then
  cat >> "$POSTGRES_CONF_FILE" <<EOF
ssl = on
ssl_cert_file = '$SERVER_CERT'
ssl_key_file = '$SERVER_KEY'
ssl_ca_file = '$ROOT_CERT'
shared_preload_libraries = 'pg_stat_statements'
EOF
fi
