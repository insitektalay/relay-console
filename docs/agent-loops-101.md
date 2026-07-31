# Agent Loops 101: Building Continuous Agent Workflows With Hermes, Codex, and Notion

This document is a practical instruction manual for building a repo-local agent loop: a repeatable workflow where a human or coordinator starts with a list of work, turns that work into an approved queue, and an implementation agent repeatedly completes the next task, verifies it, records evidence, and continues.

The pattern described here works with:

- **Codex** as the implementation worker.
- **Hermes Agent / Hermes Desktop Agent** as the coordinator, reviewer, sync operator, and user-facing assistant.
- **Notion** as an optional planning dashboard/control plane.
- Plain Markdown files in a repository as the source of truth for the worker.

Notion is useful, but not required. The important part is that the worker agent gets a small, explicit, repo-local folder that tells it:

1. What work is approved.
2. Which item to do next.
3. How much autonomy it has.
4. What safety boundaries remain.
5. What evidence it must leave behind before moving on.

---

## 1. What Is an Agent Loop?

An **agent loop** is a controlled continuous workflow for AI agents.

Instead of giving an agent one large vague instruction like:

> Build everything needed for launch.

You create a durable loop folder that says:

> Here is the approved queue. Pick the first ready item. Do it. Verify it. Write evidence. Update state. Continue to the next ready item until the queue is empty or a serious blocker is reached.

The loop is not just the agent working repeatedly. The loop is the full operating system around the agent:

```text
Work list / roadmap / planning docs
  -> approved backlog
  -> agent reads repo-local loop instructions
  -> agent implements next item
  -> agent verifies work
  -> agent writes report and updates state
  -> coordinator/user reviews progress
  -> next item starts
```

A good loop prevents two common failures:

- **Wandering:** the agent invents work, chases side quests, or implements things that were never approved.
- **Amnesia:** each run forgets what happened before, what was checked, what failed, and what remains.

---

## 2. The Core Roles

### Human / Product Owner

The human decides goals, priorities, safety limits, and final acceptance.

Typical responsibilities:

- Define what needs to get done.
- Approve the backlog or categories of work.
- Decide which blockers require human input.
- Review final evidence and launch readiness.

### Hermes Agent / Hermes Desktop Agent

Hermes is best used as the **coordinator**.

Typical responsibilities:

- Read product docs, Notion pages, roadmaps, and previous reports.
- Convert high-level work into explicit backlog items.
- Create and maintain the `agent-loop/` folder.
- Sync evidence back into Notion or another user-facing dashboard.
- Review Codex reports and decide whether the loop can continue.
- Update rules when the user changes autonomy level.

Hermes can also run tasks directly, but in this pattern Hermes primarily manages the loop infrastructure and human-facing coordination.

### Codex

Codex is best used as the **implementation worker**.

Typical responsibilities:

- Read the repo-local loop files.
- Select the first approved item.
- Modify code/docs/tests/configuration as required.
- Run checks.
- Fix failures.
- Update loop evidence.
- Continue or stop according to the rules.

Codex should not have to read Notion directly. It should work from the repository's loop files so there is a single worker-facing source of truth.

### Notion, Linear, GitHub Projects, or Another Dashboard

A dashboard is optional. If used, it is the **planning/control plane**, not the worker's direct instruction source.

Typical responsibilities:

- Show the roadmap to humans.
- Display queue status.
- Store human-friendly descriptions and links.
- Receive imported evidence from reports.

The worker should still execute from repo-local Markdown.

---

## 3. Why Use a Repo-Local `agent-loop/` Folder?

Put loop state inside the repository because it is:

- **Close to the code:** the agent sees the exact instructions beside the code it edits.
- **Versionable:** changes to the loop can be reviewed in git.
- **Durable:** every run can leave files behind for future runs.
- **Tool-neutral:** Codex, Hermes, Claude Code, OpenClaw, humans, and CI can all read Markdown.
- **Explicit:** the approved backlog is separated from loose planning notes.

The repo-local folder becomes the contract between humans, Hermes, Codex, and any optional dashboard.

---

## 4. Recommended Folder Structure

Create this directory at the root of the project repository:

```text
agent-loop/
  README.md
  loop-rules.md
  codex-automation.md
  backlog.md
  state.md
  run-log.md
  blocked.md
  done.md
  decisions.md
  handoff.md
  sync-model.md
  reports/
    README.md
    0001-loop-setup.md
```

You can add more files later, but this is the minimum useful structure for a serious loop.

---

## 5. Create the Folder

From the repository root:

```bash
mkdir -p agent-loop/reports
```

Then create the files below.

---

## 6. File-by-File Manual

### 6.1 `agent-loop/README.md`

**Purpose:** The orientation page. Any human or agent should be able to open this first and understand what the loop is for.

It should contain:

- What this loop controls.
- Which project/repo it belongs to.
- Which files are important.
- The intended runner, usually Codex.
- The basic use flow.

Template:

```markdown
# Agent Loop

This directory is the shared coordination state for agent loop runs in this repository.
It is intentionally plain Markdown so humans and agents can read it before doing work.

## Purpose

- Keep agent runs focused on approved work.
- Preserve handoff context between humans, Hermes, Codex, and other agents.
- Record what changed, what was checked, and what remains uncertain.
- Prevent planning notes from becoming unapproved product work.

## Files

- `loop-rules.md` - operating rules for loop runs.
- `codex-automation.md` - Codex-specific startup and execution instructions.
- `backlog.md` - approved work queue.
- `state.md` - current shared state snapshot.
- `run-log.md` - chronological history.
- `blocked.md` - blocked items and why they are blocked.
- `done.md` - completed items.
- `decisions.md` - durable decisions.
- `handoff.md` - short next-operator handoff.
- `sync-model.md` - optional external dashboard/sync model.
- `reports/` - append-only run reports.

## How To Use

1. Read `state.md`, `loop-rules.md`, `codex-automation.md`, `backlog.md`, and the latest report.
2. Select the first `Agent Ready` item in `backlog.md`.
3. Complete and verify it.
4. Update `backlog.md`, `state.md`, `run-log.md`, and `done.md` or `blocked.md`.
5. Write a report in `reports/`.
6. Continue or stop according to `loop-rules.md`.
```

Why this file is needed:

- It makes the loop self-explanatory.
- It prevents future operators from guessing which file to read first.
- It gives other agents a stable starting point.

---

### 6.2 `agent-loop/loop-rules.md`

**Purpose:** The operating constitution for the loop.

This is where you define autonomy, order of execution, safety boundaries, allowed deployments, blocker policy, and reporting requirements.

It should contain:

- The loop mode: smoke test, one-item mode, or continuous mode.
- Which statuses are executable.
- How to select work.
- When to continue.
- When to stop.
- What checks are required.
- Safety limits.

Template:

```markdown
# Loop Rules

## Core Contract

- Use `backlog.md` as the execution queue, not as a brainstorming document.
- Only execute items marked `Agent Ready`.
- Select the first `Agent Ready` item in table order.
- Move it to `In Progress` while working.
- Complete it, verify it, update evidence, then continue to the next `Agent Ready` item.
- Stop only when no `Agent Ready` items remain or a serious blocker is reached.
- Do not create new product tasks unless a human or coordinator explicitly adds them.

## Status Values

- `Proposed` - candidate work, not approved for execution.
- `Agent Ready` - approved, scoped, and ready for the agent loop.
- `In Progress` - currently being handled by an agent.
- `Needs Review` - completed enough for review, or a review gate is genuinely needed.
- `Blocked` - cannot proceed without serious blocker resolution.
- `Done` - completed and verified for the requested scope.
- `Not For Now` - intentionally out of scope.
- `Needs Human Decision` - requires human decision before execution.

## Blocker Policy

Do not stop for ordinary implementation friction. Work through it by reading code,
running focused checks, fixing tests, installing safe local tools, and retrying.

Stop for human input only for:

- paid purchases or paid plan upgrades
- destructive deletion of production data/resources
- missing credentials or login that cannot be solved from the existing environment
- legal/privacy/product decisions not already made in docs
- serious data-loss/security risk

## Safety Boundaries

- Do not expose, print, commit, or log secrets.
- Do not weaken authentication, authorization, or data isolation to make tests pass.
- Do not perform external account actions unless explicitly approved.
- Do not deploy unless deployment is explicitly allowed for this loop.

## Documentation Discipline

- Reports are append-only run artifacts.
- `state.md` is the current summary, not a full history.
- `run-log.md` is the chronological history.
- `decisions.md` is for durable decisions only.
- `handoff.md` should stay short enough to read before a run.
```

Why this file is needed:

- It prevents the agent from negotiating rules every run.
- It encodes the user's autonomy preference.
- It creates a consistent definition of done, blocked, and safe.

---

### 6.3 `agent-loop/backlog.md`

**Purpose:** The approved execution queue.

This is the most important file for the worker. The backlog should contain only approved work, not every possible idea.

It should contain:

- A short description of the loop's current mode.
- Autonomy policy for this specific queue.
- Execution rules for the queue.
- A table of work items.

Recommended table columns:

```markdown
| ID | Status | Owner | Summary | Source | Notes |
| --- | --- | --- | --- | --- | --- |
```

Template:

```markdown
# Backlog

This file contains approved agent-loop work for this project.

## Autonomy Policy

- Codex is approved to implement code, docs, tests, migrations, and configuration required by `Agent Ready` items.
- Codex should work through ordinary blockers itself.
- Codex should stop only for the serious blocker categories in `loop-rules.md`.
- Codex must not leak, print, commit, or rotate secrets unless a task explicitly requires safe secret handling.

## Execution Rules For This Queue

- Execute items in table order by selecting the first `Agent Ready` item.
- After finishing and verifying an item, mark it `Done` if complete.
- Use `Needs Review` only when review is genuinely required before safe continuation.
- Update reports and state after each item or coherent batch.

## Approved Queue

| ID | Status | Owner | Summary | Source | Notes |
| --- | --- | --- | --- | --- | --- |
| LOOP-0001 | Agent Ready | Codex | Run a baseline repo health pass and capture current check status. | Human / launch plan | Run install if needed, build/typecheck/lint/test where available, fix trivial breakages, and report serious blockers only after attempting local fixes. |
| LOOP-0002 | Agent Ready | Codex | Implement the first scoped feature or infrastructure item. | Product roadmap section X | Add tests and update docs as needed. |

## Example Format Only - Not Approved Backlog

The examples below are placeholders. They are not approved tasks and must not be executed.

| ID | Status | Owner | Summary | Source | Notes |
| --- | --- | --- | --- | --- | --- |
| EXAMPLE-000 | Proposed | Human | Example task title. | Example source note. | Example only; do not execute. |
```

Why this file is needed:

- It separates approved execution from planning.
- It lets the agent choose the next item deterministically.
- It gives the coordinator a single place to control scope.

Backlog rules that matter:

- Use stable IDs like `LOOP-0001`, `LOOP-0002`, etc.
- Keep summaries action-oriented.
- Include the source of truth for each item.
- Put enough notes in each item that Codex can act without guessing.
- Do not let Codex add new items unless explicitly allowed.

---

### 6.4 `agent-loop/codex-automation.md`

**Purpose:** The copy-ready instruction file for Codex.

This file tells Codex exactly how to run the loop. The human should be able to start Codex with a short prompt like:

```markdown
Working directory:
/path/to/repo

Read `agent-loop/codex-automation.md` and follow it exactly.
```

The file should contain:

- Working directory.
- Required reading list.
- Execution flow.
- Blocker policy.
- Deployment policy, if deployment is allowed.
- Start prompt.

Template:

````markdown
# Codex Native Automation

This file describes how Codex should run this repository's agent loop.

## Conceptual Configuration

- Working directory: repository root.
- Start prompt: read this file and the repo-local loop files listed below.
- Mode: continuous implementation queue.
- Execute approved `Agent Ready` items in `agent-loop/backlog.md` in order.
- After completing and verifying one item, update evidence and continue.
- Stop only when no `Agent Ready` items remain or a serious blocker is reached.
- Keep secret handling safe: do not print, log, commit, or expose tokens.

## Required Reading At Start

Read:

- `agent-loop/README.md`
- `agent-loop/loop-rules.md`
- `agent-loop/state.md`
- `agent-loop/backlog.md`
- `agent-loop/blocked.md`
- `agent-loop/decisions.md`
- `agent-loop/done.md`
- `agent-loop/run-log.md`
- latest file in `agent-loop/reports/`
- any project roadmap or architecture docs referenced by the selected backlog item

## Continuous Loop Instructions

1. Select the first `Agent Ready` item in `agent-loop/backlog.md`.
2. If none exists, write a no-op/final report if useful, update `state.md`, and stop.
3. Mark the selected item `In Progress`.
4. Implement the item completely enough to satisfy its source docs and notes.
5. Run relevant checks. If checks fail, fix the cause and rerun.
6. If deployment is required and approved, deploy from the correct project directory and verify live behavior.
7. Mark the item `Done` when verified, or `Needs Review` only when review is genuinely required.
8. Update `backlog.md`, `state.md`, `run-log.md`, `done.md` or `blocked.md`, and write a report under `agent-loop/reports/`.
9. Continue to the next `Agent Ready` item.

## Codex Start Prompt

```markdown
Working directory:
/path/to/repo

Read `agent-loop/codex-automation.md` and follow it exactly.

Run the repository implementation loop in continuous mode: execute the first
`Agent Ready` item in `agent-loop/backlog.md`, verify it, update the loop evidence
files and report, then continue to the next `Agent Ready` item. Keep going until
no `Agent Ready` items remain or a serious blocker is reached.

Do not print, commit, or expose secrets.
```
````

Why this file is needed:

- It makes starting Codex simple and repeatable.
- It avoids long fragile prompts copied into every run.
- It gives Codex the same operating instructions every time.

---

### 6.5 `agent-loop/state.md`

**Purpose:** The current shared state snapshot.

This should be short and current. It is not the full history.

It should contain:

- Last updated date.
- Current loop status.
- Active item.
- Latest report.
- Next executable item.
- Key repo facts.
- Guardrails.
- Next recommended action.

Template:

```markdown
# State

Last updated: YYYY-MM-DD

## Current Loop State

- Status: continuous implementation mode enabled.
- Active item: none.
- Latest report: `reports/0001-loop-setup.md`.
- Completed items: none.
- Next executable `Agent Ready` item: `LOOP-0001`.

## Repo Facts

- Monorepo root: `/path/to/repo`.
- Web app package: `web/`.
- Backend package: `backend/`.
- Package manager: `pnpm` / `npm` / `yarn` / other.

## Guardrails

- Do not print or commit secrets.
- Preserve unrelated working tree changes.
- Follow `loop-rules.md` for blocker policy.

## Next Recommended Action

Run Codex from the repository root and tell it to read `agent-loop/codex-automation.md`.
```

Why this file is needed:

- It lets a new run orient quickly.
- It prevents every run from needing to reconstruct history.
- It gives Hermes and humans a concise status page.

---

### 6.6 `agent-loop/run-log.md`

**Purpose:** The chronological history.

This file records what happened over time at a high level.

Template:

```markdown
# Run Log

## YYYY-MM-DD - 0001 Loop Setup

- Created the initial `agent-loop/` directory.
- Recorded operating rules, backlog format, state, handoff, and report schema.
- Product implementation: none.
- Deployment: none.
- Secrets touched: none.

Next action: approve the first bounded item and mark it `Agent Ready`.

## YYYY-MM-DD - 0002 LOOP-0001 Baseline Health Pass

- Selected backlog item: `LOOP-0001`.
- Starting status: `Agent Ready`.
- Ending status: `Done`.
- Checks run: web build, backend tests, lint.
- Report: `reports/0002-loop-0001-baseline-health-pass.md`.

Next action: continue to `LOOP-0002`.
```

Why this file is needed:

- It gives a readable history without opening every report.
- It helps Hermes sync progress to Notion or another dashboard.
- It prevents repeated work.

---

### 6.7 `agent-loop/reports/README.md`

**Purpose:** Defines the report schema.

Template:

```markdown
# Reports

This folder contains one report per loop run or completed item.

Reports should be append-only. If a later run discovers that an earlier report was incomplete or wrong, write a new report and reference the older one.

Each report should include:

- Report ID/date
- Runner type: Codex, Hermes, human, CI, or other
- Selected backlog item ID
- Starting status
- Ending status
- Scope
- Files changed
- Implementation notes
- Commands run
- Checks run and exact results
- Checks skipped and why
- Evidence
- Remaining findings or known warnings
- Blockers
- Human decisions needed
- Deployment required? yes/no
- Secrets touched? must be no unless explicitly approved
- Browser/Playwright used? yes/no
- External account actions? yes/no
- Destructive actions? yes/no
- Next recommended action
```

Why this file is needed:

- It forces evidence instead of vague progress claims.
- It makes reports consistent across runs and agents.
- It gives Notion/Hermes something structured to import.

---

### 6.8 `agent-loop/reports/NNNN-short-name.md`

**Purpose:** Immutable evidence for one run, item, or coherent batch.

Template:

````markdown
# 0001 LOOP-0001 Baseline Health Pass

Date: YYYY-MM-DD
Runner: Codex native automation
Selected backlog item: `LOOP-0001`
Starting status: `Agent Ready`
Ending status: `Done`

## Summary

Short description of what was completed.

## Scope

The specific backlog item scope that was implemented or investigated.

## Files Changed

- `path/to/file.ts` - what changed
- `path/to/test.spec.ts` - test coverage added/updated

## Implementation Notes

- Important design choices, discoveries, or behavior changes.
- Mention if existing code already satisfied part of the requirement.

## Commands Run

```bash
pnpm install
pnpm test
pnpm build
```

## Checks And Results

- `pnpm test` - passed
- `pnpm build` - passed
- `git diff --check` - passed

## Checks Skipped

- None.

## Evidence

- Specific test names, output snippets, endpoint URLs, screenshots, or logs.

## Remaining Findings

- Known warnings, deferred deployment needs, snapshot drift, lint warnings, or
  other non-blocking findings that future runs should remember.

## Blockers

- None.

## Human Decisions Needed

- None.

## Safety

- Deployment required: no
- Secrets touched: no
- Browser/Playwright used: no
- External account actions: no
- Destructive actions: no

## Next Recommended Action

Continue to `LOOP-0002`.
````

Why reports are needed:

- They are the loop's audit trail.
- They let humans trust what happened.
- They let Hermes update Notion with evidence rather than assumptions.

---

### 6.9 `agent-loop/done.md`

**Purpose:** Completed item index.

Template:

```markdown
# Done

## LOOP-0001 - Baseline Health Pass

- Completed: YYYY-MM-DD
- Report: `reports/0002-loop-0001-baseline-health-pass.md`
- Summary: Baseline checks were run and failures were fixed or recorded.
- Verification: tests/build/lint passed or known findings documented.
```

Why this file is needed:

- It gives a quick list of completed work.
- It avoids scanning the whole backlog table.
- It helps a coordinator generate progress summaries.

---

### 6.10 `agent-loop/blocked.md`

**Purpose:** Serious blockers only.

Do not use this for ordinary failing tests or missing local packages if the agent can fix them. A blocked item should mean the loop truly cannot continue safely.

Template:

```markdown
# Blocked

## LOOP-0007 - Example Blocked Item

- Blocked since: YYYY-MM-DD
- Blocking category: missing credentials / paid purchase / destructive action / legal decision / serious security risk
- What was attempted:
  - Command or investigation 1
  - Command or investigation 2
- Why the agent cannot proceed:
  - Clear explanation
- Human decision or action needed:
  - Specific request
- Report: `reports/0007-example-blocker.md`
```

Why this file is needed:

- It keeps true blockers visible.
- It prevents the loop from silently stalling.
- It distinguishes serious blockers from normal engineering work.

---

### 6.11 `agent-loop/decisions.md`

**Purpose:** Durable decisions that future runs must know.

Examples:

- Deployment is approved for this loop.
- Browser tests are allowed only for final smoke testing.
- The backend source of truth is production/staging, not local loopback.
- Certain product features are intentionally out of scope.

Template:

```markdown
# Decisions

## YYYY-MM-DD - Deployment Approved For Release Items

Decision: Codex may deploy the backend when a backlog item requires live verification.

Reason: Several release-readiness items cannot be considered complete until deployed health or behavior is verified.

Applies to:

- `LOOP-0034`
- Any item whose notes explicitly require deployment

Limits:

- Do not print or commit secrets.
- Do not delete production data.
- Stop if credentials/login are unavailable.
```

Why this file is needed:

- It prevents the same decision from being re-litigated.
- It gives Codex a durable source for permissions and constraints.
- It keeps important decisions out of transient chat history.

---

### 6.12 `agent-loop/handoff.md`

**Purpose:** The fastest possible next-operator brief.

This file should stay short. If it becomes long, move detail into reports or state.

Template:

```markdown
# Handoff

Last updated: YYYY-MM-DD

Read first:

- `agent-loop/codex-automation.md`
- `agent-loop/loop-rules.md`
- `agent-loop/state.md`
- `agent-loop/backlog.md`
- latest report in `agent-loop/reports/`

Current queue:

- `LOOP-0001` is done.
- `LOOP-0002` is active or next.

Next operator action:

Continue with the first `Agent Ready` item in `backlog.md`.

Important constraints:

- Do not print or commit secrets.
- Preserve unrelated user changes.
- Stop only for serious blockers listed in `loop-rules.md`.
```

Why this file is needed:

- It is the file a tired human or fresh agent reads first.
- It reduces context-loading time.
- It supports clean handoff between Hermes, Codex, and humans.

---

### 6.13 `agent-loop/sync-model.md`

**Purpose:** Defines how external systems relate to repo-local loop state.

If you use Notion, this file explains how Notion, Hermes, repo Markdown, and Codex interact.

If you do not use Notion, this file can describe GitHub Issues, Linear, Jira, or no external dashboard.

Template with Notion:

````markdown
# Sync Model

## Control Plane

- Notion is the planning/control plane.
- Hermes reads and writes Notion.
- Hermes exports only approved and scoped work into repo Markdown.
- Codex reads only repo-local `agent-loop/` files.
- Codex writes reports and state back into the repo.
- Hermes reads those reports and updates Notion.
- The loop is not real unless state is updated after each run.

## Canonical Flow

```text
Notion planning/control plane
  -> Hermes sync/export
  -> agent-loop/backlog.md + state.md + handoff.md
  -> Codex run
  -> agent-loop/reports/* + state.md + run-log.md + done.md/blocked.md
  -> Hermes sync/import
  -> Notion status/evidence updates
```

## Codex Planning Boundary

- Codex must not read Notion directly.
- Codex must not assume Notion status unless it appears in repo Markdown.
- Codex must not invent backlog items from roadmap docs or comments.
- Codex may use roadmap docs only as context when an approved item points to them.
````

Template without Notion:

````markdown
# Sync Model

## Control Plane

- Repo Markdown is the source of truth for worker execution.
- External planning tools are optional.
- A human or Hermes coordinator is responsible for promoting approved work into `backlog.md`.
- Codex reads only repo-local `agent-loop/` files.
- Codex writes reports and state back into the repo.

## Canonical Flow

```text
Planning docs / issues / human priorities
  -> Hermes or human backlog curation
  -> agent-loop/backlog.md + state.md + handoff.md
  -> Codex run
  -> agent-loop/reports/* + state.md + run-log.md + done.md/blocked.md
  -> human/Hermes review
```
````

Why this file is needed:

- It prevents confusion about which system is authoritative.
- It keeps Codex from relying on stale dashboard state.
- It gives Hermes a clear import/export responsibility.

---

## 7. The Three Loop Modes

### Mode 1: Smoke Test / No-Op Mode

Use this when first proving the loop works.

Setup:

- Create all loop files.
- Leave no `Agent Ready` item in `backlog.md`.
- Start Codex.

Expected result:

- Codex reads the loop files.
- Codex finds no approved work.
- Codex writes a no-op report.
- Codex stops.

This proves the loop does not invent work.

### Mode 2: One-Item Bounded Mode

Use this for early testing or risky projects.

Setup:

- Add exactly one `Agent Ready` item.
- Rules say Codex must stop after that item.

Expected result:

- Codex completes one item.
- Codex updates reports and state.
- Codex stops for review.

This proves the loop can do real work while staying bounded.

### Mode 3: Continuous Implementation Mode

Use this when the user wants high autonomy.

Setup:

- Add a full approved queue.
- Rules say Codex should continue after each completed item.
- Define serious blockers clearly.
- Define deployment permission clearly.

Expected result:

- Codex starts at the first `Agent Ready` item.
- Codex completes, verifies, reports, and continues.
- Codex stops only when the queue is empty or a serious blocker is reached.

This is the mode used for major beta-launch pushes.

---

## 8. Turning a List of Work Into a Loop

The loop starts with a list of things that need to get done. That list may come from:

- Notion project docs.
- A PRD.
- Architecture docs.
- Launch checklist.
- GitHub Issues.
- Human chat instructions.
- Existing TODO comments.

Do not give the raw list directly to Codex. First, convert it into an approved queue.

### Step 1: Gather source material

Collect the relevant docs and notes.

Examples:

```text
product-roadmap.md
architecture.md
launch-checklist.md
security-review.md
Notion database rows
```

### Step 2: Extract real work items

Turn vague goals into executable items.

Bad:

```text
Make auth production ready.
```

Good:

```text
LOOP-0010: Lock down thread and message authorization by workspace membership. Users must not read or mutate another user's workspace threads/messages by ID. Add security-critical tests.
```

### Step 3: Order the work

Put prerequisites first.

A typical order:

1. Baseline health checks.
2. Safety/security gates.
3. Core implementation.
4. UI and UX.
5. Documentation/installers.
6. Monitoring/operations.
7. Full release checks.
8. Deployment.
9. Final smoke test.
10. Evidence pack.

### Step 4: Add source references

Every item should point back to where the requirement came from.

Example:

```markdown
| LOOP-0008 | Agent Ready | Codex | Fix workspace ownership/membership checks for workspace reads and writes. | `docs/production-launch-architecture.md` Phase 0.2 | Enforce 404 for missing workspace and 403 for unauthorized workspace. Add tests for cross-user access denial. |
```

### Step 5: Define autonomy

Decide whether the agent may:

- Modify code.
- Modify docs.
- Add migrations.
- Install local tooling.
- Deploy.
- Use browsers.
- Touch external accounts.
- Continue automatically.

Write this into `loop-rules.md`, `backlog.md`, and `codex-automation.md`.

### Step 6: Define stop conditions

Good stop conditions are specific.

Examples:

- Paid purchases/upgrades.
- Destructive production deletion.
- Missing credentials/login.
- Legal/privacy/product decision not already made.
- Serious data-loss/security risk.

Bad stop conditions are vague.

Examples:

- Stop if anything is confusing.
- Stop if a test fails.
- Stop if a package is missing.

Those are normal engineering blockers and should usually be worked through.

---

## 9. How Hermes Fits In

Hermes is especially useful before, between, and after Codex runs.

### Before a run

Hermes can:

- Read the roadmap and architecture docs.
- Create the `agent-loop/` folder.
- Turn the work list into `backlog.md`.
- Write or update `loop-rules.md` and `codex-automation.md`.
- Check that statuses and report files are consistent.
- Give the user a copy-ready Codex start prompt.

### During a run

Hermes can:

- Monitor reports if Codex writes them.
- Answer user questions about current state.
- Keep Notion or another dashboard updated.

### After a run

Hermes can:

- Review the latest report.
- Verify files and command outputs where possible.
- Import evidence back into Notion.
- Promote the next item or adjust the queue.
- Update loop rules if the user changes autonomy.

Hermes should avoid replacing durable loop state with chat memory. The point of the loop is that the next worker can recover from the files, not from a long conversation.

---

## 10. How Codex Fits In

Codex should be started from the repository root with a minimal prompt.

Example:

```markdown
Working directory:
/path/to/repo

Read `agent-loop/codex-automation.md` and follow it exactly.

Run the implementation loop in continuous mode: execute the first `Agent Ready`
item in `agent-loop/backlog.md`, verify it, update the loop evidence files and
report, then continue to the next `Agent Ready` item. Keep going until no
`Agent Ready` items remain or a serious blocker is reached.
```

The important trick is that Codex does not need a giant prompt. The giant prompt lives in the repo as Markdown. The Codex kickoff prompt only tells it where to look and what mode to run.

If using Codex CLI and it is installed:

```bash
cd /path/to/repo
codex exec "Read agent-loop/codex-automation.md and follow it exactly. Run the implementation loop until no Agent Ready items remain or a serious blocker is reached."
```

For interactive or hosted Codex products, supply:

- Working directory: repository root.
- Prompt: the start prompt from `agent-loop/codex-automation.md`.

---

## 11. How Notion Fits In

Notion is optional, but useful as a human-facing control plane.

A good Notion setup has:

- A database of backlog items.
- Status fields matching the repo loop statuses.
- Source links to product/architecture docs.
- A report/evidence relation or text field.
- A current state page.

Recommended Notion fields:

| Field | Type | Purpose |
| --- | --- | --- |
| ID | Text | Stable loop ID, e.g. `LOOP-0008` |
| Status | Select | `Proposed`, `Agent Ready`, `In Progress`, `Done`, etc. |
| Owner | Select | `Codex`, `Hermes`, `Human`, etc. |
| Summary | Title/text | Executable task summary |
| Source | URL/text | Requirement source |
| Notes | Text | Scope details and constraints |
| Report | URL/text | Link or pasted evidence from `agent-loop/reports/` |
| Last Updated | Date | Sync timestamp |

Recommended sync rule:

```text
Notion is for human planning and visibility.
Repo Markdown is for worker execution.
```

That means:

1. Humans/Hermes approve work in Notion.
2. Hermes exports approved work into `agent-loop/backlog.md`.
3. Codex executes only from repo Markdown.
4. Codex writes reports into the repo.
5. Hermes imports report summaries back into Notion.

Do not make Codex depend on direct Notion access unless you have a very specific reason. Direct external-dashboard access adds auth failure modes and can make runs less reproducible.

---

## 12. Reporting and Evidence Standards

A loop is only trustworthy if it leaves evidence.

Every completed item should answer:

- What was selected?
- What changed?
- What files were modified?
- What commands were run?
- What checks passed?
- What checks failed?
- What was skipped and why?
- Were secrets touched?
- Was deployment done?
- Are human decisions needed?
- What should happen next?

Bad report:

```text
Implemented marketplace gating. Looks good.
```

Good report:

```text
Selected item: LOOP-0005
Files changed: backend/src/marketplace/..., backend/test/marketplace...
Commands run: pnpm --filter backend test marketplace-beta-gate.spec.ts
Result: passed, 18 tests
Deployment: not required for this item
Secrets touched: no
Next: LOOP-0006 web unavailable states
```

Reports should be append-only. If a later report corrects an earlier one, reference the older report instead of editing history.

---

## 13. Working Tree and Git Discipline

Before a serious loop run, record working tree state.

Recommended preflight:

```bash
git status --short
git diff --stat
```

Rules:

- Preserve unrelated user changes.
- Do not overwrite uncommitted work without inspection.
- If the loop itself changes files, those changes should be visible in git.
- Use reports to distinguish pre-existing changes from loop-created changes.

For multi-agent work, consider git worktrees so separate agents do not edit the same checkout at the same time.

---

## 14. Deployment Policy

Deployment must be explicit.

In low-autonomy loops:

```markdown
- Deployment is not approved.
- If deployment appears necessary, stop and ask the human.
```

In high-autonomy launch loops:

```markdown
- Deployment is approved when a backlog item requires live verification.
- Deploy from the documented project directory.
- Use existing project configuration.
- Do not print or commit secrets.
- Verify health and item-specific behavior after deployment.
- If deployment fails, diagnose, fix, rerun checks, and retry unless a serious blocker is reached.
```

Write the chosen policy in:

- `loop-rules.md`
- `backlog.md`
- `codex-automation.md`
- `decisions.md` if it is a durable decision

---

## 15. The Initial Setup Report

After creating the loop, write `agent-loop/reports/0001-loop-setup.md`.

Template:

```markdown
# 0001 Loop Setup

Date: YYYY-MM-DD
Runner: Hermes / Human / Codex
Selected backlog item: none
Starting status: no loop folder
Ending status: loop folder created

## Summary

Created the initial `agent-loop/` coordination directory and documentation.

## Files Created

- `agent-loop/README.md`
- `agent-loop/loop-rules.md`
- `agent-loop/codex-automation.md`
- `agent-loop/backlog.md`
- `agent-loop/state.md`
- `agent-loop/run-log.md`
- `agent-loop/blocked.md`
- `agent-loop/done.md`
- `agent-loop/decisions.md`
- `agent-loop/handoff.md`
- `agent-loop/sync-model.md`
- `agent-loop/reports/README.md`

## Checks

- Confirmed files exist.
- Confirmed backlog contains only approved work or example placeholders.

## Safety

- Product implementation: none
- Deployment: none
- Secrets touched: no
- External account actions: no

## Next Recommended Action

Approve the first bounded work item and mark it `Agent Ready`.
```

This report proves that the loop infrastructure itself was intentionally created.

---

## 15A. Lessons From Real Loop Reports

After a loop has several reports, update this manual and the loop files with what
the reports reveal. The reports are not just an audit trail; they are feedback
for improving the loop system itself.

Patterns to look for:

- **Starting status may be `In Progress`.** In a continuous run, Codex may mark
  the next item `In Progress` before writing the report. The report should still
  name the selected backlog item and ending status clearly.
- **Some items need focused checks, not full release checks.** A docs/config item
  may only need `git diff --check` plus a targeted validation script, while a
  backend authorization item may need focused test suites and a backend build.
  The report must explain why broader checks were skipped.
- **Deployment can be deferred but must stay visible.** If backend or web behavior
  changed and deployment is queued for a later release item, record that in the
  report's safety and remaining findings sections.
- **Non-blocking findings should be carried forward.** Lint warnings, build
  warnings, generated snapshot drift, and deferred deploy needs should not be
  lost just because the selected item is done.
- **Implementation notes matter.** Reports should capture discoveries like
  "existing service already enforced 404/403" or "the guard needed `wsId`
  support" so future agents do not rediscover the same facts.
- **Safety evidence should be explicit.** Modern reports should include whether
  secrets, browser automation, external accounts, and destructive actions were
  touched.

When updating the loop from report evidence, prefer improving the reusable
manual, report schema, and loop rules rather than adding long one-off chat notes.

---

## 16. End-to-End Setup Checklist

Use this checklist when creating a new loop.

### Planning

- [ ] Gather the source work list: roadmap, PRD, issues, launch checklist, Notion, etc.
- [ ] Decide whether the loop is smoke-test, one-item, or continuous.
- [ ] Decide whether deployment is allowed.
- [ ] Decide which blockers require human input.
- [ ] Decide whether Notion or another dashboard will be used.

### Folder creation

- [ ] Create `agent-loop/`.
- [ ] Create `agent-loop/reports/`.
- [ ] Add `README.md`.
- [ ] Add `loop-rules.md`.
- [ ] Add `codex-automation.md`.
- [ ] Add `backlog.md`.
- [ ] Add `state.md`.
- [ ] Add `run-log.md`.
- [ ] Add `blocked.md`.
- [ ] Add `done.md`.
- [ ] Add `decisions.md`.
- [ ] Add `handoff.md`.
- [ ] Add `sync-model.md`.
- [ ] Add `reports/README.md`.

### Backlog

- [ ] Convert high-level work into executable items.
- [ ] Give each item a stable ID.
- [ ] Add status, owner, source, and notes.
- [ ] Mark only approved items `Agent Ready`.
- [ ] Put items in dependency order.
- [ ] Include examples only under a clearly marked non-approved section.

### Reporting

- [ ] Write `reports/0001-loop-setup.md`.
- [ ] Add the setup entry to `run-log.md`.
- [ ] Set current status in `state.md`.
- [ ] Write a short `handoff.md`.

### First run

- [ ] Start with no `Agent Ready` item if you want a smoke test.
- [ ] Start with one `Agent Ready` item if you want a bounded test.
- [ ] Start with a full queue only when autonomy and safety policies are clear.
- [ ] Give Codex the working directory and start prompt.
- [ ] Review the first report before scaling up autonomy.

---

## 17. Common Mistakes

### Mistake: Putting ideas directly into the executable backlog

Fix: keep ideas as `Proposed` or in a separate planning doc. Only `Agent Ready` is executable.

### Mistake: No report after a run

Fix: make reports mandatory. A loop without evidence is just chat.

### Mistake: Long prompts instead of durable files

Fix: put rules in `agent-loop/`. Use a short prompt that tells Codex to read them.

### Mistake: Unclear deployment permissions

Fix: explicitly state whether deployment is allowed, when, and from where.

### Mistake: Treating normal errors as blockers

Fix: define serious blockers. Failing tests, missing packages, and implementation uncertainty are usually work to solve, not reasons to stop.

### Mistake: Letting Codex read external planning tools directly

Fix: use Hermes or a human to export approved work into repo Markdown. Codex executes from repo Markdown.

### Mistake: `state.md` becomes a full history

Fix: keep `state.md` current and short. Put history in `run-log.md` and details in reports.

---

## 18. Example Minimal Loop Start Prompt

Use this when starting Codex:

```markdown
Working directory:
/path/to/repo

Read `agent-loop/codex-automation.md` and follow it exactly.

Execute the first `Agent Ready` item in `agent-loop/backlog.md`, verify it,
update the loop evidence files and report, then continue according to
`agent-loop/loop-rules.md`.

Do not print, commit, or expose secrets. Stop only for the serious blockers listed
in `agent-loop/loop-rules.md`.
```

---

## 19. Example Hermes Coordinator Prompt

Use this when asking Hermes to set up a loop:

```markdown
Create a repo-local `agent-loop/` folder for this project.

Start from these source docs:

- `docs/product-roadmap.md`
- `docs/architecture.md`
- `docs/launch-checklist.md`

Create the standard loop files:

- `README.md`
- `loop-rules.md`
- `codex-automation.md`
- `backlog.md`
- `state.md`
- `run-log.md`
- `blocked.md`
- `done.md`
- `decisions.md`
- `handoff.md`
- `sync-model.md`
- `reports/README.md`
- `reports/0001-loop-setup.md`

Convert the source docs into an ordered approved backlog. Use `Agent Ready` only
for items that are scoped enough for Codex to implement. Include safety boundaries,
reporting requirements, and a copy-ready Codex start prompt.
```

---

## 20. Definition of a Healthy Loop

A healthy loop has these properties:

- A new agent can read the folder and know what to do.
- The next task is deterministic.
- The backlog contains approved work only.
- Safety limits are explicit.
- Reports contain real evidence.
- State is updated after every run.
- Completed work is marked done.
- Blockers are specific and serious.
- Human-facing dashboards are synced from repo evidence, not guesswork.
- The loop can survive chat context loss because the files contain the operating state.

If those are true, you have a real agent loop.

