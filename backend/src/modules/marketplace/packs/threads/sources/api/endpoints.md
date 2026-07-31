# Threads Endpoint Families

## 1. POST /{threads-user-id}/threads creates text or media containers.

## 2. GET /{threads-container-id}?fields=status,error_message checks publishing status.

## 3. POST /{threads-user-id}/threads_publish publishes a finished container after approval.

## 4. GET /{threads-user-id}/threads and GET /{threads-media-id}/replies read owned content/replies where permitted.

## 5. Insights endpoints read metrics where the insights permission and account eligibility allow it.

Approval rule: do not call write/delete/moderation endpoints until the user has approved exact native account, native object ID, payload, and visibility.

Official docs:
- https://developers.facebook.com/docs/threads/
- https://developers.facebook.com/docs/threads/get-started
- https://developers.facebook.com/docs/threads/threads-media
