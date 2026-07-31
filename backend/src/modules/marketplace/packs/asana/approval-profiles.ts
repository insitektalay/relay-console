import { action, blocked } from "../../catalog/marketplace-catalog.types";

const allowed = [
  action("read_asana_context", "Read Asana context", "Resolve Asana workspace, team, project, section, task, user, custom-field, and portfolio GIDs before querying."),
  action("read_asana_task_state", "Read Asana task state", "Read Asana completion state, assignee, due dates, memberships, custom fields, tags, and dependencies before proposing changes."),
  action("read_asana_report", "Read Asana report", "Use bounded pagination and opt_fields for reports and preserve Asana GIDs."),
  action("draft_asana_change", "Draft Asana change", "Prepare exact Asana task, story/comment, project/section membership, custom-field, portfolio, attachment, or webhook changes for review without side effects."),
];
const approvalRequired = [
  action("asana_bulk_or_admin", "Change Asana in bulk/admin", "Bulk task changes, task deletes, project configuration, section membership changes, custom-field changes, external/customer-visible stories, and webhook changes require approval."),
];
const blockedActions = [
  blocked("asana_secret_or_permission_abuse", "Asana secret/permission abuse", "Token exposure, workspace/project deletion, bypassing permissions, mass private-data export, and hidden task status changes are blocked."),
];
export const ASANA_APPROVAL_PROFILES = [
  { id: "asana_read_only", label: "Read Only", description: "Read-only Asana operation.", defaultSelected: false, allowedActions: allowed.filter((item) => item.id.startsWith("read_")), approvalRequiredActions: approvalRequired, blockedActions },
  { id: "asana_safe_operator", label: "Safe Operator", description: "Default Asana operator. Reads and drafts are allowed; provider side effects are approval-gated.", defaultSelected: true, allowedActions: allowed, approvalRequiredActions: approvalRequired, blockedActions },
  { id: "asana_manager_approval", label: "Manager Approval", description: "Allows approved Asana writes after explicit review and audit.", defaultSelected: false, allowedActions: allowed, approvalRequiredActions: approvalRequired, blockedActions },
  { id: "asana_admin_high_risk", label: "Admin High Risk", description: "Administrative Asana profile; destructive and secret-exposure actions remain blocked.", defaultSelected: false, allowedActions: allowed, approvalRequiredActions: approvalRequired, blockedActions },
];
