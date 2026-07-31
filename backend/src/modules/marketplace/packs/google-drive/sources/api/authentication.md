# Google Drive API Authentication

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://developers.google.com/drive/api/guides/about-sdk
- https://developers.google.com/drive/api/guides/about-auth
- https://developers.google.com/workspace/drive/api/guides/api-specific-auth
- https://developers.google.com/workspace/drive/api/reference/rest/v3
- https://developers.google.com/drive/api/guides/push
- https://developers.google.com/drive/api/guides/handle-errors

Google OAuth 2.0. Store access/refresh tokens only in ClawChat. Shared-drive/team-space access depends on token user, app scopes, and resource membership.

Use connector-held Google OAuth tokens for the authorized Drive user or Workspace context. Confirm granted Drive scopes such as `drive.metadata.readonly`, `drive.readonly`, `drive.file`, or broader `drive` before selecting methods. Do not infer missing Drive credentials from user text; if OAuth is expired, revoked, or missing Drive scope consent, ask the user to repair the Google connection.
