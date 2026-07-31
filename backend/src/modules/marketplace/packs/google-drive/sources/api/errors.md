# Google Drive Errors and Failure Modes

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://developers.google.com/drive/api/guides/about-sdk
- https://developers.google.com/drive/api/guides/about-auth
- https://developers.google.com/workspace/drive/api/guides/api-specific-auth
- https://developers.google.com/workspace/drive/api/reference/rest/v3
- https://developers.google.com/drive/api/guides/push
- https://developers.google.com/drive/api/guides/handle-errors

Handle not_found, insufficient permissions, rate limit, conflict, quota exceeded, file too large, malware/export limitations, and provider outage errors.

On authentication, authorization, validation, conflict, quota, throttling, provider outage, or partial-write failures: stop, summarize the safe provider error, preserve object ids, and do not retry side-effecting writes blindly.
