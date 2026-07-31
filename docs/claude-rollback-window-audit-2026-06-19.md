# Claude Rollback Window Audit - 2026-06-19

## Status

Rollback window remains open.

LOOP-0030 intentionally did not remove Claude legacy tables, legacy entities,
`AgentEntity.claudeBinding`, Claude-specific bridge callback behavior, or
deprecated DTO compatibility for `claudeBinding`.

The generic runtime domain is now the preferred runtime architecture, but local
repo evidence does not prove the production-like parity and stability required
to close the Claude rollback window safely.

## Closure Criteria Review

| Criterion | Local evidence reviewed | 2026-06-19 conclusion |
| --- | --- | --- |
| New Claude dispatches are created exclusively through generic runtime orchestration. | `ClaudeService` mirrors legacy Claude dispatches into generic runtime dispatches, and the Claude runtime adapter still identifies compatibility mode as `claude_bridge_callbacks`. | Not proven. Generic runtime state exists, but compatibility mode remains active. |
| Claude dispatch/session state in generic runtime tables is complete and trusted operationally. | Runtime binding, session, dispatch, health, and operator-overview support now exists. Legacy `claude_*` tables are still mirrored and backfilled into runtime tables. | Not proven operationally from local evidence alone. |
| Claude bridge callbacks are no longer required to update legacy `claude_*` state for rollback. | `bridge.controller.ts` still routes posted Claude dispatch messages through `ClaudeService.attachPostedMessage`, and `ClaudeService` continues to mirror legacy state. | False for closure purposes. Legacy callback compatibility remains live. |
| Thread archive, wrap-up, and member-removal flows operate correctly through generic runtime closure in production-like usage. | Generic lifecycle code exists, but this audit did not have deployed production-like Claude flow evidence or a stability-period record. | Not proven. |
| Claude final message posting, failure handling, timeout handling, and stale-dispatch reconciliation are proven through the generic path. | `ClaudeService` mirrors completed and failed legacy dispatches into generic runtime dispatches and exposes runtime payloads for events. | Not proven as generic-only. Compatibility mirroring still matters. |
| A real rollback exercise is no longer needed because the generic path survived the agreed stability window. | No repo evidence defines the stability window or records a completed production rollback exercise. | Not proven. |
| No active callers depend on public/shared `claudeBinding`, backend DTO `claudeBinding`, or Claude-specific callback-only semantics. | `CreateAgentDto` and `UpdateAgentDto` still accept deprecated `claudeBinding`; `AgentService.resolveClaudeRuntimeInput` still accepts it; Claude-specific callback behavior remains documented. | Not proven. Deprecated compatibility remains intentionally supported. |

## Compatibility Paths Still Present

- `backend/src/entities/claude-agent-binding.entity.ts`
- `backend/src/entities/claude-thread-session.entity.ts`
- `backend/src/entities/claude-dispatch.entity.ts`
- `backend/src/entities/agent.entity.ts` via `AgentEntity.claudeBinding`
- `backend/src/modules/agent/dto/agent.dto.ts` via deprecated `claudeBinding`
  input
- `backend/src/modules/agent/agent.service.ts` via
  `resolveClaudeRuntimeInput`
- `backend/src/modules/claude/claude.service.ts` via legacy-to-generic
  mirroring and backfill
- `backend/src/modules/claude/claude-code-runtime.adapter.ts` via
  `claude_bridge_callbacks` compatibility mode
- `backend/src/modules/bridge/bridge.controller.ts` via Claude-specific
  posted-message completion behavior

## Decision

Do not close the Claude rollback window from local evidence alone.

No removal was performed because doing so would delete rollback safety and live
compatibility before the documented closure criteria have been proven. The next
safe step is evidence collection, not legacy deletion.

## Required Evidence Before Removal

- Define the agreed stability window for Claude generic-runtime operation.
- Verify production-like Claude dispatch creation, progress events, final
  message posting, failure handling, timeout handling, stale-dispatch
  reconciliation, cancel behavior, thread archive, wrap-up, and member-removal
  flows.
- Confirm deployed operator data shows Claude generic runtime tables are
  complete and trusted without relying on legacy `claude_*` tables.
- Confirm no supported caller sends `claudeBinding` or depends on
  Claude-specific callback-only semantics.
- Record that a real rollback exercise is either completed or no longer needed
  after the agreed stability window.
- Only then plan a migration/removal pass for legacy Claude tables, legacy
  entities, `AgentEntity.claudeBinding`, Claude-specific bridge callback
  endpoints, and deprecated DTO support.
