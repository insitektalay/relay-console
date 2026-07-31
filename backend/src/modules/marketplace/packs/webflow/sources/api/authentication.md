# Webflow API Authentication

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

## Authentication Families

- Webflow OAuth tokens for marketplace/public integrations
- Site tokens for single-site internal integrations with selected scopes

## Scopes, Grants And Capabilities

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

## Secret Safety

- Do not put secrets in generated OpenClaw or Hermes outputs.
- Do not include bearer tokens, API keys, bot tokens, application passwords, webhook URLs with tokens, client secrets or refresh tokens in examples.
- When showing examples, use placeholder IDs and redacted headers.
