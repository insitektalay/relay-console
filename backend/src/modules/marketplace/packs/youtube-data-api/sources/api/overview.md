# YouTube Data API API Overview

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

## Provider Object Model

- videos, thumbnails, captions and video status/privacy
- channels, channel sections and subscriptions
- playlists and playlistItems
- commentThreads and comments
- liveBroadcasts and liveStreams
- search results, activities and push notification feeds

## Endpoint Families

- Videos and Thumbnails: Video updates, uploads, deletes, thumbnails and privacy/status changes require approval.
- Channels and Subscriptions: Channel owner data requires OAuth; ownership/admin changes are blocked.
- Playlists and Items: Playlist writes affect public channel organization and require approval.
- Comments: Replies and moderation can be public/customer-facing.
- Captions and Live: Caption uploads/deletes and liveBroadcast/liveStream operations are high-impact.
- Push Notifications: Use PubSubHubbub instead of polling channel feeds.
