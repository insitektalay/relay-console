import { action, blocked } from "../../catalog/marketplace-catalog.types";

const allowed = [
  action("read_crm_records", "Read HubSpot CRM records", "Search or retrieve contacts, companies, deals, tickets, owners, properties, pipelines, lists, associations, and activities using narrow filters and explicit properties."),
  action("summarize_crm_state", "Summarize HubSpot state", "Summarize customer, company, deal, ticket, owner, and pipeline state while minimizing personal and commercial data exposure."),
  action("draft_crm_change", "Draft HubSpot CRM change", "Prepare exact HubSpot object, association, note, task, pipeline, or ticket-update payloads for review without side effects."),
  action("validate_hubspot_ids", "Validate HubSpot ids and properties", "Resolve object ids, association labels/type ids, property internal names, owner ids, pipeline ids, and stage/status ids before writes."),
];

const approvalRequired = [
  action("customer_visible_reply", "Send customer-visible ticket or engagement reply", "Any HubSpot ticket reply, email-like engagement, or customer-visible communication requires approval."),
  action("pipeline_or_owner_change", "Change deal/ticket pipeline, stage, status, or owner", "Moving deals or tickets, changing owners, or changing pipeline state requires approval because it affects sales/support accountability."),
  action("bulk_crm_mutation", "Bulk mutate or export HubSpot CRM data", "Batch updates, imports, exports, list-wide edits, owner changes at scale, merges, and deletes require approval."),
  action("automation_or_webhook_change", "Change HubSpot automation, webhooks, or properties", "Creating or modifying webhooks, workflows, private app scopes, object schemas, properties, or calculated fields requires approval."),
];

const blockedActions = [
  blocked("hubspot_secret_exposure", "Expose HubSpot secrets", "Private app tokens, OAuth access/refresh tokens, client secrets, webhook secrets, and credential-shaped values must never be displayed, logged, or written to provider records."),
  blocked("hubspot_mass_outreach", "Mass-message or bulk outreach", "Unapproved bulk customer/prospect outreach, list blasting, or automated email-like activity creation is blocked."),
  blocked("hubspot_account_destruction", "Delete HubSpot account or bypass controls", "Deleting the account/portal, bypassing scopes or CRM permissions, disabling audit/compliance controls, or destructive bulk actions are blocked."),
];

export const HUBSPOT_APPROVAL_PROFILES = [
  { id: "hubspot_read_only", label: "Read Only", description: "Read-only HubSpot operation.", defaultSelected: false, allowedActions: allowed.filter((item) => item.id === "read_crm_records" || item.id === "summarize_crm_state"), approvalRequiredActions: approvalRequired, blockedActions },
  { id: "hubspot_safe_operator", label: "Safe Operator", description: "Default HubSpot operator. Reads, summaries, validation, and drafts are allowed; CRM side effects are approval-gated.", defaultSelected: true, allowedActions: allowed, approvalRequiredActions: approvalRequired, blockedActions },
  { id: "hubspot_manager_approval", label: "Manager Approval", description: "Allows approved HubSpot writes after explicit review and audit.", defaultSelected: false, allowedActions: allowed, approvalRequiredActions: approvalRequired, blockedActions },
  { id: "hubspot_admin_high_risk", label: "Admin High Risk", description: "Administrative HubSpot profile; destructive, bulk, outreach, and secret-exposure actions remain blocked.", defaultSelected: false, allowedActions: allowed, approvalRequiredActions: approvalRequired, blockedActions },
];
