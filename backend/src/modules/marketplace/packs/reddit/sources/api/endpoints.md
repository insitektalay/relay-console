# Reddit Endpoint Families

## 1. POST /api/submit submits a link/self post to a subreddit after approval.

## 2. POST /api/comment comments on a t3_ post or replies to a t1_ comment after approval.

## 3. POST /api/editusertext edits a post/comment body after approval.

## 4. POST /api/del deletes a post/comment after approval.

## 5. Moderator endpoints for modqueue, reports, removals, flair, rules, and wiki require moderator scopes and subreddit role validation.

Approval rule: do not call write/delete/moderation endpoints until the user has approved exact native account, native object ID, payload, and visibility.

Official docs:
- https://www.reddit.com/dev/api/
- https://github.com/reddit-archive/reddit/wiki/OAuth2
- https://developers.reddit.com/docs/
