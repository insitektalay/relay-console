# Salesforce API Authentication

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

Use OAuth access tokens against the org-specific instance URL returned by auth. Send `Authorization: Bearer <access_token>` and never place tokens in URLs, records, comments, generated docs, or logs.

Validate connected-app scopes and running-user permissions before writes. Stop on `INVALID_SESSION_ID`, expired refresh, insufficient scope, or authorization errors.
