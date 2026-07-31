# Webflow API Overview

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

## Provider Object Model

- sites, workspaces and authorization info
- pages, page content and custom code
- collections, CMS fields and collection items
- assets in the Webflow asset manager
- forms and form submissions
- domains, site configuration and publish targets
- webhooks and trigger types

## Endpoint Families

- Sites and Pages: Resolve site/page IDs and distinguish staging from production before writes.
- Collections and Items: CMS writes can affect live pages after publishing; validate field schema first.
- Assets: Asset uploads and replacements require approval when public pages may reference them.
- Forms: Treat submissions as personal data and summarize by default.
- Publishing and Site Config: Publishing, domains and site settings are high-impact.
- Webhooks: Webhook create/delete changes event delivery and requires approval.
