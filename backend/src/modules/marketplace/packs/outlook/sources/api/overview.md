# Outlook API Overview

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

## Provider Object Model

- Mailbox user/account
- Message with headers, body, snippets, attachments, labels/folders, internet message id
- Thread/conversation
- Draft
- Label or mailFolder
- Attachment
- History/change notification resource

## Endpoint/Method Families

- /me/messages
- /me/mailFolders
- /me/sendMail
- /me/messages/{id}/reply
- /me/messages/{id}/move
- /me/messages/{id}/attachments
