# Sentry API Authentication

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://docs.sentry.io/api/
- https://docs.sentry.io/api/auth/
- https://docs.sentry.io/api/permissions/
- https://docs.sentry.io/api/events/
- https://docs.sentry.io/api/ratelimits/
- https://docs.sentry.io/organization/integrations/integration-platform/webhooks/

Auth token or OAuth token. Tokens/secrets remain in ClawChat connections.

Use connector-held Sentry auth tokens or OAuth tokens in Sentry API authorization headers. Confirm the token has the needed Sentry scopes, such as `org:read`, `project:read`, `project:write`, `event:read`, `team:read`, `team:write`, or integration/webhook permissions, before selecting endpoints. Do not infer missing Sentry credentials, organization slugs, project slugs, or issue ids from user text; if access is insufficient, ask the user to repair the Sentry connection.
