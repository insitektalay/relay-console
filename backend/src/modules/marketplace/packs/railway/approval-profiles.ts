import { action, blocked } from "../../catalog/marketplace-catalog.types";

const allowed = [
  action("read_railway_ids", "Resolve Railway ids", "Resolve Railway workspace, project, environment, service, deployment, variable, custom-domain, and webhook ids before querying."),
  action("read_railway_state", "Inspect Railway state", "Inspect Railway deployment status, environment config, domain state, variable metadata, plugin/resource status, and webhook subscriptions before proposing action."),
  action("read_railway_logs", "Read Railway logs safely", "Limit Railway logs/events to the requested deployment/service/time window and redact tokens, variable values, build secrets, source snippets, and private project metadata."),
  action("draft_railway_change", "Draft Railway change", "Prepare Railway GraphQL mutation names and variables for review without external side effects."),
];
const approvalRequired = [
  action("railway_production_or_admin", "Change Railway production/admin state", "Production deployments, service restarts, variable/secret changes, custom-domain changes, webhook changes, plugin/resource changes, project/service deletes, and bulk project updates require approval."),
];
const blockedActions = [
  blocked("railway_secret_or_project_abuse", "Railway secret/project abuse", "Exposing Railway API tokens or variable values, deleting a project/service without a destructive approval path, disabling security/protection controls, unapproved production changes, and broad source/log exports are blocked."),
];
export const RAILWAY_APPROVAL_PROFILES = [
  { id: "railway_read_only", label: "Read Only", description: "Read-only Railway operation.", defaultSelected: false, allowedActions: allowed.filter((item) => item.id.startsWith("read_")), approvalRequiredActions: approvalRequired, blockedActions },
  { id: "railway_safe_operator", label: "Safe Operator", description: "Default Railway operator. Reads and drafts are allowed; provider side effects are approval-gated.", defaultSelected: true, allowedActions: allowed, approvalRequiredActions: approvalRequired, blockedActions },
  { id: "railway_manager_approval", label: "Manager Approval", description: "Allows approved Railway writes after explicit review and audit.", defaultSelected: false, allowedActions: allowed, approvalRequiredActions: approvalRequired, blockedActions },
  { id: "railway_admin_high_risk", label: "Admin High Risk", description: "Administrative Railway profile; destructive and secret-exposure actions remain blocked.", defaultSelected: false, allowedActions: allowed, approvalRequiredActions: approvalRequired, blockedActions },
];
