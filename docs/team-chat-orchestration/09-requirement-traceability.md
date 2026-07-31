# Requirement traceability matrix

This matrix is the initial release ledger. Implementation must replace component-level test descriptions with exact test file/case identifiers and deployed evidence links. No row may remain without passing evidence at release.

## Functional requirements

| Requirements | Primary owner | Contract/data | Required evidence |
|---|---|---|---|
| ORCH-FR-001–002 | Planning API and creation UX | Planning session, contribution | New Operational Team Chat opens Relay interview; typed/dictated/pasted/attached intake E2E |
| ORCH-FR-003 | Inventory service | Inventory snapshot | Cross-workspace/access tests; agents/runtimes/apps/policies match canonical services |
| ORCH-FR-004 | Planner + requirement validator | Questions, assumptions, conflicts | Missing/ambiguous plumber facts produce targeted questions; no repeated-question loop |
| ORCH-FR-005–006 | Planning/realtime/clients | Session version, attributed contributions | Resume on second device; two humans contribute; stale edit conflict handled |
| ORCH-FR-007 | Requirements editor | Requirements schema | Direct structured edits persist and produce new proposal revision |
| ORCH-FR-010–011 | Planner/compiler/proposal UX | Proposal and graph | One proposal renders matching prose, graph and detailed configuration |
| ORCH-FR-012 | Agent-fit/team builder | Roster plan | Reuse unchanged/reuse with change/create decisions shown with rationale; unchanged-agent inventory comparison proves no harness-owned field changed |
| ORCH-FR-013–014 | Application planner | Application plan/dependencies | Exact tools/scopes/action/approval shown; missing resources block |
| ORCH-FR-015 | Grounded explanation | Proposal provenance | "Why" answers cite stored requirement/pattern/inventory facts; hallucination test |
| ORCH-FR-016 | Graph editor/compiler | Canonical graph/display metadata | Visual/detail edits round-trip without execution/display contamination |
| ORCH-FR-017 | Validator/simulator | Reports and compiled hash | Approval rejected until both pass on current revision |
| ORCH-FR-018 | Simulator | Simulation events/report | Branch/failure/cost coverage; zero real write/admin effects |
| ORCH-FR-019 | Build-review UX | Build desired-state plan | Exact team/agent/docs/apps/policy/version diff acceptance; reused-agent diff names changed and untouched harness fields |
| ORCH-FR-020–021 | Planning + Marketplace handoff | Dependency status/inventory refresh | OAuth/connect handoff returns to same proposal and clears only verified gap |
| ORCH-FR-022 | Access + approval | Approval hash/actor | Unauthorised build denied; changed proposal invalidates approval |
| ORCH-FR-023 | Build saga | Build/steps/idempotency | Duplicate build request and crash/restart create no duplicate resource |
| ORCH-FR-024–025 | Provisioning/preflight | Runtime health/build status | Offline/unbound agent never shown ready; triggers disabled until all green |
| ORCH-FR-026 | Build recovery UX | Step/compensation/remediation | Injected external failure exposes exact state, safe retry and rollback; disconnect and compensation preserve pre-existing harness agents |
| ORCH-FR-027 | Team builder | Team/thread/agent/grant/version refs | Final built resources match approved desired-state hash |
| ORCH-FR-030 | Trigger adapters | Trigger contract/start key | Manual, command, schedule, webhook/app and subworkflow starts |
| ORCH-FR-031 | Engine | Graph/node runs | Nodes schedule only after declared readiness under concurrency tests |
| ORCH-FR-032 | Split/join engine | Join tokens/policies | all/any/quorum/n-of-m, duplicate arrivals and failed branch tests |
| ORCH-FR-033–034 | Controller/agent executor | Child task/node result envelope | Delegation constrained; completion never rebroadcasts to team |
| ORCH-FR-035 | Connector executor integration | Connector correlation/grant | Existing Marketplace authority used; direct credential/provider bypass denied |
| ORCH-FR-036 | Human/approval/wait executor | Task/approval/timer refs | Pause/resume after device disconnect and expiry/rejection paths |
| ORCH-FR-037 | Decision engine | Decision event/evidence | Deterministic/classifier routes record inputs, confidence and selected edge |
| ORCH-FR-038–039 | Budget/loop engine | Policy/usage/loop state | Every limit trips structurally; cyclic graph without bound cannot publish |
| ORCH-FR-040 | Connector/idempotency | Logical action key | Fault-injected duplicate/timeout creates exactly one provider effect |
| ORCH-FR-041 | Run command service | Intervention command/event | State/capability matrix for pause/resume/cancel/retry/skip/reassign/input |
| ORCH-FR-042 | Engine/reconciler | Events/outbox/leases | Kill/restart matrix with no lost state or duplicate side effect |
| ORCH-FR-043 | Definition/run service | Immutable version FK/hash | Existing run unaffected by new publication/rollback |
| ORCH-FR-050–051 | Projection/chat UX | Projection metadata/detail policy | Concise channel plus expandable permitted details; no chain-of-thought claim |
| ORCH-FR-052 | Projection/graph UX | Run/node/event links | Bidirectional chat-card/node navigation |
| ORCH-FR-053–054 | Live diagram | Run snapshot/node overlay | Every state, agent/app/action/retry/artifact/path visible and accurate |
| ORCH-FR-055 | Backend/realtime/clients | Sequence/snapshot | Two humans/devices converge through disconnect/replay |
| ORCH-FR-056 | Presentation preferences | User preference | Concise/normal/detailed changes projection only, not runtime/audit |
| ORCH-FR-057 | Composer/command service | Message classification/command DTO | Plain comment produces no node transition; explicit intervention preview |
| ORCH-FR-060 | Metrics | Aggregates/telemetry | Known fixture produces correct throughput/error/cost/wait/quality metrics |
| ORCH-FR-061 | Recommendation planner | Evidence-linked draft | Recommendation cannot call publish/grant/build mutation |
| ORCH-FR-062–063 | Change planning/compiler | Base version/diff/new version | Natural-language change creates validated/simulated approvable diff |
| ORCH-FR-064 | Migration service | Safe checkpoint/transform | Default pinning and permitted/denied migration tests |
| ORCH-FR-065 | Version selection | Definition selected version | Rollback applies to new starts and retains complete history |
| ORCH-FR-066 | Export | Version/process export | Human and machine export reconstruct approved definition without secrets |

## Non-functional requirements

| Requirement | Verification |
|---|---|
| ORCH-NFR-001 | Railway/backend deploy and worker-kill recovery suite |
| ORCH-NFR-002 | Redis-loss test plus Postgres/outbox reconstruction |
| ORCH-NFR-003 | Endpoint, command and websocket capability matrix |
| ORCH-NFR-004 | Automated IDOR/cross-workspace suite for every new entity/reference |
| ORCH-NFR-005 | Event completeness invariant and material-side-effect audit comparison |
| ORCH-NFR-006 | Synthetic-secret canary across prompts, logs, events, chat, graph, analytics and exports |
| ORCH-NFR-007 | WCAG 2.2 AA automated/manual audit; graph/list semantic parity |
| ORCH-NFR-008 | p95 persisted-to-projected transition load measurement |
| ORCH-NFR-009 | 1,000-definition, 10,000-open-run and 100,000-transition/day load tests |
| ORCH-NFR-010 | Randomly sampled run reconstructed from version/input/event/action/approval evidence |
| ORCH-NFR-011 | Same canonical task graph executes agent nodes through OpenClaw and Hermes |
| ORCH-NFR-012 | Shared contract fixtures and parity tests across web, macOS and iOS |

## Cross-cutting release evidence

Each requirement row receives:

- implementation owner;
- pull request/commit;
- contract/entity/API references;
- test identifiers;
- Railway deployment identifier and migration result where applicable;
- supported client build identifiers;
- pass/fail and reviewer;
- date and evidence artifact.

The release checklist must fail closed if an identifier from `01-product-requirements.md` is absent from this ledger or lacks passing evidence.
