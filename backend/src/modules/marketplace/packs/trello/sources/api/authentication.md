# Trello API Authentication

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://developer.atlassian.com/cloud/trello/rest/
- https://developer.atlassian.com/cloud/trello/guides/rest-api/authorization/
- https://developer.atlassian.com/cloud/trello/guides/rest-api/rate-limits/
- https://developer.atlassian.com/cloud/trello/guides/rest-api/webhooks/
- https://developer.atlassian.com/cloud/trello/rest/api-group-cards/

API key plus OAuth token. Tokens stay in ClawChat and inherit workspace/project access.

Use connector-held Trello API key and token for the authorized member and board/workspace access. Confirm the token can read or write the target board, list, card, and webhook model before selecting endpoints. Do not infer missing Trello credentials from user text; if token access is insufficient, ask the user to repair the Trello connection.
