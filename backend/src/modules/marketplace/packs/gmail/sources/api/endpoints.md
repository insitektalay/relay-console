# Gmail Endpoint Families

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

- `users.messages.list/get/send/modify/trash/untrash/delete` with `q`, `labelIds`, `format=metadata|full|raw`, and attachment retrieval.
- `users.threads.list/get/modify/trash/delete` for conversation-level context and label changes.
- `users.drafts.create/get/list/send/delete` for approval-first send workflows.
- `users.labels.list/create/update/delete` for mailbox organization.
- `users.history.list` for incremental mailbox changes after a stored `historyId`.
- `users.watch` and `users.stop` for Pub/Sub push notifications.

## Read Method Doctrine

- Search with Gmail `q` syntax, `labelIds`, and a narrow time/window limit.
- Read Gmail thread/message metadata before fetching full body, raw MIME, or attachments.
- Summarize mail without exposing tokens, auth links, or unnecessary personal data.

## Write Method Doctrine

- Create Gmail drafts before sending; include MIME headers, recipients, cc/bcc, subject, body, attachments, `In-Reply-To`/`References`, and `threadId` where replying.
- Send or reply only after target recipients, thread context, and exact content are confirmed.
- Apply labels, archive, trash, or delete only to explicitly selected Gmail message/thread ids.
