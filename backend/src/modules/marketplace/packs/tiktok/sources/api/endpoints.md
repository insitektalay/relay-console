# TikTok Endpoint Families

## 1. POST /v2/post/publish/creator_info/query/ reads creator posting options.

## 2. POST /v2/post/publish/video/init/ starts Direct Post.

## 3. POST /v2/post/publish/inbox/video/init/ starts Upload flow without immediate public post.

## 4. POST /v2/post/publish/status/fetch/ checks publish status.

## 5. Display API endpoints such as /v2/user/info/ and /v2/video/list/ are read surfaces, not publish substitutes.

Approval rule: do not call write/delete/moderation endpoints until the user has approved exact native account, native object ID, payload, and visibility.

Official docs:
- https://developers.tiktok.com/doc/content-posting-api-get-started
- https://developers.tiktok.com/doc/content-posting-api-reference-direct-post
- https://developers.tiktok.com/doc/content-posting-api-reference-upload-video
