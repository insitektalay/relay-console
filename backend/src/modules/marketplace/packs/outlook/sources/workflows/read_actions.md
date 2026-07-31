# Outlook Read Workflows

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

- Search with Microsoft Graph `$search`/`$filter`, folder, and narrow time/window limits.
- Read thread/message metadata before fetching full body or attachments.
- Summarize mail without exposing tokens, auth links, or unnecessary personal data.

Always use explicit Microsoft Graph message ids, conversation ids, mailFolder ids, attachment ids, subscription ids, or narrow `$search`/`$filter` queries. Summaries must redact secrets, auth links, one-time codes, and unnecessary personal, customer, financial, security, source-code, or private mailbox data.
