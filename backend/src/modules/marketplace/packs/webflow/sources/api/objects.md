# Webflow Objects

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

## Primary Objects

- sites, workspaces and authorization info
- pages, page content and custom code
- collections, CMS fields and collection items
- assets in the Webflow asset manager
- forms and form submissions
- domains, site configuration and publish targets
- webhooks and trigger types

## Object-ID Discipline

- Resolve IDs from provider reads before writes.
- Include human-readable names only as context; the request target must be an official provider ID/key.
- Validate ownership/visibility boundaries for private, public, customer-facing and admin resources.
