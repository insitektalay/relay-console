# Salesforce Endpoint Families

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

- Versions/resources: `GET /services/data`, `GET /services/data/vXX.X/`.
- sObject metadata: `GET /sobjects`, `GET /sobjects/{Object}/describe`.
- sObject records: `GET/POST /sobjects/{Object}`, `GET/PATCH/DELETE /sobjects/{Object}/{Id}`.
- SOQL: `GET /query?q=SELECT ...` and queryMore URLs for pagination.
- SOSL: `GET /search?q=FIND ...` for cross-object text search.
- Composite: `/composite`, `/composite/batch`, `/composite/tree`, and graph-style requests where supported.
- Limits and usage: `/limits` and `Sforce-Limit-Info` headers.
- Events: Platform Event and CDC resources/subscriptions where the connector supports them.

## Write Doctrine

For every write, show object API name, record id, field API names, old/new values where known, record type, owner, external/customer impact, approval id, and rollback expectation.
