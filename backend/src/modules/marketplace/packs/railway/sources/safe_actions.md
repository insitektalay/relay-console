# Railway Safe Actions

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Allowed Without Additional Approval

- Resolve Railway workspace id, project id, environment id, service id, deployment id, variable name/key, custom-domain id/name, and webhook id before querying.
- Inspect current service deployment status, environment configuration, custom domain state, variable metadata, plugin/resource status, and webhook subscription before proposing action.
- Limit logs/events to the requested deployment/service/time window and redact tokens, variable values, build secrets, source snippets, and private project metadata.

## Approval Required

- Production deployments, service restarts, variable/secret changes, custom-domain changes, webhook changes, plugin/resource changes, project/service deletes, and bulk project updates require approval.

## Blocked

- Exposing Railway API tokens or variable values, deleting a project/service without a destructive approval path, disabling security/protection controls, unapproved production changes, and broad source/log exports are blocked.

## Secret-Safety Rule

Provider secrets and credential-shaped values must never appear in responses, generated files, examples, audit notes, or provider-side comments/messages.
