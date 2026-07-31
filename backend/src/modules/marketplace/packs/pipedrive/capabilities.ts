import { capability } from "../../catalog/marketplace-catalog.types";

export const PIPEDRIVE_CAPABILITIES = [
  capability("crm_read", "CRM Read", "Read Pipedrive persons, organizations, deals, leads, pipelines, stages, activities, notes, products, users, filters, fields, files, and webhooks with bounded API queries.", true),
  capability("crm_draft", "CRM Draft", "Prepare Pipedrive person, organization, deal, lead, activity, note, product, filter, pipeline/stage, or webhook changes without mutating the company account.", true),
  capability("crm_write", "CRM Write", "Create or update Pipedrive CRM records after validating API token/OAuth context, company domain, person/org/deal/lead ids, owner/user ids, pipeline/stage ids, custom fields, and approval policy.", false),
  capability("crm_admin", "CRM Admin", "Manage Pipedrive pipelines, stages, products, filters, webhooks, fields, exports, permissions, or destructive/bulk CRM workflows only through explicit approval.", false),
];
