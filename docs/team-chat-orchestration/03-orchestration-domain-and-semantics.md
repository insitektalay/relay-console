# Orchestration domain and execution semantics

## Why a strict domain is required

An LLM can suggest sensible collaboration, but prose does not define reliable execution. "Ask Alice and Bob, compare their answers and continue if they agree" leaves unanswered:

- whether they run sequentially or concurrently;
- what each receives;
- what counts as finished;
- whether partial results are allowed;
- who resolves disagreement;
- how often a failed task retries;
- whether a repeated tool call may duplicate a side effect;
- what happens after restart;
- when the process stops.

Relay therefore compiles natural language and visual designs into a small graph language with deterministic state transitions. Agent intelligence lives inside bounded tasks; the engine owns routing, durability and termination.

## Core aggregates

### Orchestration definition

The durable identity of a process, such as "Plumbing booking". It belongs to a workspace and Team and can have many immutable versions.

### Orchestration version

A compiled graph, policy bundle, role/application bindings, input/output schema, assumptions and provenance. Published content cannot be edited.

### Orchestration run

One execution of one published version, with a trigger, inputs, state, budgets and terminal outcome.

### Node run

The execution record for a graph node, including attempts, inputs, outputs, executor, lease, error and timing.

### Run event

An append-only, monotonically sequenced record of a state transition or material observation. It powers audit, realtime projection and diagram replay.

### Planning proposal

A mutable design artifact. It is not executable until compiled, validated, approved, built and published.

## Canonical runtime node types

Visual roles and pattern-library labels map into these primitives.

| Node type | Meaning |
|---|---|
| `trigger` | Accepts and validates an external/manual/scheduled start event |
| `task` | Performs bounded work through an agent, application connector, human, rule or service executor |
| `decision` | Selects one or more outgoing routes from explicit predicates or a governed classifier |
| `parallel_split` | Makes a declared set of branches ready |
| `join` | Waits using `all`, `any`, `quorum`, `n_of_m` or custom validated aggregation policy |
| `wait` | Waits for time, event, webhook, human input or external status |
| `state` | Reads, writes or atomically compares durable scoped workflow state |
| `subworkflow` | Starts a pinned version of a reusable definition and awaits or detaches it according to policy |
| `completion` | Validates terminal outputs and marks the run complete |

`task.executorKind` is one of:

- `agent`;
- `connector`;
- `human`;
- `rule`;
- `platform_service`.

Manager, planner, worker, checker and integrator are semantic roles attached to agent task nodes. They are not separate scheduling primitives.

## Node contract

Every compiled node has:

- stable node key within the version;
- type and display metadata;
- typed input and output JSON Schemas;
- predecessor and successor edges;
- readiness and route policy;
- executor reference and capability grants where applicable;
- timeout, retry and backoff policy;
- idempotency strategy;
- approval policy;
- failure, fallback and compensation routes;
- resource budget;
- data classification and retention tags;
- chat projection policy;
- optional human intervention policy.

No published node may depend on an untyped free-text convention such as "tell the next agent when finished".

## Edge contract

An edge defines:

- source and target node keys;
- output-to-input mapping;
- optional predicate;
- priority;
- label visible to users;
- whether it is success, failure, timeout, rejection, compensation or cancellation flow.

Mappings are validated at publication. Runtime expression evaluation is sandboxed and has no network, filesystem or credential access.

## Readiness algorithm

Within a transaction, the engine:

1. locks the run and relevant node state;
2. appends the causal completion/failure event;
3. evaluates outgoing edges using persisted outputs;
4. updates join tokens and branch state;
5. identifies newly ready nodes;
6. reserves unique node runs and outbox commands;
7. commits state and events together;
8. asynchronously delivers commands to runtime, connector, approval or timer workers.

At-least-once command delivery is acceptable. Duplicate state transition and side-effect execution is not; unique keys and executor idempotency enforce this.

## Coordination patterns

The planner can compose the primitives into the following supported patterns.

### Central controller

A controller breaks an objective into bounded tasks, assigns them and integrates results. Dynamic child tasks are permitted only within a declared template, capability set, depth, count and budget. The controller cannot invent unrestricted tool authority.

Use for ambiguous work requiring judgement and coordination.

### Sequential pipeline

Each node's validated output becomes the next node's input. Failure and revision routes are explicit.

Use when later work genuinely depends on earlier work.

### Parallel workers with join

A split activates independent branches. A join waits for all, any, quorum or a declared subset, then maps available outputs.

Use for scheduling and estimating in parallel, multi-source research, or independent specialist work.

### Review and revise

A worker produces an artifact; a checker returns accepted or structured revision requirements. A bounded loop returns to the worker. Exhaustion routes to human review or failure.

Use for estimates, communications, compliance and quality assurance.

### Manager–worker hierarchy

A top controller delegates to subcontrollers or workers. Depth, child count, communication route and completion roll-up are explicit.

Use for larger processes, not as an invitation to spawn agents indefinitely.

### Blackboard

Workers read and add typed claims/artifacts to shared run state. A scheduler decides which eligible contribution occurs next; an evaluator determines sufficiency.

Use for open-ended synthesis where tasks emerge from shared evidence. The blackboard has contribution limits, conflict handling and a completion evaluator.

### Event-driven choreography

Nodes subscribe to declared business event types and emit typed events. The engine correlates events to a run and applies policy; agents do not listen to arbitrary chat traffic.

Use for asynchronous application workflows.

### Router and specialists

A decision/classifier selects one or more specialist branches. The classifier output is constrained to declared labels and may require confidence-based human fallback.

Use for triage and case routing.

### Debate, voting and consensus

Independent agents receive isolated inputs, produce votes or scored proposals, and an aggregation rule selects or escalates. Agents do not continuously reply to each other.

Use only when diversity improves the outcome. Participant count, rounds and tie handling are bounded.

### Contract-net or capability bidding

Eligible agents provide structured availability/cost/confidence bids. A deterministic selection policy awards the task.

Use for dynamic assignment where skills and capacity vary.

### Human-in-the-loop

A human task or approval node declares the required role, due time, escalation and permitted outcomes.

Use whenever business authority or unavailable automation requires a person.

### Saga with compensation

Forward steps have compensating actions where possible. Failure invokes compensation in reverse dependency order, while non-compensatable effects are surfaced.

Use for multi-application processes with material writes.

Patterns are templates, not mutually exclusive modes. One version can contain a router, parallel branches, a review loop and a final saga.

## Goals and completion

A version declares:

- goal statement;
- goal mode: `fixed` or `evolving_within_policy`;
- required terminal outputs;
- completion predicate;
- failure predicate;
- quality thresholds;
- allowed dynamic task templates;
- maximum elapsed time and resource budgets.

An evolving goal does not mean endless work. A controller may refine subtasks or intermediate criteria inside approved boundaries. Changing the business outcome, application authority, budget or completion contract requires a new proposal/version.

Only a `completion` node can mark a run successful, and only after schema and predicate validation. Agent prose is evidence, not the terminal state transition.

## Agent task semantics

An agent receives a task envelope containing:

- immutable run/version/node identifiers;
- role and bounded objective;
- declared inputs and referenced artifacts;
- expected output schema;
- available tools for this node only;
- time/action/token budget;
- approval rules;
- relevant, minimised context;
- allowed completion statuses.

The agent returns a structured result:

- `completed` with schema-valid output;
- `blocked` with reason and required input;
- `failed` with safe error classification;
- `needs_approval` with proposed action;
- `needs_revision` only where the graph permits it.

Friendly chat text may accompany the result but cannot replace it. Invalid output enters repair attempts, fallback or human intervention according to policy.

## Controller and dynamic delegation semantics

A controller may submit a structured child-task proposal:

- purpose;
- selected approved role/agent;
- inputs and expected output;
- parent dependency;
- allowed tool capability;
- budget and deadline.

The engine validates it against the published dynamic-task template. If accepted, it creates a recorded child node run. If outside policy, it blocks or requests approval. Controller-to-worker communication is therefore a task record and optional chat projection—not an unbounded message that wakes the channel.

## Application action semantics

A connector task binds:

- Marketplace app slug and tool name;
- opaque connection ID;
- input mapping;
- action classification (`read`, `draft`, `write`, `admin`);
- approval policy;
- stable idempotency key derived from run, node and logical operation;
- retryable and terminal error codes;
- optional compensation tool;
- redaction and audit policy.

The engine calls the existing connector executor. The LLM does not receive credentials and does not directly call provider APIs outside that authority.

An agent task may also call granted connector tools during its bounded dispatch. Those calls must include the run/node identity and are recorded as child action events under the node.

## State scopes

State is explicit and namespaced:

- run state: isolated to one execution;
- definition state: durable counters/configuration approved for a definition;
- team state: shared operational facts with access policy;
- workspace reference: existing canonical artifacts or records, linked rather than copied;
- agent memory: separate from orchestration truth and never the sole store of run state.

Concurrent writes use version checks or atomic operations. A chat transcript is not workflow memory.

## Failure and retry semantics

Errors are classified:

- transient provider/runtime/network;
- invalid input or output;
- missing credential/scope;
- policy or approval blocked;
- business exception;
- timeout/deadline;
- executor unavailable;
- non-retryable side-effect uncertainty;
- internal invariant violation.

Retry is node-specific. Before retrying an uncertain external write, the executor reconciles using the idempotency key or provider record. Blind repetition is prohibited.

Fallback may reassign an agent, select another connection, use a human step, route an exception branch or terminate. Each option must be in the published policy.

## Loop and circuit-breaker semantics

Every cycle in the graph must declare:

- purpose;
- loop-carried state;
- continuation predicate;
- maximum iterations;
- maximum elapsed time and budget;
- exit route;
- exhaustion route.

Runtime counters are authoritative. Prompt phrases such as "silence is usually correct" or "do not acknowledge" may improve agent behaviour but are not circuit breakers.

Global run breakers include:

- maximum node transitions;
- maximum dynamic child tasks and hierarchy depth;
- maximum external writes;
- token/cost ceiling;
- wall-clock deadline;
- repeated-identical-output detector;
- no-progress detector;
- operator pause/cancel.

## Cancellation and compensation

Cancellation stops new scheduling, requests cancellation of cancellable dispatches, and waits a bounded time for in-flight work. The version defines whether to preserve completed effects, compensate them, or ask a human. Cancellation is itself a durable state machine and cannot pretend an external effect was undone.

## Version migration

Runs are pinned to a version. The compiler may label safe checkpoints where:

- old and new state schemas are compatible or have a validated transform;
- no uncertain side effect is in flight;
- required agents/apps remain available;
- branch and join tokens can be mapped.

Migration is explicit, audited and reversible only if the declared transform supports it. Default behaviour is to finish the old run and use the new version for future runs.

