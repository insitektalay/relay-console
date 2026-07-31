export const FIGMA_ENDPOINT_FAMILIES = [
  {
    id: "files",
    label: "Files and Nodes",
    docsUrl: "https://developers.figma.com/docs/rest-api/",
    guidance: "Resolve file keys and node ids before file reads or renders.",
    representativeEndpoints: ["GET /v1/files/{file_key}","GET /v1/files/{file_key}/nodes","GET /v1/files/{file_key}/versions"],
  },
  {
    id: "design_system",
    label: "Components, Component Sets and Styles",
    docsUrl: "https://developers.figma.com/docs/rest-api/",
    guidance: "Use design-system endpoints for audits; do not publish or replace shared library assets without approval.",
    representativeEndpoints: ["GET /v1/files/{file_key}/components","GET /v1/files/{file_key}/component_sets","GET /v1/files/{file_key}/styles"],
  },
  {
    id: "comments",
    label: "Comments",
    docsUrl: "https://developers.figma.com/docs/rest-api/",
    guidance: "Read comment threads freely within access; posting or deleting comments is approval-gated.",
    representativeEndpoints: ["GET /v1/files/{file_key}/comments","POST /v1/files/{file_key}/comments","DELETE /v1/files/{file_key}/comments/{comment_id}"],
  },
  {
    id: "images",
    label: "Images and Renders",
    docsUrl: "https://developers.figma.com/docs/rest-api/",
    guidance: "Export only requested nodes and formats; treat render URLs as sensitive temporary links.",
    representativeEndpoints: ["GET /v1/images/{file_key}","GET /v1/images/{file_key}/fills"],
  },
  {
    id: "teams_projects",
    label: "Teams and Projects",
    docsUrl: "https://developers.figma.com/docs/rest-api/",
    guidance: "Use team/project reads to resolve accessible files without crossing sharing boundaries.",
    representativeEndpoints: ["GET /v1/teams/{team_id}/projects","GET /v1/projects/{project_id}/files"],
  },
  {
    id: "webhooks",
    label: "Webhooks V2",
    docsUrl: "https://developers.figma.com/docs/rest-api/",
    guidance: "Webhook create/update/delete is an external event-routing change and requires approval.",
    representativeEndpoints: ["GET /v2/webhooks","POST /v2/webhooks","DELETE /v2/webhooks/{webhook_id}"],
  },
];
