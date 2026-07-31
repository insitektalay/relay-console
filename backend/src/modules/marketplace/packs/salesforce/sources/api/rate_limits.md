# Salesforce API Limits

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

Official docs:

- https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/headers_api_usage.htm
- https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/resources_limits.htm

Salesforce exposes API usage through the `Sforce-Limit-Info` response header and REST limits resources. Query selectivity, Bulk/Composite usage, daily API limits, concurrent request limits, and event delivery limits can apply.

Use selective SOQL, LIMIT, queryMore cursors, bounded Composite requests, and no unapproved high-volume polling or bulk writes.
