# Figma Escalation Workflow

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

## Escalate When

- The request would publish externally, export private/customer content, upload/replace media, delete content, moderate users/comments, change permissions/roles/settings/domains/webhooks, or send public/community messages.
- The provider returns auth/permission failures that require account owner action.
- The requested action matches a blocked item.

## Escalation Payload

- Provider: Figma
- Target IDs and readable names
- Requested endpoint/method family
- Public/private/customer-facing impact
- Required scopes/permissions
- Rollback/remediation notes where available
