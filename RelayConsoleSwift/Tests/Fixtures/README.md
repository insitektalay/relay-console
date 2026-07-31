# Relay Console Swift Test Fixtures

This directory holds test-only fixtures and evidence manifests for Relay
Console Swift. Fixture packets support migration, contract, service, event
replay, visual, accessibility, manual evidence, and real-harness validation
without seeding product-visible sample data.

## Non-Negotiable Rules

- Fixtures are never product seeds. They must not create sample conversations,
  fake agents, fake harnesses, generated welcome messages, or simulated runtime
  output.
- Fixture data must be deterministic: stable ids, stable timestamps, explicit
  timezone notes, stable ordering, and documented rerun behavior.
- Secrets, credentials, raw tokens, private machine paths, and personal account
  values are not allowed. Use redacted metadata or secret-reference-only
  labels.
- Every packet must include a `manifest.md` or `manifest.json` that follows
  `manifest-schema.md`.
- Every manifest must link at least one `RCSPR` requirement id, one `SM`
  source-map id, an owner, and the consuming check or review layer.
- Real runtime observations belong under `real-harness/` as evidence. They are
  never deterministic product fixtures.

## Planned Roots

```text
Tests/Fixtures/
  README.md
  manifest-schema.md
  migrations/
  contracts/
  services/
  events/
  visual/
  accessibility/
  manual-evidence/
  real-harness/
```

Empty roots do not count as verified evidence. A root becomes meaningful only
when it contains a manifest that names its layer, owner, traceability, files,
and consuming checks.

## Naming

Use this packet layout:

```text
Tests/Fixtures/<layer-root>/<product-area>/<case-id>/
```

The `case-id` should be stable and descriptive:

```text
<requirement-or-family>-<state-or-scenario>-<sequence>
```

Examples:

- `migrations/profile-workspace/v006-profile-preferences-001/`
- `contracts/chat/thread-message-roundtrip-001/`
- `services/baseline/no-fake-bootstrap-001/`
- `events/runtime/dispatch-started-replay-001/`
- `visual/chat/failed-dispatch-min-window-001/`
- `manual-evidence/baseline/demo-00-baseline-001/`
- `real-harness/hermes/provision-dispatch-cancel-001/`

## Current Packets

| Packet | Layer | Status | Consuming check |
| --- | --- | --- | --- |
| `manual-evidence/baseline/demo-00-baseline-001/manifest.md` | `manual-evidence` | `verified` | Branch packet review plus `VC-0001`, `VC-0002`, `VC-0003`, and `VC-0006` command evidence from `codex/itc-0001-baseline-preflight`. |

## Status Boundaries

- `planned`: documented but not created.
- `created`: files or directories exist, but no consuming check has verified
  them.
- `implemented`: consumed by a test, script, or reviewed packet section.
- `verified`: consumed by passing command evidence or a reviewed manual packet
  that is in scope for the claim.
- `stale`: present but no longer current with the source graph.
- `retired`: intentionally retained only for history.

Fixture bootstrap files created for `ITC-0003` prove only fixture discipline
and schema readiness. They do not prove downstream migration, contract,
service, event replay, UI, visual, accessibility, manual, real-harness, or
release behavior.
