# Canva API Authentication

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://www.canva.dev/docs/connect/
- https://www.canva.dev/docs/connect/authentication/
- https://www.canva.dev/docs/connect/appendix/scopes/
- https://www.canva.dev/docs/connect/canva-concepts/
- https://www.canva.dev/docs/connect/api-reference/exports/create-design-export-job/
- https://www.canva.dev/docs/connect/webhooks/

## Authentication Families

- Canva Connect OAuth 2 authorization code flow
- OIDC profile/email scopes only when identity data is required

## Scopes, Grants And Capabilities

- design:meta:read
- design:content:read
- design:content:write
- asset:read
- asset:write
- folder:read
- folder:write
- folder:permission:write
- brandtemplate:meta:read
- brandtemplate:content:read
- comment:read
- comment:write
- collaboration:event
- openid
- profile
- email

## Secret Safety

- Do not put secrets in generated OpenClaw or Hermes outputs.
- Do not include bearer tokens, API keys, bot tokens, application passwords, webhook URLs with tokens, client secrets or refresh tokens in examples.
- When showing examples, use placeholder IDs and redacted headers.
