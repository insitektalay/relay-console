# System architecture and runtime

## Current implementation baseline

The implementation must begin from the code that exists, not a conceptual rewrite.

Current shared Team Chat routing is centred in `backend/src/modules/message/message.service.ts`:

- shared thread types include team, department, company meeting and agent-to-agent;
- an explicit eligible mention selects that agent;
- otherwise one eligible agent is selected with `Math.random()`;
- an agent reply excludes its sender and may route to another random agent;
- `ThreadSessionEntity` stores running/paused state, manual or reply-limit pause reason, reply limit and per-agent catch-up cursors;
- message controller endpoints expose state, pause, continue and reply-limit mutation.

Existing foundations that must be reused:

- `RuntimeDispatchEntity` and runtime dispatch coordinator for durable OpenClaw/Hermes/other harness execution;
- `AgentEntity`, runtime bindings, runtime hosts and provisioning jobs;
- Marketplace connector manifests, connections, installations, token proxy and connector executor;
- `ApprovalEntity` and server-authorised approval resolution;
- `TaskEntity`, artifacts, notifications and team operational data where their contracts fit;
- `EventsGateway` and clients' websocket infrastructure;
- Railway Postgres and server-side resource access;
- the Relay Console resident agent identity and team-building expertise.

The new engine is not implemented by adding more prompt wording inside `routeMessageToAgents`.

## Target component model

```text
Web / macOS / iOS
        |
        | HTTPS / WebSocket via /api/v1 and Railway websocket base
        v
Railway API and orchestration module
  ├── Planning session + proposal services
  ├── Pattern retrieval + structured planner dispatch
  ├── Compiler + validator + simulator
  ├── Team build saga
  ├── Definition/version service
  ├── Run command service
  ├── Durable engine + scheduler + reconciler
  ├── Chat/diagram projection service
  └── Audit/metrics service
        |
        ├── RuntimeDispatch ──> paired/managed OpenClaw and Hermes runtimes
        ├── Marketplace executor ──> external business applications
        ├── Approval service ──> authorised humans
        ├── Agent provisioning/document services
        └── Postgres + transactional outbox (Redis only for wake-up/presence)
```

All public API traffic remains on `/api/v1`, rewritten to Railway. Backend configuration continues to use `CLAWCHAT_RAILWAY_ORIGIN` and `NEXT_PUBLIC_RAILWAY_WS_BASE_URL`. There is no loopback fallback design.

## Framework decision: Relay-native engine, not Google ADK

Google ADK is useful reference material for agent nodes, tool invocation, sessions, events, evaluation and multi-agent composition. It is not the orchestration authority for this feature.

Relay already has product-specific systems that ADK would otherwise need to sit beside or wrap:

- OpenClaw and Hermes runtime bindings and dispatch;
- Railway-authoritative multi-user/team state;
- Marketplace connections, token proxy and application policies;
- Relay approvals, tasks, artifacts and notifications;
- web, macOS and iOS contracts;
- agent provisioning, documentation and workspace models.

Making ADK the engine would create two concepts of session, task, tool, event, state, retry and agent identity, then require translation and reconciliation between them. Instead, Relay should learn from its useful abstractions and implement the small execution kernel in [03-orchestration-domain-and-semantics.md](./03-orchestration-domain-and-semantics.md) directly around existing Relay authorities.

An ADK-based agent could later be supported as another bounded runtime executor, just as OpenClaw or Hermes is, but ADK must not own the canonical graph, business application credentials, approval state or run history.

## Backend module boundary

Create a dedicated `backend/src/modules/orchestration/` module. Recommended services:

| Service | Responsibility |
|---|---|
| `OrchestrationPlanningService` | Session lifecycle, requirement ledger, collaborator contributions |
| `OrchestrationPlannerService` | Structured LLM requests through Relay Console planner identity |
| `OrchestrationInventoryService` | Authorised snapshot of teams, agents, runtimes, apps and policies |
| `OrchestrationPatternService` | Versioned pattern-catalog retrieval and explanation |
| `OrchestrationCompilerService` | Proposal-to-canonical-graph compilation |
| `OrchestrationValidationService` | Structural, schema, capability, policy and resource validation |
| `OrchestrationSimulationService` | Side-effect-safe path simulation |
| `OrchestrationBuildService` | Idempotent build saga and compensation |
| `OrchestrationDefinitionService` | Definition/version publication, diff and rollback |
| `OrchestrationRunService` | Start, inspect and operator commands |
| `OrchestrationEngineService` | Transactional state transitions and node readiness |
| `OrchestrationSchedulerService` | Claims ready work and invokes node executors |
| `OrchestrationReconcilerService` | Repairs leases, missing callbacks and uncertain actions |
| `OrchestrationProjectionService` | Chat cards, graph snapshots and realtime events |
| `OrchestrationAuditService` | Ordered events, provenance, export and metrics |

Node executors implement a narrow interface:

```ts
interface OrchestrationNodeExecutor {
  kind: "agent" | "connector" | "human" | "rule" | "platform_service";
  prepare(nodeRunId: string): Promise<PreparedCommand>;
  dispatch(command: PreparedCommand): Promise<DispatchReceipt>;
  reconcile(nodeRunId: string): Promise<ReconciliationResult>;
  cancel(nodeRunId: string): Promise<CancellationResult>;
}
```

This is an implementation contract, not a mandate to expose generated code or arbitrary extensions.

## Command and event flow

### Start

1. A trigger adapter authenticates and normalises the event.
2. `OrchestrationRunService` verifies the published version, trigger policy, user/application authority and idempotency key.
3. In one transaction it creates the run, accepts validated input, appends initial events and places the trigger transition in the outbox.
4. A scheduler wake-up occurs after commit.

### Schedule

1. A worker claims an outbox command with `FOR UPDATE SKIP LOCKED` or equivalent lease semantics.
2. The engine transaction marks eligible node runs ready/queued once.
3. The correct executor creates a durable downstream dispatch, connector action, approval/human task or timer.
4. The outbox item records successful delivery; duplicate delivery resolves to the same downstream identifier.

### Complete

1. Runtime/connector/human callback is authenticated and correlated to the node run.
2. The engine rejects stale attempts or illegal transitions.
3. Output is schema-validated and persisted.
4. Completion event, route evaluation, join update, newly ready nodes and new outbox commands commit atomically.
5. Projection events are published after commit.

### Reconcile

The reconciler periodically finds:

- expired leases;
- queued nodes without downstream receipts;
- running nodes beyond timeout;
- callbacks received but not transitioned;
- uncertain connector writes;
- builds stuck in external provisioning;
- run projections behind event sequence.

It checks canonical downstream state before retrying. It never assumes "no callback" means "nothing happened".

## Agent execution through RuntimeDispatch

Agent tasks must use the existing canonical runtime dispatch path rather than creating a second harness protocol.

Required extension:

- add optional orchestration correlation to dispatches: `orchestrationRunId`, `orchestrationNodeRunId`, `orchestrationAttemptId`;
- construct an orchestration task message/envelope and persist it as the dispatch's causal message or introduce a compatible task-envelope relation;
- include structured output schema and task budgets in runtime payload metadata;
- accept structured completion callbacks while retaining a safe text fallback/parser for harnesses that cannot yet return native structured output;
- preserve assignment epoch, runtime thread session, timeout and reconciliation behaviour;
- make the dispatch key derive from node attempt identity.

A Team Chat message is posted as a projection after the task is assigned or completed. Posting that message must not call legacy random routing.

## Connector execution

Connector nodes and agent tool calls continue to use `MarketplaceConnectorExecutorRequest` and existing execution authority:

- Railway-authoritative connectors execute through the server-side token proxy;
- device-local source-host tools use the existing bridge authority;
- `secretMaterialSentToHermes` remains false;
- every request includes stable dispatch and orchestration correlation;
- connector errors map to orchestration error classes;
- approval-required actions cannot execute before a matching approval;
- action result, safe summary and audit metadata become node events/artifacts.

Add explicit executor support for idempotency/reconciliation metadata without exposing credentials. A connector that cannot safely retry a write must declare that and route uncertain outcomes to reconciliation/human review.

## Human tasks and approvals

Human work is not simulated by assigning a prompt to an agent.

- Human task nodes create an assignable task with permitted completion fields.
- Approval policies create or reuse an `ApprovalEntity` correlated to the node run.
- Resolving an approval calls an orchestration transition after the approval service's existing resource and approver checks.
- Rejection, expiry and delegation follow declared routes.
- A chat approval card and notification are projections; the approval row is authoritative.

## Chat projection architecture

`OrchestrationProjectionService` consumes committed run events and writes idempotent system/agent-style messages with metadata:

- `orchestrationRunId`;
- `orchestrationNodeRunId`;
- `runEventSequence`;
- `projectionKind`;
- concise display fields and artifact references.

Projection kinds include run started, assignment, progress, approval requested/resolved, blocked, retry, node completed, route selected, intervention and run completed/failed.

The message service must recognise orchestration projections and never send them through `routeMessageToAgents`.

Human messages in an operational thread are classified as:

- normal conversation;
- start request;
- input to a waiting node;
- operator command;
- process-change request.

The client requires explicit selection/confirmation for destructive commands. Backend DTOs, not an LLM alone, authorise and apply commands.

## Realtime and projections

Postgres stores state and ordered events. The websocket gateway broadcasts after commit to workspace/team/thread/run rooms.

Clients maintain:

- last event sequence per run;
- a backend-provided snapshot version;
- replay from a sequence after reconnect;
- fallback snapshot refresh if the replay window is unavailable.

Redis may be used for presence, queue wake-up and ephemeral fan-out, but loss of Redis cannot lose a run or approval. Realtime ordering is based on run event sequence, not arrival time.

## Visual graph architecture

The canvas renders the canonical graph plus versioned display metadata. Runtime overlays are a separate run snapshot keyed by stable node keys.

Do not execute React Flow nodes or records from the separate orchestration diagram builder directly. Instead:

1. define canonical graph contracts in `packages/contracts`;
2. map graph nodes to client visual models;
3. export reusable examples from the diagram builder into a versioned semantic pattern catalog;
4. keep positions, frames and decorative fields outside runtime semantics;
5. validate that every visible runtime node maps to a canonical node and vice versa.

The accessible list view is generated from the same graph and run overlay.

## Planner architecture

The existing Relay Console resident agent is the user-facing identity. Its current local/macOS helper cannot own the shared planning state.

The target design:

- backend creates the planning session and inventory snapshot;
- planner prompts are dispatched through an authorised available Relay Console planner runtime;
- structured planner results are validated and stored by Railway;
- multiple devices see the same session;
- loss of planner runtime produces an honest "planner unavailable" state without losing answers;
- direct writes from the planner are impossible;
- build authority is a separate backend command after approval.

This follows the existing agent-documentation proposal principle: generate a proposal first, review it, then apply separately.

## Queueing and concurrency

Use a database-backed outbox and leased worker claims. The engine needs:

- unique ready-node reservation per run/version/node/activation;
- configurable workspace and definition concurrency;
- per-agent/runtime capacity;
- per-connection provider rate limits;
- fair scheduling to prevent one workflow starving others;
- priority with ageing;
- cancellation-aware delivery;
- backpressure status visible to users.

The implementation may use existing queue infrastructure where it satisfies durable semantics. A memory-only queue is insufficient.

## Deployment and schema changes

All new API behaviour, entities, migrations, runtime payload fields and persisted fields consumed by clients are backend changes. When implementation occurs:

- migrations are additive and rehearsed against a production-like snapshot;
- backend deployments run from `backend/` so `backend/railway.json` applies and migrations run on startup;
- `/api/v1` and Railway websocket routing remain unchanged;
- client feature exposure waits for the deployed Railway schema/API and compatibility checks;
- partial internal work remains feature-flagged and cannot be called usable before deployment and acceptance.

This documentation change itself does not deploy or alter the backend.
