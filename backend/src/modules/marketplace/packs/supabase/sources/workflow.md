# Supabase Workflow Router

Use Supabase for project-level backend operations: PostgREST database access, auth users, storage buckets/objects, edge functions, realtime, database webhooks, and project configuration triage.

Do not use Supabase for arbitrary production database changes without approval, schema migrations that belong in source control, secrets extraction, or bypassing row-level security with service_role unless explicitly approved.

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

## Routing Doctrine

1. Confirm the connected Supabase project ref, API URL, anon versus service_role context, schema/table/view, auth/storage/function target, RLS boundary, and webhook/edge-function target before selecting tools.
2. Load auth, permissions, endpoint, rate-limit, webhook, error, safe-action, and workflow references before writes.
3. Resolve Supabase project refs, schemas, tables/views, primary keys, storage bucket/object paths, auth user ids, edge function names, database webhook ids, RLS/policy names, and management-resource ids before mutation.
4. Draft database writes, SQL execution, service_role usage, auth-admin mutations, storage bucket/object writes, edge-function deployment/secret changes, RLS/policy changes, database webhooks, production project settings, and bulk exports for approval.
5. Record Supabase project ref, schema/table/bucket/function/user ids, endpoint path or SQL summary, expected affected rows, approval id, and safe response summaries after approved writes.

## When To Use

Use Supabase for project-level backend operations: PostgREST database access, auth users, storage buckets/objects, edge functions, realtime, database webhooks, and project configuration triage.

## When Not To Use

Do not use Supabase for arbitrary production database changes without approval, schema migrations that belong in source control, secrets extraction, or bypassing row-level security with service_role unless explicitly approved.
