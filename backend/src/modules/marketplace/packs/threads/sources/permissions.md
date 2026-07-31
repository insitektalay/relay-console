# Threads Permissions

Provider-specific permission model:
- threads_basic, threads_content_publish, threads_manage_replies, threads_read_replies, threads_manage_insights where approved and available to the app.

Allowed without approval:
- Bounded reads of authorized Threads objects: Threads user/profile, text/image/video/carousel media containers, published Threads media, replies, reply controls, insights.
- Drafting candidate text, captions, replies, moderation notes, and summaries without sending them.

Approval required:
- Any public post, reply, comment, media publish, message send, reaction, follow, repost/share, native object change, or moderation action supported by Threads.
- Bulk or scheduled publishing, repeated engagement, campaign actions, or changes to connected account/app permissions.
- Deleting, hiding, removing, restricting, banning, locking, editing, or otherwise changing existing provider state.

## Social safety hard blocks
- Do not autonomously spam post, bulk publish, or run campaign posting without explicit approval.
- Do not mass DM, follow, like, repost, vote, comment, or reply for engagement manipulation.
- Do not impersonate people/brands or bypass platform policies, app review, access tiers, rate limits, or community rules.
- Do not post externally without approval that names the native account/object and exact payload.
- Do not scrape, export, or infer private data outside the documented API permissions.
- Do not delete, hide, remove, ban, restrict, or otherwise moderate/administer content without item-level approval.
