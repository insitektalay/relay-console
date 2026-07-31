# Railway Escalation

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

Escalate when the Railway API token is missing, workspace/project/environment/service identifiers are ambiguous, the GraphQL mutation is approval-required, the request touches variables/secrets or production deployments, Railway returns conflicting deployment or domain state, or official Railway docs do not cover the requested action.

## Approval-Required Patterns

- Production deployments, service restarts, variable/secret changes, custom-domain changes, webhook changes, plugin/resource changes, project/service deletes, and bulk project updates require approval.

## Blocked Patterns

- Exposing Railway API tokens or variable values, deleting a project/service without a destructive approval path, disabling security/protection controls, unapproved production changes, and broad source/log exports are blocked.
