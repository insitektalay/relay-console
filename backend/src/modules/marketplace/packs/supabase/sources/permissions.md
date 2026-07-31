# Supabase Permissions and Scopes

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

## Provider Permission Model

Prefer anon/RLS-safe read paths where possible. service_role, SQL execution, auth admin operations, storage policy changes, edge function secrets, and project settings are high-risk. Management API access tokens and project refs must be scoped to the target project.

## Capability Mapping

- Read capability: inspect Supabase project metadata, PostgREST tables/views through explicit `select`/filter/range queries, Auth users, Storage buckets/objects, Edge Functions, Realtime/database webhook configuration, and troubleshooting status.
- Draft capability: prepare exact PostgREST mutations, SQL statements, Storage operations, Auth Admin updates, Edge Function invocations/deployments, secret changes, RLS/policy changes, or database webhook payloads without side effects.
- Write capability: perform approved PostgREST writes, Storage object changes, Auth Admin updates, Edge Function invocations, and webhook changes only inside the selected Supabase project/ref, key type, RLS boundary, and approval policy.
- Admin capability: service_role use, Management API project/configuration changes, SQL execution, schema/RLS/policy changes, edge-function secret/deploy changes, database webhooks, backups, billing, and destructive operations; disabled by default.
