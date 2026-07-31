# TikTok Safe Actions

## Safe reads
Read only the authorized objects needed for the task: Creator account, creator_info, privacy_level_options, video source, upload URL, publish_id, post status, duet/comment/stitch toggles, branded_content and ai_generated_content flags.

## Safe drafts
Draft content, captions, replies, moderation recommendations, and publish plans without calling write endpoints.

## Approval-gated writes
Approval must name TikTok account, video file/source URL, title/caption, privacy_level, disable_duet, disable_comment, disable_stitch, brand_content_toggle, brand_organic_toggle, and ai_generated_content flag.

## Blocked or strongly gated
Unaudited-client restrictions, private-mode limits, branded content disclosures, AI-generated content labeling, music/rights, wrong privacy level, mass posting, and unsupported comments/DM automation.

## Social safety hard blocks
- Do not autonomously spam post, bulk publish, or run campaign posting without explicit approval.
- Do not mass DM, follow, like, repost, vote, comment, or reply for engagement manipulation.
- Do not impersonate people/brands or bypass platform policies, app review, access tiers, rate limits, or community rules.
- Do not post externally without approval that names the native account/object and exact payload.
- Do not scrape, export, or infer private data outside the documented API permissions.
- Do not delete, hide, remove, ban, restrict, or otherwise moderate/administer content without item-level approval.
