# Vercel Endpoint Families

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

- `GET /v6/deployments` and deployment list filters for project, team, target, state, and time windows.
- `GET /v13/deployments/{id}` for deployment status, URLs, aliases, checks, and metadata.
- Project endpoints such as `GET/POST /v9/projects`, project config, framework, build/output settings, and deletion.
- Environment variable endpoints for project env vars by target/environment; secret values must not be displayed.
- Domains, aliases, certificates, and DNS/configuration endpoints.
- Team/member/access-role endpoints where enabled.
- Vercel webhook endpoints for deployment, project, domain, and integration events.

## Read Method Doctrine

- Resolve Vercel team id, project id/name, deployment id, domain/alias, branch, and target environment before querying.
- Inspect current deployment state, aliases, domains, env-var metadata, project config, access role, and protection status before proposing action.
- Limit build logs/events to the requested deployment/time window and redact env vars, tokens, domains under transfer, and secrets.

## Write Method Doctrine

- Draft exact Vercel project, deployment, alias, domain, env-var, team/member, protection, integration, or webhook payloads.
- Use preview deployments and non-production targets when possible.
- Audit every production deployment, alias/domain change, env-var/secret change, webhook, team/member, or customer-impacting mutation.
