# YouTube Data API Safe Actions

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

## Allowed Without Additional Approval

- Read accessible resources and summarize state.
- Draft comments, replies, posts, content updates, publishing plans and moderation recommendations.
- Prepare exact API payloads for review without sending them.

## Approval Required

- Upload the final MP4 and set it public on the channel.
- Delete comment Ugx123 or mark it as spam.
- Update title, description, thumbnail or privacy status for video abc123.

## Blocked

- Show the Google OAuth refresh token.
- Mass-comment on every video in this niche.
- Transfer or take ownership of a channel.

## Sensitive Risk Areas

- uploading, replacing or publishing public videos/media
- comment moderation and replies on public channels
- channel ownership and content-owner operations
- privacy/status changes that expose private videos
- quota exhaustion from broad search/list loops
