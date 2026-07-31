import { action, blocked } from "../../catalog/marketplace-catalog.types";

const allowed = [
  action("read_airtable_schema", "Read Airtable schema", "Inspect Airtable base/table/field/view definitions before querying records."),
  action("read_airtable_records", "Read Airtable records", "Use Airtable filterByFormula, views, field selection, sort parameters, and bounded pagination."),
  action("summarize_airtable_records", "Summarize Airtable records", "Preserve Airtable record ids, field names, linked-record ids, select options, and typed values in summaries."),
  action("draft_airtable_change", "Draft Airtable change", "Prepare exact Airtable record, schema, field/table, automation/interface, or webhook changes for review without side effects."),
];
const approvalRequired = [
  action("airtable_bulk_or_schema", "Change Airtable records/schema", "Bulk record changes, schema/field changes, webhook changes, deletes, external shares, and automations require approval."),
  action("airtable_sensitive_export", "Export sensitive Airtable view", "Sensitive Airtable tables/views require approval before export."),
  action("airtable_formula_or_permission", "Change Airtable formulas/permissions", "Changing formulas, field options, linked-record behavior, or base permissions requires approval."),
];
const blockedActions = [
  blocked("airtable_secret_or_base_abuse", "Airtable secret/base abuse", "Token exposure, base deletion, bypassing sharing restrictions, and unbounded export of sensitive tables are blocked."),
];
export const AIRTABLE_APPROVAL_PROFILES = [
  { id: "airtable_read_only", label: "Read Only", description: "Read-only Airtable operation.", defaultSelected: false, allowedActions: allowed.filter((item) => item.id.startsWith("read_")), approvalRequiredActions: approvalRequired, blockedActions },
  { id: "airtable_safe_operator", label: "Safe Operator", description: "Default Airtable operator. Reads and drafts are allowed; provider side effects are approval-gated.", defaultSelected: true, allowedActions: allowed, approvalRequiredActions: approvalRequired, blockedActions },
  { id: "airtable_manager_approval", label: "Manager Approval", description: "Allows approved Airtable writes after explicit review and audit.", defaultSelected: false, allowedActions: allowed, approvalRequiredActions: approvalRequired, blockedActions },
  { id: "airtable_admin_high_risk", label: "Admin High Risk", description: "Administrative Airtable profile; destructive and secret-exposure actions remain blocked.", defaultSelected: false, allowedActions: allowed, approvalRequiredActions: approvalRequired, blockedActions },
];
