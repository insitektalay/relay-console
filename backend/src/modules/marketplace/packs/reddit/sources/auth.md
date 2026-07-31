# Reddit Authentication

Reddit OAuth 2.0 using oauth.reddit.com with a descriptive User-Agent and refresh tokens only when approved. Validate authenticated redditor, subreddit, moderator status, and subreddit rules before writes.

Required credential handling:
- Store tokens, app passwords, refresh tokens, client secrets, and signing secrets only in the ClawChat marketplace connection.
- Verify the native account before every write. For this pack that means: Approval must name subreddit, post kind, title, URL or selftext markdown, flair ID/text, NSFW/spoiler settings, reply parent fullname, and rule check result. Moderation actions need item fullname and reason.
- Re-authenticate or escalate on expired token, missing permission, product-access denial, account mismatch, or rate limiting.
- Never paste secrets, token responses, session cookies, app passwords, private media URLs, or webhook signing secrets into chat or generated docs.

Official docs:
- https://www.reddit.com/dev/api/
- https://github.com/reddit-archive/reddit/wiki/OAuth2
- https://developers.reddit.com/docs/
