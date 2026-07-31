# YouTube Data API Errors

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://developers.google.com/youtube/v3/getting-started
- https://developers.google.com/youtube/v3/guides/authentication
- https://developers.google.com/youtube/v3/docs/videos/list
- https://developers.google.com/youtube/v3/docs/errors
- https://developers.google.com/youtube/v3/guides/push_notifications
- https://developers.google.com/youtube/v3/guides/implementation/partial

## Failure Modes

- 403 insufficientPermissions means the OAuth token lacks required scope.
- 403 quotaExceeded means quota is exhausted.
- 400 incompatibleParameters, missingRequiredParameter or invalidValue means request shape is invalid.
- 401 invalidCredentials means token/key is missing, expired or invalid.

## Response Discipline

- Stop on auth, permission or ownership failures and ask for corrected access.
- Do not retry destructive or publishing calls blindly.
- Record provider error code/status and redacted request target in the audit summary.
