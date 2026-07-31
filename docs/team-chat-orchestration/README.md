# Relay Console Team Chat Orchestration

Status: product and implementation specification  
Scope: complete end-state release contract, not an MVP  
Last updated: 2026-07-25

## Purpose

This documentation set defines the complete replacement for Relay Console's current random pass-the-baton Team Chat behaviour.

Today, an unmentioned user message in a shared agent thread is sent to one randomly selected eligible agent. An agent reply can then be sent to another randomly selected agent. A per-session reply limit is the principal circuit breaker. That is useful as a conversational experiment, but it is not a business-process orchestration engine: there is no explicit goal, task graph, routing policy, join, decision gate, durable workflow state, version, task-level retry, application-action contract, or deterministic completion condition.

The target product lets a non-technical business owner describe how work gets done in natural language. The Relay Console agent interviews them, discovers requirements, proposes a visual orchestration, identifies existing and missing agents and application connections, validates and simulates the design, and—after explicit approval—builds an operational agent team. Work is then visible both as a Team Chat and as a live execution diagram.

## Release rule

The documents describe one complete feature. The implementation may be divided into engineering workstreams and merged behind an internal feature flag, but none of the workstreams constitutes a customer-ready reduced edition. The feature must not be represented as complete until the release acceptance contract in [08-implementation-and-acceptance.md](./08-implementation-and-acceptance.md) passes.

There is deliberately no "MVP now, orchestration later" product definition here.

## Document map

| Document | Purpose |
|---|---|
| [01-product-requirements.md](./01-product-requirements.md) | Product intent, users, requirements, scope, outcomes and success measures |
| [02-user-experience.md](./02-user-experience.md) | Complete creation, interview, proposal, connection, build, run and change experience |
| [03-orchestration-domain-and-semantics.md](./03-orchestration-domain-and-semantics.md) | Runtime primitives, patterns, graph rules, goals, state, handoffs and termination |
| [04-system-architecture-and-runtime.md](./04-system-architecture-and-runtime.md) | Railway-authoritative architecture, engine, dispatch, connector and chat projection design |
| [05-data-api-and-realtime-contracts.md](./05-data-api-and-realtime-contracts.md) | Persistence model, DTOs, API surface, events, idempotency and versioning |
| [06-planner-pattern-library-and-team-builder.md](./06-planner-pattern-library-and-team-builder.md) | Natural-language interview, pattern retrieval, compilation, validation, simulation and build saga |
| [07-apps-security-governance-and-operations.md](./07-apps-security-governance-and-operations.md) | Application actions, credentials, approvals, RBAC, safety, observability and recovery |
| [08-implementation-and-acceptance.md](./08-implementation-and-acceptance.md) | File-level implementation plan, dependency order, migration, tests and release gates |
| [09-requirement-traceability.md](./09-requirement-traceability.md) | Requirement-to-component, contract, test and release-evidence ledger |

## Locked architectural decisions

1. **Railway is authoritative.** Shared planning sessions, proposals, definitions, versions, runs, node state and audit events are persisted by the Railway backend. No client-local orchestration database is a source of truth.
2. **Chat is a view of execution, not the execution bus.** Agent messages must not automatically prompt every other agent. The orchestration engine decides exactly which node becomes ready.
3. **The Relay Console agent is the planner persona, not the database.** It conducts the interview and explains proposals. Structured state, validation and mutations belong to backend services.
4. **Planning never mutates the company.** The planner produces a reviewable proposal. Agent creation, team changes, application assignments and workflow publication occur only after explicit approval.
5. **Definitions are versioned and immutable once published.** Active runs remain pinned to their starting version. Changes create a new reviewable version.
6. **The pattern library informs planning; it is not executable data.** Visual examples must be compiled into a small, strict runtime graph language.
7. **Relay's existing runtime and application authorities are reused.** Agent tasks use canonical `RuntimeDispatch`; application actions use the Marketplace connector executor; human decisions use Approvals.
8. **Credentials never enter prompts.** Agents receive tool schemas and opaque connection references, never OAuth tokens, API keys or connector secrets.
9. **Side effects are idempotent and policy-controlled.** Retries may not duplicate invoices, emails, bookings, payments or other external writes.
10. **No silent self-modification.** The system may monitor and recommend an orchestration change, but an agent may not publish a changed graph, expand permissions or hire agents without authorised human approval.
11. **One primary team lead is not the same as one controller node.** A Team can retain a human-visible lead while an orchestration uses multiple controller, planner, checker or subworkflow roles.
12. **Operational Team Chats are structured.** New agent Team Chats pass through orchestration design. Informal multi-agent conversation remains a separate ad-hoc conversation mode and is never presented as reliable workflow execution.

## Current-to-target summary

| Concern | Current shared Team Chat | Target orchestration |
|---|---|---|
| Routing | Random eligible agent, or explicit mention | Graph readiness and explicit routing policy |
| Work unit | Chat message | Durable task/node run |
| Goal | Implied by prompt | Structured, testable goal and completion policy |
| Parallel work | Accidental message fan-out | Explicit split, concurrency policy and join |
| Agent response | May become another prompt | Completes/fails/blocks a named node |
| Stopping | Reply limit or manual pause | Completion conditions, budgets, loop limits, deadlines and circuit breakers |
| Applications | Tools available to an agent | Per-node tool grants, connection binding, approval and idempotency |
| Recovery | Continue latest pending message | Retry/reassign/resume/compensate from durable state |
| Change | Edit participants or prompts | Draft, diff, validate, simulate, approve and publish a new version |
| Visibility | Message stream | Team Chat plus live graph, state, approvals, artifacts and audit trail |

## Terminology

- **Planning session:** the interview and requirements workspace used to design or change an orchestration.
- **Proposal:** a mutable, reviewable design produced during planning.
- **Definition:** the identity of a business workflow across versions.
- **Version:** one immutable, compiled graph and its policies.
- **Run:** one execution of a published version.
- **Node run:** one execution attempt of a node inside a run.
- **Controller:** an agent role that plans, delegates or integrates work. It is still constrained by the graph and policy.
- **Application action:** a typed Marketplace connector operation, such as reading a form or drafting an invoice.
- **Team Chat projection:** human-readable messages generated from durable run events.
- **Operational thread:** a Team Chat bound to an orchestration definition.
- **Pattern:** a reusable coordination shape used by the planner, such as parallel workers followed by a checker.
