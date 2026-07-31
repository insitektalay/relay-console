# Railway API Authentication

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://docs.railway.com/reference/public-api
- https://docs.railway.com/reference/public-api#authentication
- https://docs.railway.com/guides/public-api
- https://docs.railway.com/guides/webhooks
- https://docs.railway.com/reference/errors

Bearer Railway API token. Tokens/secrets remain in ClawChat connections.

Use the connector-held Railway API token in the GraphQL `Authorization: Bearer ...` header. Confirm the token can access the requested Railway workspace, project, environment, service, deployment, variable, custom domain, and webhook before selecting mutations. Do not infer Railway tokens, project ids, or environment ids from user text; if access is missing, ask the user to repair the Railway connection or provide an unambiguous project reference.
