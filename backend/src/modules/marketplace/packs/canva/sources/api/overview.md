# Canva API Overview

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

## Provider Object Model

- designs and design imports
- folders and folder permissions
- assets/uploads for image, audio and video files
- brand templates and brand-template content
- comments, replies and collaboration notifications
- export jobs with temporary download URLs

## Endpoint Families

- Designs: Use design endpoints for metadata/content reads and design creation only when design:content:write is enabled.
- Folders: Folder writes and permission changes can expose content and require approval.
- Assets and Uploads: Uploads/replacements affect brand libraries and generated content; approval required for writes.
- Brand Templates: Brand-template content can contain controlled brand assets; read only unless explicitly approved.
- Exports: Export jobs create downloadable files; private/customer content exports require approval.
- Comments and Webhooks: Collaboration writes and webhook/event routing require approval.
