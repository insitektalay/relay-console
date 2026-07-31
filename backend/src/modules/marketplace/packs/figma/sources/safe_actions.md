# Figma Safe Actions

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

## Allowed Without Additional Approval

- Read accessible resources and summarize state.
- Draft comments, replies, posts, content updates, publishing plans and moderation recommendations.
- Prepare exact API payloads for review without sending them.

## Approval Required

- Post this approved reply to comment 456 in file ABC123.
- Export the private launch frames from file ABC123 to PNG and attach them to the campaign ticket.
- Create a file webhook for project 987 that sends events to the approved ClawChat webhook URL.

## Blocked

- Show me the Figma token from the connection.
- Export every private file in the team drive.
- Bypass sharing and read a file I was not invited to.

## Sensitive Risk Areas

- private design data, roadmap screenshots and embedded customer content
- bulk exports of private frames or assets
- comments that notify collaborators or create review history
- webhook changes that leak design activity to external URLs
