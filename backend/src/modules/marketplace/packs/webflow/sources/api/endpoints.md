# Webflow Endpoints

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://developers.webflow.com/data/reference/authentication
- https://developers.webflow.com/v2.0.0/data/reference/scopes
- https://developers.webflow.com/data/reference/cms/collection-items
- https://developers.webflow.com/data/reference/pages
- https://developers.webflow.com/data/reference/webhooks
- https://developers.webflow.com/data/v2.0.0/reference/rate-limits

## Representative Endpoints

- GET /v2/sites and GET /v2/sites/{site_id}
- GET /v2/sites/{site_id}/pages
- GET /v2/sites/{site_id}/collections and collection fields
- GET/POST/PATCH/DELETE /v2/collections/{collection_id}/items
- GET/POST /v2/sites/{site_id}/assets
- GET /v2/sites/{site_id}/forms and submissions
- POST /v2/sites/{site_id}/publish
- GET/POST/DELETE webhook endpoints

## Method Guidance

- GET/list endpoints are preferred for discovery and summaries.
- POST/PATCH/PUT/DELETE endpoints are side-effecting and must pass capability, permission and approval checks.
- For publish/export/moderation/admin endpoints, include exact target IDs and a rollback or remediation note where the provider supports one.
