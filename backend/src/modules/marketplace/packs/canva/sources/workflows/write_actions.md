# Canva Write Workflows

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

## Write Workflow

1. Read current state and validate target ID, owner/account and required scope.
2. Draft the exact method, endpoint and payload.
3. Check whether the action is allowed, approval-required or blocked.
4. For approval-required actions, wait for explicit human approval that names the target and intended effect.
5. Execute once, then summarize the provider response with secrets redacted.

## Approval-Required Writes

- Export design DAFabc123 as PDF for external client review.
- Upload the approved hero image into Canva assets.
- Move a design into a shared brand folder or change folder permissions.
