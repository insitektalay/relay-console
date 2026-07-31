import { action, blocked } from "../../catalog/marketplace-catalog.types";

const allowed = [
  action("read_outlook_search", "Search Outlook narrowly", "Search Outlook with Microsoft Graph $search/$filter, folders, and a narrow time/window limit."),
  action("read_outlook_message", "Read Outlook message metadata", "Read Outlook message/conversation metadata before fetching full body or attachments."),
  action("summarize_outlook", "Summarize Outlook safely", "Summarize Outlook mail without exposing tokens, auth links, one-time codes, or unnecessary personal data."),
  action("draft_outlook_change", "Draft Outlook change", "Prepare exact Outlook sendMail, draft, reply, forward, move, category, attachment, or subscription changes for review without side effects."),
];
const approvalRequired = [
  action("outlook_send_or_delete", "Send or delete Outlook mail", "Sending external mail, bulk sends, deleting messages, forwarding attachments, and customer/legal/security/billing mail require approval."),
  action("outlook_secret_transmission", "Transmit Outlook secrets", "Credential, token, auth-link, or one-time-code transmission is blocked even with approval."),
  action("outlook_admin_access", "Change Outlook admin access", "Application-wide mailbox access, shared/delegated mailbox changes, mailbox rules/settings, and Graph subscriptions require approval."),
];
const blockedActions = [
  blocked("outlook_abuse_or_secret_exposure", "Outlook abuse or secret exposure", "Emailing secrets, mass unsolicited mail, deleting mailbox/account, bypassing Microsoft tenant security, and broad mailbox exports are blocked."),
];
export const OUTLOOK_APPROVAL_PROFILES = [
  { id: "outlook_read_only", label: "Read Only", description: "Read-only Outlook operation.", defaultSelected: false, allowedActions: allowed.filter((item) => item.id.startsWith("read_")), approvalRequiredActions: approvalRequired, blockedActions },
  { id: "outlook_safe_operator", label: "Safe Operator", description: "Default Outlook operator. Reads and drafts are allowed; provider side effects are approval-gated.", defaultSelected: true, allowedActions: allowed, approvalRequiredActions: approvalRequired, blockedActions },
  { id: "outlook_manager_approval", label: "Manager Approval", description: "Allows approved Outlook writes after explicit review and audit.", defaultSelected: false, allowedActions: allowed, approvalRequiredActions: approvalRequired, blockedActions },
  { id: "outlook_admin_high_risk", label: "Admin High Risk", description: "Administrative Outlook profile; destructive and secret-exposure actions remain blocked.", defaultSelected: false, allowedActions: allowed, approvalRequiredActions: approvalRequired, blockedActions },
];
