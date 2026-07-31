# Notion API Authentication

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://developers.notion.com/docs/getting-started
- https://developers.notion.com/docs/authorization
- https://developers.notion.com/docs/authorization#capabilities
- https://developers.notion.com/reference/intro
- https://developers.notion.com/reference/request-limits
- https://developers.notion.com/reference/status-codes
- https://developers.notion.com/reference/webhooks

Notion supports internal integration tokens and OAuth integrations. Tokens are bearer credentials stored in ClawChat connections. Notion-Version headers control API behavior and must be pinned by tools. An integration can only access pages and databases that have been shared with it or authorized during OAuth.

Send Notion API requests with the connector-held bearer token and the pinned `Notion-Version` header. For OAuth connections, preserve the authorized workspace, bot/integration identity, and granted capabilities from the authorization flow. For internal integrations, confirm the target parent page/database was shared with the integration before reading or writing.

Do not infer missing Notion credentials from user text. If an object is inaccessible, ask the user to share the page/database with the integration or repair the OAuth connection rather than requesting the raw token.
