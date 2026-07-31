# Linear API Authentication

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://developers.linear.app/docs/graphql/working-with-the-graphql-api
- https://developers.linear.app/docs/graphql/graphql-api
- https://developers.linear.app/docs/graphql/oauth/authentication
- https://developers.linear.app/docs/oauth/authentication#scopes
- https://developers.linear.app/docs/graphql/webhooks
- https://developers.linear.app/docs/graphql/working-with-the-graphql-api/rate-limiting
- https://developers.linear.app/docs/graphql/working-with-the-graphql-api/errors

Linear supports OAuth and personal API keys. API keys and OAuth access tokens are bearer credentials. OAuth apps request scopes during installation; workspace access is tied to the installing user and organization.

Send Linear GraphQL API requests with the connector-held bearer credential. Preserve the authorized organization, installing user, selected OAuth scopes, and personal API-key owner context. Do not infer missing Linear credentials from user text; if the token is revoked, expired, scope-limited, or tied to the wrong organization, ask the user to repair or reinstall the Linear connection.
