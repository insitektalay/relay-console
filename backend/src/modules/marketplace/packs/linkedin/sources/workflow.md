# LinkedIn Marketplace Workflow

Use this pack only for LinkedIn-native workflows backed by official provider APIs. Resolve the native account/object first, read current state, draft the action, then require explicit approval before any external write.

## Provider doctrine
- Auth: LinkedIn OAuth 2.0 with approved Community Management or Marketing products. Validate member identity, organization URN, admin role, and product access before organization writes.
- Permissions/scopes: w_member_social, r_member_social, w_organization_social, r_organization_social, rw_organization_admin as needed for member/organization publishing and admin validation.
- Object model: Person URNs, organization URNs, posts, commentary, lifecycleState, visibility, media assets, social actions, comments, likes, analytics where product access allows.
- Publishing rules: Approval must include author URN, whether member or organization, exact commentary, visibility, lifecycleState, media asset URNs, target audience, and admin role proof for organizations.
- Community/moderation risks: Posting as wrong organization, unauthorized employee advocacy, undisclosed sponsorship/recruiting claims, comment manipulation, mass liking/commenting, and changing organization settings without approval.

## Social safety hard blocks
- Do not autonomously spam post, bulk publish, or run campaign posting without explicit approval.
- Do not mass DM, follow, like, repost, vote, comment, or reply for engagement manipulation.
- Do not impersonate people/brands or bypass platform policies, app review, access tiers, rate limits, or community rules.
- Do not post externally without approval that names the native account/object and exact payload.
- Do not scrape, export, or infer private data outside the documented API permissions.
- Do not delete, hide, remove, ban, restrict, or otherwise moderate/administer content without item-level approval.

## Official docs
- https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api
- https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow
- https://learn.microsoft.com/en-us/linkedin/shared/api-guide/concepts/protocol-version
