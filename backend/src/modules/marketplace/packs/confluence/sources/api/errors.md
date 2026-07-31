# Confluence Errors and Failure Modes

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

Handle invalid page ids, body representation errors, missing version numbers, permission denied, object not found, rate limit, version conflict, and validation errors.

On authentication, authorization, validation, conflict, quota, throttling, provider outage, or partial-write failures: stop, summarize the safe provider error, preserve object ids, and do not retry side-effecting writes blindly.
