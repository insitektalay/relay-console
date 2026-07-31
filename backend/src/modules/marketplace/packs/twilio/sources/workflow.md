# Twilio Workflow Router

Use Twilio for SMS, MMS, WhatsApp, calls, Conversations, messaging services, phone numbers, delivery status, and status callbacks tied to explicit approved communications.

Do not use Twilio for emergency calling, spam, cold outreach, secret transmission, or mailbox-style email/chat operations.

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

## Routing Doctrine

1. Confirm the connected Twilio Account SID or subaccount, API key context, Messaging Service, sender, recipient, channel type, message/call/conversation SID, and status callback target before selecting tools.
2. Load auth, permissions, endpoint, rate-limit, webhook, error, safe-action, and workflow references before writes.
3. Resolve Twilio Account SID, subaccount SID, Message SID, Call SID, Conversation SID, Messaging Service SID, phone-number SID, sender id, participant id, and webhook URL ownership from Twilio APIs before mutating anything.
4. Draft every live SMS/MMS/WhatsApp/call send, bulk message, international send, customer-facing notification, status-callback change, Messaging Service sender-pool change, phone-number update, compliance-bundle change, Conversation mutation, and webhook change for approval unless the connection has an explicit pre-approved transactional policy.
5. Record Twilio SIDs, sender/recipient/channel type, endpoint path, approval id, delivery status, error code/message where present, and safe response summaries after approved writes.

## When To Use

Use Twilio for SMS, MMS, WhatsApp, calls, Conversations, messaging services, phone numbers, delivery status, and status callbacks tied to explicit approved communications.

## When Not To Use

Do not use Twilio for emergency calling, spam, cold outreach, secret transmission, or mailbox-style email/chat operations.
