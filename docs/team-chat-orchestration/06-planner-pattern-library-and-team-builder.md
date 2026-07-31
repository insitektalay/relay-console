# Planner, pattern library and team builder

## Responsibility boundaries

The "Relay Console agent builds the team" is a user-facing description of several controlled services:

| Concern | Owner |
|---|---|
| Conversation and explanation | Relay Console planner agent |
| Requirement truth | Planning session service |
| Existing-resource facts | Inventory service |
| Candidate coordination design | Planner agent plus pattern retrieval |
| Executable graph | Deterministic compiler |
| Safety/capability correctness | Validators |
| Example behaviour | Simulator |
| User authority | Approval and resource-access services |
| Mutating teams/agents/apps | Idempotent build saga |
| Live execution | Orchestration engine |

The planner cannot call team creation, agent provisioning or permission mutation tools during the interview. It returns structured proposed changes.

## Planner workflow

### 1. Intake extraction

From the user's narrative and attachments, produce:

- business vocabulary;
- triggers, steps, decisions, people and systems;
- desired outcomes and evidence;
- stated constraints and exceptions;
- candidate application operations;
- citations to the source contribution;
- uncertainty/confidence per extracted claim.

The result must conform to `OrchestrationRequirementsDeltaV1`. Invalid output is repaired or rejected.

### 2. Authorised inventory

The backend constructs a minimised inventory:

- Teams and relevant descriptions;
- agents, roles, capabilities and availability;
- runtime type, binding and honest readiness/capacity;
- Marketplace app manifests and available tools;
- installed connections, health and granted scopes visible to the user;
- approval and workspace policies;
- supported trigger adapters;
- reusable published subworkflows.

It excludes credentials, unrelated workspace content and resources the user cannot inspect. Inventory has a timestamp and changes can invalidate a proposal.

### 3. Gap and conflict analysis

Deterministic checks and the planner identify:

- required completion facts not defined;
- ambiguous system of record;
- incompatible answers;
- missing exception route;
- missing human authority;
- unknown volume, latency or risk where it changes design;
- requested app operation absent from the Marketplace manifest;
- agent capability/runtime gap;
- privacy or retention conflict.

### 4. Question selection

The planner ranks questions by:

1. blocks correctness or safety;
2. changes permissions/side effects;
3. changes graph structure;
4. changes agent/app selection;
5. improves optimisation only.

It groups compatible questions and avoids asking what inventory already proves. The backend enforces a maximum planner turn budget and detects repeated questions. If uncertainty remains, the session shows it rather than continuing indefinitely.

### 5. Requirements confirmation

The user sees a plain-language process summary and edits/accepts it. Each release-blocking assumption must be confirmed, answered or explicitly rejected.

### 6. Pattern retrieval and composition

The planner searches the versioned pattern catalog using:

- industry/task labels;
- trigger and outcome shape;
- required coordination semantics;
- exception and approval needs;
- number/type of parallel responsibilities;
- long-running/event-driven characteristics.

Retrieved patterns are examples and constraints. The planner can compose them; it must not copy their presentation records into production.

### 7. Proposal generation

The planner returns `OrchestrationProposalDraftV1`:

- recommended pattern composition and reasons;
- logical graph;
- roles and agent fit decisions;
- application requirements;
- human authority;
- policies, budgets and exception routes;
- display explanation;
- unresolved issues.

### 8. Compilation and deterministic enrichment

The compiler:

- normalises node and edge keys;
- maps semantic roles to runtime primitives;
- generates/validates JSON Schemas;
- resolves declared role and application bindings to inventory identifiers;
- expands pattern shorthand into explicit split/join/loop/failure nodes;
- adds structural circuit breakers;
- derives idempotency scopes;
- separates display metadata from runtime semantics;
- calculates compiled hash;
- refuses constructs it cannot safely represent.

The compiler never invents a credential, connection, approver or agent ID.

## Pattern catalog

The separate orchestration diagram builder currently contains an audited corpus of 1,382 visual nodes arranged across 231 frames. That work should be used, but the count is not 1,382 executable workflow definitions. The records include managers, workers, stages, checkers, gates and result cards; visual records need semantic enrichment before planner use.

### Catalog package

Export a versioned, read-only package or generated artifact containing:

- catalog version and source provenance;
- pattern/frame ID, title, description and tags;
- suitable and unsuitable use cases;
- semantic roles;
- canonical topology template;
- required runtime primitives;
- required questions/parameters;
- join, failure and termination expectations;
- app/tool placeholders;
- example business narratives;
- known risks;
- visual layout template.

The export process validates that every topology compiles against the current canonical graph schema. Decorative diagram nodes without executable meaning remain examples only.

### Three separate layers

1. **Presentation:** positions, colours, avatars, frames, app icons and labels.
2. **Semantic design:** manager, worker, checker, gate, integrated result, business intent.
3. **Execution contract:** trigger, task, decision, split, join, wait, state, subworkflow and completion.

A visual "Manager/planner" card normally compiles to an agent task with a controller role. A "Gate" compiles to a decision or approval. An "Integrated result" may compile to a join plus integrator task. The mapping is explicit and testable.

### Retrieval quality

Keyword/metadata filtering is authoritative for compatibility. Embedding similarity may rank candidates but cannot override excluded capabilities or policies. Retrieval results and catalog version are stored with the proposal so its reasoning is reproducible.

## Agent selection and creation

### Fit analysis

For each role, the planner compares:

- capabilities and declared role;
- runtime/harness compatibility;
- model/tool requirements;
- application grants;
- data-access boundaries;
- availability and concurrency;
- current team assignments;
- cost/quality policy;
- memory/workspace isolation.

It recommends:

- **reuse unchanged**;
- **reuse with approved documentation/capability change**;
- **create**;
- **human role**;
- **unsupported/blocking**.

Names and personas are secondary to operational fit.

For an existing Hermes Agent or OpenClaw agent, **reuse unchanged** means Relay
adds only Relay-owned membership, orchestration, grant and presentation data.
The build does not rewrite harness-owned identity, instructions, skills,
tools, memory, model, provider settings or unrelated configuration. **Reuse
with approved documentation/capability change** requires a field-level diff
and applies only the accepted fields. A disconnect or compensation step leaves
the pre-existing harness agent intact.

### Agent specification

A proposed new agent includes:

- display name and role;
- bounded responsibility;
- runtime/harness and model;
- capability and tool grants;
- application assignments;
- output obligations;
- collaboration/handoff rules;
- escalation and stop conditions;
- workspace/document set;
- memory scope and retention;
- concurrency/budget policy;
- fallback.

The planner generates proposed identity, soul/instructions, workflow and memory-policy documents. These appear in the final diff. This reuses the repository's proposal-first documentation pattern: structured generation never writes files directly.

### Team lead versus controllers

The Team can retain one primary lead for ownership and display. Controller-role nodes are workflow responsibilities and can use the lead or other agents. The current client rule that equates "manager" role with a single selectable agent must not prevent legitimate nested or specialised controllers. The build proposal makes the distinction visible.

## Application planning

For every application dependency, the proposal records:

- app slug;
- required provider account purpose;
- tool name/operation;
- input/output schema;
- read/draft/write/admin classification;
- required scopes;
- existing eligible connection or missing connection;
- node and agent access;
- approval profile;
- system-of-record status;
- expected idempotency/reconciliation support;
- data classification.

If an app is unsupported, the planner may propose:

- a supported Marketplace connector;
- an existing MCP/OpenAPI-backed connector if its manifest and policy are registered;
- a human task;
- a blocked requirement.

It may not claim that arbitrary MCP availability makes a connector production-ready. The same Relay connector security, approval, credential and audit boundary applies regardless of whether the underlying adapter is native, MCP-backed, OpenAPI-generated or device-local.

## Validation framework

Validation produces stable error codes, severity, resource/node paths and fixes.

### Structural

- one or more valid triggers;
- all required nodes reachable;
- terminal routes end in completion/failure/cancellation;
- no orphan edges;
- every cycle bounded;
- split/join compatibility;
- valid subworkflow pinning and recursion depth.

### Data

- edge mappings satisfy target input schema;
- decisions reference available fields;
- completion output is constructible;
- state writes have declared schema and conflict policy;
- sensitive data does not enter unauthorised nodes.

### Execution

- resolved agent/runtime available or explicitly provisionable;
- supported node executor;
- timeouts/retries coherent;
- dynamic delegation constrained;
- budgets finite;
- human assignees/escalations resolvable.

### Applications

- tool exists in manifest;
- connection belongs to workspace and is healthy;
- scopes sufficient;
- installation/grant covers node/agent;
- approval covers action;
- idempotency/reconciliation acceptable;
- compensation honest.

### Governance

- proposer/approver separation where policy requires;
- publication authority;
- data retention and audit policy;
- external communication/payment thresholds;
- no secret material in compiled graph.

### UX completeness

- every node has human-readable purpose;
- decisions and exception routes labelled;
- final result understandable;
- accessible linear ordering exists;
- chat projection policy exists.

Warnings can require explicit acceptance. Errors block approval.

## Simulation

Simulation runs the compiled candidate in an isolated `simulation` mode with its own events and report.

### Side-effect policy

- connector `read` may execute only where explicitly supported and authorised for simulation;
- `draft` may create a local simulation artifact rather than a provider draft unless the user opts into a provider sandbox;
- `write` and `admin` are mocked by default;
- webhooks, emails, SMS, bookings, invoices, payments and deletes cannot escape the simulator;
- agent tool descriptors are replaced with simulation adapters;
- unsupported simulation becomes a reported limitation, not a real call.

### Coverage

The simulator explores:

- happy path;
- each decision branch where fixtures can be generated;
- missing/invalid input;
- worker/runtime unavailable;
- transient and terminal app failures;
- approval granted/rejected/expired;
- retry exhaustion;
- loop exhaustion;
- cancellation;
- compensation.

It reports unreachable or untested routes and compares estimated budgets with observed agent usage.

## Build saga

Building spans Postgres and external runtimes, so it is a saga rather than a single database transaction.

### Desired-state plan

The approved proposal compiles into immutable build steps with desired-state hashes. The build service, not the planner, executes:

1. revalidate approval hash and inventory freshness;
2. reserve logical identifiers;
3. create/update Team in inactive-build state;
4. provision missing agents through existing provisioning services;
5. wait for runtime bindings and health;
6. create reviewed agent-documentation proposals and apply approved content;
7. assign membership and role bindings;
8. bind Marketplace installations/connections and policy grants;
9. register trigger adapters in disabled state;
10. create/bind the operational Team Chat;
11. persist the immutable definition version;
12. perform cross-resource preflight;
13. atomically select/activate the version and enable triggers;
14. post the activation summary.

### Resume and compensation

Every step first observes actual state. If desired state already exists, it records success rather than recreating it.

Compensation examples:

- remove unactivated membership;
- revoke newly created grants;
- disable newly registered triggers;
- archive an unused agent created solely by the build, subject to user policy;
- leave a non-deletable external resource inactive and surface it.

The system never deletes an existing reused agent, connection or Team as compensation.

### Activation invariant

No trigger can start a real run until:

- version is published;
- all required bindings resolve;
- agents/runtimes pass health;
- connections/scopes pass health;
- approval policies resolve;
- final preflight hash matches approved build;
- operational thread and projections are ready.

## Continuous monitoring and recommended changes

The monitoring service computes evidence such as:

- repeated checker revisions;
- common missing input;
- bottleneck agent or approval;
- provider failure/rate limits;
- budget overruns;
- route frequency;
- human overrides;
- outcome quality.

The Relay Console agent can explain the evidence and open a prefilled change-planning session. It may suggest an additional validation node, changed parallelism or different assignment. It cannot publish the change or widen an application grant.
