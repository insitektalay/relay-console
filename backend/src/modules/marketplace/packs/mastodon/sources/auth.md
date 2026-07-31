# Mastodon Authentication

Instance-specific OAuth. Discover/register the app against the target instance, request granular scopes, and validate the account and instance rules before reads or writes.

Required credential handling:
- Store tokens, app passwords, refresh tokens, client secrets, and signing secrets only in the ClawChat marketplace connection.
- Verify the native account before every write. For this pack that means: Approval must name instance, account, status text, visibility public/unlisted/private/direct, in_reply_to_id, media_ids, spoiler_text/content warning, sensitive flag, language, and Idempotency-Key for creates where used.
- Re-authenticate or escalate on expired token, missing permission, product-access denial, account mismatch, or rate limiting.
- Never paste secrets, token responses, session cookies, app passwords, private media URLs, or webhook signing secrets into chat or generated docs.

Official docs:
- https://docs.joinmastodon.org/api/oauth-scopes/
- https://docs.joinmastodon.org/methods/statuses/
- https://docs.joinmastodon.org/api/rate-limits/
