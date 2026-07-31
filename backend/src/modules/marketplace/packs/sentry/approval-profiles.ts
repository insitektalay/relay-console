import { action, blocked } from "../../catalog/marketplace-catalog.types";

const allowed = [
  action("read_sentry_ids", "Resolve Sentry ids", "Resolve Sentry organization/project/issue/event/release/team/alert/webhook identifiers before querying."),
  action("read_sentry_state", "Inspect Sentry state", "Inspect Sentry issue status, event samples, releases/deploys, alert rules, team/project membership, and webhooks before proposing action."),
  action("read_sentry_events", "Read Sentry events safely", "Limit Sentry event and stack-trace reads to requested filters and redact PII, request headers, breadcrumbs, tokens, and secrets."),
  action("draft_sentry_change", "Draft Sentry change", "Prepare Sentry issue-state, release/deploy, alert-rule, team/project, integration, or webhook changes for review without side effects."),
];
const approvalRequired = [
  action("sentry_bulk_or_admin", "Change Sentry bulk/admin state", "Bulk issue updates, alert-rule edits/disables, release/deploy metadata changes, webhook/integration changes, team/member changes, project deletion, and privacy-sensitive event exports require approval."),
];
const blockedActions = [
  blocked("sentry_secret_or_event_abuse", "Sentry secret/event abuse", "Exposing Sentry auth tokens, private DSNs, event secrets, request headers, or PII; deleting org/project resources without approval; disabling alerting/security controls; and broad event/source exports are blocked."),
];
export const SENTRY_APPROVAL_PROFILES = [
  { id: "sentry_read_only", label: "Read Only", description: "Read-only Sentry operation.", defaultSelected: false, allowedActions: allowed.filter((item) => item.id.startsWith("read_")), approvalRequiredActions: approvalRequired, blockedActions },
  { id: "sentry_safe_operator", label: "Safe Operator", description: "Default Sentry operator. Reads and drafts are allowed; provider side effects are approval-gated.", defaultSelected: true, allowedActions: allowed, approvalRequiredActions: approvalRequired, blockedActions },
  { id: "sentry_manager_approval", label: "Manager Approval", description: "Allows approved Sentry writes after explicit review and audit.", defaultSelected: false, allowedActions: allowed, approvalRequiredActions: approvalRequired, blockedActions },
  { id: "sentry_admin_high_risk", label: "Admin High Risk", description: "Administrative Sentry profile; destructive and secret-exposure actions remain blocked.", defaultSelected: false, allowedActions: allowed, approvalRequiredActions: approvalRequired, blockedActions },
];
