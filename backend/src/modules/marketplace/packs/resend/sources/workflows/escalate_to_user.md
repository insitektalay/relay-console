# Resend Escalation

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

Escalate when the Resend API key is missing or invalid, account policy is insufficient, email/domain/audience/contact/broadcast/API-key/webhook ids are ambiguous, the operation is approval-required, the request touches secrets or high-risk recipient data, Resend returns conflicting delivery/domain state, or official docs do not cover the requested endpoint.

## Approval-Required Patterns

- Any live email send, batch send, broadcast, domain mutation, API-key mutation, webhook change, or audience/contact bulk change requires approval.
- External/customer-facing content and emails containing legal, billing, security, or account-status language require approval.
- Sending attachments or high-recipient-count messages requires approval.

## Blocked Patterns

- Spam campaigns, purchased lists, credential emailing, API key exposure, webhook secret exposure, and sender-domain spoofing are blocked.
- Do not send password reset, security, billing, or legal notices unless the user approved exact content and recipients.
- Do not infer opt-in status; require source-of-truth confirmation for audiences.
