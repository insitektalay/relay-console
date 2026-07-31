# Supabase API Overview

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

## Provider Object Model

- Project with ref, region, API URL, settings
- Postgres tables/views exposed through PostgREST
- Auth user, identity, session, MFA factor
- Storage bucket and object path
- Edge function and secret
- Realtime channel/publication
- Database webhook tied to table events

## Endpoint/Method Families

- PostgREST: GET/POST/PATCH/DELETE /rest/v1/{table} with select/filter/order/range headers
- Auth Admin API for users where enabled
- Storage API for buckets and objects
- Supabase Management API for projects/configuration
- Edge Functions invoke endpoints
- Database webhooks from Postgres triggers
