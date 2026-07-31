# TikTok Marketplace Workflow

Use this pack only for TikTok-native workflows backed by official provider APIs. Resolve the native account/object first, read current state, draft the action, then require explicit approval before any external write.

## Provider doctrine
- Auth: TikTok OAuth/Login Kit with Content Posting API product access. Validate creator identity, creator_info, account privacy options, and app audit status before uploads or Direct Post.
- Permissions/scopes: video.publish for Direct Post, video.upload for Upload-to-Inbox flow, user.info.basic for creator identity/readiness.
- Object model: Creator account, creator_info, privacy_level_options, video source, upload URL, publish_id, post status, duet/comment/stitch toggles, branded_content and ai_generated_content flags.
- Publishing rules: Approval must name TikTok account, video file/source URL, title/caption, privacy_level, disable_duet, disable_comment, disable_stitch, brand_content_toggle, brand_organic_toggle, and ai_generated_content flag.
- Community/moderation risks: Unaudited-client restrictions, private-mode limits, branded content disclosures, AI-generated content labeling, music/rights, wrong privacy level, mass posting, and unsupported comments/DM automation.

## Social safety hard blocks
- Do not autonomously spam post, bulk publish, or run campaign posting without explicit approval.
- Do not mass DM, follow, like, repost, vote, comment, or reply for engagement manipulation.
- Do not impersonate people/brands or bypass platform policies, app review, access tiers, rate limits, or community rules.
- Do not post externally without approval that names the native account/object and exact payload.
- Do not scrape, export, or infer private data outside the documented API permissions.
- Do not delete, hide, remove, ban, restrict, or otherwise moderate/administer content without item-level approval.

## Official docs
- https://developers.tiktok.com/doc/content-posting-api-get-started
- https://developers.tiktok.com/doc/content-posting-api-reference-direct-post
- https://developers.tiktok.com/doc/content-posting-api-reference-upload-video
