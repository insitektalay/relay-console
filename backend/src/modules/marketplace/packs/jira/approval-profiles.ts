import { action, blocked } from "../../catalog/marketplace-catalog.types";

const allowed = [
  action("read_jira_context", "Read Jira context", "Resolve Jira Cloud site, project key, issue key/id, board id, sprint id, and accountId before querying."),
  action("read_jira_state", "Read Jira issue state", "Read Jira status, valid transitions, assignee, labels, fields, components, versions, and permissions before proposing changes."),
  action("read_jira_jql", "Read Jira JQL results", "Use bounded JQL for reports and preserve Jira issue keys, ids, and field ids."),
  action("draft_jira_change", "Draft Jira change", "Prepare exact Jira issue, transition, comment, worklog, sprint, field, issue-link, attachment, or webhook changes for review without side effects."),
];
const approvalRequired = [
  action("jira_bulk_or_admin", "Change Jira in bulk/admin", "Bulk transitions, deletes/archives, project configuration, workflow/status/field changes, external/customer-visible comments, sprint changes, and webhook changes require approval."),
];
const blockedActions = [
  blocked("jira_secret_or_permission_abuse", "Jira secret/permission abuse", "Token exposure, Jira site/project deletion, bypassing permissions, mass private-data export, and hidden status changes are blocked."),
];
export const JIRA_APPROVAL_PROFILES = [
  { id: "jira_read_only", label: "Read Only", description: "Read-only Jira operation.", defaultSelected: false, allowedActions: allowed.filter((item) => item.id.startsWith("read_")), approvalRequiredActions: approvalRequired, blockedActions },
  { id: "jira_safe_operator", label: "Safe Operator", description: "Default Jira operator. Reads and drafts are allowed; provider side effects are approval-gated.", defaultSelected: true, allowedActions: allowed, approvalRequiredActions: approvalRequired, blockedActions },
  { id: "jira_manager_approval", label: "Manager Approval", description: "Allows approved Jira writes after explicit review and audit.", defaultSelected: false, allowedActions: allowed, approvalRequiredActions: approvalRequired, blockedActions },
  { id: "jira_admin_high_risk", label: "Admin High Risk", description: "Administrative Jira profile; destructive and secret-exposure actions remain blocked.", defaultSelected: false, allowedActions: allowed, approvalRequiredActions: approvalRequired, blockedActions },
];
