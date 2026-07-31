# Applications, security, governance and operations

## Application execution boundary

Relay Console already connects agents to applications through Marketplace manifests, installations, connections and runtime tool descriptors. The orchestration feature must make those capabilities more explicit and governable; it must not replace them with a parallel ADK, MCP or direct-API credential system.

### Node-level least privilege

An orchestration version binds only the required application operations to the nodes/roles that need them. An estimating agent with `quickbooks.create_estimate_draft` does not automatically receive refund, delete or account-administration tools.

At execution, effective authority is the intersection of:

- workspace policy;
- user's/build approver's authority;
- application connection scopes;
- Marketplace installation and approval profile;
- published orchestration node grant;
- assigned agent grant;
- current approval;
- runtime execution authority.

Any missing layer denies the action.

### MCP, OpenAPI and native connectors

These describe adapter mechanisms, not different trust levels. All must expose a registered manifest, typed tools, action classification, credential handling, health, approval and audit behaviour.

An MCP server may make tools available to Relay. It does not by itself answer:

- which workspace owns the connection;
- which agent/node may invoke it;
- whether the operation writes data;
- whether approval is required;
- how credentials are protected;
- how retries avoid duplicate side effects;
- how execution is audited.

Relay's connector boundary supplies those answers.

## Credential rules

- OAuth tokens, API keys, PATs and secret material remain encrypted/server- or source-host-side.
- Planner inventories use connection IDs, labels, scopes and health only.
- Compiled graphs contain opaque connection references, never secrets.
- Agent prompts receive tool schemas and token-proxy descriptors, not credentials.
- Chat, graph, run events, errors, analytics and support exports redact secrets.
- Connection refresh/revocation is handled by Marketplace services.
- When a connection becomes unhealthy, dependent nodes wait/block according to policy; they do not request credentials in chat.

## Authentication and authorisation

### Workspace isolation

Every planning, build, definition, run, node, event and artifact lookup begins with a server-side workspace membership check. Nested IDs are verified to belong to the same workspace. Websocket subscriptions receive only authorised rooms.

### Proposed capabilities

- `orchestration.view`;
- `orchestration.design`;
- `orchestration.contribute`;
- `orchestration.validate`;
- `orchestration.simulate`;
- `orchestration.approve_build`;
- `orchestration.publish`;
- `orchestration.start`;
- `orchestration.intervene`;
- `orchestration.cancel`;
- `orchestration.audit`;
- `orchestration.view_sensitive`;
- `orchestration.manage_app_grants`.

Map these into existing owner/admin/member/viewer and policy systems. Sensitive capabilities can require explicit custom roles.

### Separation of duties

Workspace policy can require:

- designer and publisher to be different people;
- application-grant approval by an admin;
- financial actions by a designated approver;
- process changes by a Team owner;
- high-risk run interventions by two people.

The exact policy snapshot is pinned to publication/run actions for audit.

## Approval model

Approvals exist at distinct levels:

1. **Proposal/build approval** — authorises resource creation/configuration and publication.
2. **Application grant approval** — authorises a role/node to use operations and connection.
3. **Run action approval** — authorises a particular material action.
4. **Exception/intervention approval** — authorises skip, override, migration or risky repair.

One approval cannot be ambiguously reused for another level. It binds the intended resource/action hash, approver policy and expiry.

Risk categories include:

- read/internal analysis;
- external draft;
- external communication;
- business-record write;
- financial commitment;
- destructive/admin;
- sensitive-data disclosure.

The build review derives defaults from Marketplace action policy and workspace rules, but the server is authoritative.

## Prompt injection and untrusted content

Forms, email, documents, websites, connector output and other agent messages are untrusted data. They may contain text attempting to change instructions or invoke tools.

Controls:

- separate system/task instructions from external content;
- label source and data classification;
- minimise context;
- enforce tool grants outside the model;
- validate structured output;
- require approvals based on action, not model claims;
- prohibit data-sourced changes to graph, permissions or budget;
- scan unsafe attachment types and links;
- retain source provenance;
- use checker/rule nodes for high-risk extraction;
- never treat a statement inside customer content as human approval.

## Data governance

### Classification

Inputs, state fields, outputs and artifacts carry classification such as public, internal, confidential, customer personal data, financial or highly restricted. Nodes and agents declare allowable classifications.

### Minimisation

The compiler warns when a branch receives fields it does not need. Edge mappings should pass the minimum required subset or artifact reference.

### Retention

Definitions, approvals and audit events follow workspace/legal retention. Detailed runtime payloads can have shorter retention with immutable safe summaries. Deletion/export processes must account for:

- planning contributions;
- proposal revisions;
- run state/events;
- agent prompts/results where retained;
- connector audit records;
- artifacts;
- projections in Team Chat.

Deletion cannot falsify required financial/legal records; it records lawful policy and tombstones references.

### Model-provider boundary

The planner and agent task screen show which runtime/model provider receives which data class. A process requiring restricted data cannot be built on a runtime policy that disallows it.

## Safety invariants

The backend must enforce:

- no published graph without successful validation and authorised approval;
- no activation with unresolved required resource;
- no execution of a node absent from the pinned version or validated dynamic-task template;
- no unbounded cycle or delegation depth;
- no external write without idempotency/reconciliation declaration;
- no tool call outside effective grant;
- no completion without completion-contract validation;
- no edit of published version;
- no silent permission expansion;
- no chat projection routed as a fresh agent prompt;
- no duplicate event sequence or logical node activation;
- no run transition from stale attempt/callback;
- no client-only claim that a server command succeeded.

## Reliability and recovery

### Failure matrix

| Failure | Required behaviour |
|---|---|
| Backend deploy/restart | Resume from Postgres/outbox; reconcile leases |
| Redis unavailable | Persist commands/events; delay realtime/wake-up without data loss |
| Client disconnect | Run continues; client replays by sequence |
| Agent runtime offline | Wait/reassign/fallback/timeout per version |
| Agent output invalid | Bounded repair then fallback/human |
| Connector rate limit | Backoff within deadline and provider policy |
| Credential expired | Block dependent node; notify authorised connector manager |
| Approval expires | Take declared expiry route |
| External write times out | Reconcile by idempotency/provider lookup before retry |
| Build crashes | Resume desired-state step; do not activate partial build |
| Projection fails | Rebuild chat/diagram projection from run events |
| Definition suspended | Reject new runs; existing-run behaviour follows suspension policy |

### Backups and disaster recovery

Orchestration tables join the existing Railway/Postgres backup and restore contract. Recovery testing must verify:

- definition/version hash integrity;
- run/node/event ordering;
- outbox and lease reconciliation;
- no duplicate connector writes after restore;
- approval and application-grant correlation;
- clients can rebuild diagram/chat state.

## Observability

### Correlation

One trace can follow:

`planningSession -> proposalRevision -> build -> definition/version -> run -> nodeActivation/attempt -> runtimeDispatch/connectorAction/approval -> artifact/projection`.

Every log and metric uses safe opaque IDs. Customer input and secrets are not default log labels.

### Metrics

Platform:

- planning/validation/simulation/build latency and failure;
- scheduler lag and outbox depth;
- ready/queued/running/waiting nodes;
- lease expiry/reconciliation;
- websocket projection lag;
- active runs per workspace/definition;
- connector/runtime error classes;
- idempotency deduplications;
- budget/circuit-breaker stops;
- compensations and uncertain effects.

Product:

- completion and exception rate;
- human wait/approval time;
- retry/revision rate by node;
- branch distribution;
- outcome SLA;
- cost/tokens/external actions;
- process-change recommendation acceptance.

### Alerts

Alert on:

- sustained scheduler/outbox lag;
- abnormal lease expiry;
- duplicate-side-effect invariant breach;
- event sequence gap;
- build activation with failed dependency (critical invariant);
- elevated credential/provider failure;
- runs with no progress beyond policy;
- projection backlog;
- reconciliation unable to determine external write outcome.

## Operational tools

Authorised support tooling must provide:

- read-only definition/version/hash inspection;
- run state and event timeline;
- downstream dispatch/action/approval correlation;
- lease/outbox status;
- replay projection;
- reconcile node/action;
- safe retry where policy permits;
- suspend definition/trigger;
- terminate run;
- export redacted diagnostic bundle.

Support cannot edit rows manually as a normal repair method. Repairs are commands that append audit events.

## Cost and resource governance

Budgets exist at workspace, definition, run, node and dynamic-controller levels:

- model tokens/cost;
- elapsed time;
- node transitions;
- agent dispatches;
- connector reads/writes;
- dynamic tasks;
- concurrent tasks;
- artifact/storage volume.

The effective limit is the strictest applicable policy. Near-limit warnings appear in chat/run views. Exceeding a hard limit pauses/routes/fails as configured; it never silently raises the limit.

## Multi-human and multi-device collaboration

The Railway backend makes a Team Chat a shared company workspace:

- humans authenticate separately and see the same authorised thread/run;
- planning answers and diagram edits use optimistic concurrency;
- presence is informational, not authority;
- approvals record the real resolving user;
- simultaneous interventions are serialised and stale commands rejected;
- agents on different runtime hosts can collaborate because task and event state is shared through Railway, not because their computers directly share memory.

## Compliance-ready evidence

For any material outcome Relay can provide:

- approved definition/version and accepted assumptions;
- initiating trigger and inputs with policy redaction;
- route and decision history;
- agent/runtime/model and tool provenance;
- approvals and human interventions;
- external application operations and safe provider identifiers;
- retries, errors and compensation;
- final output and completion predicate result.

This is operational traceability. Hidden model chain-of-thought is neither required nor stored as the explanation.

