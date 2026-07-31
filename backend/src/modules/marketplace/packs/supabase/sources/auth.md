# Supabase Auth Setup

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

## Authentication Model

Supabase projects expose anon and service_role JWT API keys plus access tokens for management APIs. anon keys are public-client credentials constrained by RLS; service_role bypasses RLS and is a critical secret. ClawChat must never render service_role, database passwords, JWT secrets, or access tokens.

## Secret Safety

- Store provider tokens, API keys, client secrets, refresh tokens, webhook secrets, signing secrets, private keys, and database/payment secrets only in ClawChat connections.
- Never display, summarize, forward, log, or write secret values into generated docs, comments, tickets, messages, files, or tool output.
- If authentication fails, stop and ask the user to repair the connection. Do not request secret values in chat.
