# Reddit API Overview

Auth model: Reddit OAuth 2.0 using oauth.reddit.com with a descriptive User-Agent and refresh tokens only when approved. Validate authenticated redditor, subreddit, moderator status, and subreddit rules before writes.

Object model: Subreddits, posts/links with t3_ fullnames, comments with t1_ fullnames, messages, flairs, subreddit rules/sidebar/wiki, modqueue, reports, modlog, scheduled posts.

Endpoint families:
- POST /api/submit submits a link/self post to a subreddit after approval.
- POST /api/comment comments on a t3_ post or replies to a t1_ comment after approval.
- POST /api/editusertext edits a post/comment body after approval.
- POST /api/del deletes a post/comment after approval.
- Moderator endpoints for modqueue, reports, removals, flair, rules, and wiki require moderator scopes and subreddit role validation.

Rate limits/quotas: Reddit exposes rate-limit information through OAuth response headers such as X-Ratelimit-Used, X-Ratelimit-Remaining, and X-Ratelimit-Reset. Treat 429/403/quarantine/rule errors as stop conditions and avoid fixed universal quota claims.

Events/webhooks: Classic Reddit API is primarily request/response and polling. Devvit apps have separate event/runtime capabilities; do not conflate Devvit with classic OAuth API endpoints.

Official docs:
- https://www.reddit.com/dev/api/
- https://github.com/reddit-archive/reddit/wiki/OAuth2
- https://developers.reddit.com/docs/
