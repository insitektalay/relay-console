# Twilio Escalation

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

Escalate when Twilio credentials are missing, Account SID/subaccount or API-key context is insufficient, Message/Call/Conversation/Messaging Service/phone-number SIDs are ambiguous, the operation is approval-required, the request touches secrets or high-risk recipient data, Twilio returns conflicting delivery/configuration state, or official docs do not cover the requested endpoint.

## Approval-Required Patterns

- Every live SMS/MMS/WhatsApp/call send requires approval unless the workspace has an explicit pre-approved transactional policy.
- Changing status callbacks, Messaging Service sender pools, phone numbers, compliance bundles, or webhooks requires approval.
- Bulk messaging, customer-facing notifications, billing/security/account messages, and international sends require approval.

## Blocked Patterns

- Emergency services, harassment, spam, credential transmission, caller-ID spoofing, compliance bypass, auth-token exposure, and unapproved paid messaging are blocked.
- Do not send secrets or one-time codes through Twilio unless the user-approved product flow requires it and masks values in logs.
- Do not disable opt-out or compliance settings.
