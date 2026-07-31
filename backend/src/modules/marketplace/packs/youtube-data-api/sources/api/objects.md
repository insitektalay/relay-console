# YouTube Data API Objects

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

## Primary Objects

- videos, thumbnails, captions and video status/privacy
- channels, channel sections and subscriptions
- playlists and playlistItems
- commentThreads and comments
- liveBroadcasts and liveStreams
- search results, activities and push notification feeds

## Object-ID Discipline

- Resolve IDs from provider reads before writes.
- Include human-readable names only as context; the request target must be an official provider ID/key.
- Validate ownership/visibility boundaries for private, public, customer-facing and admin resources.
