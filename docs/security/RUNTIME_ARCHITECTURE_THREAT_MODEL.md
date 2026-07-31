# Runtime architecture threat model

Status: launch baseline

## Protected assets

- canonical agent identity, lifecycle, owner, assignment epoch, and suppression;
- bridge device credentials and managed worker secrets;
- model and Marketplace credentials;
- local profile, workspace, message, document, and artifact content;
- managed Railway service and volume isolation;
- migration manifests, checkpoints, and rollback authority; and
- approval, dispatch, billing, metering, and audit integrity.

## Trust boundaries

The macOS app, browser, iPhone/iPad app, bridge host, user-managed runtime,
Railway control plane, managed Hermes worker, Marketplace provider, and billing
provider are separate principals. Online status is presentation data, not
execution authority. Only the Railway decision combining active lifecycle,
no suppression, enabled binding, active ownership, positive epoch, and a fresh
online owner may expose execution.

## Threats and controls

| Threat | Required control | Verification |
|---|---|---|
| Reconnect claims an unassigned agent | Observation and heartbeat updates never assign; assignment requires an explicit reviewed operation. | Reconnect non-transfer regression and epoch audit. |
| Stale client executes after ownership transfer | Dispatch and UI require the current positive assignment epoch; old leases and owners are revoked. | Disabled, stale-epoch, offline, revoked, and switched-owner tests. |
| Collision or deleted identity reappears | Active suppressions quarantine matching observations across the declared scope. | Collision, suppression, reconnect, and lift-review tests. |
| Connector v2 substitutes an agent mapping | Bind workspace, host, runtime type, external ID, canonical ID, capability snapshot, and contract version. Fail closed on drift. | Connector negotiation and mapping tests. |
| Managed document exposes local bytes | Railway stores desired/applied metadata and bounded content only under the approved document model; local credentials and unrestricted paths are forbidden. | Schema, export, redaction, traversal, and tenant tests. |
| Artifact URL leaks or outlives authority | Signed URLs bind artifact, tenant, expiry, and disposition; clients render moved, expired, deleted, denied, and unavailable states without executable controls. | Artifact state and signing tests. |
| Migration copies secrets or machine state | Allowlisted categories, recursive forbidden-key/path checks, size limits, encryption, digest verification, and fresh credential authorization. | Manifest rejection and integrity tests. |
| Migration creates split brain | Source stays authoritative through snapshot/import/validation; one explicit epoch switch activates the destination. | Boundary-resume, source-authority, rollback, and owner tests. |
| Remediation deletes unrelated state | Dry-run inventory, exact workspace predicates, checksums, counts, checkpoints, and fail-closed path/marker checks. | Guarded remediation and local marker tests. |
| Forged marker deletes user content | Marker must match the binding and direct managed path; traversal, symlinks, nested roots, wrong agent, and missing marker are rejected. | Local teardown safety matrix. |
| Stale PID stops another process | Require Relay-created service identity and executable/config match; never trust a PID alone. | Process cleanup safety test. |
| Managed runtime crosses tenants | Every runtime, host, binding, migration, document, billing, and export lookup includes workspace authority. Per-workspace resources and credentials remain isolated. | Tenant-isolation suite. |
| Managed worker secret is exposed | Derive a per-runtime worker secret, send fresh model credentials directly to Railway variables, and exclude values from database, logs, exports, and support data. | Credential-storage regression and export tests. |
| Usage or deletion is misreported | Persist active minutes, authenticated worker byte counts, lifecycle timestamps, and provider deletion requests. | Metering, retention, decommission, and billing tests. |

## Residual risks

Railway, model providers, Marketplace providers, Apple, and Stripe remain
external dependencies. A compromised user-managed host can access its own
runtime content and credentials. Managed-volume deletion follows Railway's
provider recovery behavior after Relay's retention window. Human legal,
privacy, tax, App Review, and production acceptance remain separate release
approvals.

## Reassessment triggers

Review this model when adding managed OpenClaw, shared runtime pools, a new
Connector contract, credential-copy migration, broader managed documents,
unbounded artifact storage, automatic runtime installation, another billing
provider, or a new production region.
