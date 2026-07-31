# Airtable API Authentication

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://airtable.com/developers/web/api/introduction
- https://airtable.com/developers/web/api/authentication
- https://airtable.com/developers/web/api/scopes
- https://airtable.com/developers/web/api/list-records
- https://airtable.com/developers/web/api/rate-limits
- https://airtable.com/developers/web/api/webhooks-overview
- https://airtable.com/developers/web/api/errors

OAuth or personal access tokens. Tokens remain in ClawChat connections and are constrained by workspace/base/doc sharing and provider permissions.

Use connector-held Airtable personal access tokens or OAuth tokens. Confirm scopes such as record read/write, schema read/write, webhook management, and base access before selecting methods. Do not infer missing Airtable credentials from user text; if token scope or base authorization is insufficient, ask the user to repair the Airtable connection or authorize the target base.
