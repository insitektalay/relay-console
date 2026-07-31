# Pinterest Safe Actions

## Safe reads
Read only the authorized objects needed for the task: User accounts, boards, board sections, Pins, Pin media/source types, analytics, organic content. Ads/catalog objects are distinct and not part of organic Pin publishing unless separately approved.

## Safe drafts
Draft content, captions, replies, moderation recommendations, and publish plans without calling write endpoints.

## Approval-gated writes
Approval must name board ID, board section ID if any, Pin title, description, link, alt text, media source type, dominant media URL/file reference, and whether the board is public or secret.

## Blocked or strongly gated
Wrong board/secret board, copyright or affiliate disclosures, spammy duplicate Pins, ads-vs-organic confusion, unapproved board deletion, and private-data export from followers/account analytics.

## Social safety hard blocks
- Do not autonomously spam post, bulk publish, or run campaign posting without explicit approval.
- Do not mass DM, follow, like, repost, vote, comment, or reply for engagement manipulation.
- Do not impersonate people/brands or bypass platform policies, app review, access tiers, rate limits, or community rules.
- Do not post externally without approval that names the native account/object and exact payload.
- Do not scrape, export, or infer private data outside the documented API permissions.
- Do not delete, hide, remove, ban, restrict, or otherwise moderate/administer content without item-level approval.
