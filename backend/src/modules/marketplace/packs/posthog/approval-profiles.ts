import { action, blocked } from "../../catalog/marketplace-catalog.types";

const allowed = [
  action("read_posthog_ids", "Resolve PostHog ids", "Resolve PostHog project, insight, dashboard, cohort, feature-flag, event/person/group, session, and destination identifiers before querying."),
  action("read_posthog_state", "Inspect PostHog state", "Inspect PostHog feature-flag rollout, cohort definition, insight query, dashboard sharing, event/person filters, privacy settings, and destinations before proposing action."),
  action("read_posthog_data_safely", "Read PostHog data safely", "Limit PostHog event/person/session reads to requested filters and redact API keys, distinct ids where unnecessary, emails, IPs, session URLs, and PII."),
  action("draft_posthog_change", "Draft PostHog change", "Prepare PostHog feature-flag, cohort, insight, dashboard, annotation, project-setting, export, or CDP destination payloads for review without side effects."),
];
const approvalRequired = [
  action("posthog_flag_export_or_admin", "Change PostHog flag/export/admin state", "Feature-flag rollout or variant changes, cohort changes, person/event exports, dashboard public sharing, CDP destination/webhook changes, project setting changes, project deletion, and bulk updates require approval."),
];
const blockedActions = [
  blocked("posthog_secret_or_raw_data_abuse", "PostHog secret/raw data abuse", "Exposing PostHog API keys, exporting unbounded persons/events/session replays, deleting projects without approval, disabling privacy/security controls, unapproved production flag changes, and broad raw-data exports are blocked."),
];
export const POSTHOG_APPROVAL_PROFILES = [
  { id: "posthog_read_only", label: "Read Only", description: "Read-only PostHog operation.", defaultSelected: false, allowedActions: allowed.filter((item) => item.id.startsWith("read_")), approvalRequiredActions: approvalRequired, blockedActions },
  { id: "posthog_safe_operator", label: "Safe Operator", description: "Default PostHog operator. Reads and drafts are allowed; provider side effects are approval-gated.", defaultSelected: true, allowedActions: allowed, approvalRequiredActions: approvalRequired, blockedActions },
  { id: "posthog_manager_approval", label: "Manager Approval", description: "Allows approved PostHog writes after explicit review and audit.", defaultSelected: false, allowedActions: allowed, approvalRequiredActions: approvalRequired, blockedActions },
  { id: "posthog_admin_high_risk", label: "Admin High Risk", description: "Administrative PostHog profile; destructive and secret-exposure actions remain blocked.", defaultSelected: false, allowedActions: allowed, approvalRequiredActions: approvalRequired, blockedActions },
];
