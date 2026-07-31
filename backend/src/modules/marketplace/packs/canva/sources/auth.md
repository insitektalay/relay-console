# Canva Authentication

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

## Supported Auth Model

- Canva Connect OAuth 2 authorization code flow
- OIDC profile/email scopes only when identity data is required

## Required Handling

- Store tokens, client secrets, API keys, application passwords and webhook URLs only as ClawChat secrets.
- Redact Authorization headers and secret-bearing URLs from logs and generated docs.
- Verify token owner/account/site/team/guild/channel before using cached IDs.
- If auth fails, debug provider grant, scopes/capabilities, token expiry/revocation and resource-level access.

## Provider Scopes Or Permissions

Canva OAuth scopes must be requested explicitly during authorization and enabled for the integration; write scopes do not imply matching read scopes.

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
