# Coda API Authentication

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://coda.io/developers/apis/v1
- https://coda.io/developers/apis/v1#section/Authentication
- https://coda.io/developers/apis/v1#operation/listDocs
- https://coda.io/developers/apis/v1#section/Rate-limits
- https://coda.io/developers/apis/v1#section/Errors
- https://coda.io/developers/apis/v1#tag/Webhooks

Bearer API tokens. Tokens remain in ClawChat connections and are constrained by workspace/base/doc sharing and provider permissions.

Use connector-held Coda API tokens for the authorized Coda account and doc access. Confirm the token can access the target doc and table before reading or writing rows. Do not infer missing Coda credentials from user text; if token scope or doc access is insufficient, ask the user to repair the Coda connection or share the doc with the integration account.
