import { action, blocked } from "../../catalog/marketplace-catalog.types";

const allowed = [
  action("read_support_records", "Read Zendesk support records", "Read tickets, users, organizations, groups, agents, comments, tags, attachments, macros, triggers, automations, and webhooks using bounded Support API queries."),
  action("summarize_ticket_state", "Summarize ticket state", "Summarize requester, assignee, group, status, priority, tags, public comments, and internal notes while preserving visibility boundaries."),
  action("draft_ticket_change", "Draft Zendesk ticket change", "Prepare exact ticket update, internal note, public reply, tag, requester, assignee, group, organization, or status payloads for review without side effects."),
  action("validate_comment_visibility", "Validate public vs internal comments", "Confirm whether a Zendesk comment is public or internal before drafting or proposing ticket updates."),
];

const approvalRequired = [
  action("public_ticket_reply", "Send public ticket reply", "Customer-visible Zendesk public comments, requester replies, side conversations, and Help Center publication require approval."),
  action("ticket_lifecycle_or_assignment", "Change ticket lifecycle or assignment", "Changing ticket status, priority, requester, assignee, group, tags at scale, or SLA-impacting fields requires approval."),
  action("bulk_ticket_or_customer_change", "Bulk mutate or export Zendesk data", "Bulk ticket/user/organization updates, exports, merges, deletes, attachment downloads at scale, and mass closures require approval."),
  action("automation_or_webhook_change", "Change automations, triggers, macros, or webhooks", "Creating or modifying macros, triggers, automations, webhooks, groups, roles, or routing rules requires approval."),
];

const blockedActions = [
  blocked("zendesk_secret_exposure", "Expose Zendesk secrets", "API tokens, OAuth access/refresh tokens, client secrets, webhook secrets, and credential-shaped values must never be displayed, logged, or written to tickets."),
  blocked("zendesk_visibility_bypass", "Bypass ticket visibility or impersonate agents", "Impersonating a human, fabricating approval, bypassing roles, exposing internal notes as public replies, or exporting restricted ticket data is blocked."),
  blocked("zendesk_account_destruction", "Delete account or destructive bulk action", "Deleting the Zendesk account, disabling security/compliance/audit controls, mass customer messaging, and destructive bulk ticket actions are blocked."),
];

export const ZENDESK_APPROVAL_PROFILES = [
  { id: "zendesk_read_only", label: "Read Only", description: "Read-only Zendesk operation.", defaultSelected: false, allowedActions: allowed.filter((item) => item.id !== "draft_ticket_change"), approvalRequiredActions: approvalRequired, blockedActions },
  { id: "zendesk_safe_operator", label: "Safe Operator", description: "Default Zendesk operator. Reads, summaries, comment-visibility validation, and drafts are allowed; ticket side effects are approval-gated.", defaultSelected: true, allowedActions: allowed, approvalRequiredActions: approvalRequired, blockedActions },
  { id: "zendesk_manager_approval", label: "Manager Approval", description: "Allows approved Zendesk writes after explicit review and audit.", defaultSelected: false, allowedActions: allowed, approvalRequiredActions: approvalRequired, blockedActions },
  { id: "zendesk_admin_high_risk", label: "Admin High Risk", description: "Administrative Zendesk profile; destructive, visibility-bypass, mass-message, and secret-exposure actions remain blocked.", defaultSelected: false, allowedActions: allowed, approvalRequiredActions: approvalRequired, blockedActions },
];
