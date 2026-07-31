# Twilio Permissions and Scopes

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

## Provider Permission Model

Limit credentials to the subaccount/project and product surface needed. Sending Messages, Calls, WhatsApp, changing Messaging Services, phone-number configuration, webhooks, or account settings are high-risk writes.

## Capability Mapping

- Read capability: retrieve Twilio Message/Call/Conversation SIDs, delivery status, error codes, Messaging Service configuration, phone-number metadata, participants, and webhook/callback settings with bounded API queries.
- Draft capability: prepare exact Twilio Message, Call, Conversation, participant, phone-number, Messaging Service, status-callback, or webhook payloads without side effects.
- Write capability: create/send Twilio messages, calls, Conversation messages/participants, or update selected Messaging Service and phone-number settings only inside approved account/subaccount policy.
- Admin capability: Twilio API-key/auth-token changes, Messaging Service sender pools, phone-number purchase/release/configuration, compliance bundles, webhooks/status callbacks, account/subaccount/billing settings, and destructive operations; disabled by default.
