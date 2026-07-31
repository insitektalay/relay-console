# Canva Escalation Workflow

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

## Escalate When

- The request would publish externally, export private/customer content, upload/replace media, delete content, moderate users/comments, change permissions/roles/settings/domains/webhooks, or send public/community messages.
- The provider returns auth/permission failures that require account owner action.
- The requested action matches a blocked item.

## Escalation Payload

- Provider: Canva
- Target IDs and readable names
- Requested endpoint/method family
- Public/private/customer-facing impact
- Required scopes/permissions
- Rollback/remediation notes where available
