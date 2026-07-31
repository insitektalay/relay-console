# Vercel Common Workflows

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

- Resolve the Vercel team id or slug, project id/name, deployment id/URL, domain, alias, environment-variable name/id, and webhook id before querying.
- Inspect current deployment state, project configuration, domain/DNS status, alias target, env-var metadata, access role, and webhook subscription before proposing action.
- Limit build logs and deployment events to the requested deployment and time window; redact tokens, env-var values, source snippets, and private project metadata.
- Draft exact Vercel project, deployment, alias, domain, environment-variable, team/member, protection, integration, or webhook payloads.
- Prefer preview deployments, non-production targets, and project-scoped changes before production promotion.
- Audit every production deployment, alias/domain change, env-var/secret change, webhook change, team/member change, or customer-impacting mutation.
