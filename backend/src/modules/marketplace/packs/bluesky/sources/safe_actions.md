# Bluesky Safe Actions

## Safe reads
Read only the authorized objects needed for the task: DIDs, handles, PDS repositories, repo records, app.bsky.feed.post records, strong refs with uri/cid, facets for mentions/links/tags, embeds/images/blobs, feeds, profiles, labels, moderation reports.

## Safe drafts
Draft content, captions, replies, moderation recommendations, and publish plans without calling write endpoints.

## Approval-gated writes
Approval must name handle and DID, PDS host, collection app.bsky.feed.post, exact text, facets, langs, embed/blob refs, reply root/parent strong refs, quote/embed target, and record URI/rkey for deletion.

## Blocked or strongly gated
Wrong DID/PDS, app-password exposure, public federation, quote/reply misreferences, label/moderation bypass, bulk follows/likes, deletion of the wrong record, and scraping/exporting private account data.

## Social safety hard blocks
- Do not autonomously spam post, bulk publish, or run campaign posting without explicit approval.
- Do not mass DM, follow, like, repost, vote, comment, or reply for engagement manipulation.
- Do not impersonate people/brands or bypass platform policies, access tiers, rate limits, or community rules.
- Do not post externally without approval that names the native account/object and exact payload.
- Do not scrape, export, or infer private data outside the documented API permissions.
- Do not delete, hide, remove, ban, restrict, or otherwise moderate/administer content without item-level approval.
