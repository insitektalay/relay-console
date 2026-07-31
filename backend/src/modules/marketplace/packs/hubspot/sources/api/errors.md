# HubSpot Errors and Failure Modes

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

Official docs: https://developers.hubspot.com/docs/api/error-handling

Handle `401`/`403` auth and scope failures, validation errors for invalid properties or option values, missing/archived records, duplicate records, association-type errors, batch partial failures, conflict/stale state, `429` rate limits, and `5xx` provider outages.

On write failure, stop, preserve object ids and the safe error category, avoid blind retries, and do not retry side-effecting batch operations without fresh approval.
