# Gmail Permissions and Scopes

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

## Provider Permission Model

Relevant scopes/permissions include gmail.readonly, gmail.modify, gmail.send, gmail.compose, gmail.labels. Read-only scopes support search and summaries; modify/send scopes allow labels, drafts, replies, and send operations and require stricter approval.

## Capability Mapping

- Read capability: use Gmail `users.messages`, `users.threads`, `users.labels`, `users.history`, attachment reads, and narrow Gmail search queries with metadata/full/raw format selected intentionally.
- Draft capability: prepare exact Gmail MIME/raw payloads for `users.drafts.create`, reply/forward content with `threadId` and headers, label mutations, or watch requests without side effects.
- Write capability: send approved Gmail drafts/messages, update labels, archive/trash selected messages, and manage drafts only when OAuth scopes and approval policy allow it.
- Admin capability: Gmail push watch/stop, broad mailbox export, domain-wide delegated mailbox access, label deletion, irreversible message delete, and high-risk mailbox settings; disabled by default.
