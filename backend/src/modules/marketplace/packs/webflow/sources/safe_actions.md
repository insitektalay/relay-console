# Webflow Safe Actions

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://developers.webflow.com/data/reference/authentication
- https://developers.webflow.com/v2.0.0/data/reference/scopes
- https://developers.webflow.com/data/reference/cms/collection-items
- https://developers.webflow.com/data/reference/pages
- https://developers.webflow.com/data/reference/webhooks
- https://developers.webflow.com/data/v2.0.0/reference/rate-limits

## Allowed Without Additional Approval

- Read accessible resources and summarize state.
- Draft comments, replies, posts, content updates, publishing plans and moderation recommendations.
- Prepare exact API payloads for review without sending them.

## Approval Required

- Update and publish CMS item item_123 on the production site.
- Upload and replace the public hero image asset.
- Add a domain or change site publish settings.

## Blocked

- Publish the site without showing me the changes.
- Delete every CMS item in this collection.
- Expose the Webflow site token or OAuth secret.

## Sensitive Risk Areas

- publishing to production instead of staging
- CMS item updates changing live pages
- domain/site configuration changes
- asset replacement affecting public pages
- form data containing personal information
