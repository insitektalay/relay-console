# Gmail API Authentication

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://developers.google.com/gmail/api/guides
- https://developers.google.com/gmail/api/auth/about-auth
- https://developers.google.com/workspace/gmail/api/auth/scopes
- https://developers.google.com/workspace/gmail/api/reference/rest
- https://developers.google.com/gmail/api/guides/push
- https://developers.google.com/workspace/gmail/api/guides/handle-errors

Google OAuth 2.0. Access tokens and refresh tokens are stored only in ClawChat. Mailbox APIs require consented delegated or application permissions depending on provider and tenant policy.

Use connector-held Google OAuth access/refresh tokens for the authorized Gmail user. Confirm granted Gmail scopes such as `gmail.readonly`, `gmail.metadata`, `gmail.modify`, `gmail.compose`, `gmail.send`, or `mail.google.com` before selecting read/write methods. Do not infer missing Gmail credentials from user text; if OAuth is expired, revoked, or missing a required Gmail scope, ask the user to repair the Google connection.
