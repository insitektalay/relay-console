# Figma Write Workflows

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

## Write Workflow

1. Read current state and validate target ID, owner/account and required scope.
2. Draft the exact method, endpoint and payload.
3. Check whether the action is allowed, approval-required or blocked.
4. For approval-required actions, wait for explicit human approval that names the target and intended effect.
5. Execute once, then summarize the provider response with secrets redacted.

## Approval-Required Writes

- Post this approved reply to comment 456 in file ABC123.
- Export the private launch frames from file ABC123 to PNG and attach them to the campaign ticket.
- Create a file webhook for project 987 that sends events to the approved ClawChat webhook URL.
