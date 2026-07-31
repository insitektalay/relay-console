# YouTube Data API API Authentication

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

## Authentication Families

- API keys for public read-only data that does not require a user/channel owner
- OAuth 2 user tokens for private channel data or any insert/update/delete action

## Scopes, Grants And Capabilities

- https://www.googleapis.com/auth/youtube.readonly
- https://www.googleapis.com/auth/youtube.force-ssl
- https://www.googleapis.com/auth/youtube.upload
- https://www.googleapis.com/auth/youtube
- https://www.googleapis.com/auth/youtubepartner when acting for content owners

## Secret Safety

- Do not put secrets in generated OpenClaw or Hermes outputs.
- Do not include bearer tokens, API keys, bot tokens, application passwords, webhook URLs with tokens, client secrets or refresh tokens in examples.
- When showing examples, use placeholder IDs and redacted headers.
