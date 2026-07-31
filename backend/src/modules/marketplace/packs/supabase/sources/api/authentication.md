# Supabase API Authentication

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

Supabase projects expose anon and service_role JWT API keys plus access tokens for management APIs. anon keys are public-client credentials constrained by RLS; service_role bypasses RLS and is a critical secret. ClawChat must never render service_role, database passwords, JWT secrets, or access tokens.

Use connector-held Supabase credentials for the target project ref and API URL. Distinguish anon keys, authenticated user JWTs, service_role keys, Management API access tokens, database passwords, JWT secrets, and edge-function secrets. Do not infer missing Supabase credentials from user text; if the project ref, key type, or token is wrong, ask the user to repair the connection.
