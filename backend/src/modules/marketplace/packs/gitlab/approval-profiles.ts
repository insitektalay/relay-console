import { action, blocked } from "../../catalog/marketplace-catalog.types";

const allowed = [
  action("read_gitlab_context", "Read GitLab context", "Resolve GitLab host, group/project id or path, branch/ref, MR IID, issue IID, pipeline/job id, and environment before querying."),
  action("read_gitlab_state", "Read GitLab state", "Inspect GitLab branch protection, MR state, pipeline/job state, issue labels/assignee/milestone, environment status, and variable metadata before proposing action."),
  action("read_gitlab_logs", "Read GitLab logs safely", "Limit GitLab logs/jobs/events to the requested time window and redact CI variables, tokens, deploy keys, and secrets."),
  action("draft_gitlab_change", "Draft GitLab change", "Prepare exact GitLab issue, merge request, branch/tag, repository file, pipeline/job, environment, CI/CD variable, member, or webhook changes for review without side effects."),
];
const approvalRequired = [
  action("gitlab_production_or_admin", "Change GitLab production/admin state", "Production deploys, protected refs, CI/CD variable or secret changes, webhook changes, project/member changes, pipeline cancellation, project deletes, and bulk updates require approval."),
];
const blockedActions = [
  blocked("gitlab_secret_or_repo_abuse", "GitLab secret/repository abuse", "Secret exposure, project/group deletion, disabling security/audit controls, unapproved production changes, and broad source/log exports are blocked."),
];
export const GITLAB_APPROVAL_PROFILES = [
  { id: "gitlab_read_only", label: "Read Only", description: "Read-only GitLab operation.", defaultSelected: false, allowedActions: allowed.filter((item) => item.id.startsWith("read_")), approvalRequiredActions: approvalRequired, blockedActions },
  { id: "gitlab_safe_operator", label: "Safe Operator", description: "Default GitLab operator. Reads and drafts are allowed; provider side effects are approval-gated.", defaultSelected: true, allowedActions: allowed, approvalRequiredActions: approvalRequired, blockedActions },
  { id: "gitlab_manager_approval", label: "Manager Approval", description: "Allows approved GitLab writes after explicit review and audit.", defaultSelected: false, allowedActions: allowed, approvalRequiredActions: approvalRequired, blockedActions },
  { id: "gitlab_admin_high_risk", label: "Admin High Risk", description: "Administrative GitLab profile; destructive and secret-exposure actions remain blocked.", defaultSelected: false, allowedActions: allowed, approvalRequiredActions: approvalRequired, blockedActions },
];
