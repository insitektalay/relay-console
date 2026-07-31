# Twilio Endpoint Families

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

- POST/GET /2010-04-01/Accounts/{AccountSid}/Messages.json
- GET /Messages/{MessageSid}.json
- POST/GET Calls resources
- Conversations API: Services, Conversations, Participants, Messages, Webhooks
- Messaging Services API for sender pools and configuration
- IncomingPhoneNumbers and AvailablePhoneNumbers resources

## Read Method Doctrine

- Retrieve message status by SID before reporting delivery, including error code and error message when present.
- Inspect Messaging Service configuration before sending from it.
- For Conversations, read participants and recent messages only for the requested conversation.

## Write Method Doctrine

- Prepare exact To, From or MessagingServiceSid, Body, media URLs, statusCallback, and compliance context before creating a Message.
- Use WhatsApp-approved senders/templates where required; do not invent template approval.
- Update phone numbers, services, callbacks, or conversations only after approval.
