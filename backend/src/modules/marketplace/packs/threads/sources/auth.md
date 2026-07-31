# Threads Authentication

Threads API OAuth/token model for a Threads user. Store long-lived tokens only in the connection vault and validate the Threads user/profile before reads or writes.

Required credential handling:
- Store tokens, app passwords, refresh tokens, client secrets, and signing secrets only in the ClawChat marketplace connection.
- Verify the native account before every write. For this pack that means: Approval must name Threads user ID, container ID, exact text, media URL(s), reply target if any, reply control settings, and whether it is a reply or root post. Threads DMs/private messages are not a normal Threads API capability here.
- Re-authenticate or escalate on expired token, missing permission, product-access denial, account mismatch, or rate limiting.
- Never paste secrets, token responses, session cookies, app passwords, private media URLs, or webhook signing secrets into chat or generated docs.

Official docs:
- https://developers.facebook.com/docs/threads/
- https://developers.facebook.com/docs/threads/get-started
- https://developers.facebook.com/docs/threads/threads-media
