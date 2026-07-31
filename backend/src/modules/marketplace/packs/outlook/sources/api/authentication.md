# Outlook API Authentication

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://learn.microsoft.com/en-us/graph/outlook-mail-concept-overview
- https://learn.microsoft.com/en-us/graph/auth/
- https://learn.microsoft.com/en-us/graph/permissions-reference
- https://learn.microsoft.com/en-us/graph/api/resources/mail-api-overview
- https://learn.microsoft.com/en-us/graph/change-notifications-overview
- https://learn.microsoft.com/en-us/graph/throttling
- https://learn.microsoft.com/en-us/graph/errors

Microsoft identity platform OAuth through Microsoft Graph. Access tokens and refresh tokens are stored only in ClawChat. Mailbox APIs require consented delegated or application permissions depending on provider and tenant policy.

Use connector-held Microsoft identity platform OAuth tokens for Microsoft Graph. Confirm delegated/application context and granted permissions such as `Mail.Read`, `Mail.ReadWrite`, `Mail.Send`, `MailboxSettings.Read`, or change-notification permissions before selecting methods. Do not infer missing Outlook credentials from user text; if OAuth is expired, revoked, tenant-blocked, or missing permission consent, ask the user to repair the Microsoft connection.
