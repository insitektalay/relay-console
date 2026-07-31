# Reddit API Authentication

Reddit OAuth 2.0 using oauth.reddit.com with a descriptive User-Agent and refresh tokens only when approved. Validate authenticated redditor, subreddit, moderator status, and subreddit rules before writes.

Permission/scopes model:
- identity, read, submit, edit, flair, modposts, modconfig, modflair, modlog, privatemessages, report, wikiread, wikiedit as needed for the requested workflow.

Token validation rules:
- Confirm the token maps to the intended native account/object before writes.
- Stop on missing scope/product access/product-access denial instead of attempting fallback behavior.
- Use the least privileged permission set for the workflow.

Official docs:
- https://www.reddit.com/dev/api/
- https://github.com/reddit-archive/reddit/wiki/OAuth2
- https://developers.reddit.com/docs/
