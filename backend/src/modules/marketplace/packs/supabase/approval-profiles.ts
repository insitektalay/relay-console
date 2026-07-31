import { action, blocked } from "../../catalog/marketplace-catalog.types";

const allowed = [
  action("read_project_context", "Read Supabase project context", "Confirm Supabase project ref/environment and whether the request can be answered through RLS-safe PostgREST queries."),
  action("read_table_rows", "Read Supabase table rows", "For table reads, require explicit schema/table/view, selected columns, filters, and row limits; avoid SELECT * on sensitive tables."),
  action("read_auth_storage", "Read Supabase auth/storage metadata", "Inspect Auth users or Storage object metadata only when the user has selected admin capability."),
  action("draft_supabase_change", "Draft Supabase change", "Prepare exact Supabase PostgREST, SQL, Storage, Auth Admin, Edge Function, RLS/policy, secret, or database-webhook changes for review without side effects."),
];
const approvalRequired = [
  action("supabase_write_or_config", "Write Supabase data/configuration", "Any database write, SQL execution, Auth Admin mutation, Storage bucket policy change, Edge Function deployment/secret change, RLS/policy change, webhook creation, or production project setting change requires approval."),
  action("supabase_sensitive_data", "Use Supabase sensitive data/service role", "Bulk export of rows, service_role usage, and operations on user/customer/payment/security data require approval."),
  action("supabase_delete_resource", "Delete Supabase resource", "Deleting rows, buckets, objects, functions, or projects requires approval and may remain blocked by workspace policy."),
];
const blockedActions = [
  blocked("supabase_secret_exposure", "Expose Supabase secrets", "Exposing service_role, JWT secret, database password, access tokens, env secrets, or backups is blocked."),
  blocked("supabase_rls_bypass", "Bypass Supabase RLS/tenant isolation", "Disabling RLS, bypassing tenant isolation, deleting projects, and unbounded production data exports are blocked."),
  blocked("supabase_destructive_sql", "Run destructive Supabase SQL", "Do not run destructive SQL or migrations from chat without an approved change plan."),
];
export const SUPABASE_APPROVAL_PROFILES = [
  { id: "supabase_read_only", label: "Read Only", description: "Read-only Supabase operation.", defaultSelected: false, allowedActions: allowed.filter((item) => item.id.startsWith("read_")), approvalRequiredActions: approvalRequired, blockedActions },
  { id: "supabase_safe_operator", label: "Safe Operator", description: "Default Supabase operator. Reads and drafts are allowed; provider side effects are approval-gated.", defaultSelected: true, allowedActions: allowed, approvalRequiredActions: approvalRequired, blockedActions },
  { id: "supabase_manager_approval", label: "Manager Approval", description: "Allows approved Supabase writes after explicit review and audit.", defaultSelected: false, allowedActions: allowed, approvalRequiredActions: approvalRequired, blockedActions },
  { id: "supabase_admin_high_risk", label: "Admin High Risk", description: "Administrative Supabase profile; destructive and secret-exposure actions remain blocked.", defaultSelected: false, allowedActions: allowed, approvalRequiredActions: approvalRequired, blockedActions },
];
