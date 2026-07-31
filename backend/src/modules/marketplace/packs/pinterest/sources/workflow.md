# Pinterest Marketplace Workflow

Use this pack only for Pinterest-native workflows backed by official provider APIs. Resolve the native account/object first, read current state, draft the action, then require explicit approval before any external write.

## Provider doctrine
- Auth: Pinterest API v5 OAuth 2.0. Request minimum read/write scopes and validate the authenticated user account, board ID, section ID, and media source before writes.
- Permissions/scopes: boards:read, boards:write, pins:read, pins:write, user_accounts:read, analytics:read, plus secret-board variants only when explicitly needed.
- Object model: User accounts, boards, board sections, Pins, Pin media/source types, analytics, organic content. Ads/catalog objects are distinct and not part of organic Pin publishing unless separately approved.
- Publishing rules: Approval must name board ID, board section ID if any, Pin title, description, link, alt text, media source type, dominant media URL/file reference, and whether the board is public or secret.
- Community/moderation risks: Wrong board/secret board, copyright or affiliate disclosures, spammy duplicate Pins, ads-vs-organic confusion, unapproved board deletion, and private-data export from followers/account analytics.

## Social safety hard blocks
- Do not autonomously spam post, bulk publish, or run campaign posting without explicit approval.
- Do not mass DM, follow, like, repost, vote, comment, or reply for engagement manipulation.
- Do not impersonate people/brands or bypass platform policies, app review, access tiers, rate limits, or community rules.
- Do not post externally without approval that names the native account/object and exact payload.
- Do not scrape, export, or infer private data outside the documented API permissions.
- Do not delete, hide, remove, ban, restrict, or otherwise moderate/administer content without item-level approval.

## Official docs
- https://developers.pinterest.com/docs/getting-started/set-up-authentication-and-authorization/
- https://developers.pinterest.com/docs/work-with-organic-content-and-users/create-boards-and-pins/
- https://developers.pinterest.com/docs/reference/rate-limits/
