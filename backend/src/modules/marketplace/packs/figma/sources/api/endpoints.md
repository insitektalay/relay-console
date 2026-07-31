# Figma Endpoints

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://developers.figma.com/docs/rest-api/
- https://developers.figma.com/docs/rest-api/authentication/
- https://developers.figma.com/docs/rest-api/scopes/
- https://developers.figma.com/docs/rest-api/file-endpoints/
- https://developers.figma.com/docs/rest-api/webhooks/
- https://developers.figma.com/docs/rest-api/rate-limits/

## Representative Endpoints

- GET /v1/files/{file_key}
- GET /v1/files/{file_key}/nodes?ids={node_ids}
- GET /v1/images/{file_key}?ids={node_ids}&format=png|jpg|svg|pdf
- GET/POST /v1/files/{file_key}/comments
- GET /v1/files/{file_key}/components and /component_sets, /styles
- GET /v1/teams/{team_id}/projects and GET /v1/projects/{project_id}/files
- GET/POST/PUT/DELETE /v2/webhooks

## Method Guidance

- GET/list endpoints are preferred for discovery and summaries.
- POST/PATCH/PUT/DELETE endpoints are side-effecting and must pass capability, permission and approval checks.
- For publish/export/moderation/admin endpoints, include exact target IDs and a rollback or remediation note where the provider supports one.
