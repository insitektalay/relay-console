# Vercel Safe Actions

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Allowed Without Additional Approval

- Resolve the Vercel team id or slug, project id/name, deployment id/URL, domain, alias, environment-variable name/id, and webhook id before querying.
- Inspect current deployment state, project configuration, domain/DNS status, alias target, env-var metadata, access role, and webhook subscription before proposing action.
- Limit build logs and deployment events to the requested deployment and time window; redact tokens, env-var values, source snippets, and private project metadata.

## Approval Required

- Production deployment promotion/redeployment, domain or alias changes, environment-variable create/update/delete, webhook changes, team/member role changes, project deletion, protection changes, and bulk project updates require approval.

## Blocked

- Exposing Vercel tokens or env-var values, deleting a project/team without an explicit destructive approval path, disabling protection/security controls, unapproved production changes, and broad source/build-log exports are blocked.

## Secret-Safety Rule

Provider secrets and credential-shaped values must never appear in responses, generated files, examples, audit notes, or provider-side comments/messages.
