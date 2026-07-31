# Canva Errors

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://www.canva.dev/docs/connect/
- https://www.canva.dev/docs/connect/authentication/
- https://www.canva.dev/docs/connect/appendix/scopes/
- https://www.canva.dev/docs/connect/canva-concepts/
- https://www.canva.dev/docs/connect/api-reference/exports/create-design-export-job/
- https://www.canva.dev/docs/connect/webhooks/

## Failure Modes

- 401/403 means missing OAuth grant, missing explicit scope, or account/team restrictions.
- 400 often means an unsupported export type, malformed design id, invalid folder id or upload metadata issue.
- Async export or upload jobs can fail after acceptance; inspect job status and error detail.

## Response Discipline

- Stop on auth, permission or ownership failures and ask for corrected access.
- Do not retry destructive or publishing calls blindly.
- Record provider error code/status and redacted request target in the audit summary.
