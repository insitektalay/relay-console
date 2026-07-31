# Bluesky Write Actions

Before calling a write endpoint, collect:
- Native account identifier and native target object ID.
- Exact text/caption/body, media references, links, accessibility text, privacy/visibility settings, reply targets, and moderation reason where applicable.
- The exact endpoint/method to call: POST /xrpc/com.atproto.repo.createRecord for app.bsky.feed.post writes, POST /xrpc/com.atproto.repo.deleteRecord for deletions, or POST /xrpc/com.atproto.repo.uploadBlob before embedding media.
- User approval that names the account/object and payload.

Blocked: autonomous spam, mass engagement, impersonation, policy bypass, scraping/private-data export, and deletion/hiding/moderation without item-level approval.
