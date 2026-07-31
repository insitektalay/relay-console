# Railway Errors and Failure Modes

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://docs.railway.com/reference/public-api
- https://docs.railway.com/reference/public-api#authentication
- https://docs.railway.com/guides/public-api
- https://docs.railway.com/guides/webhooks
- https://docs.railway.com/reference/errors

Handle auth failures, permission denied, not found, validation errors, conflict, rate limit, build/deployment failure, and provider outage errors.

On authentication, authorization, validation, conflict, quota, throttling, provider outage, or partial-write failures: stop, summarize the safe provider error, preserve object ids, and do not retry side-effecting writes blindly.
