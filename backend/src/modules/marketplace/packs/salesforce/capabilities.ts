import { capability } from "../../catalog/marketplace-catalog.types";

export const SALESFORCE_CAPABILITIES = [
  capability("crm_read", "CRM Read", "Read Salesforce REST API resources, sObjects, object describes, fields, record types, Accounts, Contacts, Leads, Opportunities, Cases, Tasks, Events, SOQL, SOSL, Composite reads, Platform Events, and Change Data Capture metadata with bounded queries.", true),
  capability("crm_draft", "CRM Draft", "Prepare Salesforce SOQL/SOSL, sObject, Case, Task/Event, Composite, owner, field, record-type, or approval-gated change plans without mutating the org.", true),
  capability("crm_write", "CRM Write", "Create or update Salesforce records only after validating connected-app OAuth scopes, object CRUD permissions, field-level security, record type, owner, validation rules, and approval policy.", false),
  capability("crm_admin", "CRM Admin", "Operate Salesforce connected apps, profiles, permission sets, object metadata, automation, Platform Events, CDC, bulk/composite writes, or destructive org-level workflows only through explicit approval.", false),
];
