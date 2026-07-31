import { action, blocked } from "../../catalog/marketplace-catalog.types";

const allowed = [
  action("read_context", "Read Bluesky context", "Read profiles, feeds, threads, posts, likes, reposts, labels, and DID/handle metadata."),
  action("draft_content", "Draft Bluesky content", "Draft posts, replies, quote posts, alt text, thread sequences, and moderation-aware response plans."),
];

const approvalRequired = [
  action("publish_public_content", "Publish public content", "Posting, replying, commenting, uploading media, or otherwise creating externally visible Bluesky content requires explicit approval."),
  action("send_private_message", "Send private or direct message", "Sending DMs, private replies, customer messages, or sensitive relationship communication requires approval."),
  action("moderate_or_delete", "Moderate, edit, hide, or delete", "Deleting, hiding, locking, banning, reporting, editing published content, or changing moderation state requires approval."),
  action("bulk_or_scheduled_action", "Bulk or scheduled action", "Bulk publishing, scheduled campaigns, repeated engagement, high-volume replies, or automation loops require approval."),
  action("permission_or_app_change", "Permission or app change", "Changing OAuth scopes, session credentials, PDS configuration, connected handles, or credentials requires approval."),
];

const blockedActions = [
  blocked("secret_exposure", "Expose Bluesky secrets", "Access tokens, refresh tokens, client secrets, app passwords, webhook secrets, signing secrets, private media URLs, and session cookies must never be printed, committed, or sent in chat."),
  blocked("spam_or_platform_abuse", "Spam or platform abuse", "Spam, fake engagement, unsolicited bulk messaging, harassment, evasion of platform limits, scraped personal data workflows, or ToS-bypassing automation are blocked."),
  blocked("impersonation_or_fake_approval", "Impersonation or fake approval", "Do not impersonate users, fabricate approvals, misrepresent sponsorships, bypass platform identity checks, or publish as a person/brand without explicit authorization."),
];

export const BLUESKY_APPROVAL_PROFILES = [
  { id: "bluesky_read_only", label: "Read Only", description: "Read-only Bluesky monitoring and reporting.", defaultSelected: false, allowedActions: allowed.filter((item) => item.id === "read_context"), approvalRequiredActions: approvalRequired, blockedActions },
  { id: "bluesky_safe_operator", label: "Safe Operator", description: "Default Bluesky operator. Reads and drafts are allowed; provider side effects are approval-gated.", defaultSelected: true, allowedActions: allowed, approvalRequiredActions: approvalRequired, blockedActions },
  { id: "bluesky_publisher", label: "Approved Publisher", description: "Allows approved Bluesky publishing workflows with audit trail; destructive, bulk, and credential actions remain approval-gated or blocked.", defaultSelected: false, allowedActions: allowed, approvalRequiredActions: approvalRequired, blockedActions },
  { id: "bluesky_admin_high_risk", label: "Admin High Risk", description: "Administrative Bluesky profile for app, account, or moderation setup; secret exposure and platform abuse remain blocked.", defaultSelected: false, allowedActions: allowed, approvalRequiredActions: approvalRequired, blockedActions },
];
