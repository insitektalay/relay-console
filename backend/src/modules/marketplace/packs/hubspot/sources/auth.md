# HubSpot Auth Setup

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://developers.hubspot.com/docs/api/overview
- https://developers.hubspot.com/docs/api/private-apps
- https://developers.hubspot.com/docs/apps/legacy-apps/authentication/scopes

## Authentication Model

HubSpot supports private app access tokens for single-portal integrations and OAuth for public or multi-portal apps. Private app tokens are bearer tokens tied to scopes configured in the HubSpot portal. OAuth installs grant access and refresh tokens for the selected scopes.

Store private app tokens, OAuth access tokens, refresh tokens, client secrets, and webhook secrets only in ClawChat connection storage. Never ask the user to paste credentials into chat, tickets, notes, or generated docs.

## Preflight

- Verify portal identity and auth type before reads or writes.
- Confirm required scopes for the endpoint family before building a request.
- Treat missing or insufficient scopes as a connection repair task, not as permission to request secret values from the user.
