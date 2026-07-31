# Jira Errors and Failure Modes

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

Handle invalid ids, unknown workflow state, permission denied, validation errors, conflict, rate limits, and provider outages.

On authentication, authorization, validation, conflict, quota, throttling, provider outage, or partial-write failures: stop, summarize the safe provider error, preserve object ids, and do not retry side-effecting writes blindly.
