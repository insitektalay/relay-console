# Mastodon Marketplace Workflow

Use this pack only for Mastodon-native workflows backed by official provider APIs. Resolve the native account/object first, read current state, draft the action, then require explicit approval before any external write.

## Provider doctrine
- Auth: Instance-specific OAuth. Discover/register the app against the target instance, request granular scopes, and validate the account and instance rules before reads or writes.
- Permissions/scopes: profile, read, read:statuses, read:notifications, write, write:statuses, write:media, write:follows, write:reports, admin:read:reports, admin:write:reports when moderation access is explicitly approved.
- Object model: Accounts, statuses, timelines, notifications, media attachments, scheduled statuses, favourites, boosts/reblogs, bookmarks, reports, instance rules, federation-visible URLs.
- Publishing rules: Approval must name instance, account, status text, visibility public/unlisted/private/direct, in_reply_to_id, media_ids, spoiler_text/content warning, sensitive flag, language, and Idempotency-Key for creates where used.
- Community/moderation risks: Federation amplification, public vs unlisted/private/direct visibility mistakes, content warning/sensitive-media omissions, instance rule violations, direct visibility mistaken for encrypted DMs, boosts/favourites as endorsement, and admin moderation overreach.

## Social safety hard blocks
- Do not autonomously spam post, bulk publish, or run campaign posting without explicit approval.
- Do not mass DM, follow, like, repost, vote, comment, or reply for engagement manipulation.
- Do not impersonate people/brands or bypass platform policies, app review, access tiers, rate limits, or community rules.
- Do not post externally without approval that names the native account/object and exact payload.
- Do not scrape, export, or infer private data outside the documented API permissions.
- Do not delete, hide, remove, ban, restrict, or otherwise moderate/administer content without item-level approval.

## Official docs
- https://docs.joinmastodon.org/api/oauth-scopes/
- https://docs.joinmastodon.org/methods/statuses/
- https://docs.joinmastodon.org/api/rate-limits/
