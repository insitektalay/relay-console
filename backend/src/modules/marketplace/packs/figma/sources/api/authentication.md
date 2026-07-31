# Figma API Authentication

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://developers.figma.com/docs/rest-api/
- https://developers.figma.com/docs/rest-api/authentication/
- https://developers.figma.com/docs/rest-api/scopes/
- https://developers.figma.com/docs/rest-api/file-endpoints/
- https://developers.figma.com/docs/rest-api/webhooks/
- https://developers.figma.com/docs/rest-api/rate-limits/

## Authentication Families

- OAuth 2 access tokens for user-delegated integrations
- Personal access tokens in X-Figma-Token for account-bound scripts

## Scopes, Grants And Capabilities

- current_user:read
- file_content:read
- file_comments:read
- file_comments:write
- file_components:read
- file_styles:read
- file_variables:read
- webhooks:read
- webhooks:write

## Secret Safety

- Do not put secrets in generated OpenClaw or Hermes outputs.
- Do not include bearer tokens, API keys, bot tokens, application passwords, webhook URLs with tokens, client secrets or refresh tokens in examples.
- When showing examples, use placeholder IDs and redacted headers.
