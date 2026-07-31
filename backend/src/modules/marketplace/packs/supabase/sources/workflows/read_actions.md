# Supabase Read Workflows

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://supabase.com/docs/reference/api/introduction
- https://supabase.com/docs/guides/api/api-keys
- https://supabase.com/docs/reference/javascript/introduction
- https://supabase.com/docs/guides/database/webhooks
- https://supabase.com/docs/guides/platform/going-into-prod#rate-limiting-resource-allocation--abuse-prevention
- https://supabase.com/docs/guides/platform/troubleshooting

- Confirm project ref/environment and whether the request can be answered through RLS-safe REST queries.
- For table reads, require explicit table/view, selected columns, filters, and row limits; avoid SELECT * on sensitive tables.
- Inspect auth users or storage object metadata only when the user has selected admin capability.

Always use explicit Supabase project refs, schemas, tables/views, primary keys, storage bucket/object paths, auth user ids, edge function names, webhook ids, or narrow PostgREST filters. Summaries must redact secrets and unnecessary personal, customer, financial, security, source-code, or private production data.
