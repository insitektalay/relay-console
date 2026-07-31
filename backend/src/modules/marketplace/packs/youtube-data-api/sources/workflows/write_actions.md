# YouTube Data API Write Workflows

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

## Write Workflow

1. Read current state and validate target ID, owner/account and required scope.
2. Draft the exact method, endpoint and payload.
3. Check whether the action is allowed, approval-required or blocked.
4. For approval-required actions, wait for explicit human approval that names the target and intended effect.
5. Execute once, then summarize the provider response with secrets redacted.

## Approval-Required Writes

- Upload the final MP4 and set it public on the channel.
- Delete comment Ugx123 or mark it as spam.
- Update title, description, thumbnail or privacy status for video abc123.
