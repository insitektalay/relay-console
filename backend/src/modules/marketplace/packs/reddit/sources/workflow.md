# Reddit Marketplace Workflow

Use this pack only for Reddit-native workflows backed by official provider APIs. Resolve the native account/object first, read current state, draft the action, then require explicit approval before any external write.

## Provider doctrine
- Auth: Reddit OAuth 2.0 using oauth.reddit.com with a descriptive User-Agent and refresh tokens only when approved. Validate authenticated redditor, subreddit, moderator status, and subreddit rules before writes.
- Permissions/scopes: identity, read, submit, edit, flair, modposts, modconfig, modflair, modlog, privatemessages, report, wikiread, wikiedit as needed for the requested workflow.
- Object model: Subreddits, posts/links with t3_ fullnames, comments with t1_ fullnames, messages, flairs, subreddit rules/sidebar/wiki, modqueue, reports, modlog, scheduled posts.
- Publishing rules: Approval must name subreddit, post kind, title, URL or selftext markdown, flair ID/text, NSFW/spoiler settings, reply parent fullname, and rule check result. Moderation actions need item fullname and reason.
- Community/moderation risks: Brigading, spam, karma manipulation, vote automation, subreddit rule violations, wrong community, private-message abuse, moderator overreach, removals/bans without reason, and scraping private data.

## Social safety hard blocks
- Do not autonomously spam post, bulk publish, or run campaign posting without explicit approval.
- Do not mass DM, follow, like, repost, vote, comment, or reply for engagement manipulation.
- Do not impersonate people/brands or bypass platform policies, app review, access tiers, rate limits, or community rules.
- Do not post externally without approval that names the native account/object and exact payload.
- Do not scrape, export, or infer private data outside the documented API permissions.
- Do not delete, hide, remove, ban, restrict, or otherwise moderate/administer content without item-level approval.

## Official docs
- https://www.reddit.com/dev/api/
- https://github.com/reddit-archive/reddit/wiki/OAuth2
- https://developers.reddit.com/docs/
