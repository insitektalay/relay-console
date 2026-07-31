import { action, blocked } from "../../catalog/marketplace-catalog.types";

const allowed = [
  action("read_email_status", "Read Resend email status", "Retrieve a Resend email by id before reporting delivery status."),
  action("read_domain_verification", "Read Resend domain verification", "Check Resend domain verification before sending from a domain; explain required DNS records without exposing secrets."),
  action("read_audience_contacts", "Read bounded Resend audience contacts", "List Resend audiences/contacts only for a bounded user request and avoid exporting full recipient lists."),
  action("draft_resend_payload", "Draft Resend payload", "Prepare exact Resend email, batch, broadcast, domain, contact/audience, API-key, or webhook payloads for review without side effects."),
];
const approvalRequired = [
  action("resend_live_send", "Send live Resend email", "Any live email send, batch send, broadcast, domain mutation, API-key mutation, webhook change, or audience/contact bulk change requires approval."),
  action("resend_sensitive_content", "Send sensitive Resend content", "External/customer-facing email content and emails containing legal, billing, security, or account-status language require approval."),
  action("resend_attachment_or_volume", "Send attachments or high-volume email", "Sending attachments or high-recipient-count messages requires approval."),
];
const blockedActions = [
  blocked("resend_abuse_or_secret_exposure", "Resend abuse or secret exposure", "Spam campaigns, purchased lists, credential emailing, API key exposure, webhook secret exposure, and sender-domain spoofing are blocked."),
  blocked("resend_unapproved_sensitive_notice", "Unapproved sensitive notice", "Do not send password reset, security, billing, or legal notices unless the user approved exact content and recipients."),
  blocked("resend_unknown_opt_in", "Unknown Resend opt-in", "Do not infer opt-in status; require source-of-truth confirmation for audiences."),
];
export const RESEND_APPROVAL_PROFILES = [
  { id: "resend_read_only", label: "Read Only", description: "Read-only Resend operation.", defaultSelected: false, allowedActions: allowed.filter((item) => item.id.startsWith("read_")), approvalRequiredActions: approvalRequired, blockedActions },
  { id: "resend_safe_operator", label: "Safe Operator", description: "Default Resend operator. Reads and drafts are allowed; provider side effects are approval-gated.", defaultSelected: true, allowedActions: allowed, approvalRequiredActions: approvalRequired, blockedActions },
  { id: "resend_manager_approval", label: "Manager Approval", description: "Allows approved Resend writes after explicit review and audit.", defaultSelected: false, allowedActions: allowed, approvalRequiredActions: approvalRequired, blockedActions },
  { id: "resend_admin_high_risk", label: "Admin High Risk", description: "Administrative Resend profile; destructive and secret-exposure actions remain blocked.", defaultSelected: false, allowedActions: allowed, approvalRequiredActions: approvalRequired, blockedActions },
];
