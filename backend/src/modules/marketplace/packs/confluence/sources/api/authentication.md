# Confluence API Authentication

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://developer.atlassian.com/cloud/confluence/rest/v2/intro/
- https://developer.atlassian.com/cloud/confluence/oauth-2-3lo-apps/
- https://developer.atlassian.com/platform/forge/manifest-reference/scopes-product-confluence/
- https://developer.atlassian.com/cloud/confluence/rest/v2/api-group-page/
- https://developer.atlassian.com/cloud/confluence/rate-limiting/
- https://developer.atlassian.com/cloud/confluence/modules/webhook/

Atlassian OAuth 2.0 or API token. Tokens remain in ClawChat connections and are constrained by workspace/base/doc sharing and provider permissions.

Use connector-held Atlassian OAuth 2.0 tokens or API-token/basic credentials for the authorized Confluence Cloud site. Confirm Confluence product scopes for spaces, pages, attachments, comments, labels, and webhooks plus space/page permissions before selecting methods. Do not infer missing Confluence credentials from user text; if site authorization, scopes, or space permission is insufficient, ask the user to repair the Atlassian connection.
