# HubSpot API Authentication

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

Use `Authorization: Bearer <token>` with either a private app access token or an OAuth access token stored in ClawChat. Do not place tokens in URLs, comments, notes, examples, or logs.

Before writing, verify auth type, portal, scopes, and token health. Authentication failures, `401`, `403`, missing scope errors, and expired OAuth refresh flows must stop the workflow until the connection is repaired.
