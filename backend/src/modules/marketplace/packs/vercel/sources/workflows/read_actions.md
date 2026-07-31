# Vercel Read Workflows

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

Always use explicit Vercel team ids, project ids/names, deployment ids/URLs, domain names, aliases, env-var names/ids, webhook ids, or narrow Vercel filters. Summaries must redact secrets and unnecessary personal, customer, financial, security, source-code, build-log, or private project data.
