import { action, blocked } from "../../catalog/marketplace-catalog.types";

const allowed = [
  action("read_team_workflow", "Read Linear team workflow", "Resolve the Linear team by key/name, then query its workflow states before creating or moving issues."),
  action("read_issue_status", "Read Linear issue status", "For status reports, query Linear issues with team/project/cycle filters and include state, priority, assignee, labels, and updatedAt."),
  action("read_issue_comments", "Read Linear issue comments", "When summarizing comments, query the Linear issue by identifier and fetch comments in chronological order."),
  action("draft_linear_mutation", "Draft Linear mutation", "Prepare exact Linear issueCreate, issueUpdate, commentCreate, project/cycle update, relation, attachment, or webhook payloads for review without side effects."),
];
const approvalRequired = [
  action("linear_bulk_issue_change", "Bulk Linear issue change", "Bulk issue updates, cross-team reassignment, moving many issues between workflow states, archiving issues, project status/date changes, and workspace webhook changes require approval."),
  action("linear_public_issue_content", "Customer-facing Linear content", "Creating public/customer-facing issue content or importing large backlogs requires approval."),
  action("linear_config_change", "Change Linear configuration", "Changing workflow configuration, teams, labels, OAuth scopes, webhooks, or project milestones requires approval."),
];
const blockedActions = [
  blocked("linear_secret_exposure", "Expose Linear secrets", "Exposing API keys/OAuth secrets, deleting workspaces, changing billing/admin settings, or bulk exporting private issue data is blocked."),
  blocked("linear_identifier_fabrication", "Fabricate Linear identifiers", "Do not fabricate issue identifiers, team keys, workflow state ids, project ids, cycle ids, or user ids; query them."),
  blocked("linear_unapproved_close", "Close Linear issue without approval", "Do not close, cancel, or archive issues without approval unless the user clearly authorized the exact issue."),
];
export const LINEAR_APPROVAL_PROFILES = [
  { id: "linear_read_only", label: "Read Only", description: "Read-only Linear operation.", defaultSelected: false, allowedActions: allowed.filter((item) => item.id.startsWith("read_")), approvalRequiredActions: approvalRequired, blockedActions },
  { id: "linear_safe_operator", label: "Safe Operator", description: "Default Linear operator. Reads and drafts are allowed; provider side effects are approval-gated.", defaultSelected: true, allowedActions: allowed, approvalRequiredActions: approvalRequired, blockedActions },
  { id: "linear_manager_approval", label: "Manager Approval", description: "Allows approved Linear writes after explicit review and audit.", defaultSelected: false, allowedActions: allowed, approvalRequiredActions: approvalRequired, blockedActions },
  { id: "linear_admin_high_risk", label: "Admin High Risk", description: "Administrative Linear profile; destructive and secret-exposure actions remain blocked.", defaultSelected: false, allowedActions: allowed, approvalRequiredActions: approvalRequired, blockedActions },
];
