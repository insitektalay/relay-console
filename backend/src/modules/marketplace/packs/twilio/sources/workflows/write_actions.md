# Twilio Write Workflows

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://www.twilio.com/docs/usage/api
- https://www.twilio.com/docs/usage/requests-to-twilio
- https://www.twilio.com/docs/messaging/api/message-resource
- https://www.twilio.com/docs/usage/webhooks
- https://www.twilio.com/docs/usage/rest-api-best-practices
- https://www.twilio.com/docs/api/errors

- Prepare exact To, From or MessagingServiceSid, Body, media URLs, statusCallback, and compliance context before creating a Message.
- Use WhatsApp-approved senders/templates where required; do not invent template approval.
- Update phone numbers, services, callbacks, or conversations only after approval.
- For calls, show To/From, TwiML or application URL, recording/transcription impact, statusCallback, and emergency-service exclusion before execution.
- For Conversations, show Service SID, Conversation SID, participant identities/addresses, message body/media, webhook impact, and retention/compliance impact.

Before execution, show the Twilio Account SID/subaccount, Message/Call/Conversation/Messaging Service/phone-number SIDs, changed fields, recipient/customer/billing impact, rollback expectations, approval requirement, and audit note.
