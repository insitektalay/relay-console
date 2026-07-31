# Linear Auth Setup

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

## Authentication Model

Linear supports OAuth and personal API keys. API keys and OAuth access tokens are bearer credentials. OAuth apps request scopes during installation; workspace access is tied to the installing user and organization.

Use the connector-held bearer credential for GraphQL API calls. OAuth connections must preserve the authorized Linear organization, installing user, granted scopes, and token expiry/refresh behavior. Personal API keys should be treated as high-sensitivity user credentials and should not be used for organization-wide administration unless explicitly authorized.

Do not request Linear API keys or OAuth tokens in chat. On authentication failure, missing scope, revoked token, or organization mismatch, stop and ask the user to repair or reinstall the Linear connection.

## Secret Safety

- Store provider tokens, API keys, client secrets, refresh tokens, webhook secrets, signing secrets, private keys, and database/payment secrets only in ClawChat connections.
- Never display, summarize, forward, log, or write Linear API keys, OAuth access tokens, refresh tokens, webhook secrets, or credential-shaped values into Linear comments, issue descriptions, generated docs, messages, files, or tool output.
- If authentication fails, stop and ask the user to repair the connection. Do not request secret values in chat.
