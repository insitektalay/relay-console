# Complete user experience

## Information architecture

An operational Team Chat has four coordinated surfaces:

1. **Plan** — the natural-language interview, requirements ledger and proposal.
2. **Chat** — human participation and concise execution updates.
3. **Diagram** — the designed graph or the live state of a selected run.
4. **Runs** — searchable instances, inputs, outputs, approvals, artifacts and audit history.

These are views of canonical backend resources. Closing a client or switching devices does not interrupt planning or execution.

## Creating a Team Chat

Selecting **New Team Chat** opens a choice:

- **Operational team** — builds a governed orchestration and is the default for agents doing company work.
- **Ad-hoc conversation** — an explicitly unstructured group conversation. It is labelled as conversational, has no reliability claims, and may retain current mention-based routing without automated baton passing.

Choosing Operational team creates a draft planning session and opens the Relay Console agent.

The first screen says, in ordinary language:

> Tell me how this work happens today. Start with what causes the work to begin, what you or your staff do, which applications you use, and what a successful result looks like. You do not need to describe agents or workflow patterns.

The user can type, dictate, paste a procedure, or attach redacted examples. Relay extracts an initial requirements summary while preserving the original source.

## The interview

### What Relay must learn

The planning session maintains a visible requirements ledger:

| Area | Example |
|---|---|
| Outcome | Customer has a confirmed, profitable plumbing appointment |
| Trigger | New Jotform enquiry or qualifying email |
| Inputs | Name, contact details, address, job type, urgency |
| Current work | Triage, travel calculation, scheduling, estimate, check, confirmation |
| Applications | Jotform, Gmail, Maps, Square Appointments, QuickBooks, Calendar, Twilio |
| Decisions | Emergency? Service area? Qualified worker? Margin acceptable? |
| Human authority | Owner approves estimates over £2,000 and refunds |
| Exceptions | Missing address, no slot, application outage, unsafe request |
| Completion | Appointment, estimate and confirmation agree and identifiers are saved |
| Service levels | Emergency requests acknowledged within five minutes |
| Data rules | Limit customer data to assigned agents; retain invoices per policy |

Each item has a status: confirmed, inferred, unanswered, conflicted or not applicable. Inferences are never silently treated as confirmed.

### Question behaviour

Relay asks the smallest useful group of questions, prioritised by how much the answers change the design. It should ask business questions, not orchestration jargon:

- "Can the booking be confirmed automatically, or must somebody approve it?"
- "What should happen if there is no suitable appointment?"
- "Which system is the final authority for price?"
- "Can an agent send a text immediately, or should it prepare one for review?"

It must not ask "Do you want a parallel fan-out with an all-of join?" It may later explain that this is the technical interpretation.

The user can answer one question, answer all, mark something unknown, delegate a question to another workspace member, or correct the extracted process. Relay can ask follow-ons when an answer creates a conflict.

### Multiple collaborators

The planning session can invite workspace members. Contributions are attributed. Conflicting answers are surfaced for resolution. Only users with publication authority can accept assumptions, approve application grants or build.

### Existing inventory

While interviewing, Relay shows:

- suitable existing agents and why they may fit;
- existing teams and whether this is an extension or a new team;
- runtime bindings and online/capacity status;
- installed Marketplace apps, connections, scopes and health;
- policies that will constrain the design;
- missing information it cannot infer.

Inventory facts come from backend services. The LLM may not invent an installed app, working runtime or authorised connection.

An experienced operator can start with **Use my existing agents**. Relay shows
the verified runtime identity and authorised agent inventory before the
operator selects agents. The inventory identifies the harness-owned fields
Relay can read and marks any field it cannot verify.

## Proposal experience

When requirements are complete enough, Relay says:

> I have enough information to propose a team. Nothing has been created or changed yet.

The proposal screen includes the following.

### Plain-language summary

It explains:

- how work begins;
- who or what handles each responsibility;
- what runs in parallel;
- where results are combined;
- which checks and approvals occur;
- what the team does when something goes wrong;
- exactly what "finished" means.

### Visual diagram

The default diagram is business-readable. Each card has:

- a short title such as "Prepare estimate";
- responsible role or application;
- a one-sentence purpose;
- required inputs and produced output;
- app icons;
- approval, retry or exception badges.

Connectors are labelled with business meaning ("qualified slot", "estimate", "revise") rather than generic arrows.

The view offers:

- **Simple:** responsibilities and main path;
- **Detailed:** node types, conditions, policies and data contracts;
- **Accessible list:** the complete graph in keyboard- and screen-reader-friendly order.

### Team roster

Every proposed role shows:

- existing agent to reuse, agent to modify, or agent to create;
- role in the process and distinction from the Team lead;
- harness/runtime and model selection;
- capabilities, instructions, skills and memory boundaries;
- applications and exact operations it may use;
- expected workload and concurrency;
- reason for the selection;
- fallback or reassignment policy.

The user can substitute an agent, change a name, move responsibility or require a human task. Changes trigger revalidation.

For each reused agent, the roster labels the proposal **reuse unchanged** or
**reuse with an approved change**. The latter opens a field-level diff for
identity, instructions, skills, tools, memory, model, provider settings and
other harness-owned configuration. Relay applies no harness change that the
diff omits. Disconnecting Relay leaves the original harness agent intact.

### Application plan

Applications are grouped into:

- ready with sufficient scope;
- connected but missing scope or unhealthy;
- available in Marketplace but not connected;
- unsupported operation requiring a supported alternative or a human step.

Each row states what Relay will do, whether it reads/drafts/writes/administers, which connection will be used, who may approve, and which nodes receive the grant.

Selecting **Connect** opens the Marketplace flow. The planning session remains intact. Returning rechecks the connection and updates the proposal.

### Decisions and safety

The user can inspect:

- auto-approved actions;
- actions requiring approval;
- blocked actions;
- thresholds and designated approvers;
- time, iteration, token/cost and external-action budgets;
- retry, fallback and compensation rules;
- sensitive-data boundaries.

### Assumptions and open issues

A proposal cannot be approved while it contains an unresolved blocking issue. Non-blocking assumptions require an explicit checkbox and are stored with the approved version.

## Validation and simulation

### Validation

The user selects **Validate**. Relay checks:

- graph structure, reachability and termination;
- data compatibility between connected nodes;
- valid decision branches and join semantics;
- available agents and runtime bindings;
- application tool existence, scope, policy and health;
- approval coverage;
- loop and budget bounds;
- identity and access constraints;
- side-effect idempotency and recovery policy;
- human role assignment;
- completion outputs.

Results link to the relevant graph element and provide a direct fix.

### Simulation

The user selects **Simulate** and chooses generated sample data or supplies a safe example. The simulator:

- evaluates routes and conditions;
- invokes agents in simulation context where useful;
- mocks external writes;
- permits supported read-only test calls;
- substitutes deterministic fixtures where a connector has no test mode;
- displays the predicted timeline, approvals, outputs, exceptions and cost bounds.

Simulation is clearly labelled and cannot be mistaken for a real booking, email, payment or record.

The user may explore alternative branches, such as no available plumber or estimate above the approval threshold.

## Final review and approval

The **Build review** is a complete diff:

- Team and Team Chat to create or change;
- agents to reuse, provision or update;
- generated agent files/instructions and their proposed diffs;
- Marketplace installations and per-agent grants;
- human membership and approval roles;
- orchestration definition and version;
- schedules/webhooks to register;
- expected side effects of build itself;
- rollback limitations.

The authorised user types or selects an explicit approval. Approval stores the exact proposal revision and compiled hash; changing the proposal invalidates approval.

## Build experience

The build screen shows a durable checklist:

- reserve names and identifiers;
- create/update Team;
- provision and verify agents;
- generate and apply approved agent documentation;
- assign agents and humans;
- bind existing Marketplace connections and grants;
- register triggers;
- create operational Team Chat;
- publish orchestration version;
- final end-to-end preflight;
- activate.

A step may be pending, running, waiting for user, complete, compensating, compensated or failed. The user can leave and return.

No partial build becomes active. If an external system makes complete rollback impossible, Relay preserves the resource, labels it unattached/inactive and gives a precise remediation choice.

## Working in the operational Team Chat

### Starting work

A manual request can be written naturally:

> Please handle this new booking.

Relay extracts or requests the declared start inputs, previews the run if required by policy, and creates a run. A message receives a run badge and links to the live diagram.

Triggers can also start runs without a new human message. The Team Chat then receives a concise start card.

### What appears in chat

Default chat presentation:

- request received;
- Manager assigned scheduling and estimate work;
- Scheduling completed, with selected slot;
- Estimate needs owner approval;
- approval result;
- Checker requested one revision, with reason;
- booking confirmed, with links to Calendar/QuickBooks/message artifacts.

It does not render every prompt, tool call or acknowledgment as top-level conversation.

Selecting a card opens:

- node inputs and outputs, with sensitive fields redacted as required;
- agent/application/human responsible;
- attempts and elapsed time;
- permitted operational messages;
- tool and approval records;
- resulting artifacts;
- causal links.

### User messages during a run

An ordinary comment is chat only. It does not wake every agent.

Explicit actions include:

- **Provide input** to a waiting node;
- **Correct data** and retry from an allowed checkpoint;
- **Pause run**;
- **Cancel run**;
- **Approve/reject**;
- **Reassign task**;
- **Ask Relay about this run**;
- **Request a process change**.

The composer indicates when the user is issuing a run command and previews its effect.

## Live diagram

The run diagram uses consistent states:

- muted: not reached;
- queued outline: ready;
- animated accent: running;
- amber: waiting or approval required;
- red: failed;
- purple: human intervention;
- green: complete;
- grey strike: skipped/cancelled.

The run path is highlighted. Parallel branches can be collapsed. The view can follow the active node or remain fixed. A timeline scrubber reconstructs prior state from ordered run events.

At any node the authorised user can inspect policy and use allowed controls. The diagram never provides a control the backend will reject.

## Completion

A run completes only when its completion node's contract passes. The final card shows:

- outcome and completion time;
- application record links or identifiers;
- approvals and exceptions;
- artifacts;
- cost/resource summary;
- any follow-up human task;
- definition version.

An LLM saying "done" is not sufficient.

## Changing a live process

Selecting **Improve this team** opens a new planning session seeded from the published version and recent authorised metrics. The user can describe the change naturally:

> We now take deposits for emergency bookings and use a different calendar for commercial customers.

Relay asks questions, proposes a graph/roster/application/policy diff, validates and simulates it, and requests publication approval.

New runs use the new version after activation. Existing runs stay on their starting version unless an authorised operator chooses a compiler-declared migration checkpoint. Rollback changes the version selected for new runs; history is retained.

Relay may proactively recommend a change, for example because a checker repeatedly rejects the same missing field. A recommendation is a draft planning session, never an automatic production mutation.

## Legacy Team Chats

Existing random-baton Team Chats remain readable and are labelled **Legacy relay routing**. They are not silently reinterpreted.

An **Upgrade to orchestration** action:

1. inventories the current roster, lead, application grants and selected historical messages;
2. asks the user to describe the actual intended outcome;
3. creates a proposal;
4. follows the same validation, simulation and approval process;
5. switches the thread to orchestration mode only after successful activation.

The existing pause/continue/reply-limit controls remain for legacy sessions. Operational threads replace them with run-aware controls and budgets.
