# Notion Auth Setup

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

## Authentication Model

Notion supports internal integration tokens and OAuth integrations. Tokens are bearer credentials stored in ClawChat connections. Notion-Version headers control API behavior and must be pinned by tools. An integration can only access pages and databases that have been shared with it or authorized during OAuth.

Internal integrations are workspace-local and should be granted only the capabilities needed for the workflow: read content, insert content, update content, and comment capabilities. OAuth integrations rely on the Notion authorization flow and workspace user consent; do not assume an OAuth token can see every page in the workspace.

Every Notion API request should include the pinned `Notion-Version` header used by the connector. If a page, database, data source, block, or user is missing, check sharing/authorization first before concluding the object was deleted.

## Secret Safety

- Store provider tokens, API keys, client secrets, refresh tokens, webhook secrets, signing secrets, private keys, and database/payment secrets only in ClawChat connections.
- Never display, summarize, forward, log, or write Notion integration tokens, OAuth client secrets, refresh tokens, webhook secrets, private keys, or credential-shaped values into pages, comments, blocks, files, tool output, or generated docs.
- If authentication fails, stop and ask the user to repair the connection. Do not request secret values in chat.
