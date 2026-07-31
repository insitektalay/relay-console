# Linear Rate Limits and Quotas

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

Linear documents GraphQL rate limiting and returns rate-limit information through response headers/errors. Prefer connection pagination, select only needed fields, and back off on rate-limit errors.

Use cursor/page tokens, field selection, bounded time windows, request batching only where documented, and provider retry headers. Do not fan out writes across large object sets without approval.
