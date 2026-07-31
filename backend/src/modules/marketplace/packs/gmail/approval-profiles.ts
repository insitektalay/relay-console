import { action, blocked } from "../../catalog/marketplace-catalog.types";

const allowed = [
  action("read_gmail_search", "Search Gmail narrowly", "Search with Gmail q syntax, labelIds, and a narrow time/window limit."),
  action("read_gmail_message", "Read Gmail message/thread metadata", "Read Gmail thread/message metadata before fetching full MIME body, raw content, or attachments."),
  action("summarize_gmail", "Summarize Gmail safely", "Summarize Gmail without exposing tokens, auth links, one-time codes, or unnecessary personal data."),
  action("draft_gmail_change", "Draft Gmail change", "Prepare exact Gmail draft, reply, forward, label, message-modify, or watch changes for review without side effects."),
];
const approvalRequired = [
  action("gmail_send_or_delete", "Send or delete Gmail mail", "Sending external mail, bulk sends, deleting messages, forwarding attachments, and customer/legal/security/billing mail require approval."),
  action("gmail_secret_transmission", "Transmit Gmail secrets", "Credential, token, auth-link, or one-time-code transmission is blocked even with approval."),
  action("gmail_watch_or_delegation", "Change Gmail watch/delegation", "Gmail Pub/Sub watch changes, broad mailbox export, or domain-wide delegated mailbox access require approval."),
];
const blockedActions = [
  blocked("gmail_abuse_or_secret_exposure", "Gmail abuse or secret exposure", "Emailing secrets, mass unsolicited mail, deleting mailbox/account, bypassing Google Workspace security, and broad mailbox exports are blocked."),
];
export const GMAIL_APPROVAL_PROFILES = [
  { id: "gmail_read_only", label: "Read Only", description: "Read-only Gmail operation.", defaultSelected: false, allowedActions: allowed.filter((item) => item.id.startsWith("read_")), approvalRequiredActions: approvalRequired, blockedActions },
  { id: "gmail_safe_operator", label: "Safe Operator", description: "Default Gmail operator. Reads and drafts are allowed; provider side effects are approval-gated.", defaultSelected: true, allowedActions: allowed, approvalRequiredActions: approvalRequired, blockedActions },
  { id: "gmail_manager_approval", label: "Manager Approval", description: "Allows approved Gmail writes after explicit review and audit.", defaultSelected: false, allowedActions: allowed, approvalRequiredActions: approvalRequired, blockedActions },
  { id: "gmail_admin_high_risk", label: "Admin High Risk", description: "Administrative Gmail profile; destructive and secret-exposure actions remain blocked.", defaultSelected: false, allowedActions: allowed, approvalRequiredActions: approvalRequired, blockedActions },
];
