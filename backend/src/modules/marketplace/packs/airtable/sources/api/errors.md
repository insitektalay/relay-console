# Airtable Errors and Failure Modes

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://airtable.com/developers/web/api/introduction
- https://airtable.com/developers/web/api/authentication
- https://airtable.com/developers/web/api/scopes
- https://airtable.com/developers/web/api/list-records
- https://airtable.com/developers/web/api/rate-limits
- https://airtable.com/developers/web/api/webhooks-overview
- https://airtable.com/developers/web/api/errors

Handle invalid field names, type mismatch, missing required fields, permission denied, object not found, rate limit, conflict, and validation errors.

On authentication, authorization, validation, conflict, quota, throttling, provider outage, or partial-write failures: stop, summarize the safe provider error, preserve object ids, and do not retry side-effecting writes blindly.
