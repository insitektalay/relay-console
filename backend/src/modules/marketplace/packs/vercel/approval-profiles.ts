import { action, blocked } from "../../catalog/marketplace-catalog.types";

const allowed = [
  action("read_vercel_context", "Read Vercel context", "Resolve Vercel team id, project id/name, deployment id, domain/alias, branch, and target environment before querying."),
  action("read_vercel_state", "Read Vercel deployment state", "Inspect Vercel deployment state, aliases, domains, env-var metadata, project config, access role, and protection status before proposing action."),
  action("read_vercel_logs", "Read Vercel logs safely", "Limit Vercel build logs/events to the requested deployment/time window and redact env vars, tokens, domains under transfer, and secrets."),
  action("draft_vercel_change", "Draft Vercel change", "Prepare exact Vercel project, deployment, alias, domain, env-var, team/member, protection, integration, or webhook changes for review without side effects."),
];
const approvalRequired = [
  action("vercel_production_or_admin", "Change Vercel production/admin state", "Production deployments/promotions, env var or secret changes, domain/alias changes, webhook changes, team/member changes, project deletes, and bulk updates require approval."),
];
const blockedActions = [
  blocked("vercel_secret_or_project_abuse", "Vercel secret/project abuse", "Secret exposure, project/team deletion, disabling protection/security controls, unapproved production changes, and broad build-log/source exports are blocked."),
];
export const VERCEL_APPROVAL_PROFILES = [
  { id: "vercel_read_only", label: "Read Only", description: "Read-only Vercel operation.", defaultSelected: false, allowedActions: allowed.filter((item) => item.id.startsWith("read_")), approvalRequiredActions: approvalRequired, blockedActions },
  { id: "vercel_safe_operator", label: "Safe Operator", description: "Default Vercel operator. Reads and drafts are allowed; provider side effects are approval-gated.", defaultSelected: true, allowedActions: allowed, approvalRequiredActions: approvalRequired, blockedActions },
  { id: "vercel_manager_approval", label: "Manager Approval", description: "Allows approved Vercel writes after explicit review and audit.", defaultSelected: false, allowedActions: allowed, approvalRequiredActions: approvalRequired, blockedActions },
  { id: "vercel_admin_high_risk", label: "Admin High Risk", description: "Administrative Vercel profile; destructive and secret-exposure actions remain blocked.", defaultSelected: false, allowedActions: allowed, approvalRequiredActions: approvalRequired, blockedActions },
];
