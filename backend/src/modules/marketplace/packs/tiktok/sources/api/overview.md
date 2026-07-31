# TikTok API Overview

Auth model: TikTok OAuth/Login Kit with Content Posting API product access. Validate creator identity, creator_info, account privacy options, and app audit status before uploads or Direct Post.

Object model: Creator account, creator_info, privacy_level_options, video source, upload URL, publish_id, post status, duet/comment/stitch toggles, branded_content and ai_generated_content flags.

Endpoint families:
- POST /v2/post/publish/creator_info/query/ reads creator posting options.
- POST /v2/post/publish/video/init/ starts Direct Post.
- POST /v2/post/publish/inbox/video/init/ starts Upload flow without immediate public post.
- POST /v2/post/publish/status/fetch/ checks publish status.
- Display API endpoints such as /v2/user/info/ and /v2/video/list/ are read surfaces, not publish substitutes.

Rate limits/quotas: TikTok documents a Direct Post daily rate limit of 6 requests per minute and 20 successful posts per day per user for video Direct Post; upload/inbox flows can hit daily upload caps and 429 rate_limit_exceeded. Respect creator_info privacy_level_options.

Events/webhooks: Content Posting workflows use status fetch/polling unless the app has documented callback support. Do not invent comment, DM, or moderation webhooks.

Official docs:
- https://developers.tiktok.com/doc/content-posting-api-get-started
- https://developers.tiktok.com/doc/content-posting-api-reference-direct-post
- https://developers.tiktok.com/doc/content-posting-api-reference-upload-video
