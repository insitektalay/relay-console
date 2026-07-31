export const CANVA_ENDPOINT_FAMILIES = [
  {
    id: "designs",
    label: "Designs",
    docsUrl: "https://www.canva.dev/docs/connect/",
    guidance: "Use design endpoints for metadata/content reads and design creation only when design:content:write is enabled.",
    representativeEndpoints: ["GET /rest/v1/designs/{design_id}","POST /rest/v1/designs","POST /rest/v1/design-imports"],
  },
  {
    id: "folders",
    label: "Folders",
    docsUrl: "https://www.canva.dev/docs/connect/",
    guidance: "Folder writes and permission changes can expose content and require approval.",
    representativeEndpoints: ["GET /rest/v1/folders","POST /rest/v1/folders","PATCH /rest/v1/folders/{folder_id}"],
  },
  {
    id: "assets",
    label: "Assets and Uploads",
    docsUrl: "https://www.canva.dev/docs/connect/",
    guidance: "Uploads/replacements affect brand libraries and generated content; approval required for writes.",
    representativeEndpoints: ["GET /rest/v1/assets","POST /rest/v1/assets/uploads","DELETE /rest/v1/assets/{asset_id}"],
  },
  {
    id: "brand",
    label: "Brand Templates",
    docsUrl: "https://www.canva.dev/docs/connect/",
    guidance: "Brand-template content can contain controlled brand assets; read only unless explicitly approved.",
    representativeEndpoints: ["GET /rest/v1/brand-templates","GET /rest/v1/brand-templates/{brand_template_id}"],
  },
  {
    id: "exports",
    label: "Exports",
    docsUrl: "https://www.canva.dev/docs/connect/",
    guidance: "Export jobs create downloadable files; private/customer content exports require approval.",
    representativeEndpoints: ["POST /rest/v1/exports","GET /rest/v1/exports/{export_id}"],
  },
  {
    id: "comments_webhooks",
    label: "Comments and Webhooks",
    docsUrl: "https://www.canva.dev/docs/connect/",
    guidance: "Collaboration writes and webhook/event routing require approval.",
    representativeEndpoints: ["GET comments endpoints","POST comment/reply endpoints","webhook event subscriptions"],
  },
];
