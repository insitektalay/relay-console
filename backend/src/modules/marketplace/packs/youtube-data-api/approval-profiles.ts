import { action, blocked } from "../../catalog/marketplace-catalog.types";

const allowed = [
  action("read_accessible", "Read accessible provider resources", "Read YouTube Data API resources visible to the connected account and summarize state."),
  action("draft_changes", "Draft provider-specific changes", "Prepare comments, replies, posts, updates, exports or publish plans without sending them."),
  action("prepare_payloads", "Prepare exact API payloads", "Prepare endpoint, method, target IDs and payloads for human review."),
];

const approvalRequired = [
  action("publish_external", "Publish or send externally", "Publishing content, posting to public/community surfaces or sending messages requires approval."),
  action("upload_replace_export", "Upload, replace or export media/content", "Uploads, replacements and exports of private/customer content require approval."),
  action("delete_or_moderate", "Delete or moderate content/users", "Deleting content/comments or moderating users/comments requires approval."),
  action("permissions_webhooks_settings", "Change permissions, webhooks or settings", "Permission, role, domain, site, webhook, security or admin setting changes require approval."),
];

const blockedActions = [
  blocked("expose_secrets", "Expose provider secrets", "Tokens, API keys, app secrets, application passwords, bot tokens and webhook secrets must never be exposed."),
  blocked("bypass_permissions", "Bypass permissions or sharing controls", "Do not bypass provider auth, ownership, sharing, role or visibility controls."),
  blocked("spam_bulk_destructive", "Spam or destructive bulk actions", "Mass messaging, spam, destructive bulk deletion and bulk private export are blocked."),
  blocked("weaken_security_admin", "Weaken security or change ownership/admin roles", "Disabling moderation/security controls or changing ownership/admin roles is blocked."),
];

export const YOUTUBE_DATA_API_APPROVAL_PROFILES = [
  { id: "youtube-data-api_read_only", label: "Read Only", description: "Read-only YouTube Data API operation for audits, summaries and safe discovery.", defaultSelected: false, allowedActions: allowed.filter((item) => item.id === "read_accessible"), approvalRequiredActions: approvalRequired, blockedActions },
  { id: "youtube-data-api_safe_operator", label: "Safe Operator", description: "Default YouTube Data API operator. Reads, summaries and drafts are allowed; side effects are approval-gated.", defaultSelected: true, allowedActions: allowed, approvalRequiredActions: approvalRequired, blockedActions },
  { id: "youtube-data-api_manager_approval", label: "Manager Approval", description: "Allows approved YouTube Data API writes after explicit review, target confirmation and audit logging.", defaultSelected: false, allowedActions: allowed, approvalRequiredActions: approvalRequired, blockedActions },
  { id: "youtube-data-api_admin_high_risk", label: "Admin High Risk", description: "Administrative YouTube Data API profile. Destructive, secret-exposure, ownership and security-reducing actions remain blocked.", defaultSelected: false, allowedActions: allowed, approvalRequiredActions: approvalRequired, blockedActions },
];
