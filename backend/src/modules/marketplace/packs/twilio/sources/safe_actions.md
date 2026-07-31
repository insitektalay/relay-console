# Twilio Safe Actions

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Allowed Without Additional Approval

- Retrieve message status by SID before reporting delivery, including error code and error message when present.
- Inspect Messaging Service configuration before sending from it.
- For Conversations, read participants and recent messages only for the requested conversation.

## Approval Required

- Every live SMS/MMS/WhatsApp/call send requires approval unless the workspace has an explicit pre-approved transactional policy.
- Changing status callbacks, Messaging Service sender pools, phone numbers, compliance bundles, or webhooks requires approval.
- Bulk messaging, customer-facing notifications, billing/security/account messages, and international sends require approval.

## Blocked

- Emergency services, harassment, spam, credential transmission, caller-ID spoofing, compliance bypass, auth-token exposure, and unapproved paid messaging are blocked.
- Do not send secrets or one-time codes through Twilio unless the user-approved product flow requires it and masks values in logs.
- Do not disable opt-out or compliance settings.

## Secret-Safety Rule

Provider secrets and credential-shaped values must never appear in responses, generated files, examples, audit notes, or provider-side comments/messages.
