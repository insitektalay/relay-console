# Webflow Permissions

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

## Provider Permission Model

- sites:read
- sites:write
- pages:read
- pages:write
- cms:read
- cms:write
- assets:read
- assets:write
- forms:read
- forms:write
- site_config:read
- site_config:write
- authorized_user:read
- webhook scopes by trigger type

## Resource Boundaries

- sites, workspaces and authorization info
- pages, page content and custom code
- collections, CMS fields and collection items
- assets in the Webflow asset manager
- forms and form submissions
- domains, site configuration and publish targets
- webhooks and trigger types

## Safe Permission Checks

- Confirm read access before exports, uploads, moderation, publishing or webhook changes.
- Confirm the token/user/bot has the exact write/admin capability required by the endpoint.
- Treat missing access and 404 responses as possible permission boundaries, not as a reason to bypass controls.
