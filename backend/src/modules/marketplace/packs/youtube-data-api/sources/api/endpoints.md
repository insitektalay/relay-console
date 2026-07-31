# YouTube Data API Endpoints

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

## Representative Endpoints

- GET /youtube/v3/videos, channels, search, playlists, playlistItems
- POST/PUT/DELETE /youtube/v3/videos and videos.rate/reportAbuse where scoped
- POST /upload/youtube/v3/videos for uploads
- GET/POST/PUT/DELETE /youtube/v3/commentThreads and comments
- GET/POST/PUT/DELETE /youtube/v3/captions and thumbnails.set
- GET/POST/PUT/DELETE /youtube/v3/liveBroadcasts and liveStreams

## Method Guidance

- GET/list endpoints are preferred for discovery and summaries.
- POST/PATCH/PUT/DELETE endpoints are side-effecting and must pass capability, permission and approval checks.
- For publish/export/moderation/admin endpoints, include exact target IDs and a rollback or remediation note where the provider supports one.
