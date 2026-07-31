import { capability } from "../../catalog/marketplace-catalog.types";

export const AIRTABLE_CAPABILITIES = [
  capability("read", "Read Airtable", "Read Airtable bases, tables, fields, views, records, typed values, linked records, pagination offsets, and webhook metadata with bounded API calls.", true),
  capability("draft", "Draft Airtable", "Prepare exact Airtable list, create/update/upsert/delete record, metadata/schema, field/table, automation/interface, or webhook payloads without side effects.", true),
  capability("write", "Write Airtable", "Create/update/delete Airtable records and limited table data only after PAT/OAuth scope, base permission, schema, and approval checks.", false),
  capability("admin", "Admin Airtable", "Operate Airtable base/table/field schema, webhooks, automations, interfaces, external sharing, base deletion, and high-volume exports under explicit approval.", false),
];
