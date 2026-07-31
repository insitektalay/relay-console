# Outlook Workflow Router

Use Outlook for mailbox operations: messages, threads, drafts, labels/folders, attachments, search, send-as identities, and approved sending through provider mail APIs.

Do not use Outlook for bulk marketing, durable project tracking, source control, or sending credentials. Use the provider only for the connected mailbox/account and not for unrelated user mailboxes.

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

## Routing Doctrine

1. Confirm the connected Microsoft tenant, mailbox user, Graph OAuth scopes, message/conversation/mailFolder ids, send-as context, attachment ids, and change-notification subscription before selecting tools.
2. Load auth, permissions, endpoint, rate-limit, webhook, error, safe-action, and workflow references before writes.
3. Resolve provider object identifiers from read APIs before mutating anything.
4. Draft external, destructive, production, billing, publishing, permission, webhook, and bulk operations for approval.
3. Resolve Microsoft Graph message ids, conversation ids, mailFolder ids, draft ids, attachment ids, internetMessageId values, and subscription ids from Outlook/Graph reads before mutating anything.
4. Draft sends/replies/forwards, attachment forwarding, folder moves, message delete, broad searches, mailbox rule/settings changes, and Graph change-notification subscriptions for approval.
5. Record Outlook mailbox/user id, Graph message/conversation/folder/draft/subscription ids, approval id, and safe response summaries after approved writes.

## When To Use

Use Outlook for mailbox operations: messages, threads, drafts, labels/folders, attachments, search, send-as identities, and approved sending through provider mail APIs.

## When Not To Use

Do not use Outlook for bulk marketing, durable project tracking, source control, or sending credentials. Use the provider only for the connected mailbox/account and not for unrelated user mailboxes.
