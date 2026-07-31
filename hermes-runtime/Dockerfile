FROM python:3.12-slim@sha256:57cd7c3a7a273101a6485ba99423ee568157882804b1124b4dd04266317710de

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HERMES_WORKER_ENV=production \
    HERMES_WORKER_HOST=0.0.0.0 \
    HERMES_WORKER_PORT=8765 \
    HERMES_HOME=/data/hermes \
    HERMES_WORKSPACE_ROOT=/data/workspace \
    HERMES_WORKER_FORBIDDEN_TOOLSETS=session_search,terminal \
    TMPDIR=/data/tmp

WORKDIR /app
COPY --chown=root:root requirements.lock pyproject.toml README.md ./
COPY --chown=root:root src ./src
RUN python -m pip install \
        --disable-pip-version-check \
        --no-cache-dir \
        --no-compile \
        --require-hashes \
        --only-binary=:all: \
        --requirement requirements.lock \
    && python -m pip install \
        --disable-pip-version-check \
        --no-cache-dir \
        --no-compile \
        --no-build-isolation \
        --no-deps \
        . \
    && python -m pip check \
    && groupadd --gid 10001 hermes \
    && useradd --uid 10001 --gid 10001 --no-create-home --home-dir /nonexistent hermes \
    && mkdir -p /data/hermes /data/workspace /data/tmp \
    && chown -R 10001:10001 /data \
    && chmod -R 0700 /data \
    && chmod -R a-w /app \
    && chmod 0555 /tmp

VOLUME ["/data"]
EXPOSE 8765
USER 10001:10001
CMD ["clawchat-hermes-worker"]
