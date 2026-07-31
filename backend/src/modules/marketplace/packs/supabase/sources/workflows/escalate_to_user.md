# Supabase Escalation

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

Escalate when Supabase credentials are missing, anon/service_role/Management API context is insufficient, project/table/bucket/function/auth-user ids are ambiguous, RLS or tenant boundaries are unclear, the operation is approval-required, the request touches secrets or high-risk production data, Supabase returns conflicting state, or official docs do not cover the requested endpoint.

## Approval-Required Patterns

- Any database write, SQL execution, auth admin mutation, storage bucket policy change, edge function deployment/secret change, RLS/policy change, webhook creation, or production project setting change requires approval.
- Bulk export of rows, service_role usage, and operations on user/customer/payment/security data require approval.
- Deleting rows, buckets, objects, functions, or projects requires approval and may remain blocked by workspace policy.

## Blocked Patterns

- Exposing service_role, JWT secret, database password, access tokens, env secrets, or backups is blocked.
- Disabling RLS, bypassing tenant isolation, deleting projects, and unbounded production data exports are blocked.
- Do not run destructive SQL or migrations from chat without an approved change plan.
