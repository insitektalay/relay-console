# Railway Endpoint Families

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://docs.railway.com/reference/public-api
- https://docs.railway.com/reference/public-api#authentication
- https://docs.railway.com/guides/public-api
- https://docs.railway.com/guides/webhooks
- https://docs.railway.com/reference/errors

- Railway Public API GraphQL endpoint for project, environment, service, deployment, variable, custom-domain, plugin/resource, and webhook queries/mutations.
- GraphQL reads for projects, environments, services, deployment history/status, build/deploy logs or events where available, service domains, and variable metadata.
- GraphQL mutations for service deploy/redeploy/restart, environment-variable create/update/delete, service/project configuration, custom domains, and webhook subscriptions.
- Railway webhook configuration for deployment, service, and project events documented in the Railway webhook guide.

## Read Method Doctrine

- Resolve Railway workspace id, project id, environment id, service id, deployment id, variable name/key, custom-domain id/name, and webhook id before querying.
- Inspect current service deployment status, environment configuration, custom domain state, variable metadata, plugin/resource status, and webhook subscription before proposing action.
- Limit logs/events to the requested deployment/service/time window and redact tokens, variable values, build secrets, source snippets, and private project metadata.

## Write Method Doctrine

- Draft exact Railway GraphQL mutation names and variables for service deploy/redeploy/restart, env-var changes, custom domains, service/project configuration, plugins/resources, or webhooks.
- Use non-production Railway environments or preview services when possible.
- Audit every production deployment, service restart, variable/secret change, custom-domain change, webhook change, project/service deletion, plugin/resource change, or customer-impacting mutation.
