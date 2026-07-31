# Canva Permissions

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

## Provider Permission Model

- design:meta:read
- design:content:read
- design:content:write
- asset:read
- asset:write
- folder:read
- folder:write
- folder:permission:write
- brandtemplate:meta:read
- brandtemplate:content:read
- comment:read
- comment:write
- collaboration:event
- openid
- profile
- email

## Resource Boundaries

- designs and design imports
- folders and folder permissions
- assets/uploads for image, audio and video files
- brand templates and brand-template content
- comments, replies and collaboration notifications
- export jobs with temporary download URLs

## Safe Permission Checks

- Confirm read access before exports, uploads, moderation, publishing or webhook changes.
- Confirm the token/user/bot has the exact write/admin capability required by the endpoint.
- Treat missing access and 404 responses as possible permission boundaries, not as a reason to bypass controls.
