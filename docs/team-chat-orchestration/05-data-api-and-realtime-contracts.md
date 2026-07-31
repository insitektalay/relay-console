# Data, API and realtime contracts

## Contract conventions

- UUIDs are opaque and workspace-scoped.
- Published versions are immutable.
- Timestamps are UTC ISO-8601 externally and `timestamptz` internally.
- All mutating commands accept an idempotency key.
- Every response includes resource version/ETag or equivalent optimistic concurrency value where concurrent editing is possible.
- JSON Schema is the canonical data-shape format for node inputs and outputs.
- User-editable expressions use a restricted evaluator with versioned syntax.
- Shared TypeScript contracts belong in `packages/contracts`, not separately handwritten in web code.
- Swift models must decode unknown event/node enum values safely and show an unsupported-version state when semantics cannot be honoured.

## New persistence model

Names are proposed and may follow repository naming conventions, but the fields and invariants are normative.

### `orchestration_planning_sessions`

| Field | Notes |
|---|---|
| `id`, `workspaceId` | identity and tenancy |
| `createdByUserId` | session owner |
| `teamId`, `threadId`, `baseDefinitionId`, `baseVersionId` | nullable for new designs |
| `status` | `interviewing`, `requirements_ready`, `proposing`, `proposal_ready`, `waiting_requirements`, `approved`, `building`, `completed`, `abandoned`, `failed` |
| `requirements` | versioned structured ledger |
| `inventorySnapshot` | authorised identifiers/health facts and capture time, no secrets |
| `openQuestions`, `assumptions`, `conflicts` | structured arrays |
| `latestProposalRevisionId` | current proposal |
| `plannerAgentId`, `plannerRuntimeBindingId` | actual planner execution provenance |
| `lockVersion`, timestamps | optimistic concurrency |

Planning messages may use a dedicated thread linked here, or a planning-message table if product separation requires it. In either case, the requirements ledger—not transcript parsing—is canonical.

### `orchestration_proposal_revisions`

| Field | Notes |
|---|---|
| `id`, `planningSessionId`, `revision` | unique revision |
| `status` | `draft`, `validating`, `invalid`, `validated`, `simulating`, `simulated`, `superseded`, `approved` |
| `requirementsSnapshot` | exact inputs used |
| `proposedGraph` | editable proposal graph |
| `rosterPlan`, `applicationPlan`, `humanRolePlan` | resources and reasons |
| `policyBundle` | approvals, budgets, retries, data rules |
| `validationReport`, `simulationReport` | typed results |
| `patternCatalogVersion`, `patternReferences` | provenance |
| `compiledCandidate`, `compiledHash`, `compilerVersion` | exact approval target |
| `approvedByUserId`, `approvedAt` | nullable |
| `createdByDispatchId`, timestamps | planner provenance |

Any mutation creates a new revision and invalidates prior validation/simulation/approval.

### `orchestration_builds` and `orchestration_build_steps`

Build:

- planning session/proposal revision/workspace;
- idempotency key;
- status;
- requested/approved/started/completed actors and times;
- target team/thread/definition/version;
- failure and remediation summary.

Step:

- stable step key and ordered dependency;
- type, target reference and desired-state hash;
- status and attempt count;
- external job/request identifiers;
- result and safe error;
- compensation status/result;
- lease and timing.

A unique `(buildId, stepKey)` and desired-state checks make resume safe.

### `orchestration_definitions`

- `id`, `workspaceId`, `teamId`;
- name, description and business outcome;
- status: active, suspended, archived;
- `currentPublishedVersionId`;
- owner and publication policy;
- default operational thread;
- timestamps.

A Team can own multiple definitions. An operational Team Chat binds one primary definition. A definition may call approved reusable subworkflows.

### `orchestration_versions`

- identity, definition and monotonically increasing version number;
- status: draft candidate, published, retired;
- canonical graph JSON;
- input/output schemas;
- role, application and policy manifests;
- compiled hash and compiler/schema versions;
- pattern provenance and accepted assumptions;
- source proposal revision;
- author, approver and timestamps.

Unique `(definitionId, versionNumber)`. Published rows cannot be updated by application code or database trigger except safe archival metadata.

### `orchestration_runs`

- identity, workspace/definition/version/team/thread;
- status: `created`, `running`, `paused`, `waiting`, `cancelling`, `compensating`, `completed`, `failed`, `cancelled`;
- trigger type, trigger reference and start idempotency key;
- input/output and current durable state;
- budget limits and usage;
- pause/cancel/failure reason;
- event sequence counter and snapshot version;
- parent run/node for subworkflows;
- actor and timestamps.

Unique start idempotency scope prevents duplicated webhook/form runs.

### `orchestration_node_runs`

- run, stable node key, activation number and attempt;
- status: `pending`, `ready`, `queued`, `running`, `waiting`, `approval_required`, `blocked`, `retry_scheduled`, `completed`, `failed`, `skipped`, `cancelled`, `compensating`, `compensated`;
- executor kind and resolved executor IDs;
- input/output and validation status;
- runtime dispatch, connector action, task, approval or timer references;
- idempotency key;
- lease owner/expiry;
- retry time, timeout and timestamps;
- error class/code/safe message;
- parent controller node and dynamic task metadata.

Unique `(runId, nodeKey, activationNumber, attempt)`. A separate logical activation identity groups retries.

### `orchestration_join_tokens`

Tracks branch arrival and status per run/join/activation. Unique branch tokens prevent duplicate callback counts.

### `orchestration_run_events`

- `runId`;
- monotonic `sequence`;
- event type and schema version;
- actor type/ID;
- causal event, command, node run, dispatch and correlation IDs;
- safe summary and structured payload;
- data-classification/redaction metadata;
- created time.

Unique `(runId, sequence)`. Append-only. The existing generic `RunEventEntity` may be evolved if it can satisfy workspace access, strict ordering, provenance and schema requirements; otherwise orchestration requires its own entity rather than overloading a weak string/content record.

### `orchestration_outbox`

Transactional commands and projection notifications:

- aggregate/run/build identity;
- command type and versioned payload;
- idempotency key;
- available time, attempts, lease, status;
- delivery result/error.

### `orchestration_state_entries`

Typed, scoped state with key, schema, value, version, classification and expiry. Unique per scope/key. Large data is stored as an artifact reference.

### Existing entity extensions

- `ThreadEntity`: routing mode (`legacy_relay`, `ad_hoc`, `orchestrated`), primary definition ID.
- `MessageEntity`: optional orchestration run/node/event sequence and projection kind.
- `RuntimeDispatchEntity`: optional run/node/attempt correlation.
- `ApprovalEntity`: optional run/node/action correlation and expected proposal/policy hash.
- `TaskEntity`: optional run/node correlation for human or operational task projection.
- Marketplace execution audit records: run/node/action/idempotency correlation.

Do not repurpose `ThreadSessionEntity.relayReplyLimit` as an orchestration budget. Legacy fields retain legacy meaning.

## Canonical graph contract

`OrchestrationGraphV1` contains:

```ts
type OrchestrationGraphV1 = {
  schemaVersion: "1";
  key: string;
  name: string;
  goal: GoalContract;
  inputSchema: JsonSchema;
  outputSchema: JsonSchema;
  nodes: OrchestrationNodeV1[];
  edges: OrchestrationEdgeV1[];
  roles: RoleBindingV1[];
  applications: ApplicationBindingV1[];
  policies: OrchestrationPolicyBundleV1;
  display: GraphDisplayMetadataV1;
};
```

Contracts must use discriminated unions by node/executor type. Unknown node types cannot be treated as generic agent tasks.

The display section contains positions, frames, colours and collapsed groups. It cannot change execution.

## Requirements and proposal contracts

`OrchestrationRequirementsV1` covers:

- business goal and completion evidence;
- triggers and input sources;
- process steps and dependencies;
- decisions and business rules;
- exceptions;
- applications and systems of record;
- human roles/authority;
- service levels and budgets;
- security, privacy and retention;
- expected volume/concurrency;
- confirmed facts, assumptions, conflicts and source references.

`OrchestrationProposalV1` contains graph, roster, applications, build plan, explanations and reports. It references inventory resources by opaque IDs and carries status for each dependency.

## REST API

Routes below are under `/api/v1`.

### Planning

- `POST /workspaces/:workspaceId/orchestration-planning-sessions`
- `GET /orchestration-planning-sessions/:id`
- `POST /orchestration-planning-sessions/:id/contributions`
- `PATCH /orchestration-planning-sessions/:id/requirements`
- `POST /orchestration-planning-sessions/:id/refresh-inventory`
- `POST /orchestration-planning-sessions/:id/generate-proposal`
- `GET /orchestration-planning-sessions/:id/proposals`
- `GET /orchestration-proposals/:id`
- `POST /orchestration-proposals/:id/revise`
- `POST /orchestration-proposals/:id/validate`
- `POST /orchestration-proposals/:id/simulate`
- `POST /orchestration-proposals/:id/approve`
- `POST /orchestration-proposals/:id/builds`

Contribution types include user message, structured answer, attachment reference, delegated answer and conflict resolution. The backend returns updated questions/requirements; planner work can be asynchronous.

### Builds

- `GET /orchestration-builds/:id`
- `GET /orchestration-builds/:id/steps`
- `POST /orchestration-builds/:id/retry`
- `POST /orchestration-builds/:id/rollback`
- `POST /orchestration-builds/:id/resolve-step`

### Definitions and versions

- `GET /teams/:teamId/orchestration-definitions`
- `GET /orchestration-definitions/:id`
- `GET /orchestration-definitions/:id/versions`
- `GET /orchestration-versions/:id`
- `GET /orchestration-versions/:id/export`
- `POST /orchestration-definitions/:id/change-planning-session`
- `POST /orchestration-definitions/:id/select-version`
- `POST /orchestration-definitions/:id/suspend`
- `POST /orchestration-definitions/:id/resume`

Publication normally occurs through an approved build. Direct version selection/rollback requires authority and preflight.

### Runs

- `POST /orchestration-definitions/:id/runs`
- `GET /orchestration-runs` with workspace/team/definition/status/time filters
- `GET /orchestration-runs/:id`
- `GET /orchestration-runs/:id/graph`
- `GET /orchestration-runs/:id/events?afterSequence=`
- `GET /orchestration-runs/:id/node-runs`
- `POST /orchestration-runs/:id/pause`
- `POST /orchestration-runs/:id/resume`
- `POST /orchestration-runs/:id/cancel`
- `POST /orchestration-runs/:id/interventions`
- `POST /orchestration-node-runs/:id/retry`
- `POST /orchestration-node-runs/:id/reassign`
- `POST /orchestration-node-runs/:id/provide-input`
- `POST /orchestration-node-runs/:id/skip`

Each action is capability- and state-checked. `skip` is available only when the compiled node policy and downstream schema permit it.

### Operational threads

- `GET /threads/:threadId/orchestration`
- `POST /threads/:threadId/orchestration/start`
- `POST /threads/:threadId/orchestration/classify-message` only if an explicit preview flow is needed
- existing legacy `/team-relay` endpoints remain limited to `legacy_relay`.

## Asynchronous job responses

Planner, validation, simulation, provisioning and build commands can exceed request time. Mutation responses return the durable resource/job with status, not an untracked background promise. Polling and realtime updates use the same identifiers.

## Realtime event catalog

Events are versioned and scoped:

### Planning

- `orchestration.planning.updated`
- `orchestration.question.created`
- `orchestration.inventory.updated`
- `orchestration.proposal.created`
- `orchestration.proposal.validation_updated`
- `orchestration.proposal.simulation_updated`
- `orchestration.proposal.approved`

### Build

- `orchestration.build.updated`
- `orchestration.build_step.updated`
- `orchestration.build.waiting_for_user`
- `orchestration.build.completed`

### Definition

- `orchestration.definition.updated`
- `orchestration.version.published`
- `orchestration.version.selected`

### Runtime

- `orchestration.run.created`
- `orchestration.run.updated`
- `orchestration.node.updated`
- `orchestration.route.selected`
- `orchestration.approval.updated`
- `orchestration.artifact.created`
- `orchestration.intervention.required`
- `orchestration.run.terminal`

Each runtime event carries `runId`, `sequence`, `snapshotVersion`, relevant node ID/key and safe display summary. Clients discard duplicates and request replay on a gap.

## Authorization

Every endpoint resolves the resource and then verifies membership and capability. Required capabilities include:

- view planning;
- contribute requirements;
- view sensitive run data;
- edit proposal;
- manage application grants;
- approve proposal/build;
- publish/select version;
- start run;
- intervene/cancel;
- resolve approval;
- audit/export.

Team membership alone does not imply application-administration or publication authority.

## Idempotency scopes

Required unique logical operations:

- planning contribution client ID;
- generate-proposal request on a requirements hash;
- validate/simulate on compiled hash and fixture hash;
- proposal approval on compiled hash;
- build on proposal revision;
- build step desired-state hash;
- run start on trigger source/event;
- node activation and attempt;
- runtime dispatch on node attempt;
- connector side effect on logical action;
- chat projection on run event sequence;
- operator command client ID.

Idempotency results are retained long enough to cover provider retry windows and audit requirements.

## Compatibility and schema evolution

- Graph, event, planner result and runtime envelope schemas carry explicit versions.
- Compiler upgrades create new candidates; they do not rewrite published versions.
- Readers support current and explicitly listed prior versions.
- Unsupported versions are blocked with a useful state, never guessed.
- API removals require client telemetry confirming no supported client uses them.
- Legacy relay sessions and endpoints remain until upgraded threads and supported clients no longer require them.

