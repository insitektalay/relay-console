import { capability } from "../../catalog/marketplace-catalog.types";

export const CODA_CAPABILITIES = [
  capability("read", "Read Coda", "Read Coda docs, pages, tables, rows, columns, formulas, controls, permissions, and webhook metadata with bounded API calls.", true),
  capability("draft", "Draft Coda", "Prepare exact Coda row insert/update/delete, cell-value, table/page/doc, formula/control, permission, or webhook payloads without side effects.", true),
  capability("write", "Write Coda", "Create/update/delete Coda rows and selected doc/table content only after token permission, doc access, table schema, and approval checks.", false),
  capability("admin", "Admin Coda", "Operate Coda doc sharing/publishing, table/column schema, formulas/controls, automations, webhooks, doc deletion, and high-volume exports under explicit approval.", false),
];
