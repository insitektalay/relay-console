# TikTok Authentication

TikTok OAuth/Login Kit with Content Posting API product access. Validate creator identity, creator_info, account privacy options, and app audit status before uploads or Direct Post.

Required credential handling:
- Store tokens, app passwords, refresh tokens, client secrets, and signing secrets only in the ClawChat marketplace connection.
- Verify the native account before every write. For this pack that means: Approval must name TikTok account, video file/source URL, title/caption, privacy_level, disable_duet, disable_comment, disable_stitch, brand_content_toggle, brand_organic_toggle, and ai_generated_content flag.
- Re-authenticate or escalate on expired token, missing permission, product-access denial, account mismatch, or rate limiting.
- Never paste secrets, token responses, session cookies, app passwords, private media URLs, or webhook signing secrets into chat or generated docs.

Official docs:
- https://developers.tiktok.com/doc/content-posting-api-get-started
- https://developers.tiktok.com/doc/content-posting-api-reference-direct-post
- https://developers.tiktok.com/doc/content-posting-api-reference-upload-video
