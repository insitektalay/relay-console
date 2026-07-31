import { action, blocked } from "../../catalog/marketplace-catalog.types";

const allowed = [
  action("read_clickup_context", "Read ClickUp context", "Resolve ClickUp team, space, folder, list, task, status, assignee, custom-field, and doc ids before querying."),
  action("read_clickup_task_state", "Read ClickUp task state", "Read ClickUp task status, assignees, priority, due date, tags, custom fields, dependencies, list membership, and permissions before proposing changes."),
  action("read_clickup_report", "Read ClickUp report", "Use bounded ClickUp task/list filters for reports and preserve task ids and custom-field ids."),
  action("draft_clickup_change", "Draft ClickUp change", "Prepare exact ClickUp task, status, assignee, custom-field, comment, doc, attachment, or webhook changes for review without side effects."),
];
const approvalRequired = [
  action("clickup_bulk_or_admin", "Change ClickUp in bulk/admin", "Bulk task changes, task deletes/archives, list/space/folder changes, status/custom-field changes, external/customer-visible comments, docs, and webhook changes require approval."),
];
const blockedActions = [
  blocked("clickup_secret_or_permission_abuse", "ClickUp secret/permission abuse", "Token exposure, workspace/team deletion, bypassing permissions, mass private-data export, and hidden task status changes are blocked."),
];
export const CLICKUP_APPROVAL_PROFILES = [
  { id: "clickup_read_only", label: "Read Only", description: "Read-only ClickUp operation.", defaultSelected: false, allowedActions: allowed.filter((item) => item.id.startsWith("read_")), approvalRequiredActions: approvalRequired, blockedActions },
  { id: "clickup_safe_operator", label: "Safe Operator", description: "Default ClickUp operator. Reads and drafts are allowed; provider side effects are approval-gated.", defaultSelected: true, allowedActions: allowed, approvalRequiredActions: approvalRequired, blockedActions },
  { id: "clickup_manager_approval", label: "Manager Approval", description: "Allows approved ClickUp writes after explicit review and audit.", defaultSelected: false, allowedActions: allowed, approvalRequiredActions: approvalRequired, blockedActions },
  { id: "clickup_admin_high_risk", label: "Admin High Risk", description: "Administrative ClickUp profile; destructive and secret-exposure actions remain blocked.", defaultSelected: false, allowedActions: allowed, approvalRequiredActions: approvalRequired, blockedActions },
];
