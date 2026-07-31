# TikTok API Authentication

TikTok OAuth/Login Kit with Content Posting API product access. Validate creator identity, creator_info, account privacy options, and app audit status before uploads or Direct Post.

Permission/scopes model:
- video.publish for Direct Post, video.upload for Upload-to-Inbox flow, user.info.basic for creator identity/readiness.

Token validation rules:
- Confirm the token maps to the intended native account/object before writes.
- Stop on missing scope/product access/product-access denial instead of attempting fallback behavior.
- Use the least privileged permission set for the workflow.

Official docs:
- https://developers.tiktok.com/doc/content-posting-api-get-started
- https://developers.tiktok.com/doc/content-posting-api-reference-direct-post
- https://developers.tiktok.com/doc/content-posting-api-reference-upload-video
