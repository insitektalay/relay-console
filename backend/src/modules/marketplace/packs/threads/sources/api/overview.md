# Threads API Overview

Auth model: Threads API OAuth/token model for a Threads user. Store long-lived tokens only in the connection vault and validate the Threads user/profile before reads or writes.

Object model: Threads user/profile, text/image/video/carousel media containers, published Threads media, replies, reply controls, insights.

Endpoint families:
- POST /{threads-user-id}/threads creates text or media containers.
- GET /{threads-container-id}?fields=status,error_message checks publishing status.
- POST /{threads-user-id}/threads_publish publishes a finished container after approval.
- GET /{threads-user-id}/threads and GET /{threads-media-id}/replies read owned content/replies where permitted.
- Insights endpoints read metrics where the insights permission and account eligibility allow it.

Rate limits/quotas: Threads API limits are product and endpoint specific. The pack must honor documented response headers, container processing status, and publish limits; do not retry container publish loops without backoff.

Events/webhooks: Threads event support must be limited to documented Meta/Threads callback surfaces available to the app. If not configured, use bounded polling for owned media/replies only.

Official docs:
- https://developers.facebook.com/docs/threads/
- https://developers.facebook.com/docs/threads/get-started
- https://developers.facebook.com/docs/threads/threads-media
