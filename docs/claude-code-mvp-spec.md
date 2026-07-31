# Claude Code Integration MVP Spec

This document is the build-grade technical spec for the MVP integration between ClawChat and Claude Code.

The following decisions are fixed for this MVP:

- Railway backend remains source of truth for workspaces, threads, memberships, agents, and messages.
- A long-running local Claude Bridge Runtime runs on the home PC.
- Claude is represented as repo-backed ClawChat agent identities.
- Routing for Claude in multi-agent chats is explicit-only by default.
- Claude session scope is one session per `(thread_session_id, claude_agent_id)`.
- Baseline UX is final reply only, plus a working indicator.
- This is a private internal setup only.
- Current beta defaults do not use local command permission bypass. Private
  runtimes may use bypass flags only after explicit owner risk acceptance is
  recorded in local runtime config.

## 1. Runtime Architecture

### Process Model

- Add a new local package at `claude-runtime/`.
- Runtime is a long-running Node/TypeScript process.
- Runtime owns:
  - Railway bridge authentication
  - websocket connection
  - Claude agent registration
  - dispatch handling
  - local session/process journal
  - Claude CLI subprocess execution
- Runtime does not own source-of-truth thread or message data.

### Startup Flow

1. Load local config from `~/.clawchat/claude-runtime/config.json`.
2. Authenticate to Railway using the existing bridge-device flow:
   - one-time pairing via `POST /bridge/enroll`
   - recurring auth via `POST /bridge/device/auth`
3. Open websocket to Railway.
4. Atomically persist the replacement device credential returned by auth, then
   send the dedicated short-lived bridge websocket token in the websocket
   `authenticate` event.
5. Send `register_bridge_agent` for each configured Claude agent external ID.
6. Start heartbeat loop every 30 seconds.
7. Run startup reconciliation against the local journal.

### Railway Authentication

- Reuse the existing bridge-device auth model already used by the backend websocket gateway.
- Persist locally:
  - `devicePublicId` in owner-only config
  - the current rotating `deviceToken` in the macOS Keychain, atomically
  - `workspaceId`
  - runtime config
- Single-flight recurring authentication. Never retry a consumed device token;
  reuse is treated as compromise and revokes the device.
- Do not introduce a separate Claude-specific auth system.

### Transport Model

- Reuse the current bridge websocket event model.
- Runtime receives work through websocket `agent.dispatch`.
- Runtime posts results through authenticated REST bridge endpoints.
- No polling in MVP.

### Agent Registration

- On startup, runtime sends:
  - `register_bridge_agent` for each configured Claude external agent ID
- Runtime must only register agents that:
  - exist in local config
  - have a valid repo binding in local config

### Posting Back

- Final agent message: `POST /bridge/messages`
- Started event: new `POST /bridge/claude-dispatches/start`
- Completed event: new `POST /bridge/claude-dispatches/:id/complete`
- Failed event: new `POST /bridge/claude-dispatches/:id/fail`
- Heartbeat: new `POST /bridge/heartbeat`

### Claude Subprocess Model

- One short-lived Claude CLI subprocess per accepted dispatch.
- Child process spawned with:
  - `cwd = repoPath`
  - stdout piped
  - stderr piped
- Runtime stores:
  - child PID
  - dispatch ID
  - start time
  - timeout deadline
  - repo lock ownership

### Timeout Model

- Hard timeout: 20 minutes.
- On timeout:
  1. send `SIGTERM`
  2. wait 10 seconds
  3. send `SIGKILL`
  4. post failure event

### Cancellation Model

- No user cancellation in MVP.
- Runtime-only cancellation paths:
  - timeout
  - runtime shutdown
  - startup reconciliation of abandoned runs

### Logging Model

- Local-only logs.
- Directory:
  - `~/.clawchat/claude-runtime/logs/YYYY-MM-DD/`
- Per-dispatch files:
  - `<dispatchId>.stdout.log`
  - `<dispatchId>.stderr.log`
  - `<dispatchId>.meta.json`
- Journal:
  - `~/.clawchat/claude-runtime/state/journal.json`

## 2. Exact Claude CLI Invocation Strategy

### Output Mode

- Use `--output-format json`
- Use `--json-schema`
- Do not use `stream-json` in MVP.

Reason:

- final reply only
- simpler parsing
- deterministic schema validation

### Session Identifier Strategy

- Backend owns the Claude session identifier.
- Store it as `claudeSessionId` in `claude_thread_sessions`.
- Initial run uses `--session-id <claudeSessionId>`.
- Subsequent runs use `--resume <claudeSessionId>`.
- Do not use session names.
- Do not use `--fork-session`.

### Working Directory

- Always invoke Claude with `cwd = repoPath`.
- Repo path must be the bound repo root for the Claude agent.
- Do not invoke Claude from a workspace-level parent folder.

### Initial Run Command

```bash
claude -p \
  --session-id "<claudeSessionId>" \
  --output-format json \
  --json-schema '<schema-json>' \
  --model "<model-or-default>" \
  --max-turns 20 \
  --add-dir "<repoPath>" \
  "<prompt>"
```

### Resumed Run Command

```bash
claude -p \
  --resume "<claudeSessionId>" \
  --output-format json \
  --json-schema '<schema-json>' \
  --model "<model-or-default>" \
  --max-turns 20 \
  --add-dir "<repoPath>" \
  "<prompt>"
```

### Required Flags

- `-p`
- `--output-format json`
- `--json-schema`
- initial run: `--session-id`
- resumed run: `--resume`

### Optional Flags

- `--model`
- `--max-turns`
- `--add-dir`
- `--dangerously-skip-permissions` only when the local runtime config contains
  documented beta risk acceptance for dangerous command bypass.

### Disallowed For MVP

- `--fork-session`
- `--worktree`
- `stream-json`
- session naming
- interactive mode

### Schema

```json
{
  "type": "object",
  "additionalProperties": false,
  "required": ["final_reply_markdown", "status"],
  "properties": {
    "status": {
      "type": "string",
      "enum": ["completed", "failed"]
    },
    "final_reply_markdown": {
      "type": "string"
    },
    "summary": {
      "type": "string"
    },
    "changed_files": {
      "type": "array",
      "items": {
        "type": "string"
      }
    }
  }
}
```

### Final Response Extraction

- Parse stdout as JSON.
- Use `final_reply_markdown` as the message body posted into ClawChat.
- Store `changed_files` in result metadata.
- Ignore `summary` for chat posting.

### Prompt Envelope

Prompt must include:

- Claude agent identity
- repo identity
- current dispatch message
- recent thread messages from backend
- instruction to return only the user-facing final reply in `final_reply_markdown`

## 3. Repo Binding And Execution Isolation

### Binding Model

- One Claude agent maps to exactly one repo.
- Repo binding is stable.
- One Claude agent cannot switch repos per thread in MVP.

### Storage Model

- Railway stores `repoKey`, not local absolute path.
- Local runtime config stores:
  - `repoKey`
  - `repoPath`
  - `externalAgentId`

### Concurrency Policy

- Serialize work globally by repo path.
- No queueing in MVP.
- If repo path is busy, second dispatch fails immediately as `busy`.

### Isolation Policy

- Use the main repo checkout.
- Do not use per-thread worktrees in MVP.

### Operational Rule Preventing Conflicts

- Exactly one active Claude run may hold a repo path lock at a time.
- No two Claude agent identities may point to the same repo key in MVP.

## 4. Railway Schema Additions

### `claude_agent_bindings`

Purpose:

- Bind a ClawChat agent identity to a repo-backed Claude worker.

Fields:

- `id uuid pk`
- `workspaceId uuid not null`
- `agentId uuid not null`
- `repoKey varchar not null`
- `routingMode varchar not null default 'explicit_only'`
- `model varchar null`
- `isEnabled boolean not null default true`
- `createdAt timestamptz not null`
- `updatedAt timestamptz not null`

Indexes and constraints:

- unique `(agentId)`
- unique `(workspaceId, repoKey)`
- index `(workspaceId, isEnabled)`

Lifecycle:

- created when a Claude repo agent is provisioned
- persists for agent lifetime

### `claude_thread_sessions`

Purpose:

- Persist Claude session scope for `(threadSessionId, agentId)`.

Fields:

- `id uuid pk`
- `workspaceId uuid not null`
- `threadId uuid not null`
- `threadSessionId uuid not null`
- `agentId uuid not null`
- `claudeSessionId uuid not null`
- `status varchar not null default 'active'`
- `lastDispatchedMessageId uuid null`
- `lastRunStartedAt timestamptz null`
- `lastRunFinishedAt timestamptz null`
- `lastErrorCode varchar null`
- `lastErrorMessage text null`
- `lastActivityAt timestamptz not null`
- `closedAt timestamptz null`
- `createdAt timestamptz not null`
- `updatedAt timestamptz not null`

Indexes and constraints:

- unique `(threadSessionId, agentId)`
- unique `(claudeSessionId)`
- index `(threadId, agentId)`
- index `(status, lastActivityAt)`

Lifecycle:

- created on first accepted dispatch
- closed on thread wrap-up, archive, or agent removal
- replaced by fresh row on next thread session

### `claude_dispatches`

Purpose:

- Dispatch dedupe, run state, timing, error tracking.

Fields:

- `id uuid pk`
- `workspaceId uuid not null`
- `threadId uuid not null`
- `threadSessionId uuid not null`
- `messageId uuid not null`
- `agentId uuid not null`
- `dispatchKey varchar not null`
- `status varchar not null default 'queued'`
- `bridgeDeviceId uuid null`
- `startedAt timestamptz null`
- `completedAt timestamptz null`
- `timeoutAt timestamptz null`
- `postedMessageId uuid null`
- `errorCode varchar null`
- `errorMessage text null`
- `resultSummary text null`
- `resultMetadata jsonb not null default '{}'`
- `createdAt timestamptz not null`
- `updatedAt timestamptz not null`

Indexes and constraints:

- unique `(dispatchKey)`
- index `(agentId, createdAt)`
- index `(status, updatedAt)`
- index `(threadSessionId, agentId)`

Dispatch key:

- `threadId:threadSessionId:messageId:agentId`

Lifecycle:

- inserted before dispatch emission
- transitions:
  - `queued`
  - `started`
  - `completed`
  - `failed`
  - `ignored`

### Heartbeat And Availability

- Do not add a new Claude-specific heartbeat table in MVP.
- Reuse `bridge_devices.lastSeenAt`.
- Heartbeat endpoint updates the authenticated bridge device `lastSeenAt`.

## 5. Backend Code Changes

### `backend/src/modules/agent/*`

Changes:

- support agent provisioning with `source = "claude_code"`
- add creation/update flow for `claude_agent_bindings`

Why:

- Claude agents must exist as normal ClawChat agents

Required for MVP:

- yes

### `backend/src/modules/message/message.service.ts`

Changes:

- split target resolution into:
  - normal agents
  - Claude agents
- Claude agents in multi-agent threads must be explicit-only
- create `claude_dispatches` row before emission
- do not emit Claude dispatches for offline agents
- do not include Claude agents in fallback “all thread agents” targeting

Why:

- current routing is too broad for repo-mutating agents

Required for MVP:

- yes

### `backend/src/modules/thread/thread-wrap-up.service.ts`

Changes:

- close matching `claude_thread_sessions` when thread session wraps

Why:

- Claude session scope is bound to thread session

Required for MVP:

- yes

### `backend/src/modules/bridge/bridge.controller.ts`

Changes:

- extend `/bridge/messages` request body with:
  - `threadSessionId`
  - `dispatchId`
  - `metadata`
- add:
  - `POST /bridge/claude-dispatches/start`
  - `POST /bridge/claude-dispatches/:id/complete`
  - `POST /bridge/claude-dispatches/:id/fail`
  - `POST /bridge/heartbeat`

Why:

- runtime needs explicit run-state callbacks

Required for MVP:

- yes

### `backend/src/modules/bridge/bridge.service.ts`

Changes:

- validate thread session on bridge-posted Claude message
- reject stale thread session message posts with `409`
- update `claude_dispatches` rows on start, complete, fail
- update `bridge_devices.lastSeenAt` on heartbeat

Why:

- keep backend state authoritative and prevent cross-session leakage

Required for MVP:

- yes

### New Module: `backend/src/modules/claude/*`

Suggested files:

- `claude.module.ts`
- `claude.service.ts`
- `claude.controller.ts` if needed

Responsibilities:

- manage `claude_agent_bindings`
- manage `claude_thread_sessions`
- manage `claude_dispatches`
- runtime availability checks
- startup reconciliation job

Required for MVP:

- yes

### `backend/src/gateways/events.gateway.ts`

Changes:

- no transport redesign
- keep existing bridge-agent dispatch path
- expose live registered agent state through current runtime inspection

Required for MVP:

- yes, small

### Typing / Working State

Changes:

- reuse existing `emitAgentTyping()`
- emit only for live Claude agents
- stop typing on completion or failure

Required for MVP:

- yes

### Failure / Timeout Handling

Changes:

- failure endpoint updates dispatch state
- stop typing on failure
- optionally inject short system message

Required for MVP:

- yes

## 6. Dispatch And Event Contracts

### Backend -> Runtime Websocket `agent.dispatch`

```json
{
  "type": "agent.dispatch",
  "data": {
    "dispatchId": "4edb6f1d-9b6f-4c0e-9f34-f3c503ce31cf",
    "dispatchKey": "thread-1:session-2:message-9:agent-7",
    "workspaceId": "ws_123",
    "threadId": "thread_123",
    "threadSessionId": "thread_session_456",
    "messageId": "msg_789",
    "externalAgentId": "claude_web",
    "agentId": "agent_uuid",
    "senderId": "openclaw_agent_uuid",
    "senderName": "OpenClaw Builder",
    "content": "@ClaudeWeb can you make this change in the repo?",
    "recentMessages": [
      {
        "senderId": "user_1",
        "senderName": "Alex",
        "content": "We need a fix in the web app.",
        "timestamp": "2026-03-28T18:00:00.000Z",
        "isFromUser": true,
        "provenance": "user"
      }
    ],
    "timeoutSeconds": 1200,
    "model": "sonnet",
    "routingMode": "explicit_only"
  }
}
```

### Runtime -> Backend Started

```json
{
  "dispatchId": "4edb6f1d-9b6f-4c0e-9f34-f3c503ce31cf",
  "threadId": "thread_123",
  "threadSessionId": "thread_session_456",
  "agentId": "agent_uuid",
  "externalAgentId": "claude_web",
  "bridgeDeviceId": "bridge_device_uuid",
  "pid": 81231,
  "startedAt": "2026-03-28T18:01:00.000Z"
}
```

### Runtime -> Backend Completed

```json
{
  "dispatchId": "4edb6f1d-9b6f-4c0e-9f34-f3c503ce31cf",
  "threadId": "thread_123",
  "threadSessionId": "thread_session_456",
  "agentId": "agent_uuid",
  "completedAt": "2026-03-28T18:06:10.000Z",
  "resultSummary": "Updated input validation and added tests.",
  "resultMetadata": {
    "changedFiles": ["components/form.tsx", "components/form.test.tsx"]
  }
}
```

### Runtime -> Backend Failed

```json
{
  "dispatchId": "4edb6f1d-9b6f-4c0e-9f34-f3c503ce31cf",
  "threadId": "thread_123",
  "threadSessionId": "thread_session_456",
  "agentId": "agent_uuid",
  "failedAt": "2026-03-28T18:21:00.000Z",
  "errorCode": "timeout",
  "errorMessage": "Claude run exceeded 1200 seconds."
}
```

### Runtime -> Backend Final Agent Message

```json
{
  "threadId": "thread_123",
  "threadSessionId": "thread_session_456",
  "dispatchId": "4edb6f1d-9b6f-4c0e-9f34-f3c503ce31cf",
  "senderId": "claude_web",
  "senderName": "Claude / clawchat-web",
  "content": "Implemented the validation fix in the web form and added a regression test. The main changes are in `components/form.tsx` and `components/form.test.tsx`.",
  "metadata": {
    "changedFiles": ["components/form.tsx", "components/form.test.tsx"]
  }
}
```

### Runtime -> Backend Heartbeat

```json
{
  "deviceLabel": "Alex Mac Studio",
  "runtimeVersion": "0.1.0",
  "activeDispatchCount": 1,
  "registeredExternalAgentIds": ["claude_web", "claude_backend"],
  "sentAt": "2026-03-28T18:02:00.000Z"
}
```

## 7. Routing Rules

### Direct Chat With Exactly One Claude Agent

- Every user-authored message routes to Claude.
- No `@mention` required.

### Any Multi-Agent Thread

- Claude routing is explicit-only.

### Team Chat With One Claude Agent

- No Claude mention: no Claude dispatch.
- Exactly one Claude mention: dispatch to that Claude agent.

### Team Chat With Multiple Claude Agents

- Exactly one resolvable Claude mention: dispatch to that agent.
- Zero Claude mentions: no Claude dispatch.
- Multiple Claude mentions in one message: no Claude dispatch in MVP.

### Agent-to-Agent Requests

- OpenClaw -> Claude requires explicit Claude mention.
- Claude -> OpenClaw continues to use normal agent message behavior.

### Ambiguous Mention

- No dispatch.
- Backend injects system message:
  - `Ambiguous Claude target. Mention exactly one Claude repo agent.`

### No Mention In Multi-Agent Chat

- No Claude dispatch.
- No system message.

### Offline Claude Target

- No dispatch is emitted.
- Backend records failed dispatch.
- Backend injects system message:
  - `<AgentName> is offline on the local Claude runtime.`

### Accidental Auto-Run Prevention

- Claude agents are excluded from fallback all-agent targeting in multi-agent threads.
- Claude never runs on agent-authored messages without explicit mention.

## 8. Session Lifecycle Rules

### Created

- On first accepted dispatch for `(threadSessionId, agentId)`.
- Backend creates `claude_thread_sessions` row with new `claudeSessionId`.

### Resumed

- When accepted dispatch finds active session row for `(threadSessionId, agentId)`.

### Considered Active

- `claude_thread_sessions.status = 'active'`
- thread `activeSessionId` matches `threadSessionId`

### Considered Stale

- thread active session changed
- thread archived
- agent removed from thread

### Closed

- on thread wrap-up
- on thread archive
- on agent removal from thread

### Abandoned

- dispatch status is `started`
- no matching live local child process
- not completed or failed

### Fresh Session After Wrap-Up

- old session row is marked `closed`
- next accepted dispatch creates fresh session row and fresh `claudeSessionId`

### Runtime Startup Reconciliation

- Load journal.
- For journaled started runs with no live child PID:
  - call fail endpoint with `runtime_restarted`
- Clear stale local locks.

### Backend Reconciliation If Runtime Disappears

- Periodic job every 1 minute.
- For `claude_dispatches.status = 'started'`:
  - if owning bridge device is offline
  - and past grace threshold
  - mark failed with `runtime_offline`
- Emit typing stop.

## 9. MVP Happy-Path Sequence

```text
User creates team thread with OpenClaw agent + Claude / clawchat-web

OpenClaw agent posts:
  "@ClaudeWeb can you make this change in the repo?"

Backend:
  resolves explicit Claude mention
  verifies Claude agent is live-registered
  ensures active thread session exists
  creates/gets claude_thread_sessions row for (threadSessionId, ClaudeAgentId)
  creates claude_dispatches row
  emits typing:start for Claude agent
  emits agent.dispatch over websocket

Local Claude runtime:
  receives dispatch
  checks repo lock for repoKey=clawchat-web
  accepts lock
  posts started event
  runs claude -p --session-id <claudeSessionId> in repo
  Claude edits/tests/etc.
  parses JSON result
  posts final message to /bridge/messages with threadSessionId
  posts complete event
  releases repo lock

Backend:
  injects Claude final message into same thread
  emits typing:stop
  marks dispatch completed
  updates claude_thread_sessions last activity

Later user replies in same thread session:
  "@ClaudeWeb can you also clean up the tests?"

Backend:
  finds existing active claude_thread_sessions row
  creates new dispatch row
  emits dispatch

Runtime:
  runs claude -p --resume <same claudeSessionId>
  posts final reply

Thread is wrapped up

Backend:
  wraps thread session
  marks old claude_thread_sessions row closed

Next Claude request in reopened thread:
  backend creates new claude_thread_sessions row with new claudeSessionId
  runtime starts fresh Claude session
```

## 10. Failure Handling Rules

### Runtime Offline

- Backend does not emit dispatch if target Claude external ID is not live-registered.
- Record failed dispatch with `runtime_offline`.
- Inject system message.

### Wrong Repo Binding

- Runtime fails before spawning Claude.
- Post failure with `repo_not_found`.
- Backend injects system message.

### Duplicate Dispatch

- Backend enforces unique `dispatchKey`.
- If duplicate exists:
  - do not emit again
  - return existing dispatch state

### Claude Timeout

- Runtime kills process.
- Posts failure with `timeout`.
- Backend emits typing stop and failure message.

### Claude Process Crash

- Runtime posts failure with `process_crashed`.
- Include exit code or signal.

### Malformed Claude Output

- Runtime treats schema parse failure as `malformed_output`.
- No final agent message is posted.
- Failure event is posted.

### Message Posted After Thread Session Changed

- `/bridge/messages` validates `threadSessionId`.
- If mismatch:
  - return `409 session_mismatch`
  - runtime fails dispatch as `stale_thread_session`
  - no repost into new session

### Same Claude Repo Agent Hit From Two Threads At Once

- Runtime repo lock rejects second dispatch immediately.
- Second dispatch marked failed `busy`.
- Backend injects system message.

## 11. Implementation Phases

### Phase 1: Local Runtime Spike

Scope:

- create `claude-runtime/`
- bridge-device auth
- websocket connect
- agent registration
- hardcoded dispatch handler

Likely files:

- `claude-runtime/src/index.ts`
- `claude-runtime/src/config.ts`
- `claude-runtime/src/railway-client.ts`
- `claude-runtime/src/ws-client.ts`
- `claude-runtime/src/claude-cli.ts`

Acceptance criteria:

- runtime connects to Railway
- registers one Claude external agent
- receives fake dispatch
- runs Claude CLI locally and parses structured output

Out of scope:

- backend persistence
- real thread integration

### Phase 2: Backend Dispatch Integration

Scope:

- `claude_agent_bindings`
- `claude_dispatches`
- explicit-only Claude routing
- offline checks
- dispatch emission

Likely files:

- `backend/src/modules/message/message.service.ts`
- `backend/src/modules/bridge/bridge.controller.ts`
- `backend/src/modules/bridge/bridge.service.ts`
- `backend/src/modules/claude/claude.service.ts`
- `backend/src/entities/claude-agent-binding.entity.ts`
- `backend/src/entities/claude-dispatch.entity.ts`

Acceptance criteria:

- Claude mention in a real thread produces one dispatch row
- offline Claude does not dispatch
- duplicate dispatches are deduped

Out of scope:

- session persistence across wrap-up

### Phase 3: Real Thread / Session Persistence

Scope:

- `claude_thread_sessions`
- initial `--session-id`
- resumed `--resume`
- wrap-up closure
- stale-session rejection

Likely files:

- `backend/src/modules/thread/thread-wrap-up.service.ts`
- `backend/src/modules/thread/thread-session.service.ts`
- `backend/src/entities/claude-thread-session.entity.ts`
- `claude-runtime/src/session-store.ts`
- `claude-runtime/src/dispatch-runner.ts`

Acceptance criteria:

- second Claude request in same thread session resumes same Claude session
- wrap-up forces new Claude session next time
- stale message post is rejected

Out of scope:

- artifact links
- cancellation UI

### Phase 4: UX / Status Hardening

Scope:

- started / complete / fail endpoints
- heartbeat
- timeout handling
- startup reconciliation
- busy rejection

Likely files:

- `backend/src/gateways/events.gateway.ts`
- `backend/src/modules/claude/claude.service.ts`
- `claude-runtime/src/journal.ts`
- `claude-runtime/src/logger.ts`

Acceptance criteria:

- working indicator appears only for live runs
- hung process is failed and typing stops
- runtime restart reconciles stale runs

Out of scope:

- worktrees
- progress summaries
- artifact browser

## 12. Final Recommendation

### Exact MVP Recommendation

- Build a new long-running local `claude-runtime`.
- Keep Railway authoritative.
- Provision Claude repo agents in backend with `source = "claude_code"`.
- Dispatch work over the existing bridge websocket.
- Persist execution state in `claude_dispatches`.
- Persist Claude conversation scope in `claude_thread_sessions`.
- Post final replies through extended `/bridge/messages`.

### Exact Concurrency Policy

- One active run per repo path globally.
- No queueing in MVP.
- Second concurrent dispatch fails immediately as `busy`.

### Exact Repo Isolation Policy

- Main checkout only.
- No worktrees in MVP.
- Safety comes from global repo-path serialization.

### Exact Claude Session Persistence Policy

- One Claude session per `(threadSessionId, agentId)`.
- First accepted dispatch creates backend-owned UUID `claudeSessionId`.
- Initial CLI call uses `--session-id`.
- Later calls use `--resume <claudeSessionId>`.
- Wrap-up closes that session record permanently.
- Next thread session gets a fresh Claude session.
