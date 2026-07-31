# Implementation and release acceptance

## Delivery contract

This is one full feature release. The work is organised below so engineers can build in a safe dependency order, not to define smaller customer editions.

Partial work must remain behind an internal workspace feature flag. A production flag must not be enabled and the feature must not be described as usable until all release gates pass across the Railway backend and supported web, macOS and iOS clients.

## Workstream A — shared contracts

### Deliverables

- Add versioned orchestration requirement, proposal, graph, pattern, build, definition, run, node, event, policy and report contracts to `packages/contracts/src/`.
- Use discriminated unions for node/executor/event types.
- Add JSON Schemas or generated runtime validators for every LLM/runtime boundary.
- Add safe enum compatibility helpers.
- Extend runtime dispatch, message, approval, task and connector audit contracts with optional orchestration correlation.
- Add shared permission/capability names and error codes.
- Add contract fixtures for plumber booking happy path and failure branches.

### Constraints

- No web-only canonical interfaces.
- Display metadata cannot affect graph execution.
- No `Record<string, unknown>` at critical boundaries where a typed union/schema is possible.
- Contract version and compiled hash are required.

## Workstream B — database and backend module

### Deliverables

- Add entities described in [05-data-api-and-realtime-contracts.md](./05-data-api-and-realtime-contracts.md).
- Add indexes, unique constraints, foreign keys, append-only guards and publication immutability enforcement.
- Add routing mode and correlation fields to existing entities.
- Register entities/modules with fresh-database bootstrap and production migration rehearsal.
- Implement orchestration controllers and server-side access checks.
- Implement transactional event sequence allocation and outbox.
- Add retention/export integration.

### Migration rules

- Use the next migration identifier at implementation time; do not assume a number from this document.
- Existing Team Chats default to `legacy_relay`.
- Existing non-shared/direct chats retain current behaviour.
- New operational threads require a primary definition before activation.
- Migrations are additive; legacy relay fields/endpoints remain during supported-client compatibility.
- Rehearse upgrade and rollback against a production-like snapshot.

## Workstream C — planner and proposal pipeline

### Deliverables

- Backend-owned planning-session lifecycle and requirement ledger.
- Relay Console planner runtime selection and dispatch.
- Authorised inventory service.
- Strict structured intake/question/proposal schemas.
- Repetition, turn and no-progress circuit breakers.
- Proposal revisions with provenance.
- Pattern retrieval and explanations.
- No-mutation planner tool set.
- Plain-language explanation service grounded in stored proposal.
- Multi-user contributions/conflict resolution.

### Existing code to reuse

- Relay Console resident agent identity and team-builder knowledge as the persona.
- Runtime dispatch infrastructure for LLM/harness execution.
- Agent documentation compiler/proposal/apply separation as a design precedent.
- Workspace/team/agent/Marketplace access services for inventory facts.

## Workstream D — pattern catalog and compiler

### Deliverables

- Versioned semantic export from `orchestration-diagram-builder`.
- Catalog validation against canonical graph schema.
- Metadata/full-text retrieval and optional embedding ranking.
- Deterministic compiler from proposal to canonical graph.
- Expansion of shorthand patterns into explicit runtime primitives.
- JSON Schema mapping validation.
- Static reachability, cycle, split/join and completion analysis.
- Dynamic delegation templates and hard budgets.
- Stable compiled hash and human-readable diagnostics.
- Version diff engine for graph, agents, apps, policies and schemas.

### Required pattern coverage

- central controller;
- sequential pipeline;
- parallel split/join;
- review/revise;
- hierarchical manager-worker;
- blackboard;
- event-driven choreography;
- router/specialists;
- bounded debate/voting/consensus;
- contract-net assignment;
- human-in-the-loop;
- saga/compensation;
- reusable subworkflow.

Every pattern requires positive, negative, restart, retry, cancellation and loop-bound tests.

## Workstream E — validator and simulator

### Deliverables

- Structural, data, executor, application, governance and UX validators.
- Stable diagnostic codes and graph paths.
- Inventory freshness checks.
- Simulation run mode and isolated event stream.
- Mock/test adapters for every Marketplace action category.
- Generated and user-supplied fixtures.
- Branch/failure/approval/compensation coverage report.
- Token/cost/action estimates and observed simulation usage.
- Side-effect escape tests proving real write/admin calls cannot occur.

## Workstream F — team build saga

### Deliverables

- Approved proposal-to-build-plan compiler.
- Resumable desired-state step runner.
- Existing Team/agent reuse and conflict handling.
- Runtime provisioning/health waiting.
- Reviewed agent-document generation and apply.
- Marketplace connection/install/grant binding without credential exposure.
- Human membership and approval role configuration.
- Disabled trigger registration.
- Operational thread creation and binding.
- Version publication, final preflight and atomic activation.
- Compensation/remediation.
- Build realtime state and UI.

### Important integration

The build must call existing agent, team, runtime, Marketplace and documentation services. It must not write their tables directly or duplicate their business rules.

## Workstream G — durable runtime engine

### Deliverables

- Run command service with start idempotency.
- Transactional transition/readiness engine.
- Outbox workers and fair scheduler.
- Node-run leases and attempt tracking.
- Agent, connector, human, rule, service and subworkflow executors.
- Parallel split/join tokens.
- Decision evaluator.
- Timer/event waits.
- Typed state service.
- Loop/global circuit breakers.
- Budgets and capacity.
- Retry/fallback/compensation/cancellation.
- Reconciler and invariant alarms.
- Safe version migration checkpoints.

### Legacy routing cutover

Refactor message routing so:

- `legacy_relay` alone can use the existing random baton/reply-limit logic;
- `ad_hoc` uses explicit mentions/user-selected participants without autonomous rebroadcast;
- `orchestrated` messages are classified/commanded through orchestration services;
- projections and agent completion messages never call random routing;
- orchestration readiness never depends on a chat message race.

The random baton code can be removed only after legacy migration and supported-client gates are complete.

## Workstream H — chat, diagram and client parity

### Web

Recommended implementation areas:

- `web/components/orchestration/planning/`
- `web/components/orchestration/proposal/`
- `web/components/orchestration/diagram/`
- `web/components/orchestration/build/`
- `web/components/orchestration/runs/`
- integrate creation into `web/components/clawchat-web-app.tsx`;
- integrate operational controls/projections into `web/components/threads/thread-detail-pane.tsx`;
- update `web/hooks/use-clawchat-realtime.ts`;
- extend `packages/web-sdk/src/index.ts`.

### macOS Swift

- shared planning session and Relay Console planner UI;
- proposal/requirements/app connection review;
- accessible graph and live run overlay;
- build progress/remediation;
- operational chat cards and controls;
- contract/realtime replay;
- no client-local source of truth.

### iOS

- full responsive interview and requirements editing;
- proposal review and approval;
- app-connection handoff;
- diagram with accessible list;
- build state;
- run/chat controls, approvals and interventions;
- event replay and honest unsupported-version state.

### Parity requirements

All supported clients can:

- resume planning;
- inspect requirements/proposal/validation/simulation;
- complete permitted connection actions;
- approve if authorised;
- observe build;
- view chat and live run;
- resolve approvals and permitted interventions;
- start a change request.

Advanced freeform graph editing may use a larger-screen layout, but mobile must provide complete semantic editing/list forms, not a read-only false parity claim.

## Workstream I — security, governance and operations

### Deliverables

- orchestration RBAC/capability checks and websocket isolation;
- prompt-injection test corpus;
- data-classification propagation and redaction;
- approval hash/expiry/separation-of-duty enforcement;
- application least-privilege grants;
- secret scanning for proposal, graph, event, logs and exports;
- audit export;
- workspace/definition/run budgets;
- metrics, dashboards and alerts;
- support inspection/reconcile/suspend/terminate commands;
- backup/restore and disaster-recovery exercise;
- retention/account-export/account-deletion integration;
- operational runbook.

## Dependency order

Engineering dependency is:

```text
Contracts + persistence
       ↓
Planning inventory + pattern catalog
       ↓
Compiler + validator + simulator
       ↓
Build saga
       ↓
Runtime engine + executors + reconciliation
       ↓
Chat/diagram projections and complete clients
       ↓
Security/operations verification and release acceptance
```

Some work runs concurrently, but no box above is optional for release.

## Required tests

### Unit

- graph parsing/compilation;
- expression sandbox;
- input/output mapping;
- readiness and every join policy;
- loop budgets and no-progress detector;
- retries/backoff;
- idempotency keys;
- permission intersection;
- validation diagnostics;
- projection idempotency;
- version diff and hash.

### Database/integration

- concurrent callbacks cannot transition twice;
- split/join duplicate tokens do not over-count;
- worker lease takeover after crash;
- outbox transaction atomicity;
- run start webhook duplication;
- published-version immutability;
- cross-workspace denial for every resource;
- build crash/resume/compensation;
- approval resolved concurrently;
- stale runtime attempt ignored;
- event replay and snapshot reconstruction.

### Runtime/connector

- OpenClaw and Hermes structured task envelopes;
- offline runtime and reassignment;
- invalid/partial agent output;
- agent tool call correlation;
- missing/expired credential and scope;
- rate limit and provider outage;
- external write timeout then reconciliation;
- duplicate delivery produces one provider effect;
- approval-required write cannot bypass approval;
- device-local authority reconnect.

### Security

- malicious form/email/document instructions cannot expand tools or graph;
- secret values never appear in prompt/log/event/chat/export;
- websocket room isolation;
- IDOR attempts on nested resources;
- planner cannot invoke mutation service;
- proposal approval invalid after any revision;
- build actor lacks application grant authority;
- forged runtime/connector callback;
- expression denial of network/filesystem/code execution.

### Client

- cross-device planning convergence and edit conflicts;
- reconnect with sequence gaps;
- chat and diagram show identical state;
- accessible graph/list parity;
- reduced motion, keyboard and screen-reader operation;
- honest waiting/offline/unavailable states;
- stale command rejection and refresh;
- legacy relay versus orchestrated controls.

### Resilience

Kill/restart each component at each critical boundary:

- before/after run transaction commit;
- before/after dispatch delivery;
- during connector write;
- during join arrival;
- during approval resolution;
- during build provisioning;
- during activation;
- during projection.

Verify no lost acknowledged state and no duplicated side effect.

### Performance/load

- 1,000 definitions in one workspace;
- 10,000 open/waiting runs;
- 100,000 node transitions/day equivalent;
- burst webhook starts with idempotent duplicates;
- high parallel fan-out/join;
- large planning sessions and diagrams;
- websocket reconnect storm;
- provider/runtimes throttled under backpressure.

## End-to-end acceptance scenario: plumbing bookings

The release candidate must demonstrate, on deployed Railway backend and supported clients:

1. A plumber creates an Operational Team Chat and describes the process without orchestration vocabulary.
2. Relay asks about missing address handling, source of pricing truth, approval threshold, no-slot behaviour and confirmation authority.
3. Relay identifies existing agents/apps and missing Jotform/Square/QuickBooks/Calendar/Twilio requirements.
4. The user connects missing apps through Marketplace and resumes the same plan.
5. Relay proposes parallel scheduling and estimating, an integrator, checker, bounded revision path, decision/approval and completion.
6. The diagram, roster, exact app operations, scopes, exception paths and limits are understandable.
7. Validation passes; simulation demonstrates happy, no-slot, rejected-margin, app-failure and approval-expiry paths without real external writes.
8. The authorised user approves an exact compiled hash.
9. Build provisions/reuses agents, verifies runtimes, applies reviewed docs, binds grants, creates the Team Chat/version and activates only after preflight.
10. Two humans on different devices observe consistent state.
11. A real test request starts scheduling and estimating concurrently.
12. Only eligible nodes execute. Agent completion does not prompt the entire team.
13. Join/integration waits correctly.
14. A high estimate requests the designated human approval.
15. Approved actions create exactly one set of external records/messages despite injected duplicate deliveries.
16. Chat remains concise; the diagram and detail view expose complete permitted evidence.
17. Completion validates that calendar, estimate and confirmation identifiers exist and agree.
18. A later process change produces a new diff/version; an existing run stays pinned to the old version.

## End-to-end acceptance scenario: existing harness reuse

The release candidate must demonstrate, on the deployed Railway backend and
supported clients:

1. An operator connects a test Hermes Agent or OpenClaw runtime that contains
   at least two working agents with known configuration.
2. Relay shows the verified runtime and complete authorised agent inventory.
3. The operator chooses one agent for **reuse unchanged** and rejects a
   proposed change to the second agent.
4. Relay builds a Team Chat and orchestration that uses the unchanged agent
   and one new Relay-proposed agent.
5. The approved build diff contains no harness-owned field change for the
   reused agent.
6. Both agents complete a test run, and Relay links each Relay agent to the
   correct harness identity and runtime binding.
7. Inventory comparison proves that Relay created no duplicate and changed no
   unapproved identity, instruction, skill, tool, memory, model or provider
   field.
8. Disconnect, failed-build compensation and reconnect leave both original
   harness agents working with their original configuration.

## Requirement traceability

Every `ORCH-FR-*` and `ORCH-NFR-*` identifier must have:

- owning backend/client components;
- contract and entity fields;
- API/realtime surface;
- unit/integration/E2E/security test IDs;
- deployed environment evidence;
- release acceptance result.

Create a machine-checkable traceability ledger during implementation. A requirement with no test/evidence remains incomplete.

## Release gates

### Product

- all functional requirements accepted;
- plumber scenario and at least two other business domains pass;
- existing Hermes Agent and OpenClaw reuse scenarios pass;
- non-technical usability study participants can create and explain a team;
- no UI calls an unstructured chat an orchestration.

### Architecture

- Railway is authoritative for all shared state;
- Postgres/outbox recovery demonstrated;
- RuntimeDispatch and Marketplace authorities reused;
- chat cannot accidentally retrigger orchestration;
- versioning and event reconstruction verified.

### Safety/security

- zero known critical/high findings;
- zero duplicate external side effects in fault-injection suite;
- secret and cross-workspace tests pass;
- loop/delegation/budget breakers structurally enforced;
- approval and least-privilege review signed off.

### Operations

- dashboards, alerts, support commands and runbook exercised;
- backup/restore rehearsal passes;
- migration rehearsal passes;
- rollback/suspension procedure tested;
- capacity test meets NFR targets.

### Clients

- web, macOS and iOS compatibility/parity tests pass;
- accessibility audit passes;
- supported old clients safely see legacy/unsupported states;
- reconnect/replay passes.

### Deployment

- backend is deployed to Railway from `backend/` with migrations successful;
- production API remains `/api/v1` rewritten to Railway;
- production websocket uses `NEXT_PUBLIC_RAILWAY_WS_BASE_URL`;
- production smoke test verifies planner, build, run, approval, connector, chat and graph;
- only then may the production feature flag be enabled.

## Definition of done

The feature is done when a real non-technical business user can describe a process, understand and approve Relay's proposal, connect what is missing, build the complete team, run recoverable application-backed work, observe it in chat and diagram, safely intervene, and later publish a governed change—without relying on random message routing or prompt-only termination.
