# Repository ownership and retention

## Purpose

This document distinguishes shipping applications, supported runtime helpers,
generated inputs, archived prototypes and disposable local output. It prevents
an old project or cached build from being mistaken for a production source of
truth.

## Ownership decisions

| ID | Surface | Decision | Owner and verification |
| --- | --- | --- | --- |
| O-001 | `relay-console/` Electron app | Archived reference implementation. Native macOS supersedes it, so it is excluded from the pnpm workspace and normal installation. Keep it only while historical UI/runtime comparisons remain useful. | No release owner. It is not part of the full release matrix. |
| O-002 | `ClawChat/` and root `ClawChat.xcodeproj/` | Legacy prototype and compatibility snapshot. Do not add release behavior here. Maintained mobile work belongs to `ios/`. | Historical only. The iOS matrix uses `ios/ClawChat.xcodeproj`. |
| O-003 | `claude-runtime/` | Supported paired runtime. It connects to Railway, remains a pnpm workspace member and must pass build/tests when its code or shared contracts change. | Runtime integration owner; `pnpm --dir claude-runtime test`. |
| O-004 | `hermes-runtime/` | Supported external Python worker and bridge fixture. It deliberately remains outside pnpm because its package and tests are Python-owned. | Runtime integration owner; backend readiness installs the binary-only, hash-required `hermes-runtime/requirements-test.lock` and runs its contract tests. |

The canonical desktop implementation is `RelayConsoleSwift/`. The canonical
mobile implementation is `ios/`. The web application is `web/`, and Railway
behavior is owned by `backend/`. The landing page, shared packages and canonical
Marketplace inputs remain normal workspace members.

## Workspace policy

Normal `pnpm install` covers maintained JavaScript/TypeScript surfaces:

- `Relay Console landing page`
- `backend`
- `claude-runtime`
- `web`
- `packages/*`

The archived Electron package is intentionally absent. The Python Hermes worker,
Swift package and Xcode projects use their native package/build tools instead of
pnpm workspace membership.

## Engineering evidence retention

Evidence must be useful, reproducible and safe to retain.

| Evidence class | Location | Retention |
| --- | --- | --- |
| Decisions, acceptance summaries, command results and deployment identifiers | Versioned Markdown or sanitized JSON under `docs/` | Retain in Git history for the life of the repository. Superseded launch programs move under `docs/archive/`; they are not deleted merely because a new launch replaces them. |
| Canonical manifests, generated snapshots and deterministic indexes needed to reproduce a release | Versioned source locations under `packages/`, `backend/`, `web/`, `RelayConsoleSwift/` and `ios/` | Retain with the source revision and its Git history. |
| Raw CI logs, provider dashboards, screenshots and generated release evidence that may contain operational metadata | Approved private release-evidence storage; commit only a sanitized summary and stable identifier | Retain for at least 180 days and through two subsequent production releases, whichever is longer, unless legal/security policy requires longer. |
| Local build products, dependency caches, coverage output and Python bytecode | Ignored cache/build directories only | Disposable immediately after verification. Never cite a local cache as durable evidence. |
| Secrets, tokens, customer payloads and private runtime state | Never in repository evidence | Follow the applicable secret, customer-data and runtime-retention policy; do not copy them into audit documents. |

Evidence summaries must name the exact revision, command, result and deployment
identifier. A remote deployment is not proved by an unversioned screenshot
alone.

## Cache cleanup

`pnpm clean:repository-caches` performs a dry-run and prints only known
disposable paths. `pnpm clean:repository-caches:apply` removes the same bounded
set. The command does not follow symlinks and cannot target the repository root,
a home directory, source folders, evidence folders, environment files or
dependency lockfiles.

Adding a new cleanup target requires a code review and a regression test. Do not
replace the allowlist with a recursive workspace-wide glob.
