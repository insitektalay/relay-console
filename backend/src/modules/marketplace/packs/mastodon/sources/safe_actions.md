# Mastodon Safe Actions

## Safe reads
Read only the authorized objects needed for the task: Accounts, statuses, timelines, notifications, media attachments, scheduled statuses, favourites, boosts/reblogs, bookmarks, reports, instance rules, federation-visible URLs.

## Safe drafts
Draft content, captions, replies, moderation recommendations, and publish plans without calling write endpoints.

## Approval-gated writes
Approval must name instance, account, status text, visibility public/unlisted/private/direct, in_reply_to_id, media_ids, spoiler_text/content warning, sensitive flag, language, and Idempotency-Key for creates where used.

## Blocked or strongly gated
Federation amplification, public vs unlisted/private/direct visibility mistakes, content warning/sensitive-media omissions, instance rule violations, direct visibility mistaken for encrypted DMs, boosts/favourites as endorsement, and admin moderation overreach.

## Social safety hard blocks
- Do not autonomously spam post, bulk publish, or run campaign posting without explicit approval.
- Do not mass DM, follow, like, repost, vote, comment, or reply for engagement manipulation.
- Do not impersonate people/brands or bypass platform policies, app review, access tiers, rate limits, or community rules.
- Do not post externally without approval that names the native account/object and exact payload.
- Do not scrape, export, or infer private data outside the documented API permissions.
- Do not delete, hide, remove, ban, restrict, or otherwise moderate/administer content without item-level approval.
