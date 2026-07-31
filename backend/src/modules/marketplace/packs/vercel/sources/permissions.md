# Vercel Permissions and Scopes

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://vercel.com/docs/rest-api
- https://vercel.com/docs/rest-api#introduction/api-basics/authentication
- https://vercel.com/docs/accounts/plans/pro/accounts/access-roles
- https://vercel.com/docs/rest-api/reference/endpoints/deployments
- https://vercel.com/docs/integrations/webhooks-overview
- https://vercel.com/docs/rest-api#introduction/api-basics/rate-limits

## Provider Permission Model

Relevant permissions include team/project roles and token access. Production, environment, secret, deploy, and admin permissions are high-risk.

## Capability Mapping

- Read capability: use Vercel teams, projects, deployments, domains, aliases, environment-variable metadata, build logs, access roles, integrations, and webhooks with bounded queries.
- Draft capability: prepare exact Vercel project, deployment, domain, alias, environment variable, team/member, protection, integration, or webhook payloads without side effects.
- Write capability: create/update Vercel projects, aliases, domains, deployments, and environment variables only when token/team permissions and approval policy allow it.
- Admin capability: Vercel production deployments/promotions, env var/secret changes, domain/alias takeover, project deletion, team/member changes, webhooks, billing/team configuration, and destructive operations; disabled by default.
