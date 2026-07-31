import { action, blocked } from "../../catalog/marketplace-catalog.types";

const allowed = [
  action("read_conversation", "Read Slack conversation context", "Resolve the Slack channel/conversation id, verify visibility and bot membership, call conversations.history with a bounded window, and fetch conversations.replies only for requested threads."),
  action("read_user", "Resolve Slack user identity", "Use users.info or users.lookupByEmail only when selected scopes allow it; do not infer identity from display names alone."),
  action("read_file", "Inspect Slack file metadata", "Inspect files.info and message shares; do not download private files unless the user explicitly requested that file and capability is enabled."),
  action("draft_message", "Draft Slack message payload", "Prepare exact chat.postMessage, chat.update, Block Kit, thread reply, reaction, or file upload payloads for review without side effects."),
];
const approvalRequired = [
  action("broadcast_or_external_post", "Broadcast or external Slack post", "Posting to @channel, @here, large public channels, executive channels, incident channels, shared/external channels, or customer-visible Slack Connect channels requires approval."),
  action("collaboration_surface_change", "Change Slack collaboration surface", "Adding/removing files, pins, bookmarks, channel topics, channel membership, webhooks, or event subscriptions requires approval."),
  action("message_edit_or_delete", "Edit or delete Slack message", "Deleting or updating existing messages requires approval unless the message is the agent draft in the same workflow."),
  action("scope_or_install_change", "Change Slack app scopes/install", "Scope expansion, app reinstall, use of chat:write.public, signing-secret rotation, or Socket Mode changes require approval."),
];
const blockedActions = [
  blocked("slack_secret_exposure", "Expose Slack secrets", "Exposing bot tokens, user tokens, signing secrets, app-level tokens, webhook URLs, or Slack export archives is blocked."),
  blocked("slack_mass_or_retention_abuse", "Mass DM or retention bypass", "Mass DM, spam, workspace deletion, bypassing retention/legal hold, and broad private-channel export are blocked."),
  blocked("slack_impersonation", "Impersonate or fabricate approval", "Do not impersonate users, invite external users without approval, fabricate approval from emoji reactions, or use mention-broadcasts to pressure users."),
];
export const SLACK_APPROVAL_PROFILES = [
  { id: "slack_read_only", label: "Read Only", description: "Read-only Slack operation.", defaultSelected: false, allowedActions: allowed.filter((item) => item.id.startsWith("read_")), approvalRequiredActions: approvalRequired, blockedActions },
  { id: "slack_safe_operator", label: "Safe Operator", description: "Default Slack operator. Reads and drafts are allowed; provider side effects are approval-gated.", defaultSelected: true, allowedActions: allowed, approvalRequiredActions: approvalRequired, blockedActions },
  { id: "slack_manager_approval", label: "Manager Approval", description: "Allows approved Slack writes after explicit review and audit.", defaultSelected: false, allowedActions: allowed, approvalRequiredActions: approvalRequired, blockedActions },
  { id: "slack_admin_high_risk", label: "Admin High Risk", description: "Administrative Slack profile; destructive and secret-exposure actions remain blocked.", defaultSelected: false, allowedActions: allowed, approvalRequiredActions: approvalRequired, blockedActions },
];
