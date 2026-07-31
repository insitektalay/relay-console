# ClawChat Hermes Runtime Worker

This is the Phase 4 Hermes worker for ClawChat.

It is a separate Python service that wraps Hermes `AIAgent` and is called by the backend through the generic runtime adapter path.

## Purpose

- keep Hermes integration outside the NestJS process
- keep ClawChat as the canonical conversation layer
- use fresh `AIAgent` instances per run
- preserve ClawChat-owned runtime session IDs
- persist worker-managed `conversation_history` snapshots
- support cancellation through `interrupt()`

## Auth

All worker endpoints require:

```text
Authorization: Bearer <HERMES_WORKER_SHARED_SECRET>
```

## Endpoints

- `GET /health`
- `POST /v1/runs/stream`
- `POST /v1/runs/{dispatch_id}/cancel`

## Callback to Runtime Event Mapping

Worker normalization:

- `stream_delta_callback(text)` -> `run.delta`
- `tool_progress_callback(name, preview, args)` -> `run.tool`
- `status_callback(topic, message)` -> `run.status`
- successful `run_conversation(...)` result -> `run.completed`
- interrupted result -> `run.cancelled`
- exception or failed result -> `run.failed`

## Session Snapshots

Snapshots are stored under:

```text
$HERMES_HOME/clawchat/runtime_sessions/<runtimeSessionId>.json
```

They are owned by the worker, keyed by ClawChat runtime session ID, and reused as `conversation_history` on the next turn.

## HERMES_HOME Isolation

`HERMES_HOME` is required.

The worker will not start without it. This avoids accidentally sharing the operator's default `~/.hermes` with ClawChat worker traffic.

## Workspace Isolation

The worker never accepts a host path. Each Railway-managed runtime has its own
service and volume. `HERMES_WORKSPACE_ROOT` is fixed by the deployment and
`HERMES_WORKSPACE_KEY` is the only workspace identity accepted in a run
payload. Both the Hermes home and workspace root are canonicalized and rejected
if any path component is a symlink.

Production runs as an unprivileged container user with no effective Linux
capabilities and `no_new_privs`. Startup fails if the application, system, or
temporary filesystem locations are writable; runtime data and `TMPDIR` are
confined to `/data`. Active runs and event queues are bounded, session
identifiers are validated, and snapshots use bounded owner-only atomic files.
The terminal and session-search toolsets are forbidden for the managed worker
until a separately audited credential broker and command sandbox are
available.

The backend reaches each managed worker only at its deterministic
`relay-hermes-<runtime-id>.railway.internal:8765` private service address.
There is no public worker domain. Each runtime receives a distinct
HMAC-derived bearer credential and rejects every other runtime's opaque
workspace key.

## Test Mode

If `HERMES_WORKER_FAKE_MODE=1`, the worker uses an internal fake agent.
Production startup rejects this setting.

This exists only to test:
- dispatch streaming
- cancel path
- snapshot continuity

without requiring live LLM credentials.

## Remote Bridge Mode

For production remote use, ClawChat can route Hermes agents through an outbound
websocket bridge instead of this local HTTP worker.

The production targets must be the Railway backend origin:

```text
apiBaseUrl = https://<railway-backend>/api/v1
wsUrl      = wss://<railway-backend>
```

The bridge client runs on the machine where Hermes is installed. It should:

1. Redeem a ClawChat bridge enrollment code with `POST /api/v1/bridge/enroll`.
   Include a Hermes capability such as `clawchat.runtime.hermes`.
2. Re-authenticate later with `POST /api/v1/bridge/device/auth` using the
   returned `devicePublicId` and `deviceToken`.
3. Connect to ClawChat websocket with the returned `wsToken`.
4. Send:

```json
{
  "type": "authenticate",
  "token": "<wsToken>",
  "capabilities": ["clawchat.runtime.hermes", "clawchat.marketplace.tools"]
}
```

5. Optionally register live Hermes-backed ClawChat agents by external id for
   telemetry/health. Dispatch availability is workspace-level and only requires
   a connected bridge with `clawchat.runtime.hermes`; live agent registration
   must use `register_hermes_agent` so ClawChat persists a Hermes bridge
   runtime binding.

```json
{
  "type": "register_hermes_agent",
  "externalAgentId": "hermes_reviewer"
}
```

After startup or websocket reconnect, the bridge should ask Railway for pending
Hermes dispatches that were already emitted but not yet completed:

```text
GET /api/v1/bridge/runtime-dispatches/pending?externalAgentIds=hermes_reviewer
Authorization: Bearer <bridge access token>
```

The response contains `dispatches[].payload` values with the same shape as a
live `hermes.run.dispatch` websocket event. The bridge should de-duplicate by
`dispatchId`, resume any matching work when safe, and send terminal runtime
events back to ClawChat exactly once.

ClawChat sends bridge dispatches to the connected Hermes bridge for the
workspace:

```json
{
  "type": "hermes.run.dispatch",
  "data": {
    "dispatchId": "<runtime dispatch id>",
    "runtimeSessionId": "<stable ClawChat runtime session id>",
    "inputText": "User message",
    "workspaceKey": "opaque-local-repository-key",
    "model": "optional model",
    "enabledToolsets": [],
    "disabledToolsets": ["session_search"],
    "defaultSkills": ["workflow-router"],
    "timeoutMs": 1200000
  }
}
```

`defaultSkills` contains Hermes skill names, not local filesystem paths. The PC
bridge should resolve/preload those names through Hermes' configured skills
directories, for example by using `build_preloaded_skills_prompt`, and inject
the resulting prompt before the user message for the ClawChat run.

When ClawChat includes `marketplaceTools` or `availableMarketplaceTools` on a
Hermes dispatch, the bridge must register those as callable Hermes tools for
that run. Tool calls are proxied back to the Railway backend using the bridge
access token:

```text
POST /api/v1/bridge/runtime-dispatches/<dispatchId>/marketplace-tools/x/<toolName>
Authorization: Bearer <bridge access token>
```

For X, this exposes tools such as `x.getMe` / `x_get_me` and
`x.getUserTweets` / `x_get_user_tweets`. If `xUserId` is omitted for user
tweets or mentions, the backend defaults to the currently authorized X account
on the marketplace connection.

The bridge streams runtime events back over the same websocket:

```json
{
  "type": "hermes_runtime_event",
  "event": {
    "type": "run.delta",
    "dispatchId": "<runtime dispatch id>",
    "seq": 1,
    "text": "partial text"
  }
}
```

Supported event types are `run.started`, `run.delta`, `run.thinking`,
`run.tool`, `run.status`, `run.context`, `run.completed`, `run.failed`, and
`run.cancelled`. `run.completed` should include `finalText`; ClawChat persists
that text as the canonical agent reply.

## Remote Bridge Workspace Protocol

Hermes does not have a native OpenClaw-style per-agent workspace, so the bridge
owns a sandboxed ClawChat layout:

```text
agent    -> $HERMES_HOME/clawchat/agents/<externalAgentId>/workspace/
shared   -> $HERMES_HOME/clawchat/shared/
sessions -> $HERMES_HOME/clawchat/runtime_sessions/        (read-only)
project  -> bridge-local repoKey mapping                   (if configured)
```

ClawChat never sends absolute filesystem paths. The bridge resolves the opaque
repository key locally and rejects path traversal, escaped symlinks, hidden secret files,
oversized files, and raw config/auth/log files.

List:

```json
{
  "type": "hermes.workspace.list",
  "data": {
    "requestId": "uuid",
    "workspaceId": "workspace-id",
    "externalAgentId": "jeff_hermes",
    "folder": "agent",
    "path": "/",
    "filename": null
  }
}
```

Read:

```json
{
  "type": "hermes.workspace.read",
  "data": {
    "requestId": "uuid",
    "workspaceId": "workspace-id",
    "externalAgentId": "jeff_hermes",
    "folder": "agent",
    "path": "/",
    "filename": "notes.md"
  }
}
```

Write:

```json
{
  "type": "hermes.workspace.write",
  "data": {
    "requestId": "uuid",
    "workspaceId": "workspace-id",
    "externalAgentId": "jeff_hermes",
    "folder": "agent",
    "path": "/",
    "filename": "notes.md",
    "content": "new contents",
    "encoding": "utf8"
  }
}
```

Delete:

```json
{
  "type": "hermes.workspace.delete",
  "data": {
    "requestId": "uuid",
    "workspaceId": "workspace-id",
    "externalAgentId": "jeff_hermes",
    "folder": "agent",
    "path": "/",
    "filename": "notes.md"
  }
}
```

Mkdir:

```json
{
  "type": "hermes.workspace.mkdir",
  "data": {
    "requestId": "uuid",
    "workspaceId": "workspace-id",
    "externalAgentId": "jeff_hermes",
    "folder": "agent",
    "path": "/",
    "filename": "research"
  }
}
```

All operations answer with `hermes.workspace.result`:

```json
{
  "type": "hermes.workspace.result",
  "data": {
    "requestId": "uuid",
    "ok": true,
    "folder": "agent",
    "path": "/",
    "entries": [
      {
        "name": "notes.md",
        "type": "file",
        "size": 1234,
        "mtime": "2026-05-06T12:00:00Z"
      }
    ]
  }
}
```

Failures use the same response type with `ok: false`:

```json
{
  "type": "hermes.workspace.result",
  "data": {
    "requestId": "uuid",
    "ok": false,
    "error": {
      "code": "not_allowed",
      "message": "Folder is read-only"
    }
  }
}
```

Hermes agents created by the ClawChat UI now default to:

```json
{
  "runtimeType": "hermes",
  "adapterKind": "hermes_bridge",
  "routingMode": "default_target"
}
```

Local/dev HTTP worker mode remains available by creating/updating the runtime
binding with `adapterKind: "python_worker"` and configuring
`HERMES_WORKER_BASE_URL` plus `HERMES_WORKER_SHARED_SECRET` on the backend.
