# Supabase Write Workflows

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

- Draft SQL, REST mutations, storage changes, auth-user updates, or edge function secret changes before execution.
- For PostgREST writes, require table, filters/primary keys, exact payload, expected affected rows, and approval.
- Use migrations/source control for schema changes; do not silently alter production schema.
- For storage changes, show bucket, object path, content type, visibility, signed/public URL impact, and overwrite/delete behavior.
- For Auth Admin changes, show user id/email, identity/session/MFA impact, and whether the action affects sign-in or account recovery.
- For edge functions and secrets, show function name, environment, secret names only, deployment impact, and rollback plan.

Before execution, show the Supabase project ref, schema/table/bucket/function/user ids, endpoint path or SQL summary, changed fields, expected affected rows, customer/production impact, rollback expectations, approval requirement, and audit note.
