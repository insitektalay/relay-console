# Canva Objects

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

## Primary Objects

- designs and design imports
- folders and folder permissions
- assets/uploads for image, audio and video files
- brand templates and brand-template content
- comments, replies and collaboration notifications
- export jobs with temporary download URLs

## Object-ID Discipline

- Resolve IDs from provider reads before writes.
- Include human-readable names only as context; the request target must be an official provider ID/key.
- Validate ownership/visibility boundaries for private, public, customer-facing and admin resources.
