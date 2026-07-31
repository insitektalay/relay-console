# WordPress Escalation Workflow

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://developer.wordpress.org/rest-api/
- https://developer.wordpress.org/rest-api/using-the-rest-api/authentication/
- https://developer.wordpress.org/rest-api/reference/posts/
- https://developer.wordpress.org/rest-api/reference/pages/
- https://developer.wordpress.org/rest-api/reference/media/
- https://developer.wordpress.org/rest-api/reference/comments/
- https://developer.wordpress.org/rest-api/reference/users/

## Escalate When

- The request would publish externally, export private/customer content, upload/replace media, delete content, moderate users/comments, change permissions/roles/settings/domains/webhooks, or send public/community messages.
- The provider returns auth/permission failures that require account owner action.
- The requested action matches a blocked item.

## Escalation Payload

- Provider: WordPress
- Target IDs and readable names
- Requested endpoint/method family
- Public/private/customer-facing impact
- Required scopes/permissions
- Rollback/remediation notes where available
