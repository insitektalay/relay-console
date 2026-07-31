# Zendesk Auth Setup

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

Zendesk Support API calls target the connected `{subdomain}.zendesk.com` site under `/api/v2/...`. Authentication may use OAuth access tokens or API token auth with an email/token identity. Store API tokens, OAuth tokens, client secrets, and webhook secrets only in ClawChat.

Never put Zendesk tokens in URLs, ticket comments, internal notes, examples, generated files, or logs. Stop on missing subdomain, invalid credentials, expired OAuth, insufficient role, or disabled token auth.
