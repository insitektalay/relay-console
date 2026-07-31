import { capability } from "../../catalog/marketplace-catalog.types";

export const HUBSPOT_CAPABILITIES = [
  capability("crm_read", "CRM Read", "Read HubSpot contacts, companies, deals, tickets, owners, properties, pipelines, lists, associations, notes, tasks, calls, and meetings with bounded CRM API queries.", true),
  capability("crm_draft", "CRM Draft", "Prepare HubSpot contact, company, deal, ticket, association, note, task, owner, property, pipeline, or list changes without mutating the portal.", true),
  capability("crm_write", "CRM Write", "Create or update HubSpot CRM records, activities, and associations after validating private app or OAuth scopes, internal property names, owner ids, pipeline/stage ids, and approval policy.", false),
  capability("crm_admin", "CRM Admin", "Manage HubSpot private app scopes, webhooks, properties, schemas, workflows, lists, exports, or destructive/bulk CRM operations only through explicit approval.", false),
];
