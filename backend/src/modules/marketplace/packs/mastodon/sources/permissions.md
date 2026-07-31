# Mastodon Permissions

Provider-specific permission model:
- profile, read, read:statuses, read:notifications, write, write:statuses, write:media, write:follows, write:reports, admin:read:reports, admin:write:reports when moderation access is explicitly approved.

Allowed without approval:
- Bounded reads of authorized Mastodon objects: Accounts, statuses, timelines, notifications, media attachments, scheduled statuses, favourites, boosts/reblogs, bookmarks, reports, instance rules, federation-visible URLs.
- Drafting candidate text, captions, replies, moderation notes, and summaries without sending them.

Approval required:
- Any public post, reply, comment, media publish, message send, reaction, follow, repost/share, native object change, or moderation action supported by Mastodon.
- Bulk or scheduled publishing, repeated engagement, campaign actions, or changes to connected account/app permissions.
- Deleting, hiding, removing, restricting, banning, locking, editing, or otherwise changing existing provider state.

## Social safety hard blocks
- Do not autonomously spam post, bulk publish, or run campaign posting without explicit approval.
- Do not mass DM, follow, like, repost, vote, comment, or reply for engagement manipulation.
- Do not impersonate people/brands or bypass platform policies, app review, access tiers, rate limits, or community rules.
- Do not post externally without approval that names the native account/object and exact payload.
- Do not scrape, export, or infer private data outside the documented API permissions.
- Do not delete, hide, remove, ban, restrict, or otherwise moderate/administer content without item-level approval.
