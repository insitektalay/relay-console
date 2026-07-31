# Canva Safe Actions

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

## Allowed Without Additional Approval

- Read accessible resources and summarize state.
- Draft comments, replies, posts, content updates, publishing plans and moderation recommendations.
- Prepare exact API payloads for review without sending them.

## Approval Required

- Export design DAFabc123 as PDF for external client review.
- Upload the approved hero image into Canva assets.
- Move a design into a shared brand folder or change folder permissions.

## Blocked

- Reveal the Canva OAuth refresh token.
- Export every design in the brand workspace.
- Remove all folder permissions so only I can see the project.

## Sensitive Risk Areas

- brand template and brand asset misuse
- generated or exported content being distributed externally
- folder permission changes exposing campaigns or customer assets
- uploads replacing approved creative assets
- comments that notify collaborators
