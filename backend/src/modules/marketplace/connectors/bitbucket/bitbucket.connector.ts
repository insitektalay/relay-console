import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const readsAndDrafts = [
  action(
    "bitbucket_repository_search",
    "Search repositories",
    "Search a bounded set of repositories visible to the authorized Bitbucket user.",
  ),
  action(
    "bitbucket_issue_list",
    "List issues",
    "List a bounded set of issues in one explicit Bitbucket repository.",
  ),
  action(
    "bitbucket_pull_request_list",
    "List pull requests",
    "List a bounded set of pull requests in one explicit Bitbucket repository.",
  ),
  action(
    "bitbucket_pull_request_comment_prepare",
    "Prepare a comment",
    "Prepare one issue or pull-request comment locally without changing Bitbucket.",
  ),
];

const writes = [
  action(
    "bitbucket_issue_comment_create",
    "Comment on an issue",
    "Post one exact comment to an explicit Bitbucket issue.",
  ),
  action(
    "bitbucket_pull_request_comment_create",
    "Comment on a pull request",
    "Post one exact comment to an explicit Bitbucket pull request.",
  ),
];

const blockedActions = [
  blocked(
    "bitbucket_repository_admin",
    "Administer repositories or workspaces",
    "Repository, project, workspace, member, permission, and branch-restriction administration are outside V1.",
  ),
  blocked(
    "bitbucket_pipeline_write",
    "Change pipelines",
    "Pipeline runs, variables, deployments, runners, and other CI/CD mutations are outside V1.",
  ),
  blocked(
    "bitbucket_repository_mutation",
    "Change repository contents",
    "Branches, tags, files, merges, pushes, forks, and repository deletion are outside V1.",
  ),
  blocked(
    "bitbucket_raw_api",
    "Use arbitrary Bitbucket API calls",
    "Raw URLs, arbitrary operations, tokens, and unbounded pagination are never exposed to agents.",
  ),
];

export const BITBUCKET_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "bitbucket",
  name: "Bitbucket",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://developer.atlassian.com/cloud/bitbucket/rest/intro/",
  providerWebsiteUrl: "https://bitbucket.org/",
  capabilities: [
    {
      ...capability(
        "repository_search",
        "Find repositories",
        "Search bounded repositories visible to the authorized Bitbucket user.",
        true,
      ),
      platformCapability: "bitbucket_repository_search",
    },
    {
      ...capability(
        "issue_read",
        "Read issues",
        "Read bounded issues from one explicit Bitbucket repository.",
        true,
      ),
      platformCapability: "bitbucket_issue_read",
    },
    {
      ...capability(
        "pull_request_read",
        "Read pull requests",
        "Read bounded pull requests from one explicit Bitbucket repository.",
        true,
      ),
      platformCapability: "bitbucket_pull_request_read",
    },
    {
      ...capability(
        "comment_draft",
        "Prepare comments",
        "Prepare bounded issue or pull-request comments locally.",
        true,
      ),
      platformCapability: "bitbucket_comment_draft",
    },
    {
      ...capability(
        "issue_comment_write",
        "Comment on issues",
        "Post one exact issue comment under the selected policy.",
        true,
      ),
      platformCapability: "bitbucket_issue_comment_write",
    },
    {
      ...capability(
        "pull_request_comment_write",
        "Comment on pull requests",
        "Post one exact pull-request comment under the selected policy.",
        true,
      ),
      platformCapability: "bitbucket_pull_request_comment_write",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://bitbucket.org/site/oauth2/authorize",
      tokenUrl: "https://bitbucket.org/site/oauth2/access_token",
      userInfoUrl: "https://api.bitbucket.org/2.0/user",
      requiredScopes: ["account", "repository", "pullrequest", "issue"],
      optionalScopes: [],
      pkce: false,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "BITBUCKET_CLIENT_ID",
        label: "Bitbucket OAuth key",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText: "Railway-held Relay Console Bitbucket OAuth consumer key.",
      },
      {
        name: "BITBUCKET_CLIENT_SECRET",
        label: "Bitbucket OAuth secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Railway-held Bitbucket OAuth consumer secret; never sent to clients or agents.",
      },
    ],
  },
  tools: [
    {
      name: "relay_bitbucket_search_repositories",
      functionName: "relay_bitbucket_search_repositories",
      aliases: ["bitbucket_repository_search"],
      capability: "repository_search",
      platformCapability: "bitbucket_repository_search",
      action: "read",
      approvalRequired: false,
      description: "Search at most twenty-five Bitbucket repositories.",
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
      name: "relay_bitbucket_list_issues",
      functionName: "relay_bitbucket_list_issues",
      aliases: ["bitbucket_issue_list"],
      capability: "issue_read",
      platformCapability: "bitbucket_issue_read",
      action: "read",
      approvalRequired: false,
      description: "List at most fifty issues from one Bitbucket repository.",
      inputSchema: {
        type: "object",
        properties: {
          repositoryPath: { type: "string", minLength: 3, maxLength: 255 },
          state: {
            type: "string",
            enum: [
              "new",
              "open",
              "resolved",
              "on hold",
              "invalid",
              "duplicate",
              "wontfix",
              "closed",
              "all",
            ],
          },
          maxResults: { type: "integer", minimum: 1, maximum: 50 },
        },
        required: ["repositoryPath"],
        additionalProperties: false,
      },
    },
    {
      name: "relay_bitbucket_list_pull_requests",
      functionName: "relay_bitbucket_list_pull_requests",
      aliases: ["bitbucket_pull_request_list"],
      capability: "pull_request_read",
      platformCapability: "bitbucket_pull_request_read",
      action: "read",
      approvalRequired: false,
      description:
        "List at most fifty pull requests from one Bitbucket repository.",
      inputSchema: {
        type: "object",
        properties: {
          repositoryPath: { type: "string", minLength: 3, maxLength: 255 },
          state: {
            type: "string",
            enum: ["OPEN", "MERGED", "DECLINED", "SUPERSEDED", "all"],
          },
          maxResults: { type: "integer", minimum: 1, maximum: 50 },
        },
        required: ["repositoryPath"],
        additionalProperties: false,
      },
    },
    {
      name: "relay_bitbucket_draft_comment",
      functionName: "relay_bitbucket_draft_comment",
      aliases: ["bitbucket_pull_request_comment_prepare"],
      capability: "comment_draft",
      platformCapability: "bitbucket_comment_draft",
      action: "draft",
      approvalRequired: false,
      description:
        "Prepare one bounded Bitbucket comment without a provider mutation.",
      inputSchema: {
        type: "object",
        properties: {
          repositoryPath: { type: "string", minLength: 3, maxLength: 255 },
          id: { type: "integer", minimum: 1 },
          target: { type: "string", enum: ["issue", "pull_request"] },
          body: { type: "string", minLength: 1, maxLength: 8000 },
        },
        required: ["repositoryPath", "id", "target", "body"],
        additionalProperties: false,
      },
    },
    {
      name: "relay_bitbucket_comment_issue",
      functionName: "relay_bitbucket_comment_issue",
      aliases: ["bitbucket_issue_comment_create"],
      capability: "issue_comment_write",
      platformCapability: "bitbucket_issue_comment_write",
      action: "write",
      approvalRequired: true,
      description:
        "Post one exact approval-controlled Bitbucket issue comment.",
      inputSchema: {
        type: "object",
        properties: {
          repositoryPath: { type: "string", minLength: 3, maxLength: 255 },
          issueId: { type: "integer", minimum: 1 },
          body: { type: "string", minLength: 1, maxLength: 8000 },
          idempotencyKey: { type: "string", pattern: "^[A-Za-z0-9_-]{8,64}$" },
          approvalId: { type: "string" },
        },
        required: ["repositoryPath", "issueId", "body", "idempotencyKey"],
        additionalProperties: false,
      },
    },
    {
      name: "relay_bitbucket_comment_pull_request",
      functionName: "relay_bitbucket_comment_pull_request",
      aliases: ["bitbucket_pull_request_comment_create"],
      capability: "pull_request_comment_write",
      platformCapability: "bitbucket_pull_request_comment_write",
      action: "write",
      approvalRequired: true,
      description:
        "Post one exact approval-controlled Bitbucket pull-request comment.",
      inputSchema: {
        type: "object",
        properties: {
          repositoryPath: { type: "string", minLength: 3, maxLength: 255 },
          pullRequestId: { type: "integer", minimum: 1 },
          body: { type: "string", minLength: 1, maxLength: 8000 },
          idempotencyKey: { type: "string", pattern: "^[A-Za-z0-9_-]{8,64}$" },
          approvalId: { type: "string" },
        },
        required: ["repositoryPath", "pullRequestId", "body", "idempotencyKey"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "bitbucket_safe",
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
        "Every selected Bitbucket operation supported by this connector runs without Relay per-action approval; connection ownership, provider authority, bounds, audits, redaction, and provider limits still apply.",
      defaultSelected: false,
      allowedActions: [...readsAndDrafts, ...writes],
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    { id: "bitbucket_user", label: "Bitbucket connected-user authorization" },
  ],
};
