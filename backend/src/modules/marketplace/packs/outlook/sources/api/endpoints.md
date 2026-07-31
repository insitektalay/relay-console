# Outlook Endpoint Families

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

- `GET /me/messages` and `GET /me/messages/{id}` with `$select`, `$filter`, `$search`, `$top`, and paging.
- `GET /me/mailFolders`, child folders, and messages within folders.
- `POST /me/sendMail`, message create/update draft, and draft send flows.
- `POST /me/messages/{id}/reply`, `replyAll`, `forward`, and `move`.
- `GET /me/messages/{id}/attachments` and attachment download metadata/content.
- Microsoft Graph change notification subscription endpoints for Outlook mail resources.

## Read Method Doctrine

- Search with Microsoft Graph `$search`/`$filter`, folder, and narrow time/window limits.
- Read Outlook message metadata before fetching full body or attachments.
- Summarize mail without exposing tokens, auth links, or unnecessary personal data.

## Write Method Doctrine

- Create Outlook/Graph drafts before sending; include recipients, cc/bcc, subject, body content type, attachments, and conversation/message reply identifiers.
- Send, reply, replyAll, or forward only after target recipients and content are confirmed.
- Move, delete, categorize, or update only explicitly selected Graph message ids.
