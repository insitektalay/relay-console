import { capability } from "../../catalog/marketplace-catalog.types";

export const NOTION_CAPABILITIES = [
  capability("read", "Read Notion", "Read accessible Notion pages, databases/data sources, page properties, comments, users, and recursive block children with explicit filters, sorts, cursors, and parent-sharing checks.", true),
  capability("draft", "Draft Notion", "Prepare exact Notion page-create, page-property update, database-query, block-append, comment, or webhook payloads without side effects.", true),
  capability("write", "Write Notion", "Create pages, append/update blocks, update page properties, and add comments only when Notion capabilities and parent sharing allow it.", false),
  capability("admin", "Admin Notion", "Operate Notion integration capabilities, database/data-source schema, page/database sharing, webhook subscriptions, page archive/delete, and bulk database workflows under explicit approval.", false),
];
