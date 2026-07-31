# Product requirements

## Product statement

Relay Console Team Chat Orchestration turns a business owner's natural-language description of work into a governed, visible and executable team of agents, humans and connected applications.

The product is intended for people who understand their business but do not understand workflow engines. A plumber should be able to explain:

> Enquiries arrive through Jotform and Gmail. I work out where the job is, find a qualified plumber and an available time, prepare an estimate, check the margin, put it in the calendar, send confirmation and keep QuickBooks up to date.

Relay Console must translate that explanation into:

- clarified requirements and explicit assumptions;
- a suitable orchestration pattern;
- named responsibilities and proposed agents;
- required application operations and connections;
- gates, approvals, exception paths and completion rules;
- a diagram the user can understand;
- a validated, simulated and reviewable build proposal;
- a functioning Team Chat backed by a durable execution engine.

The product also serves experienced Hermes Agent and OpenClaw operators. They
can connect an existing runtime, reuse its agents in a Relay team, and gain the
same orchestration and operating surfaces without rebuilding or surrendering
their harness configuration.

## Problem

The current Team Chat can make multiple agents appear to collaborate, but collaboration is produced by message routing rather than work orchestration. Randomly passing a reply to another agent has serious limitations:

- no agent owns a declared task unless a prompt happens to establish ownership;
- responses can trigger unnecessary responses or infinite conversations;
- adding agents increases ambiguous fan-out rather than useful parallelism;
- no engine knows when parallel work has all completed;
- no deterministic decision or quality gate exists;
- application actions are not tied to workflow nodes or outcomes;
- a reply limit stops activity without knowing whether the business objective is complete;
- a process cannot be safely resumed after a crash from a known node;
- there is no immutable definition explaining what process was executed;
- a business user cannot inspect or change the process as a process.

The product must replace accidental coordination with explicit coordination while retaining the approachable Team Chat interface.

## Primary users

### Business owner or operator

Describes work, answers questions, connects applications, approves the proposed team, watches outcomes and changes the process. This user may have no workflow or software terminology.

### Operational team member

Participates in the Team Chat, supplies information, handles assigned human steps, resolves approvals and intervenes when work is blocked.

### Workspace administrator

Controls application connections, permissions, runtime availability, budgets, audit access and publication rights.

### Existing harness operator

Connects a customer-operated Hermes Agent or OpenClaw runtime, verifies the
agent inventory, chooses which agents Relay may reuse, and reviews any proposed
change to harness-owned configuration.

### Agent/team designer

May edit the graph and advanced policies directly, but is not required for ordinary setup.

### Support or compliance operator

Investigates an execution, reconstructs decisions and application actions, and safely repairs or terminates stuck work.

## Jobs to be done

1. "Listen to how my company works and turn it into a sensible agent team."
2. "Ask me the questions I did not know I needed to answer."
3. "Show me what you intend to build before anything changes."
4. "Use the agents and application connections I already have where they fit,
   without overwriting the harness setup I trust."
5. "Tell me exactly what is missing and guide me to connect or authorise it."
6. "Let me see the team working without requiring me to read every internal exchange."
7. "Stop, ask for help or request approval when the process reaches a risky or uncertain point."
8. "Recover reliably when an agent, runtime, application or network connection fails."
9. "Explain why a particular route, decision or application action occurred."
10. "Adapt the process when my business changes, without silently changing live work."

## Product principles

### Natural language first, structured truth underneath

The user speaks about customers, jobs, invoices and staff. Relay translates these into structured requirements and an executable contract. The LLM may propose; deterministic services validate and execute.

### Diagram and chat are two views of one run

The chat and diagram must never disagree. Both are projections of the same backend run events and state.

### Human authority remains visible

The proposal shows what will be created, connected and permitted. Publishing, permission expansion and material side effects require the configured authority.

### Business outcomes, not agent chatter

The system optimises for a confirmed booking, reconciled account or resolved case—not for a long conversation between convincing personas.

### Honest states

Relay must distinguish proposed, waiting for connection, validating, simulated, ready, building, active, blocked, failed and complete. It must never imply that an unprovisioned agent or unconnected application is operational.

## Functional requirements

Identifiers below are normative and are referenced by the acceptance matrix.

### Creation and discovery

- **ORCH-FR-001:** Creating an operational agent Team Chat starts a planning session with the Relay Console agent.
- **ORCH-FR-002:** The user can describe a new process, paste existing procedures, attach examples and identify current applications in natural language.
- **ORCH-FR-003:** The planner inventories agents, teams, runtime bindings, connected Marketplace applications and the requesting user's authorisations.
- **ORCH-FR-004:** The planner asks targeted follow-up questions until every release-blocking requirement is answered or explicitly recorded as an accepted assumption.
- **ORCH-FR-005:** The planning session is resumable across clients and devices.
- **ORCH-FR-006:** Multiple authorised humans can contribute answers; every answer and requirement change records authorship.
- **ORCH-FR-007:** The user can edit the structured requirements summary directly without fighting the conversational agent.

### Proposal and review

- **ORCH-FR-010:** Relay produces a proposal containing goals, triggers, nodes, routes, agents, applications, policies, approvals, exceptions, outputs and completion conditions.
- **ORCH-FR-011:** The same proposal is shown as plain-language explanation, visual diagram and detailed configuration.
- **ORCH-FR-012:** Each proposed agent is marked reuse unchanged, reuse with an approved change, or create, with rationale, runtime, model, instructions, skills and application capabilities. Reuse unchanged preserves all harness-owned configuration.
- **ORCH-FR-013:** Each application requirement identifies operations, action level, scopes, connection status, assigned nodes and approval policy.
- **ORCH-FR-014:** Missing agents, runtimes, applications, scopes, permissions or human roles are shown as blocking requirements with direct remediation actions.
- **ORCH-FR-015:** The user can ask why a pattern, role, route, gate or tool was selected and receive an explanation grounded in the proposal.
- **ORCH-FR-016:** Expert users can edit the diagram and policies; edits round-trip through the same canonical graph contract.
- **ORCH-FR-017:** Relay validates and simulates the complete proposal before it can be approved.
- **ORCH-FR-018:** Simulation shows example paths, decisions, parallel joins, approvals, failures, projected side effects and estimated execution/cost bounds without committing external writes.
- **ORCH-FR-019:** The user sees a final build diff before approval: team/thread changes, agents, documents, application grants, policies and workflow version. For a reused agent, the diff names each harness-owned field Relay proposes to change and confirms which fields remain untouched.

### Connection and build

- **ORCH-FR-020:** The proposal can pause in "waiting for connections" while users complete Marketplace installation or OAuth.
- **ORCH-FR-021:** Returning from Marketplace resumes the same proposal and re-runs connection health and scope checks.
- **ORCH-FR-022:** Only an authorised user can approve and start the build.
- **ORCH-FR-023:** The build is a resumable, idempotent saga. Repeating the request cannot duplicate agents, teams, installs or definitions.
- **ORCH-FR-024:** Externally provisioned agents are not represented as ready until their runtime binding and health checks pass.
- **ORCH-FR-025:** The orchestration is not activated until every required build step and final preflight passes.
- **ORCH-FR-026:** A failed build exposes completed, compensated, pending and failed steps and provides safe retry or rollback. Rollback and disconnect do not delete, disable or rewrite an agent that existed in the harness before the build.
- **ORCH-FR-027:** The build produces a Team, an operational Team Chat, agent membership, agent instructions/skills, application assignments and the initial published orchestration version.

### Execution

- **ORCH-FR-030:** Runs may be started by manual request, channel command, schedule, webhook/application event, form submission or another approved orchestration.
- **ORCH-FR-031:** The engine schedules nodes only when their declared dependencies and conditions are satisfied.
- **ORCH-FR-032:** Parallel branches execute with declared concurrency and join semantics.
- **ORCH-FR-033:** A controller delegates through structured child tasks or graph routes, not unrestricted conversational rebroadcast.
- **ORCH-FR-034:** An agent output completes, fails or blocks its assigned node and does not automatically prompt all other team members.
- **ORCH-FR-035:** Application actions use the existing Marketplace connector execution authority and node-specific grants.
- **ORCH-FR-036:** Human tasks and approvals pause only the dependent path and resume from durable state after resolution.
- **ORCH-FR-037:** Decisions record evaluated inputs, selected route and policy or actor responsible.
- **ORCH-FR-038:** Every run enforces time, iteration, token/cost, action and concurrency budgets.
- **ORCH-FR-039:** Loops require an exit condition and maximum iteration count. Runtime enforcement is structural, not prompt-only.
- **ORCH-FR-040:** External write operations have stable idempotency keys and declared retry/compensation policies.
- **ORCH-FR-041:** An operator can pause, resume, cancel, retry, skip where permitted, reassign a human/agent task, or supply corrected input.
- **ORCH-FR-042:** Restarting any backend process or reconnecting a runtime cannot lose acknowledged state or double-run a completed side effect.
- **ORCH-FR-043:** A run remains pinned to the immutable orchestration version with which it started.

### Team Chat and diagram

- **ORCH-FR-050:** Team Chat shows human requests, assignments, concise status updates, approval requests, blockers and final outcomes.
- **ORCH-FR-051:** Verbose agent reasoning, tool traffic and intermediate artifacts are not dumped into the main channel. Permitted operational detail is available through expandable run/node activity.
- **ORCH-FR-052:** Every orchestration message links to its run and node; every visible graph node links to its relevant chat activity.
- **ORCH-FR-053:** The live diagram identifies waiting, ready, running, blocked, approval-required, failed, skipped and completed nodes.
- **ORCH-FR-054:** The diagram shows active agents, application actions, elapsed time, retries, artifacts and the path taken.
- **ORCH-FR-055:** Multiple humans on different devices see consistent chat, diagram and control state through the Railway backend.
- **ORCH-FR-056:** Users can choose concise, normal or detailed presentation without altering execution semantics or audit retention.
- **ORCH-FR-057:** Ad-hoc messages to the team do not mutate a run unless the user explicitly invokes a supported run command or intervention.

### Monitoring and evolution

- **ORCH-FR-060:** Relay monitors throughput, failures, retries, approvals, costs, human wait time, application errors and outcome quality.
- **ORCH-FR-061:** The Relay Console agent may recommend changes with evidence, but cannot apply them silently.
- **ORCH-FR-062:** Changing a process opens a planning session based on the current version and produces a visual and textual diff.
- **ORCH-FR-063:** A new version requires validation, simulation and authorised publication.
- **ORCH-FR-064:** Existing runs finish on their original version by default; an authorised operator may migrate only at a compiler-declared safe checkpoint.
- **ORCH-FR-065:** Versions can be rolled back for new runs without deleting historical definitions, runs or audit events.
- **ORCH-FR-066:** Users can export a human-readable process specification and a machine-readable definition.

## Non-functional requirements

- **ORCH-NFR-001 Availability:** Persisted run state survives Railway deployment, worker restart and client disconnection.
- **ORCH-NFR-002 Consistency:** Postgres is the source of truth. Redis or websocket events are wake-up and projection mechanisms, never sole state.
- **ORCH-NFR-003 Security:** Workspace, team, thread, definition, run, connection and approval access are server-authorised for every operation.
- **ORCH-NFR-004 Isolation:** No cross-workspace identifier may be resolved merely because it exists.
- **ORCH-NFR-005 Audit:** Every state transition and material side effect has an immutable actor, time, correlation and causation record.
- **ORCH-NFR-006 Privacy:** Secrets and raw credentials are never included in planner context, agent prompts, chat, diagrams or run exports.
- **ORCH-NFR-007 Accessibility:** Interview, proposal, graph status and controls meet WCAG 2.2 AA; a non-graph linear representation is complete.
- **ORCH-NFR-008 Performance:** A normal state transition is persisted and projected to connected clients within two seconds at p95, excluding external runtime/provider latency.
- **ORCH-NFR-009 Scale:** One workspace can operate at least 1,000 definitions, 10,000 open runs and 100,000 node transitions per day without changing the contract.
- **ORCH-NFR-010 Explainability:** A user can reconstruct which version, inputs, policies, agent, application connection and approval produced an output.
- **ORCH-NFR-011 Portability:** The graph contract is runtime-harness-neutral. OpenClaw, Hermes and future harnesses implement task execution; they do not define orchestration semantics.
- **ORCH-NFR-012 Compatibility:** Web, macOS and iOS consume the same shared contracts and show honest parity states.

## Success measures

Release telemetry must measure:

- percentage of planning sessions reaching an approved build;
- median questions and elapsed time to an approved proposal;
- percentage of proposed agents reused versus newly created;
- reused-agent configuration changes approved, rejected and applied, with a
  target of zero changes outside an approved diff;
- connection remediation completion rate;
- build success and rollback rates;
- run completion, blocked, cancelled and failed rates by definition version;
- median human interventions and approval wait time;
- duplicate external side effects, with a target of zero;
- runs stopped by budgets or loop circuit breakers;
- difference between simulated and actual path/cost;
- user-rated correctness of proposed process and completed outcome;
- time from business request to completed outcome.

Raw message count and agent-to-agent conversation length are not success measures.

## Scope boundaries

Included:

- structured orchestration of agents, humans, rules, services and Marketplace application actions;
- natural-language design and change interviews;
- reusable orchestration patterns;
- visual editing and live execution;
- durable, recoverable runs;
- governance, approval, audit and operational controls;
- multiple human collaborators and runtime-hosted agents.

Excluded:

- training or fine-tuning foundation models;
- allowing arbitrary generated code to execute outside existing governed runtime/connector boundaries;
- treating LLM hidden chain-of-thought as an auditable business record;
- importing the visual pattern library and executing its current UI records directly;
- silently converting every historical chat into a workflow;
- using a third-party orchestration framework as Relay's source of truth.
