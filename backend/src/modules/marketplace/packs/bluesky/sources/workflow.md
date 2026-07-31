# Bluesky Marketplace Workflow

Use this pack only for Bluesky-native workflows backed by official provider APIs. Resolve the native account/object first, read current state, draft the action, then require explicit approval before any external write.

## Provider doctrine
- Auth: AT Protocol session auth using app passwords or supported OAuth where officially enabled for the client. Resolve handle to DID and PDS before authenticated writes.
- Permissions/scopes: Bluesky app-password/session auth does not use OAuth scopes in the classic sense. The pack must document DID, handle, PDS, accessJwt/refreshJwt, and supported OAuth only when the app is configured for it.
- Object model: DIDs, handles, PDS repositories, repo records, app.bsky.feed.post records, strong refs with uri/cid, facets for mentions/links/tags, embeds/images/blobs, feeds, profiles, labels, moderation reports.
- Publishing rules: Approval must name handle and DID, PDS host, collection app.bsky.feed.post, exact text, facets, langs, embed/blob refs, reply root/parent strong refs, quote/embed target, and record URI/rkey for deletion.
- Community/moderation risks: Wrong DID/PDS, app-password exposure, public federation, quote/reply misreferences, label/moderation bypass, bulk follows/likes, deletion of the wrong record, and scraping/exporting private account data.

## Social safety hard blocks
- Do not autonomously spam post, bulk publish, or run campaign posting without explicit approval.
- Do not mass DM, follow, like, repost, vote, comment, or reply for engagement manipulation.
- Do not impersonate people/brands or bypass platform policies, access tiers, rate limits, or community rules.
- Do not post externally without approval that names the native account/object and exact payload.
- Do not scrape, export, or infer private data outside the documented API permissions.
- Do not delete, hide, remove, ban, restrict, or otherwise moderate/administer content without item-level approval.

## Official docs
- https://docs.bsky.app/docs/get-started
- https://docs.bsky.app/docs/advanced-guides/posts
- https://docs.bsky.app/docs/advanced-guides/rate-limits
