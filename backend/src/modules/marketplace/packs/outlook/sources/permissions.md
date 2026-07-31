# Outlook Permissions and Scopes

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

## Provider Permission Model

Relevant scopes/permissions include Mail.Read, Mail.ReadWrite, Mail.Send, MailboxSettings.Read, offline_access. Read-only scopes support search and summaries; modify/send scopes allow labels, drafts, replies, and send operations and require stricter approval.

## Capability Mapping

- Read capability: use Microsoft Graph mail APIs for `/me/messages`, `/me/mailFolders`, attachments, conversation metadata, `$search`, `$filter`, `$select`, and change notifications where granted.
- Draft capability: prepare exact Outlook message JSON/MIME, draft, reply, replyAll, forward, move, category/folder, attachment, or subscription payloads without side effects.
- Write capability: send approved mail with `Mail.Send`, update/move/delete selected messages with `Mail.ReadWrite`, and manage drafts only when Graph permissions and approval policy allow it.
- Admin capability: application-wide mailbox access, shared mailbox/delegated access, mailbox rules/settings, broad export, irreversible delete, and Graph subscription changes; disabled by default.
