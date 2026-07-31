export const WEBFLOW_ENDPOINT_FAMILIES = [
  {
    id: "sites_pages",
    label: "Sites and Pages",
    docsUrl: "https://developers.webflow.com/data/reference/authentication",
    guidance: "Resolve site/page IDs and distinguish staging from production before writes.",
    representativeEndpoints: ["GET /v2/sites","GET /v2/sites/{site_id}/pages","GET /v2/pages/{page_id}"],
  },
  {
    id: "cms",
    label: "Collections and Items",
    docsUrl: "https://developers.webflow.com/data/reference/authentication",
    guidance: "CMS writes can affect live pages after publishing; validate field schema first.",
    representativeEndpoints: ["GET /v2/sites/{site_id}/collections","GET /v2/collections/{collection_id}/items","PATCH /v2/collections/{collection_id}/items/{item_id}"],
  },
  {
    id: "assets",
    label: "Assets",
    docsUrl: "https://developers.webflow.com/data/reference/authentication",
    guidance: "Asset uploads and replacements require approval when public pages may reference them.",
    representativeEndpoints: ["GET /v2/sites/{site_id}/assets","POST /v2/sites/{site_id}/assets"],
  },
  {
    id: "forms",
    label: "Forms",
    docsUrl: "https://developers.webflow.com/data/reference/authentication",
    guidance: "Treat submissions as personal data and summarize by default.",
    representativeEndpoints: ["GET /v2/sites/{site_id}/forms","GET /v2/forms/{form_id}/submissions"],
  },
  {
    id: "publish_config",
    label: "Publishing and Site Config",
    docsUrl: "https://developers.webflow.com/data/reference/authentication",
    guidance: "Publishing, domains and site settings are high-impact.",
    representativeEndpoints: ["POST /v2/sites/{site_id}/publish","GET/PATCH site configuration endpoints"],
  },
  {
    id: "webhooks",
    label: "Webhooks",
    docsUrl: "https://developers.webflow.com/data/reference/authentication",
    guidance: "Webhook create/delete changes event delivery and requires approval.",
    representativeEndpoints: ["GET /v2/sites/{site_id}/webhooks","POST /v2/sites/{site_id}/webhooks","DELETE /v2/webhooks/{webhook_id}"],
  },
];
