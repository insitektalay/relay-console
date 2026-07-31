import { action, blocked } from "../../catalog/marketplace-catalog.types";

const allowed = [
  action("read_message_status", "Read Twilio message status", "Retrieve Twilio message status by SID before reporting delivery, including error code and error message when present."),
  action("read_messaging_service", "Read Twilio Messaging Service", "Inspect Twilio Messaging Service configuration, sender pool, and callback settings before sending from it."),
  action("read_conversation", "Read Twilio Conversation", "For Twilio Conversations, read participants and recent messages only for the requested Conversation SID."),
  action("draft_twilio_payload", "Draft Twilio payload", "Prepare exact Twilio Message, Call, Conversation, participant, phone-number, Messaging Service, callback, or webhook payloads for review without side effects."),
];
const approvalRequired = [
  action("twilio_live_send", "Send live Twilio communication", "Every live SMS/MMS/WhatsApp/call send requires approval unless the connection has an explicit pre-approved transactional policy."),
  action("twilio_config_change", "Change Twilio messaging configuration", "Changing status callbacks, Messaging Service sender pools, phone numbers, compliance bundles, Conversations services, or webhooks requires approval."),
  action("twilio_bulk_or_sensitive_send", "Send bulk/sensitive Twilio message", "Bulk messaging, customer-facing notifications, billing/security/account messages, and international sends require approval."),
];
const blockedActions = [
  blocked("twilio_abuse_or_secret_exposure", "Twilio abuse or secret exposure", "Emergency services, harassment, spam, credential transmission, caller-ID spoofing, compliance bypass, auth-token exposure, and unapproved paid messaging are blocked."),
  blocked("twilio_unapproved_secret_message", "Unapproved Twilio secret message", "Do not send secrets or one-time codes through Twilio unless the user-approved product flow requires it and masks values in logs."),
  blocked("twilio_compliance_disable", "Disable Twilio compliance controls", "Do not disable opt-out, consent, WhatsApp template approval, or compliance settings."),
];
export const TWILIO_APPROVAL_PROFILES = [
  { id: "twilio_read_only", label: "Read Only", description: "Read-only Twilio operation.", defaultSelected: false, allowedActions: allowed.filter((item) => item.id.startsWith("read_")), approvalRequiredActions: approvalRequired, blockedActions },
  { id: "twilio_safe_operator", label: "Safe Operator", description: "Default Twilio operator. Reads and drafts are allowed; provider side effects are approval-gated.", defaultSelected: true, allowedActions: allowed, approvalRequiredActions: approvalRequired, blockedActions },
  { id: "twilio_manager_approval", label: "Manager Approval", description: "Allows approved Twilio writes after explicit review and audit.", defaultSelected: false, allowedActions: allowed, approvalRequiredActions: approvalRequired, blockedActions },
  { id: "twilio_admin_high_risk", label: "Admin High Risk", description: "Administrative Twilio profile; destructive and secret-exposure actions remain blocked.", defaultSelected: false, allowedActions: allowed, approvalRequiredActions: approvalRequired, blockedActions },
];
