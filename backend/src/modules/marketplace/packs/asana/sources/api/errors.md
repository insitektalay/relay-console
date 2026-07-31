# Asana Errors and Failure Modes

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://developers.asana.com/docs
- https://developers.asana.com/docs/authentication
- https://developers.asana.com/docs/oauth
- https://developers.asana.com/reference/rest-api-reference
- https://developers.asana.com/docs/webhooks-guide
- https://developers.asana.com/docs/rate-limits
- https://developers.asana.com/docs/errors

Handle invalid ids, unknown workflow state, permission denied, validation errors, conflict, rate limits, and provider outages.

On authentication, authorization, validation, conflict, quota, throttling, provider outage, or partial-write failures: stop, summarize the safe provider error, preserve object ids, and do not retry side-effecting writes blindly.
