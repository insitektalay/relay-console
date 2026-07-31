# Pinterest Write Actions

Before calling a write endpoint, collect:
- Native account identifier and native target object ID.
- Exact text/caption/body, media references, links, accessibility text, privacy/visibility settings, reply targets, and moderation reason where applicable.
- The exact endpoint/method to call: POST /v5/pins for Pin creation, POST /v5/boards for board creation, PATCH /v5/pins/{pin_id} for Pin updates, or DELETE /v5/pins/{pin_id} for Pin deletion.
- User approval that names the account/object and payload.

Blocked: autonomous spam, mass engagement, impersonation, policy bypass, scraping/private-data export, and deletion/hiding/moderation without item-level approval.
