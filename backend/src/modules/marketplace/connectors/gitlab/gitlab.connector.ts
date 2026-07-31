import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const readsAndDrafts = [
  action(
    "gitlab_project_search",
    "Search projects",
    "Search a bounded set of projects visible to the authorized GitLab user.",
  ),
  action(
    "gitlab_issue_list",
    "List issues",
    "List a bounded set of issues in one explicit GitLab project.",
  ),
  action(
    "gitlab_merge_request_list",
    "List merge requests",
    "List a bounded set of merge requests in one explicit GitLab project.",
  ),
  action(
    "gitlab_issue_comment_prepare",
    "Prepare a comment",
    "Prepare one issue or merge-request comment locally without changing GitLab.",
  ),
];

const writes = [
  action(
    "gitlab_issue_comment_create",
    "Comment on an issue",
    "Post one exact comment to an explicit GitLab issue.",
  ),
  action(
    "gitlab_merge_request_comment_create",
    "Comment on a merge request",
    "Post one exact comment to an explicit GitLab merge request.",
  ),
];

const blockedActions = [
  blocked(
    "gitlab_project_admin",
    "Administer projects or groups",
    "Project, group, member, and instance administration are outside the bounded V1 connector.",
  ),
  blocked(
    "gitlab_cicd_write",
    "Change CI/CD",
    "Pipeline mutation, variables, secrets, runners, deployments, and protected-environment changes are outside V1.",
  ),
  blocked(
    "gitlab_repository_mutation",
    "Change repository contents",
    "Branches, tags, files, protected refs, merges, force pushes, and repository deletion are outside V1.",
  ),
  blocked(
    "gitlab_raw_api",
    "Use arbitrary GitLab API calls",
    "Raw URLs, arbitrary operations, tokens, and unbounded pagination are never exposed to agents.",
  ),
];

export const GITLAB_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "gitlab",
  name: "GitLab",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://docs.gitlab.com/api/oauth2/",
  providerWebsiteUrl: "https://gitlab.com/",
  capabilities: [
    {
      ...capability(
        "project_search",
        "Find projects",
        "Search bounded projects visible to the authorized GitLab user.",
        true,
      ),
      platformCapability: "gitlab_project_search",
    },
    {
      ...capability(
        "issue_read",
        "Read issues",
        "Read bounded issues from one explicit GitLab project.",
        true,
      ),
      platformCapability: "gitlab_issue_read",
    },
    {
      ...capability(
        "merge_request_read",
        "Read merge requests",
        "Read bounded merge requests from one explicit GitLab project.",
        true,
      ),
      platformCapability: "gitlab_merge_request_read",
    },
    {
      ...capability(
        "comment_draft",
        "Prepare comments",
        "Prepare bounded issue or merge-request comments locally.",
        true,
      ),
      platformCapability: "gitlab_comment_draft",
    },
    {
      ...capability(
        "issue_comment_write",
        "Comment on issues",
        "Post one exact issue comment under the selected policy.",
        true,
      ),
      platformCapability: "gitlab_issue_comment_write",
    },
    {
      ...capability(
        "merge_request_comment_write",
        "Comment on merge requests",
        "Post one exact merge-request comment under the selected policy.",
        true,
      ),
      platformCapability: "gitlab_merge_request_comment_write",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://gitlab.com/oauth/authorize",
      tokenUrl: "https://gitlab.com/oauth/token",
      userInfoUrl: "https://gitlab.com/api/v4/user",
      requiredScopes: ["api"],
      optionalScopes: [],
      pkce: true,
      supportsRefresh: true,
      revocationUrl: "https://gitlab.com/oauth/revoke",
    },
    credentialSchema: [
      {
        name: "GITLAB_CLIENT_ID",
        label: "GitLab application ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText: "Railway-held Relay Console GitLab OAuth application ID.",
      },
      {
        name: "GITLAB_CLIENT_SECRET",
        label: "GitLab application secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Railway-held GitLab application secret; never sent to clients or agents.",
      },
    ],
  },
  tools: [
    {
      name: "relay_gitlab_search_projects",
      functionName: "relay_gitlab_search_projects",
      aliases: ["gitlab_project_search"],
      capability: "project_search",
      platformCapability: "gitlab_project_search",
      action: "read",
      approvalRequired: false,
      description: "Search at most twenty-five GitLab projects.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", minLength: 1, maxLength: 256 },
          maxResults: { type: "integer", minimum: 1, maximum: 25 },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
    {
      name: "relay_gitlab_list_issues",
      functionName: "relay_gitlab_list_issues",
      aliases: ["gitlab_issue_list"],
      capability: "issue_read",
      platformCapability: "gitlab_issue_read",
      action: "read",
      approvalRequired: false,
      description: "List at most fifty issues from one GitLab project.",
      inputSchema: {
        type: "object",
        properties: {
          projectPath: { type: "string", minLength: 1, maxLength: 255 },
          state: { type: "string", enum: ["opened", "closed", "all"] },
          maxResults: { type: "integer", minimum: 1, maximum: 50 },
        },
        required: ["projectPath"],
        additionalProperties: false,
      },
    },
    {
      name: "relay_gitlab_list_merge_requests",
      functionName: "relay_gitlab_list_merge_requests",
      aliases: ["gitlab_merge_request_list"],
      capability: "merge_request_read",
      platformCapability: "gitlab_merge_request_read",
      action: "read",
      approvalRequired: false,
      description: "List at most fifty merge requests from one GitLab project.",
      inputSchema: {
        type: "object",
        properties: {
          projectPath: { type: "string", minLength: 1, maxLength: 255 },
          state: {
            type: "string",
            enum: ["opened", "closed", "merged", "all"],
          },
          maxResults: { type: "integer", minimum: 1, maximum: 50 },
        },
        required: ["projectPath"],
        additionalProperties: false,
      },
    },
    {
      name: "relay_gitlab_draft_comment",
      functionName: "relay_gitlab_draft_comment",
      aliases: ["gitlab_issue_comment_prepare"],
      capability: "comment_draft",
      platformCapability: "gitlab_comment_draft",
      action: "draft",
      approvalRequired: false,
      description:
        "Prepare one bounded GitLab comment without a provider mutation.",
      inputSchema: {
        type: "object",
        properties: {
          projectPath: { type: "string", minLength: 1, maxLength: 255 },
          iid: { type: "integer", minimum: 1 },
          target: { type: "string", enum: ["issue", "merge_request"] },
          body: { type: "string", minLength: 1, maxLength: 8000 },
        },
        required: ["projectPath", "iid", "target", "body"],
        additionalProperties: false,
      },
    },
    {
      name: "relay_gitlab_comment_issue",
      functionName: "relay_gitlab_comment_issue",
      aliases: ["gitlab_issue_comment_create"],
      capability: "issue_comment_write",
      platformCapability: "gitlab_issue_comment_write",
      action: "write",
      approvalRequired: true,
      description: "Post one exact approval-controlled GitLab issue comment.",
      inputSchema: {
        type: "object",
        properties: {
          projectPath: { type: "string", minLength: 1, maxLength: 255 },
          issueIid: { type: "integer", minimum: 1 },
          body: { type: "string", minLength: 1, maxLength: 8000 },
          idempotencyKey: { type: "string", pattern: "^[A-Za-z0-9_-]{8,64}$" },
          approvalId: { type: "string" },
        },
        required: ["projectPath", "issueIid", "body", "idempotencyKey"],
        additionalProperties: false,
      },
    },
    {
      name: "relay_gitlab_comment_merge_request",
      functionName: "relay_gitlab_comment_merge_request",
      aliases: ["gitlab_merge_request_comment_create"],
      capability: "merge_request_comment_write",
      platformCapability: "gitlab_merge_request_comment_write",
      action: "write",
      approvalRequired: true,
      description:
        "Post one exact approval-controlled GitLab merge-request comment.",
      inputSchema: {
        type: "object",
        properties: {
          projectPath: { type: "string", minLength: 1, maxLength: 255 },
          mergeRequestIid: { type: "integer", minimum: 1 },
          body: { type: "string", minLength: 1, maxLength: 8000 },
          idempotencyKey: { type: "string", pattern: "^[A-Za-z0-9_-]{8,64}$" },
          approvalId: { type: "string" },
        },
        required: ["projectPath", "mergeRequestIid", "body", "idempotencyKey"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "gitlab_safe",
      label: "Safe",
      description:
        "Project searches, bounded reads, and local drafts run directly; each posted comment requires matching approval.",
      defaultSelected: true,
      allowedActions: readsAndDrafts,
      approvalRequiredActions: writes,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Every selected GitLab operation supported by this connector runs without Relay per-action approval; connection ownership, GitLab user authority, request bounds, audits, redaction, and GitLab limits still apply.",
      defaultSelected: false,
      allowedActions: [...readsAndDrafts, ...writes],
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    { id: "gitlab_user", label: "GitLab connected-user authorization" },
  ],
};
