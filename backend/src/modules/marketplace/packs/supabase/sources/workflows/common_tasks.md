# Supabase Common Workflows

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
- Draft SQL, REST mutations, storage changes, auth-user updates, or edge function secret changes before execution.
- For PostgREST writes, require table, filters/primary keys, exact payload, expected affected rows, and approval.
- Use migrations/source control for schema changes; do not silently alter production schema.
