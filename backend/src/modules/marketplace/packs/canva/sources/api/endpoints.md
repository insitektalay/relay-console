# Canva Endpoints

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://www.canva.dev/docs/connect/
- https://www.canva.dev/docs/connect/authentication/
- https://www.canva.dev/docs/connect/appendix/scopes/
- https://www.canva.dev/docs/connect/canva-concepts/
- https://www.canva.dev/docs/connect/api-reference/exports/create-design-export-job/
- https://www.canva.dev/docs/connect/webhooks/

## Representative Endpoints

- GET/POST /rest/v1/designs and design import endpoints
- GET/POST/PATCH/DELETE /rest/v1/folders
- GET/POST/PATCH/DELETE /rest/v1/assets
- GET /rest/v1/brand-templates and content endpoints
- POST /rest/v1/exports and GET /rest/v1/exports/{job_id}
- comment and reply endpoints where enabled
- webhook/event subscription endpoints for collaboration events

## Method Guidance

- GET/list endpoints are preferred for discovery and summaries.
- POST/PATCH/PUT/DELETE endpoints are side-effecting and must pass capability, permission and approval checks.
- For publish/export/moderation/admin endpoints, include exact target IDs and a rollback or remediation note where the provider supports one.
