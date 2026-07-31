# Mastodon Write Actions

Before calling a write endpoint, collect:
- Native account identifier and native target object ID.
- Exact text/caption/body, media references, links, accessibility text, privacy/visibility settings, reply targets, and moderation reason where applicable.
- The exact endpoint/method to call: POST /api/v1/statuses for status/reply creation, PUT /api/v1/statuses/:id for edits, or DELETE /api/v1/statuses/:id for deletion.
- User approval that names the account/object and payload.

Blocked: autonomous spam, mass engagement, impersonation, policy bypass, scraping/private-data export, and deletion/hiding/moderation without item-level approval.
