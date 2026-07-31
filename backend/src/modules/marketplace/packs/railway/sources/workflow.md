# Railway Workflow Router

Use Railway for developer operations involving GraphQL, projects, services, deployments, variables, environments, plugins, webhooks.

Do not use Railway for unrelated CRM, email, or payment workflows. Production deploy/configuration changes require explicit approval.

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://docs.railway.com/reference/public-api
- https://docs.railway.com/reference/public-api#authentication
- https://docs.railway.com/guides/public-api
- https://docs.railway.com/guides/webhooks
- https://docs.railway.com/reference/errors

## Routing Doctrine

1. Confirm the connected Railway workspace, project, environment, service, deployment, variable name, GraphQL operation, API-token scope, and webhook target before selecting tools.
2. Load auth, permissions, endpoint, rate-limit, webhook, error, safe-action, and workflow references before writes.
3. Resolve Railway workspace/project/environment/service/deployment/variable/webhook identifiers through GraphQL reads before mutating anything.
4. Draft production deployments, service restarts, variable changes, custom-domain changes, plugin/resource changes, webhook changes, billing-sensitive operations, and destructive operations for approval.
5. Record Railway project id, environment id, service id, deployment id, GraphQL operation name, request intent, approval id, and safe response summaries after approved writes.

## When To Use

Use Railway for developer operations involving GraphQL, projects, services, deployments, variables, environments, plugins, webhooks.

## When Not To Use

Do not use Railway for unrelated CRM, email, or payment workflows. Production deploy/configuration changes require explicit approval.
