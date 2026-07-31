# LinkedIn Safe Actions

## Safe reads
Read only the authorized objects needed for the task: Person URNs, organization URNs, posts, commentary, lifecycleState, visibility, media assets, social actions, comments, likes, analytics where product access allows.

## Safe drafts
Draft content, captions, replies, moderation recommendations, and publish plans without calling write endpoints.

## Approval-gated writes
Approval must include author URN, whether member or organization, exact commentary, visibility, lifecycleState, media asset URNs, target audience, and admin role proof for organizations.

## Blocked or strongly gated
Posting as wrong organization, unauthorized employee advocacy, undisclosed sponsorship/recruiting claims, comment manipulation, mass liking/commenting, and changing organization settings without approval.

## Social safety hard blocks
- Do not autonomously spam post, bulk publish, or run campaign posting without explicit approval.
- Do not mass DM, follow, like, repost, vote, comment, or reply for engagement manipulation.
- Do not impersonate people/brands or bypass platform policies, app review, access tiers, rate limits, or community rules.
- Do not post externally without approval that names the native account/object and exact payload.
- Do not scrape, export, or infer private data outside the documented API permissions.
- Do not delete, hide, remove, ban, restrict, or otherwise moderate/administer content without item-level approval.
