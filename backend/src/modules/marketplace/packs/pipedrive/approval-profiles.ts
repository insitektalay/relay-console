import { action, blocked } from "../../catalog/marketplace-catalog.types";

const allowed = [
  action("read_pipedrive_records", "Read Pipedrive CRM records", "Read persons, organizations, deals, leads, pipelines, stages, activities, notes, products, users, filters, fields, and webhooks with bounded API queries."),
  action("summarize_pipeline_state", "Summarize pipeline state", "Summarize deal, lead, contact, organization, activity, note, user, and pipeline state while minimizing customer/prospect data exposure."),
  action("draft_pipedrive_change", "Draft Pipedrive change", "Prepare exact person, organization, deal, lead, activity, note, product, pipeline/stage, or filter payloads for review without side effects."),
  action("validate_pipedrive_ids", "Validate Pipedrive ids and fields", "Resolve company domain, object ids, custom field keys, user ids, owner ids, pipeline ids, stage ids, filter ids, and product ids before writes."),
];

const approvalRequired = [
  action("deal_stage_or_owner", "Change deal/lead stage, pipeline, status, value, or owner", "Moving deals or leads, changing pipeline/stage/status/value, or changing ownership requires approval."),
  action("customer_visible_outreach", "Send customer/prospect-visible outreach", "Any customer/prospect-visible email-like outreach, activity completion that triggers outreach, or bulk follow-up requires approval."),
  action("bulk_crm_mutation", "Bulk mutate, merge, delete, or export Pipedrive data", "Bulk updates, exports, merges, deletes, filters applied at scale, and owner changes at scale require approval."),
  action("pipeline_or_webhook_admin", "Change pipelines, stages, fields, filters, products, or webhooks", "Creating or modifying pipelines, stages, custom fields, filters, products, webhooks, roles, or permissions requires approval."),
];

const blockedActions = [
  blocked("pipedrive_secret_exposure", "Expose Pipedrive secrets", "API tokens, OAuth access/refresh tokens, client secrets, webhook secrets, and credential-shaped values must never be displayed, logged, or written to notes."),
  blocked("pipedrive_mass_outreach", "Mass-message prospects", "Unapproved bulk customer/prospect outreach, spam, impersonation, or fabricated approval is blocked."),
  blocked("pipedrive_company_destruction", "Delete company account or destructive bulk action", "Deleting the company account, disabling security/compliance/audit controls, bypassing permissions, and destructive bulk CRM actions are blocked."),
];

export const PIPEDRIVE_APPROVAL_PROFILES = [
  { id: "pipedrive_read_only", label: "Read Only", description: "Read-only Pipedrive operation.", defaultSelected: false, allowedActions: allowed.filter((item) => item.id !== "draft_pipedrive_change"), approvalRequiredActions: approvalRequired, blockedActions },
  { id: "pipedrive_safe_operator", label: "Safe Operator", description: "Default Pipedrive operator. Reads and drafts are allowed; pipeline, outreach, and CRM side effects are approval-gated.", defaultSelected: true, allowedActions: allowed, approvalRequiredActions: approvalRequired, blockedActions },
  { id: "pipedrive_manager_approval", label: "Manager Approval", description: "Allows approved Pipedrive writes after explicit review and audit.", defaultSelected: false, allowedActions: allowed, approvalRequiredActions: approvalRequired, blockedActions },
  { id: "pipedrive_admin_high_risk", label: "Admin High Risk", description: "Administrative Pipedrive profile; destructive, mass-outreach, company-level, and secret-exposure actions remain blocked.", defaultSelected: false, allowedActions: allowed, approvalRequiredActions: approvalRequired, blockedActions },
];
