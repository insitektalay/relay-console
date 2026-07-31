import { action, blocked } from "../../catalog/marketplace-catalog.types";

const allowed = [
  action("read_coda_schema", "Read Coda schema", "Inspect Coda doc/page/table/column definitions before querying rows."),
  action("read_coda_rows", "Read Coda rows", "Use Coda table/view/query parameters, visible column selection, and bounded pagination."),
  action("summarize_coda_rows", "Summarize Coda rows", "Preserve Coda row ids, column names, cell values, formula/control references, and typed values in summaries."),
  action("draft_coda_change", "Draft Coda change", "Prepare exact Coda row, cell, table/page/doc, formula/control, permission, or webhook changes for review without side effects."),
];
const approvalRequired = [
  action("coda_bulk_or_schema", "Change Coda rows/schema", "Bulk row changes, table/column schema changes, webhook changes, row deletes, external shares, and automations require approval."),
  action("coda_sensitive_export", "Export sensitive Coda table", "Sensitive Coda tables/views require approval before export."),
  action("coda_formula_or_permission", "Change Coda formulas/permissions", "Changing formulas, controls, columns, or document permissions requires approval."),
];
const blockedActions = [
  blocked("coda_secret_or_doc_abuse", "Coda secret/doc abuse", "Token exposure, doc deletion, bypassing sharing restrictions, and unbounded export of sensitive tables are blocked."),
];
export const CODA_APPROVAL_PROFILES = [
  { id: "coda_read_only", label: "Read Only", description: "Read-only Coda operation.", defaultSelected: false, allowedActions: allowed.filter((item) => item.id.startsWith("read_")), approvalRequiredActions: approvalRequired, blockedActions },
  { id: "coda_safe_operator", label: "Safe Operator", description: "Default Coda operator. Reads and drafts are allowed; provider side effects are approval-gated.", defaultSelected: true, allowedActions: allowed, approvalRequiredActions: approvalRequired, blockedActions },
  { id: "coda_manager_approval", label: "Manager Approval", description: "Allows approved Coda writes after explicit review and audit.", defaultSelected: false, allowedActions: allowed, approvalRequiredActions: approvalRequired, blockedActions },
  { id: "coda_admin_high_risk", label: "Admin High Risk", description: "Administrative Coda profile; destructive and secret-exposure actions remain blocked.", defaultSelected: false, allowedActions: allowed, approvalRequiredActions: approvalRequired, blockedActions },
];
