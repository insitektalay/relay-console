# Jira API Authentication

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://developer.atlassian.com/cloud/jira/platform/rest/v3/intro/
- https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps/
- https://developer.atlassian.com/platform/forge/manifest-reference/scopes-product-jira/
- https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/
- https://developer.atlassian.com/cloud/jira/platform/rate-limiting/
- https://developer.atlassian.com/cloud/jira/platform/webhooks/

Atlassian OAuth 2.0 or API token. Tokens stay in ClawChat and inherit workspace/project access.

Use connector-held Atlassian OAuth 2.0 tokens or API-token/basic credentials for the authorized Jira Cloud site. Confirm Jira product scopes such as issue, project, comment, worklog, and webhook read/write scopes plus project permissions before selecting methods. Do not infer missing Jira credentials from user text; if site authorization, scopes, or project permission is insufficient, ask the user to repair the Atlassian connection.
