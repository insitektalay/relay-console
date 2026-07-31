#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: Scripts/upload-sentry-dsyms.sh /path/to/ClawChat.xcarchive" >&2
  exit 2
fi

ARCHIVE_PATH="$1"
DSYM_PATH="$ARCHIVE_PATH/dSYMs"

if [[ -z "${SENTRY_AUTH_TOKEN:-}" ]]; then
  echo "Skipping Sentry dSYM upload because SENTRY_AUTH_TOKEN is not set." >&2
  exit 0
fi

if [[ -z "${SENTRY_ORG:-}" || -z "${SENTRY_PROJECT:-}" ]]; then
  echo "SENTRY_ORG and SENTRY_PROJECT are required when SENTRY_AUTH_TOKEN is set." >&2
  exit 1
fi

if ! command -v sentry-cli >/dev/null 2>&1; then
  echo "sentry-cli is required to upload Sentry dSYMs." >&2
  exit 1
fi

if [[ ! -d "$ARCHIVE_PATH" || "$ARCHIVE_PATH" != *.xcarchive ]]; then
  echo "Expected an existing .xcarchive path: $ARCHIVE_PATH" >&2
  exit 1
fi

if [[ ! -d "$DSYM_PATH" ]] || ! find "$DSYM_PATH" -maxdepth 1 -name '*.dSYM' -print -quit | grep -q .; then
  echo "No dSYM bundles were found in $DSYM_PATH." >&2
  exit 1
fi

sentry-cli debug-files upload \
  --org "$SENTRY_ORG" \
  --project "$SENTRY_PROJECT" \
  "$DSYM_PATH"

echo "Uploaded Sentry dSYMs from $DSYM_PATH." >&2
