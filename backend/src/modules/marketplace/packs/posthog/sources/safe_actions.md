# PostHog Safe Actions

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Allowed Without Additional Approval

- Resolve PostHog project id, region/host, insight id, dashboard id, cohort id, feature-flag key/id, event name, person distinct id, group key, session/replay id, and CDP destination/webhook id before querying.
- Inspect current feature-flag filters/rollout, cohort definition, insight query, dashboard sharing state, event/person filters, project privacy settings, and destination/webhook configuration before proposing action.
- Limit event/person/session reads to requested filters, properties, and time windows; redact API keys, distinct ids where not needed, emails, IPs, session URLs, and other PII.

## Approval Required

- Feature-flag rollout or variant changes, cohort rule/membership changes, person/event exports, dashboard public sharing, CDP destination/webhook changes, project setting changes, project deletion, and bulk updates require approval.

## Blocked

- Exposing PostHog personal/project API keys, exporting unbounded persons/events/session replays, deleting a project without a destructive approval path, disabling privacy/security controls, unapproved production flag changes, and broad raw-data exports are blocked.

## Secret-Safety Rule

Provider secrets and credential-shaped values must never appear in responses, generated files, examples, audit notes, or provider-side comments/messages.
