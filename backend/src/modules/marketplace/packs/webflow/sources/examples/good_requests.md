# Webflow Good Request Examples

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

## Good Requests

- List Webflow CMS items in collection blog_posts that are staged but not published.
- Summarize recent form submissions without exporting raw personal data.
- Draft title and slug changes for page About, but do not publish.

## Why These Are Good

- They identify a bounded target.
- They favor reads, summaries or drafts.
- They do not expose secrets or create unapproved external side effects.
