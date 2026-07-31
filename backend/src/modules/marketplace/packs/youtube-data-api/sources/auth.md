# YouTube Data API Authentication

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

## Supported Auth Model

- API keys for public read-only data that does not require a user/channel owner
- OAuth 2 user tokens for private channel data or any insert/update/delete action

## Required Handling

- Store tokens, client secrets, API keys, application passwords and webhook URLs only as ClawChat secrets.
- Redact Authorization headers and secret-bearing URLs from logs and generated docs.
- Verify token owner/account/site/team/guild/channel before using cached IDs.
- If auth fails, debug provider grant, scopes/capabilities, token expiry/revocation and resource-level access.

## Provider Scopes Or Permissions

- https://www.googleapis.com/auth/youtube.readonly
- https://www.googleapis.com/auth/youtube.force-ssl
- https://www.googleapis.com/auth/youtube.upload
- https://www.googleapis.com/auth/youtube
- https://www.googleapis.com/auth/youtubepartner when acting for content owners
