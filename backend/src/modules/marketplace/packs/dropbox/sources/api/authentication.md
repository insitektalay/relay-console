# Dropbox API Authentication

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://www.dropbox.com/developers/documentation/http/overview
- https://www.dropbox.com/developers/reference/oauth-guide
- https://developers.dropbox.com/oauth-guide#scopes
- https://www.dropbox.com/developers/documentation/http/documentation
- https://www.dropbox.com/developers/reference/webhooks

OAuth 2.0 access and refresh tokens. Store access/refresh tokens only in ClawChat. Shared-drive/team-space access depends on token user, app scopes, and resource membership.

Use connector-held Dropbox OAuth access/refresh tokens with the target account, team, and namespace context. Confirm scopes such as `files.metadata.read`, `files.content.read`, `files.content.write`, `sharing.read`, `sharing.write`, and team scopes where required. Do not infer missing Dropbox credentials from user text; if OAuth is expired, revoked, or missing scopes, ask the user to repair the Dropbox connection.
