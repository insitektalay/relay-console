# Figma Objects

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

## Primary Objects

- file keys from figma.com/file/{key} or design URLs
- files with DOCUMENT/CANVAS node trees
- nodes, components, component sets, styles, variables and versions
- comments, comment reactions and resolved state
- image/render export URLs
- teams, projects and webhook contexts

## Object-ID Discipline

- Resolve IDs from provider reads before writes.
- Include human-readable names only as context; the request target must be an official provider ID/key.
- Validate ownership/visibility boundaries for private, public, customer-facing and admin resources.
