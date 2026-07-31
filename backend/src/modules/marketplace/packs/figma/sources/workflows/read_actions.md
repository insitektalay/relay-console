# Figma Read Workflows

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

## Read Workflow

1. Confirm connection, scope and resource boundary.
2. Resolve target IDs from official endpoints.
3. Fetch only fields/items needed for the user request.
4. Summarize state without exposing secrets or unnecessary personal/private content.

## Good Read Requests

- Summarize unresolved comments in file ABC123 grouped by page and do not export frames.
- Render node 12:34 from file ABC123 as a PNG after confirming I can access that file.
- List components and styles used by file ABC123 and flag detached instances.
