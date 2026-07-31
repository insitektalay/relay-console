# Trello Errors and Failure Modes

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://developer.atlassian.com/cloud/trello/rest/
- https://developer.atlassian.com/cloud/trello/guides/rest-api/authorization/
- https://developer.atlassian.com/cloud/trello/guides/rest-api/rate-limits/
- https://developer.atlassian.com/cloud/trello/guides/rest-api/webhooks/
- https://developer.atlassian.com/cloud/trello/rest/api-group-cards/

Handle invalid ids, unknown workflow state, permission denied, validation errors, conflict, rate limits, and provider outages.

On authentication, authorization, validation, conflict, quota, throttling, provider outage, or partial-write failures: stop, summarize the safe provider error, preserve object ids, and do not retry side-effecting writes blindly.
