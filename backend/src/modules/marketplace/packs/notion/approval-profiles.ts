import { action, blocked } from "../../catalog/marketplace-catalog.types";

const allowed = [
  action("read_search", "Search accessible Notion content", "Use Notion search only to discover accessible pages/databases, then fetch the specific page or database before acting."),
  action("read_blocks", "Read Notion block tree", "Walk Notion block children recursively and preserve block order; do not flatten checkboxes, toggles, or code blocks into ambiguous prose."),
  action("query_database", "Query Notion database", "Apply explicit Notion filter and sort objects; validate property names against the database/data-source schema before querying."),
  action("draft_notion_payload", "Draft Notion payload", "Prepare exact Notion page, property, block, comment, database-query, or webhook payloads for review without side effects."),
];
const approvalRequired = [
  action("notion_share_or_schema_change", "Share or change Notion schema", "Publishing externally, sharing pages/databases, changing database/data-source schema, archiving pages with many children, or bulk updating database rows requires approval."),
  action("sensitive_doc_write", "Write sensitive Notion doc", "Writing into company policy, legal, finance, security, HR, or public documentation requires approval."),
  action("notion_comment_mention", "Post Notion comment mention", "Adding comments that mention users or request action from people requires approval if customer/external visible."),
  action("notion_webhook_or_capability", "Change Notion integration capability", "Webhook subscriptions, integration capability expansion, relation/rollup/status-property changes, and parent moves require approval."),
];
const blockedActions = [
  blocked("notion_secret_exposure", "Expose Notion secrets", "Exposing integration tokens, OAuth client secrets, private page contents outside authorized users, or hidden database data is blocked."),
  blocked("notion_access_bypass", "Bypass Notion sharing", "Workspace deletion, bypassing sharing restrictions, scraping inaccessible pages, and mass-exporting the workspace are blocked."),
  blocked("notion_hidden_content_inference", "Infer hidden Notion content", "Do not claim a page/database does not exist until access restrictions have been considered, and do not infer hidden relation targets."),
];
export const NOTION_APPROVAL_PROFILES = [
  { id: "notion_read_only", label: "Read Only", description: "Read-only Notion operation.", defaultSelected: false, allowedActions: allowed.filter((item) => item.id.startsWith("read_")), approvalRequiredActions: approvalRequired, blockedActions },
  { id: "notion_safe_operator", label: "Safe Operator", description: "Default Notion operator. Reads and drafts are allowed; provider side effects are approval-gated.", defaultSelected: true, allowedActions: allowed, approvalRequiredActions: approvalRequired, blockedActions },
  { id: "notion_manager_approval", label: "Manager Approval", description: "Allows approved Notion writes after explicit review and audit.", defaultSelected: false, allowedActions: allowed, approvalRequiredActions: approvalRequired, blockedActions },
  { id: "notion_admin_high_risk", label: "Admin High Risk", description: "Administrative Notion profile; destructive and secret-exposure actions remain blocked.", defaultSelected: false, allowedActions: allowed, approvalRequiredActions: approvalRequired, blockedActions },
];
