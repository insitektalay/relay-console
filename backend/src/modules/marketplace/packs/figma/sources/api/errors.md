# Figma Errors

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://developers.figma.com/docs/rest-api/
- https://developers.figma.com/docs/rest-api/authentication/
- https://developers.figma.com/docs/rest-api/scopes/
- https://developers.figma.com/docs/rest-api/file-endpoints/
- https://developers.figma.com/docs/rest-api/webhooks/
- https://developers.figma.com/docs/rest-api/rate-limits/

## Failure Modes

- 401/403 usually means an invalid token, missing scope, expired OAuth grant, or file not shared with the authenticated user.
- 404 can mean the file key/node id does not exist or the caller lacks access.
- Export URLs are temporary and should not be stored as durable assets.

## Response Discipline

- Stop on auth, permission or ownership failures and ask for corrected access.
- Do not retry destructive or publishing calls blindly.
- Record provider error code/status and redacted request target in the audit summary.
