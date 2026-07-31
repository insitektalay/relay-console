# Reddit Safe Actions

## Safe reads
Read only the authorized objects needed for the task: Subreddits, posts/links with t3_ fullnames, comments with t1_ fullnames, messages, flairs, subreddit rules/sidebar/wiki, modqueue, reports, modlog, scheduled posts.

## Safe drafts
Draft content, captions, replies, moderation recommendations, and publish plans without calling write endpoints.

## Approval-gated writes
Approval must name subreddit, post kind, title, URL or selftext markdown, flair ID/text, NSFW/spoiler settings, reply parent fullname, and rule check result. Moderation actions need item fullname and reason.

## Blocked or strongly gated
Brigading, spam, karma manipulation, vote automation, subreddit rule violations, wrong community, private-message abuse, moderator overreach, removals/bans without reason, and scraping private data.

## Social safety hard blocks
- Do not autonomously spam post, bulk publish, or run campaign posting without explicit approval.
- Do not mass DM, follow, like, repost, vote, comment, or reply for engagement manipulation.
- Do not impersonate people/brands or bypass platform policies, app review, access tiers, rate limits, or community rules.
- Do not post externally without approval that names the native account/object and exact payload.
- Do not scrape, export, or infer private data outside the documented API permissions.
- Do not delete, hide, remove, ban, restrict, or otherwise moderate/administer content without item-level approval.
