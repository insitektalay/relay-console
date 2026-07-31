export const NOTION_ENDPOINT_FAMILIES = [
  { id: "search", label: "POST /v1/search", docsUrl: "https://developers.notion.com/reference/intro", guidance: "Discover accessible pages and databases/data sources only; missing results can mean missing sharing." },
  { id: "pages", label: "Pages and page properties", docsUrl: "https://developers.notion.com/reference/intro", guidance: "Use POST /v1/pages, GET/PATCH /v1/pages/{page_id}, and page property item retrieval for typed Notion properties." },
  { id: "blocks", label: "Block children and block updates", docsUrl: "https://developers.notion.com/reference/intro", guidance: "Use GET/PATCH /v1/blocks/{block_id}/children and PATCH/archive block methods while preserving block order and ids." },
  { id: "databases", label: "Database/data-source query and schema", docsUrl: "https://developers.notion.com/reference/intro", guidance: "Use database/data-source query endpoints with explicit filters, sorts, cursors, property ids, and schema validation." },
  { id: "comments", label: "Comments", docsUrl: "https://developers.notion.com/reference/intro", guidance: "Use GET /v1/comments and POST /v1/comments only with a clear page/block parent and approval for mentions or external visibility." },
  { id: "users", label: "Users and bot identity", docsUrl: "https://developers.notion.com/reference/intro", guidance: "Use GET /v1/users and GET /v1/users/me to distinguish people, bots, and the integration identity." },
  { id: "webhooks", label: "Notion webhooks", docsUrl: "https://developers.notion.com/reference/webhooks", guidance: "Webhook subscription, callback, and event handling require approval and capability checks." },
];
