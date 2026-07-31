# Threads Safe Actions

## Safe reads
Read only the authorized objects needed for the task: Threads user/profile, text/image/video/carousel media containers, published Threads media, replies, reply controls, insights.

## Safe drafts
Draft content, captions, replies, moderation recommendations, and publish plans without calling write endpoints.

## Approval-gated writes
Approval must name Threads user ID, container ID, exact text, media URL(s), reply target if any, reply control settings, and whether it is a reply or root post. Threads DMs/private messages are not a normal Threads API capability here.

## Blocked or strongly gated
False DM capability, cross-post spam, automated replies, wrong profile, impersonation, policy bypass, repeated hashtag/engagement manipulation, and deleting/hiding replies without review.

## Social safety hard blocks
- Do not autonomously spam post, bulk publish, or run campaign posting without explicit approval.
- Do not mass DM, follow, like, repost, vote, comment, or reply for engagement manipulation.
- Do not impersonate people/brands or bypass platform policies, app review, access tiers, rate limits, or community rules.
- Do not post externally without approval that names the native account/object and exact payload.
- Do not scrape, export, or infer private data outside the documented API permissions.
- Do not delete, hide, remove, ban, restrict, or otherwise moderate/administer content without item-level approval.
