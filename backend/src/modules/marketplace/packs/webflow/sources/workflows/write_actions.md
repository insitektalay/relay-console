# Webflow Write Workflows

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://developers.webflow.com/data/reference/authentication
- https://developers.webflow.com/v2.0.0/data/reference/scopes
- https://developers.webflow.com/data/reference/cms/collection-items
- https://developers.webflow.com/data/reference/pages
- https://developers.webflow.com/data/reference/webhooks
- https://developers.webflow.com/data/v2.0.0/reference/rate-limits

## Write Workflow

1. Read current state and validate target ID, owner/account and required scope.
2. Draft the exact method, endpoint and payload.
3. Check whether the action is allowed, approval-required or blocked.
4. For approval-required actions, wait for explicit human approval that names the target and intended effect.
5. Execute once, then summarize the provider response with secrets redacted.

## Approval-Required Writes

- Update and publish CMS item item_123 on the production site.
- Upload and replace the public hero image asset.
- Add a domain or change site publish settings.
