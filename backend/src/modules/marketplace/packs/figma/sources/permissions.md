# Figma Permissions

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

## Provider Permission Model

- current_user:read
- file_content:read
- file_comments:read
- file_comments:write
- file_components:read
- file_styles:read
- file_variables:read
- webhooks:read
- webhooks:write

## Resource Boundaries

- file keys from figma.com/file/{key} or design URLs
- files with DOCUMENT/CANVAS node trees
- nodes, components, component sets, styles, variables and versions
- comments, comment reactions and resolved state
- image/render export URLs
- teams, projects and webhook contexts

## Safe Permission Checks

- Confirm read access before exports, uploads, moderation, publishing or webhook changes.
- Confirm the token/user/bot has the exact write/admin capability required by the endpoint.
- Treat missing access and 404 responses as possible permission boundaries, not as a reason to bypass controls.
