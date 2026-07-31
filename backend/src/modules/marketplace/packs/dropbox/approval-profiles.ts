import { action, blocked } from "../../catalog/marketplace-catalog.types";

const allowed = [
  action("read_dropbox_metadata", "Read Dropbox metadata", "Resolve Dropbox file/folder ids, paths, revs, namespaces, and team-folder context before reading."),
  action("read_dropbox_content", "Read Dropbox file content", "Use Dropbox metadata first, then download only the specific requested file or revision."),
  action("read_dropbox_folder", "Read Dropbox folder cursor", "For Dropbox folders/team spaces, paginate list_folder cursors and preserve path/namespace context."),
  action("draft_dropbox_change", "Draft Dropbox change", "Prepare exact Dropbox upload, move, copy, delete, restore, shared-link, file-lock, team-folder, or webhook changes for review without side effects."),
];
const approvalRequired = [
  action("dropbox_share_or_admin", "Share or administer Dropbox content", "External sharing, permission role changes, deletes, public links, large downloads/exports, namespace changes, and team-folder admin changes require approval."),
  action("approval_2", "Downloads of sensitive/customer/security/legal folders require approva", "Downloads of sensitive/customer/security/legal folders require approval."),
  action("approval_3", "Overwrite operations require approval unless the user supplied the exa", "Overwrite operations require approval unless the user supplied the exact file id/version."),
];
const blockedActions = [
  blocked("dropbox_secret_or_team_abuse", "Dropbox secret/team abuse", "Exposing OAuth tokens, refresh tokens, full-account/team-folder exports, bypassing sharing restrictions, and deleting team folders are blocked."),
];
export const DROPBOX_APPROVAL_PROFILES = [
  { id: "dropbox_read_only", label: "Read Only", description: "Read-only Dropbox operation.", defaultSelected: false, allowedActions: allowed.filter((item) => item.id.startsWith("read_")), approvalRequiredActions: approvalRequired, blockedActions },
  { id: "dropbox_safe_operator", label: "Safe Operator", description: "Default Dropbox operator. Reads and drafts are allowed; provider side effects are approval-gated.", defaultSelected: true, allowedActions: allowed, approvalRequiredActions: approvalRequired, blockedActions },
  { id: "dropbox_manager_approval", label: "Manager Approval", description: "Allows approved Dropbox writes after explicit review and audit.", defaultSelected: false, allowedActions: allowed, approvalRequiredActions: approvalRequired, blockedActions },
  { id: "dropbox_admin_high_risk", label: "Admin High Risk", description: "Administrative Dropbox profile; destructive and secret-exposure actions remain blocked.", defaultSelected: false, allowedActions: allowed, approvalRequiredActions: approvalRequired, blockedActions },
];
