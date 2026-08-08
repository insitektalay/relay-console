# Relay Host architecture

Date: 2026-08-08

Status: implemented in the `relay-host-architecture` worker change. Integration and Railway deployment are separate operations.

## Purpose

Relay Host is the stable computer identity and background connection owner for Relay. Hermes Agent and OpenClaw are runtime adapters inside that host. They are not separate computers.

The normal product view shows one Relay Host for one Mac. It lists the available runtime adapters below that host. Advanced diagnostics can still show each adapter credential when a support action needs that detail.

## Stable identity

The macOS client creates one installation ID with the `relayhost_` prefix and saves it in the local application database. All bridge enrollments from that installation send this ID to Railway.

Railway stores the ID on bridge enrollments, bridge devices, and runtime hosts. It uses the ID to merge Hermes Agent and OpenClaw adapters into one runtime host. Runtime dispatch still selects the active bridge device for the requested runtime type.

Each bridge device also has a durable role. The host controller and a runtime adapter use separate replacement slots. Thus, a new Hermes adapter revokes only the previous Hermes adapter. It does not revoke the Relay Host controller. Runtime dispatch prefers a runtime adapter over the controller when both can serve the same runtime.

This rule avoids label-based identity. A display-name change does not create a new host.

## Background service

The application bundle contains `RelayHostService`. The macOS application installs it as the per-user launchd service `work.relayconsole.host`.

The service uses the existing `CloudRuntimeDeviceTransport`. Therefore, it keeps the existing token renewal, credential rotation, WebSocket reconnect, registration acknowledgement, registration retry, and automatic agent-link repair behaviour.

The user interface starts the embedded connection owner only when the launchd service cannot start. This is the safe fallback during rollout and on unsupported installations. Only one owner starts for a normal application session.

The service writes a small local health file. The application uses this file and the process ID to decide whether the service owns the connection.

## Recovery invariants

The Relay Host change must preserve these rules:

1. Refresh an expired account token and retry the failed request one time.
2. Keep the last valid bridge list when refresh fails.
3. Resend runtime and external-agent registration until Railway acknowledges it.
4. Repair only eligible automatic Hermes Agent and OpenClaw links.
5. Respect `connect_auto_link_suppressed` and every explicit user opt-out.
6. Keep runtime-specific dispatch authorization. A Hermes request cannot use an OpenClaw credential, and an OpenClaw request cannot use a Hermes credential.
7. Do not let a revoked credential create a new trust relationship.

The source contract in `scripts/runtime-recovery-contract.test.mjs` checks these rules and the Relay Host ownership model together.

## Data and API compatibility

The new API fields are optional. An old client can continue to authenticate without a host installation ID. After a successful legacy authentication response, the macOS client adopts the Railway host installation ID for later requests.

The migration backfills stable IDs for current bridge records that share the same workspace, host type, and normalized computer label. Runtime-host adoption is lazy. This avoids an unsafe rewrite of historical authority records during deployment.

## Removal and rollback

The existing embedded transport remains available as a fallback. If the background service is disabled with `RELAY_HOST_DISABLE_SERVICE=1`, is absent from the bundle, or cannot start, Relay Console uses the embedded owner.

The local data-removal flow unloads the launchd service and removes its health state. The integration deployment must run the backend migration before clients depend on the new stable identity fields.
