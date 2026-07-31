# Vercel Workflow Router

Use Vercel for developer operations involving projects, deployments, domains, environment variables, teams, aliases, webhooks.

Do not use Vercel for unrelated CRM, email, or payment workflows. Production deploy/configuration changes require explicit approval.

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

## Routing Doctrine

1. Confirm the connected Vercel team, project id/name, deployment id, environment, domain/alias, environment-variable name, token scope, and webhook target before selecting tools.
2. Load auth, permissions, endpoint, rate-limit, webhook, error, safe-action, and workflow references before writes.
3. Resolve Vercel team ids, project ids/names, deployment ids/URLs, domain names, alias ids, environment variable names/ids, branch/environment targets, integration ids, and webhook ids before mutating anything.
4. Draft production deployments/promotions, domain/alias changes, environment variable and secret changes, project deletion, team/member changes, webhook changes, build log exports, and protection-bypass operations for approval.
5. Record Vercel team/project/deployment/domain/env-var/webhook ids, target environment, changed fields, approval id, and safe response summaries after approved writes.

## When To Use

Use Vercel for developer operations involving projects, deployments, domains, environment variables, teams, aliases, webhooks.

## When Not To Use

Do not use Vercel for unrelated CRM, email, or payment workflows. Production deploy/configuration changes require explicit approval.
