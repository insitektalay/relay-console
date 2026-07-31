# Supabase Safe Actions

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Allowed Without Additional Approval

- Confirm project ref/environment and whether the request can be answered through RLS-safe REST queries.
- For table reads, require explicit table/view, selected columns, filters, and row limits; avoid SELECT * on sensitive tables.
- Inspect auth users or storage object metadata only when the user has selected admin capability.

## Approval Required

- Any database write, SQL execution, auth admin mutation, storage bucket policy change, edge function deployment/secret change, RLS/policy change, webhook creation, or production project setting change requires approval.
- Bulk export of rows, service_role usage, and operations on user/customer/payment/security data require approval.
- Deleting rows, buckets, objects, functions, or projects requires approval and may remain blocked by workspace policy.

## Blocked

- Exposing service_role, JWT secret, database password, access tokens, env secrets, or backups is blocked.
- Disabling RLS, bypassing tenant isolation, deleting projects, and unbounded production data exports are blocked.
- Do not run destructive SQL or migrations from chat without an approved change plan.

## Secret-Safety Rule

Provider secrets and credential-shaped values must never appear in responses, generated files, examples, audit notes, or provider-side comments/messages.
