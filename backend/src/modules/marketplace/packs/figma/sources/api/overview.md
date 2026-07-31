# Figma API Overview

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

## Provider Object Model

- file keys from figma.com/file/{key} or design URLs
- files with DOCUMENT/CANVAS node trees
- nodes, components, component sets, styles, variables and versions
- comments, comment reactions and resolved state
- image/render export URLs
- teams, projects and webhook contexts

## Endpoint Families

- Files and Nodes: Resolve file keys and node ids before file reads or renders.
- Components, Component Sets and Styles: Use design-system endpoints for audits; do not publish or replace shared library assets without approval.
- Comments: Read comment threads freely within access; posting or deleting comments is approval-gated.
- Images and Renders: Export only requested nodes and formats; treat render URLs as sensitive temporary links.
- Teams and Projects: Use team/project reads to resolve accessible files without crossing sharing boundaries.
- Webhooks V2: Webhook create/update/delete is an external event-routing change and requires approval.
