# Bluesky Authentication

AT Protocol session auth using app passwords or supported OAuth where officially enabled for the client. Resolve handle to DID and PDS before authenticated writes.

Required credential handling:
- Store tokens, app passwords, refresh tokens, client secrets, and signing secrets only in the ClawChat marketplace connection.
- Verify the native account before every write. For this pack that means: Approval must name handle and DID, PDS host, collection app.bsky.feed.post, exact text, facets, langs, embed/blob refs, reply root/parent strong refs, quote/embed target, and record URI/rkey for deletion.
- Re-authenticate or escalate on expired token, missing permission, product-access denial, account mismatch, or rate limiting.
- Never paste secrets, token responses, session cookies, app passwords, private media URLs, or webhook signing secrets into chat or generated docs.

Official docs:
- https://docs.bsky.app/docs/get-started
- https://docs.bsky.app/docs/advanced-guides/posts
- https://docs.bsky.app/docs/advanced-guides/rate-limits
