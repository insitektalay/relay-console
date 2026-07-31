import {
  action,
  blocked,
  type MarketplaceActionPolicy,
  type MarketplaceApprovalProfile,
} from "../../catalog/marketplace-catalog.types";

export type GithubApprovalProfilePolicy = MarketplaceApprovalProfile & {
  allowedActions: MarketplaceActionPolicy[];
  approvalRequiredActions: MarketplaceActionPolicy[];
  blockedActions: MarketplaceActionPolicy[];
};

const COMMON_ALLOWED = [
  action(
    "read_repositories",
    "Read repositories, issues, and pull requests",
    "Inspect repository state, labels, issues, pull requests, reviews, workflow runs, and branch status.",
  ),
  action(
    "create_issues",
    "Create issues",
    "Open new issues with clear summaries, labels, and reproduction detail.",
  ),
  action(
    "comment_threads",
    "Comment on issues or pull requests",
    "Add factual comments, status updates, or review guidance without changing repository state.",
  ),
  action(
    "draft_pr_summaries",
    "Draft PR summaries",
    "Prepare pull request descriptions, release note drafts, and reviewer-ready summaries.",
  ),
];

const COMMON_APPROVAL = [
  action(
    "open_pr",
    "Open pull request",
    "Creating a pull request that changes repository state requires approval unless the profile says otherwise.",
  ),
  action(
    "request_reviewers",
    "Request reviewers",
    "Assigning reviewers or teams changes workflow state and requires approval.",
  ),
  action(
    "merge_pr",
    "Merge pull request",
    "Merging a pull request always requires approval.",
  ),
  action(
    "create_release",
    "Create release",
    "Releases and release publication require approval.",
  ),
  action(
    "change_branch_protection",
    "Change branch protection",
    "Branch protection or ruleset changes require approval.",
  ),
  action(
    "modify_workflows_or_secrets",
    "Modify workflows, Actions, or secrets",
    "Workflow YAML, Actions settings, secrets, and variables are high-impact operations and require approval.",
  ),
];

const COMMON_BLOCKED = [
  blocked(
    "delete_repository",
    "Delete repository",
    "Repository deletion is blocked in marketplace-operated GitHub packs.",
  ),
  blocked(
    "delete_org_or_team",
    "Delete organization or team",
    "Deleting organizations, teams, or core governance structures is blocked.",
  ),
  blocked(
    "disable_security_controls",
    "Disable security controls",
    "Turning off code scanning, branch protections, required checks, or comparable security controls is blocked.",
  ),
  blocked(
    "rewrite_protected_history",
    "Rewrite protected branch history",
    "Force pushes or history rewrites on protected branches are blocked.",
  ),
  blocked(
    "expose_secrets",
    "Expose secrets or tokens",
    "Secrets, installation tokens, PATs, webhook secrets, and private keys must never be printed or committed.",
  ),
];

export const GITHUB_APPROVAL_PROFILES: GithubApprovalProfilePolicy[] = [
  {
    id: "github_safe_operator",
    label: "Safe Operator",
    description:
      "Default GitHub operator. Reads, opens issues, comments, and drafts PR work. Repository-changing actions stay approval-gated.",
    defaultSelected: true,
    allowedActions: COMMON_ALLOWED,
    approvalRequiredActions: COMMON_APPROVAL,
    blockedActions: COMMON_BLOCKED,
  },
  {
    id: "github_contributor",
    label: "Contributor",
    description:
      "Can prepare branch-level changes and pull requests, but merges, releases, workflow edits, and governance changes still require approval.",
    defaultSelected: false,
    allowedActions: [
      ...COMMON_ALLOWED,
      action(
        "prepare_branch_changes",
        "Prepare branch changes",
        "Draft file updates on a non-protected branch when repository contents write capability is enabled.",
      ),
    ],
    approvalRequiredActions: COMMON_APPROVAL,
    blockedActions: COMMON_BLOCKED,
  },
  {
    id: "github_maintainer_restricted",
    label: "Maintainer Restricted",
    description:
      "For trusted operators managing active repositories. Still blocks destructive and security-reducing actions.",
    defaultSelected: false,
    allowedActions: [
      ...COMMON_ALLOWED,
      action(
        "prepare_branch_changes",
        "Prepare branch changes",
        "Draft or update branch content when contents write capability is enabled.",
      ),
      action(
        "draft_release_notes",
        "Draft release notes",
        "Prepare release notes before a human approves publication.",
      ),
    ],
    approvalRequiredActions: COMMON_APPROVAL,
    blockedActions: COMMON_BLOCKED,
  },
];

export function resolveGithubApprovalProfile(profileId?: string | null) {
  return (
    GITHUB_APPROVAL_PROFILES.find((profile) => profile.id === profileId) ??
    GITHUB_APPROVAL_PROFILES.find((profile) => profile.defaultSelected) ??
    GITHUB_APPROVAL_PROFILES[0]
  );
}
