# YouTube Data API Permissions

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

## Provider Permission Model

- https://www.googleapis.com/auth/youtube.readonly
- https://www.googleapis.com/auth/youtube.force-ssl
- https://www.googleapis.com/auth/youtube.upload
- https://www.googleapis.com/auth/youtube
- https://www.googleapis.com/auth/youtubepartner when acting for content owners

## Resource Boundaries

- videos, thumbnails, captions and video status/privacy
- channels, channel sections and subscriptions
- playlists and playlistItems
- commentThreads and comments
- liveBroadcasts and liveStreams
- search results, activities and push notification feeds

## Safe Permission Checks

- Confirm read access before exports, uploads, moderation, publishing or webhook changes.
- Confirm the token/user/bot has the exact write/admin capability required by the endpoint.
- Treat missing access and 404 responses as possible permission boundaries, not as a reason to bypass controls.
