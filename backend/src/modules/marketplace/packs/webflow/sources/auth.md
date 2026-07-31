# Webflow Authentication

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

## Supported Auth Model

- Webflow OAuth tokens for marketplace/public integrations
- Site tokens for single-site internal integrations with selected scopes

## Required Handling

- Store tokens, client secrets, API keys, application passwords and webhook URLs only as ClawChat secrets.
- Redact Authorization headers and secret-bearing URLs from logs and generated docs.
- Verify token owner/account/site/team/guild/channel before using cached IDs.
- If auth fails, debug provider grant, scopes/capabilities, token expiry/revocation and resource-level access.

## Provider Scopes Or Permissions

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
