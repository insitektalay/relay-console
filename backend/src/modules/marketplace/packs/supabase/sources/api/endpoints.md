# Supabase Endpoint Families

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

- PostgREST: GET/POST/PATCH/DELETE /rest/v1/{table} with select/filter/order/range headers
- Auth Admin API for users where enabled
- Storage API for buckets and objects
- Supabase Management API for projects/configuration
- Edge Functions invoke endpoints
- Database webhooks from Postgres triggers

## Read Method Doctrine

- Confirm project ref/environment and whether the request can be answered through RLS-safe REST queries.
- For table reads, require explicit table/view, selected columns, filters, and row limits; avoid SELECT * on sensitive tables.
- Inspect auth users or storage object metadata only when the user has selected admin capability.

## Write Method Doctrine

- Draft SQL, REST mutations, storage changes, auth-user updates, or edge function secret changes before execution.
- For PostgREST writes, require table, filters/primary keys, exact payload, expected affected rows, and approval.
- Use migrations/source control for schema changes; do not silently alter production schema.
