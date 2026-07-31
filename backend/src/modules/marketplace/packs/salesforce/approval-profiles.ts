import { action, blocked } from "../../catalog/marketplace-catalog.types";

const allowed = [
  action("read_sobjects", "Read Salesforce sObjects", "Inspect sObject metadata and retrieve Accounts, Contacts, Leads, Opportunities, Cases, Tasks, Events, and allowed custom objects with bounded REST, SOQL, or SOSL queries."),
  action("respect_fls", "Respect Salesforce security model", "Use object describes, profiles, permission sets, sharing rules, CRUD, field-level security, and record types to avoid reading or proposing unauthorized fields."),
  action("summarize_salesforce_state", "Summarize Salesforce state", "Summarize sales/support state while minimizing customer, prospect, commercial, and case-sensitive data."),
  action("draft_sobject_change", "Draft Salesforce record change", "Prepare exact sObject, Composite, owner, Case, Opportunity stage, Task, Event, or field update payloads for review without side effects."),
];

const approvalRequired = [
  action("customer_visible_case_reply", "Send customer-visible Case communication", "Any customer-visible Case reply or support message routed through Salesforce requires approval."),
  action("opportunity_stage_or_owner", "Change Opportunity/Case stage, status, or owner", "Opportunity stage, Case status, owner, queue, assignment, escalation, or record-type changes require approval."),
  action("bulk_or_composite_write", "Bulk, Composite, merge, export, or delete records", "Bulk API, Composite writes, mass owner changes, exports, merges, deletes, and high-volume sObject mutations require approval."),
  action("org_security_or_automation", "Change org security, metadata, events, or automation", "Connected apps, OAuth scopes, profiles, permission sets, field permissions, flows, triggers, Platform Events, CDC, and webhooks require approval."),
];

const blockedActions = [
  blocked("salesforce_secret_exposure", "Expose Salesforce secrets", "OAuth access/refresh tokens, connected-app secrets, session ids, certificates, and credential-shaped values must never be displayed, logged, or written to records."),
  blocked("salesforce_permission_bypass", "Bypass org security", "Bypassing sharing, CRUD, profile, permission set, field-level security, role hierarchy, or compliance/audit settings is blocked."),
  blocked("salesforce_org_destruction", "Delete org or destructive bulk action", "Deleting orgs, disabling security/compliance/audit controls, mass-message workflows, and destructive bulk CRM actions are blocked."),
];

export const SALESFORCE_APPROVAL_PROFILES = [
  { id: "salesforce_read_only", label: "Read Only", description: "Read-only Salesforce operation.", defaultSelected: false, allowedActions: allowed.filter((item) => item.id !== "draft_sobject_change"), approvalRequiredActions: approvalRequired, blockedActions },
  { id: "salesforce_safe_operator", label: "Safe Operator", description: "Default Salesforce operator. Reads and drafts are allowed; org side effects are approval-gated.", defaultSelected: true, allowedActions: allowed, approvalRequiredActions: approvalRequired, blockedActions },
  { id: "salesforce_manager_approval", label: "Manager Approval", description: "Allows approved Salesforce writes after explicit review, security validation, and audit.", defaultSelected: false, allowedActions: allowed, approvalRequiredActions: approvalRequired, blockedActions },
  { id: "salesforce_admin_high_risk", label: "Admin High Risk", description: "Administrative Salesforce profile; destructive, security-bypass, org-level, and secret-exposure actions remain blocked.", defaultSelected: false, allowedActions: allowed, approvalRequiredActions: approvalRequired, blockedActions },
];
