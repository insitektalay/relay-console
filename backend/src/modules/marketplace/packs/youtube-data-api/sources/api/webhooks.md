# YouTube Data API Webhooks And Events

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

## Provider Events

- YouTube Data API supports push notifications through PubSubHubbub for channel video upload, title update and description update events.
- Subscriptions use the Google hub with a callback URL and topic https://www.youtube.com/feeds/videos.xml?channel_id=CHANNEL_ID.

## Safety Rules

- Creating, changing or deleting webhook subscriptions requires approval.
- Validate signatures/secrets where the provider supports them.
- Redact webhook URLs, signing secrets and delivery payload secrets.
- Dedupe retries and avoid sending private payloads to unapproved external destinations.
