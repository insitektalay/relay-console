FROM ghcr.io/railwayapp-templates/postgres-ssl:17@sha256:1713b3b1a1063905d240297de1f705d867de50f41422bd5e09cee6a289bb3832

USER root
RUN apt-get update \
    && apt-get install -y --no-install-recommends socat \
    && rm -rf /var/lib/apt/lists/*

COPY --chmod=755 init-ssl.sh /docker-entrypoint-initdb.d/init-ssl.sh
COPY --chmod=755 relay-postgres-start.sh /usr/local/bin/relay-postgres-start.sh
COPY --chmod=755 relay-serve-ca.sh /usr/local/bin/relay-serve-ca.sh

CMD ["relay-postgres-start.sh"]
