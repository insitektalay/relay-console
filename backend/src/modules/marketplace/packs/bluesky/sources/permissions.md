# Bluesky Permissions

Provider-specific permission model:
- Bluesky app-password/session auth does not use OAuth scopes in the classic sense. The pack must document DID, handle, PDS, accessJwt/refreshJwt, and supported OAuth only when the app is configured for it.

Allowed without approval:
- Bounded reads of authorized Bluesky objects: DIDs, handles, PDS repositories, repo records, app.bsky.feed.post records, strong refs with uri/cid, facets for mentions/links/tags, embeds/images/blobs, feeds, profiles, labels, moderation reports.
- Drafting candidate text, captions, replies, moderation notes, and summaries without sending them.

Approval required:
- Any public post, reply, comment, media publish, message send, reaction, follow, repost/share, native object change, or moderation action supported by Bluesky.
- Bulk or scheduled publishing, repeated engagement, campaign actions, or changes to connected account/app permissions.
- Deleting, hiding, removing, restricting, banning, locking, editing, or otherwise changing existing provider state.

## Social safety hard blocks
- Do not autonomously spam post, bulk publish, or run campaign posting without explicit approval.
- Do not mass DM, follow, like, repost, vote, comment, or reply for engagement manipulation.
- Do not impersonate people/brands or bypass platform policies, access tiers, rate limits, or community rules.
- Do not post externally without approval that names the native account/object and exact payload.
- Do not scrape, export, or infer private data outside the documented API permissions.
- Do not delete, hide, remove, ban, restrict, or otherwise moderate/administer content without item-level approval.
