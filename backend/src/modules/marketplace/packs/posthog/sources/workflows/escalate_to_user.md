# PostHog Escalation

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

Escalate when PostHog API keys are missing, token/project permissions are insufficient, project/resource identifiers or query filters are ambiguous, the operation is approval-required, the request touches persons/events/session replays or API keys, PostHog returns conflicting flag/cohort/destination state, or official docs do not cover the requested action.

## Approval-Required Patterns

- Feature-flag rollout or variant changes, cohort rule/membership changes, person/event exports, dashboard public sharing, CDP destination/webhook changes, project setting changes, project deletion, and bulk updates require approval.

## Blocked Patterns

- Exposing PostHog personal/project API keys, exporting unbounded persons/events/session replays, deleting a project without a destructive approval path, disabling privacy/security controls, unapproved production flag changes, and broad raw-data exports are blocked.
