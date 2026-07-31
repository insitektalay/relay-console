import { action, blocked } from "../../catalog/marketplace-catalog.types";

const allowed = [
  action("read_1", "Resolve file/folder ids and parent/container before reading.", "Resolve file/folder ids and parent/container before reading."),
  action("read_2", "Use metadata first, then download/export only the specific requested f", "Use metadata first, then download/export only the specific requested file."),
  action("read_3", "For folders/team spaces, paginate and preserve path/parent context.", "For folders/team spaces, paginate and preserve path/parent context."),
  action("draft_change", "Draft provider-specific change", "Prepare exact Google Drive changes for review without external side effects."),
];
const approvalRequired = [
  action("approval_1", "External sharing, permission role changes, deletes, public links, larg", "External sharing, permission role changes, deletes, public links, large exports, shared-drive organizer changes, ownership transfers, and shortcut moves require approval."),
  action("approval_2", "Downloads of sensitive/customer/security/legal folders require approva", "Downloads of sensitive/customer/security/legal folders require approval."),
  action("approval_3", "Overwrite operations require approval unless the user supplied the exa", "Overwrite operations require approval unless the user supplied the exact file id/version."),
];
const blockedActions = [
  blocked("blocked_1", "Exposing OAuth tokens, refresh tokens, full My Drive/shared-drive expo", "Exposing OAuth tokens, refresh tokens, full My Drive/shared-drive exports, bypassing sharing restrictions, and deleting shared drives are blocked."),
];
export const GOOGLE_DRIVE_APPROVAL_PROFILES = [
  { id: "google-drive_read_only", label: "Read Only", description: "Read-only Google Drive operation.", defaultSelected: false, allowedActions: allowed.filter((item) => item.id.startsWith("read_")), approvalRequiredActions: approvalRequired, blockedActions },
  { id: "google-drive_safe_operator", label: "Safe Operator", description: "Default Google Drive operator. Reads and drafts are allowed; provider side effects are approval-gated.", defaultSelected: true, allowedActions: allowed, approvalRequiredActions: approvalRequired, blockedActions },
  { id: "google-drive_manager_approval", label: "Manager Approval", description: "Allows approved Google Drive writes after explicit review and audit.", defaultSelected: false, allowedActions: allowed, approvalRequiredActions: approvalRequired, blockedActions },
  { id: "google-drive_admin_high_risk", label: "Admin High Risk", description: "Administrative Google Drive profile; destructive and secret-exposure actions remain blocked.", defaultSelected: false, allowedActions: allowed, approvalRequiredActions: approvalRequired, blockedActions },
];
