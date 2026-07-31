import { capability } from "../../catalog/marketplace-catalog.types";

export const RESEND_CAPABILITIES = [
  capability("read", "Read Resend", "Read Resend email status, verified domains/DNS records, API-key metadata, bounded audiences/contacts, broadcasts, and webhook configuration without exposing secrets.", true),
  capability("draft", "Draft Resend", "Prepare exact Resend /emails, batch send, broadcast, domain, contact/audience, API-key, or webhook payloads without side effects.", true),
  capability("write", "Write Resend", "Send approved transactional emails and mutate Resend contacts, audiences, domains, broadcasts, or webhooks only after policy and approval checks.", false),
  capability("admin", "Admin Resend", "Operate Resend API-key creation/deletion, domain verification/deletion, webhook endpoints, broadcast scheduling, high-volume recipient changes, and account configuration under explicit approval.", false),
];
