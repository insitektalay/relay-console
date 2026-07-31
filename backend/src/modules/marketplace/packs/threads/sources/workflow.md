# Threads Marketplace Workflow

Use this pack only for Threads-native workflows backed by official provider APIs. Resolve the native account/object first, read current state, draft the action, then require explicit approval before any external write.

## Provider doctrine
- Auth: Threads API OAuth/token model for a Threads user. Store long-lived tokens only in the connection vault and validate the Threads user/profile before reads or writes.
- Permissions/scopes: threads_basic, threads_content_publish, threads_manage_replies, threads_read_replies, threads_manage_insights where approved and available to the app.
- Object model: Threads user/profile, text/image/video/carousel media containers, published Threads media, replies, reply controls, insights.
- Publishing rules: Approval must name Threads user ID, container ID, exact text, media URL(s), reply target if any, reply control settings, and whether it is a reply or root post. Threads DMs/private messages are not a normal Threads API capability here.
- Community/moderation risks: False DM capability, cross-post spam, automated replies, wrong profile, impersonation, policy bypass, repeated hashtag/engagement manipulation, and deleting/hiding replies without review.

## Social safety hard blocks
- Do not autonomously spam post, bulk publish, or run campaign posting without explicit approval.
- Do not mass DM, follow, like, repost, vote, comment, or reply for engagement manipulation.
- Do not impersonate people/brands or bypass platform policies, app review, access tiers, rate limits, or community rules.
- Do not post externally without approval that names the native account/object and exact payload.
- Do not scrape, export, or infer private data outside the documented API permissions.
- Do not delete, hide, remove, ban, restrict, or otherwise moderate/administer content without item-level approval.

## Official docs
- https://developers.facebook.com/docs/threads/
- https://developers.facebook.com/docs/threads/get-started
- https://developers.facebook.com/docs/threads/threads-media
