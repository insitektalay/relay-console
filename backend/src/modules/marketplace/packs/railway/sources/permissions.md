# Railway Permissions and Scopes

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://docs.railway.com/reference/public-api
- https://docs.railway.com/reference/public-api#authentication
- https://docs.railway.com/guides/public-api
- https://docs.railway.com/guides/webhooks
- https://docs.railway.com/reference/errors

## Provider Permission Model

Relevant permissions include workspace/project access carried by token. Production, environment, secret, deploy, and admin permissions are high-risk.

## Capability Mapping

- Read capability: run bounded Railway GraphQL queries for workspaces, projects, environments, services, deployments, variables metadata, custom domains, plugins/resources, and webhooks; summarize without exposing variable values or build secrets.
- Draft capability: prepare exact Railway GraphQL mutation variables for service deploy/redeploy/restart, environment-variable changes, domain changes, webhook subscriptions, or project/service settings without side effects.
- Write capability: create or update Railway services, deployments, variables, domains, or webhooks only inside the selected project/environment/service and only when approval policy allows the mutation.
- Admin capability: Railway production deployment actions, variable/secret changes, custom domain moves, project/service deletion, plugin/resource changes, webhook management, team/workspace permissions, billing-sensitive settings, and destructive operations; disabled by default.
