# Gmail Workflow Router

Use Gmail for mailbox operations: messages, threads, drafts, labels/folders, attachments, search, send-as identities, and approved sending through provider mail APIs.

Do not use Gmail for bulk marketing, durable project tracking, source control, or sending credentials. Use the provider only for the connected mailbox/account and not for unrelated user mailboxes.

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

## Routing Doctrine

1. Confirm the connected Gmail user, OAuth scopes, mailbox label/thread/message/draft ids, send-as identity, attachment ids, and watch/history state before selecting tools.
2. Load auth, permissions, endpoint, rate-limit, webhook, error, safe-action, and workflow references before writes.
3. Resolve Gmail message ids, thread ids, draft ids, label ids, history ids, attachment ids, and `Message-ID` headers from Gmail API reads before mutating anything.
4. Draft sends/replies/forwards, attachment forwarding, label creation/deletion, message trash/delete, broad searches, watch/push changes, and security/legal/billing/customer email content for approval.
5. Record Gmail user id (`me` or delegated user), message/thread/draft/label ids, RFC 2822 headers, approval id, and safe response summaries after approved writes.

## When To Use

Use Gmail for mailbox operations: messages, threads, drafts, labels/folders, attachments, search, send-as identities, and approved sending through provider mail APIs.

## When Not To Use

Do not use Gmail for bulk marketing, durable project tracking, source control, or sending credentials. Use the provider only for the connected mailbox/account and not for unrelated user mailboxes.
