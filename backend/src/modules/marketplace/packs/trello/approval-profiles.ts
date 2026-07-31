import { action, blocked } from "../../catalog/marketplace-catalog.types";

const allowed = [
  action("read_trello_context", "Read Trello context", "Resolve Trello workspace, board, list, card, checklist, member, and label ids before querying."),
  action("read_trello_card_state", "Read Trello card state", "Read Trello card list, members, labels, due date, checklists, custom fields, and closed/archive state before proposing changes."),
  action("read_trello_report", "Read Trello board report", "Use bounded board/list/card queries and preserve Trello ids and shortLinks."),
  action("draft_trello_change", "Draft Trello change", "Prepare exact Trello card, checklist, comment/action, label/member, attachment, custom-field, board/list, or webhook changes for review without side effects."),
];
const approvalRequired = [
  action("trello_bulk_or_admin", "Change Trello in bulk/admin", "Bulk card moves, card archives/deletes, board/list changes, checklist changes, member/label changes, customer-visible comments, and webhook changes require approval."),
];
const blockedActions = [
  blocked("trello_secret_or_permission_abuse", "Trello secret/permission abuse", "API key/token exposure, workspace/board deletion, bypassing permissions, mass private-data export, and hidden card moves are blocked."),
];
export const TRELLO_APPROVAL_PROFILES = [
  { id: "trello_read_only", label: "Read Only", description: "Read-only Trello operation.", defaultSelected: false, allowedActions: allowed.filter((item) => item.id.startsWith("read_")), approvalRequiredActions: approvalRequired, blockedActions },
  { id: "trello_safe_operator", label: "Safe Operator", description: "Default Trello operator. Reads and drafts are allowed; provider side effects are approval-gated.", defaultSelected: true, allowedActions: allowed, approvalRequiredActions: approvalRequired, blockedActions },
  { id: "trello_manager_approval", label: "Manager Approval", description: "Allows approved Trello writes after explicit review and audit.", defaultSelected: false, allowedActions: allowed, approvalRequiredActions: approvalRequired, blockedActions },
  { id: "trello_admin_high_risk", label: "Admin High Risk", description: "Administrative Trello profile; destructive and secret-exposure actions remain blocked.", defaultSelected: false, allowedActions: allowed, approvalRequiredActions: approvalRequired, blockedActions },
];
