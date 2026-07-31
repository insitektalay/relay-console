# Harness Supply-Chain Policy

Relay Console public-beta harness installation is fail closed.

## Trusted Inputs

- Relay release metadata and `harness-compatibility.json` ship inside the signed
  app bundle.
- Hermes and OpenClaw source may come only from their recorded official GitHub
  repositories. The installer checks out the recorded release tag and accepts
  it only when `HEAD` equals the recorded peeled commit.
- Managed Node archives may come only from `nodejs.org`; managed uv archives may
  come only from the official `astral-sh/uv` GitHub release.
- Every supported Node and uv archive has an exact HTTPS URL and lowercase
  SHA-256 in the bundled manifest. A mismatch deletes the file before execution
  or extraction.
- pnpm is exact-version constrained. Hermes uses `uv sync --locked`; OpenClaw
  uses `pnpm install --frozen-lockfile`. Their upstream lockfiles carry package
  artifact integrity values.
- SwiftPM remains governed by the tracked `Package.resolved`; release work must
  not update it implicitly.

## Failure Rules

An unknown architecture, missing pin, unexpected host, invalid checksum,
different Git commit, wrong executable version, or changed dependency lock
stops installation. Relay Console must not execute or extract the rejected
download and must preserve the previously installed harness during an update.

Updating any pin or checksum requires a reviewed Relay release change, upstream
tag/commit verification, lockfile review, clean build/test evidence, and new
supported-architecture artifact evidence.
