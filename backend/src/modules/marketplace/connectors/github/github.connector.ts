import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const readsAndDrafts = [
  action(
    "github_repo_search",
    "Search repositories",
    "Search a bounded set of repositories visible to the authorized GitHub user.",
  ),
  action(
    "github_issue_list",
    "List issues",
    "List a bounded set of issues in one explicit repository.",
  ),
  action(
    "github_pull_request_list",
    "List pull requests",
    "List a bounded set of pull requests in one explicit repository.",
  ),
  action(
    "github_issue_comment_prepare",
    "Prepare a comment",
    "Prepare one issue or pull-request comment locally without changing GitHub.",
  ),
];

const writes = [
  action(
    "github_issue_comment_create",
    "Comment on an issue",
    "Post one exact comment to an explicit issue.",
  ),
  action(
    "github_pull_request_comment_create",
    "Comment on a pull request",
    "Post one exact conversation comment to an explicit pull request.",
  ),
];

const blockedActions = [
  blocked(
    "github_repository_delete",
    "Delete repositories",
    "Repository deletion is outside the bounded V1 connector.",
  ),
  blocked(
    "github_governance_admin",
    "Change governance or security",
    "Organization administration, branch protections, rulesets, secrets, and security-control changes are outside V1.",
  ),
  blocked(
    "github_raw_api",
    "Use arbitrary GitHub API calls",
    "Raw URLs, arbitrary operations, tokens, and unbounded pagination are never exposed to agents.",
  ),
  blocked(
    "github_history_rewrite",
    "Rewrite protected history",
    "Force pushes and protected-history rewrites are outside V1.",
  ),
];

export const GITHUB_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "github",
  name: "GitHub",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://docs.github.com/en/apps/creating-github-apps",
  providerWebsiteUrl: "https://github.com/",
  capabilities: [
    {
      ...capability(
        "repository_search",
        "Find repositories",
        "Search bounded repositories visible through the installed GitHub App.",
        true,
      ),
      platformCapability: "github_repository_search",
    },
    {
      ...capability(
        "issue_read",
        "Read issues",
        "Read bounded issues from one explicit repository.",
        true,
      ),
      platformCapability: "github_issue_read",
    },
    {
      ...capability(
        "pull_request_read",
        "Read pull requests",
        "Read bounded pull requests from one explicit repository.",
        true,
      ),
      platformCapability: "github_pull_request_read",
    },
    {
      ...capability(
        "comment_draft",
        "Prepare comments",
        "Prepare bounded issue or pull-request comments locally.",
        true,
      ),
      platformCapability: "github_comment_draft",
    },
    {
      ...capability(
        "issue_comment_write",
        "Comment on issues",
        "Post one exact issue comment under the selected policy.",
        true,
      ),
      platformCapability: "github_issue_comment_write",
    },
    {
      ...capability(
        "pull_request_comment_write",
        "Comment on pull requests",
        "Post one exact pull-request conversation comment under the selected policy.",
        true,
      ),
      platformCapability: "github_pull_request_comment_write",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://github.com/login/oauth/authorize",
      tokenUrl: "https://github.com/login/oauth/access_token",
      userInfoUrl: "https://api.github.com/user",
      requiredScopes: [],
      optionalScopes: [],
      pkce: true,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "GITHUB_CLIENT_ID",
        label: "GitHub App client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText: "Railway-held Relay Console GitHub App client ID.",
      },
      {
        name: "GITHUB_CLIENT_SECRET",
        label: "GitHub App client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Railway-held GitHub App client secret; never sent to clients or agents.",
      },
      {
        name: "GITHUB_APP_SLUG",
        label: "GitHub App slug",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Railway-held public GitHub App slug used to open the one-click installation flow.",
      },
    ],
  },
  tools: [
    {
      name: "relay_github_search_repositories",
      functionName: "relay_github_search_repositories",
      aliases: ["github_repo_search"],
      capability: "repository_search",
      platformCapability: "github_repository_search",
      action: "read",
      approvalRequired: false,
      description: "Search at most twenty-five GitHub repositories.",
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
      name: "relay_github_list_issues",
      functionName: "relay_github_list_issues",
      aliases: ["github_issue_list"],
      capability: "issue_read",
      platformCapability: "github_issue_read",
      action: "read",
      approvalRequired: false,
      description: "List at most fifty issues from one repository.",
      inputSchema: {
        type: "object",
        properties: {
          owner: { type: "string", minLength: 1, maxLength: 100 },
          repo: { type: "string", minLength: 1, maxLength: 100 },
          state: { type: "string", enum: ["open", "closed", "all"] },
          maxResults: { type: "integer", minimum: 1, maximum: 50 },
        },
        required: ["owner", "repo"],
        additionalProperties: false,
      },
    },
    {
      name: "relay_github_list_pull_requests",
      functionName: "relay_github_list_pull_requests",
      aliases: ["github_pull_request_list"],
      capability: "pull_request_read",
      platformCapability: "github_pull_request_read",
      action: "read",
      approvalRequired: false,
      description: "List at most fifty pull requests from one repository.",
      inputSchema: {
        type: "object",
        properties: {
          owner: { type: "string", minLength: 1, maxLength: 100 },
          repo: { type: "string", minLength: 1, maxLength: 100 },
          state: { type: "string", enum: ["open", "closed", "all"] },
          maxResults: { type: "integer", minimum: 1, maximum: 50 },
        },
        required: ["owner", "repo"],
        additionalProperties: false,
      },
    },
    {
      name: "relay_github_draft_comment",
      functionName: "relay_github_draft_comment",
      aliases: ["github_issue_comment_prepare"],
      capability: "comment_draft",
      platformCapability: "github_comment_draft",
      action: "draft",
      approvalRequired: false,
      description:
        "Prepare one bounded GitHub comment without a provider mutation.",
      inputSchema: {
        type: "object",
        properties: {
          owner: { type: "string", minLength: 1, maxLength: 100 },
          repo: { type: "string", minLength: 1, maxLength: 100 },
          number: { type: "integer", minimum: 1 },
          body: { type: "string", minLength: 1, maxLength: 8000 },
        },
        required: ["owner", "repo", "number", "body"],
        additionalProperties: false,
      },
    },
    {
      name: "relay_github_comment_issue",
      functionName: "relay_github_comment_issue",
      aliases: ["github_issue_comment_create"],
      capability: "issue_comment_write",
      platformCapability: "github_issue_comment_write",
      action: "write",
      approvalRequired: true,
      description: "Post one exact approval-controlled issue comment.",
      inputSchema: {
        type: "object",
        properties: {
          owner: { type: "string", minLength: 1, maxLength: 100 },
          repo: { type: "string", minLength: 1, maxLength: 100 },
          issueNumber: { type: "integer", minimum: 1 },
          body: { type: "string", minLength: 1, maxLength: 8000 },
          idempotencyKey: { type: "string", pattern: "^[A-Za-z0-9_-]{8,64}$" },
          approvalId: { type: "string" },
        },
        required: ["owner", "repo", "issueNumber", "body", "idempotencyKey"],
        additionalProperties: false,
      },
    },
    {
      name: "relay_github_comment_pull_request",
      functionName: "relay_github_comment_pull_request",
      aliases: ["github_pull_request_comment_create"],
      capability: "pull_request_comment_write",
      platformCapability: "github_pull_request_comment_write",
      action: "write",
      approvalRequired: true,
      description:
        "Post one exact approval-controlled pull-request conversation comment.",
      inputSchema: {
        type: "object",
        properties: {
          owner: { type: "string", minLength: 1, maxLength: 100 },
          repo: { type: "string", minLength: 1, maxLength: 100 },
          pullNumber: { type: "integer", minimum: 1 },
          body: { type: "string", minLength: 1, maxLength: 8000 },
          idempotencyKey: { type: "string", pattern: "^[A-Za-z0-9_-]{8,64}$" },
          approvalId: { type: "string" },
        },
        required: ["owner", "repo", "pullNumber", "body", "idempotencyKey"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "github_safe",
      label: "Safe",
      description:
        "Repository searches, bounded reads, and local drafts run directly; each posted comment requires matching approval.",
      defaultSelected: true,
      allowedActions: readsAndDrafts,
      approvalRequiredActions: writes,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Every selected GitHub operation supported by this connector runs without Relay per-action approval; connection ownership, GitHub App permissions, user authority, repository selection, request bounds, audits, redaction, and provider limits still apply.",
      defaultSelected: false,
      allowedActions: [...readsAndDrafts, ...writes],
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    { id: "github_user", label: "GitHub user and installed-app authorization" },
  ],
};
