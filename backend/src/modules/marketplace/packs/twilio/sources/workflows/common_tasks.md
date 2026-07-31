# Twilio Common Workflows

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

- Retrieve message status by SID before reporting delivery, including error code and error message when present.
- Inspect Messaging Service configuration before sending from it.
- For Conversations, read participants and recent messages only for the requested conversation.
- Prepare exact To, From or MessagingServiceSid, Body, media URLs, statusCallback, and compliance context before creating a Message.
- Use WhatsApp-approved senders/templates where required; do not invent template approval.
- Update phone numbers, services, callbacks, or conversations only after approval.
