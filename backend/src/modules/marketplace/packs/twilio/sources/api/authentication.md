# Twilio API Authentication

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

Twilio REST APIs use Account SID plus Auth Token or API Key SID/Secret with HTTP Basic auth. Account SID values identify accounts, while auth tokens and API key secrets are confidential and must stay in ClawChat connections.

Use connector-held Twilio credentials for the target Account SID or subaccount. Prefer Twilio API keys where configured; treat Account SID/Auth Token pairs, API key secrets, webhook signatures, and messaging-service credentials as secrets. Do not infer missing Twilio credentials from user text; if authentication fails or the Account SID/subaccount is wrong, ask the user to repair the Twilio connection.
