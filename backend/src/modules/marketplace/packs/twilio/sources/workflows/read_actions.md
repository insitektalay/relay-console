# Twilio Read Workflows

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

Always use explicit Twilio Account SID/subaccount, Message SID, Call SID, Conversation SID, Messaging Service SID, phone-number SID, participant SID, or narrow Twilio list filters. Summaries must redact secrets and unnecessary personal, customer, financial, security, source-code, or private recipient data.
