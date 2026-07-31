import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const readsAndDrafts = [
  action(
    "linear_team_list",
    "List teams",
    "List a bounded set of teams visible to the connected user.",
  ),
  action(
    "linear_issue_search",
    "Find issues",
    "Find a bounded set of issues by title within the connected workspace.",
  ),
  action(
    "linear_issue_read",
    "Read an issue",
    "Read one explicit issue and a bounded set of its comments.",
  ),
  action(
    "linear_project_list",
    "List projects",
    "List a bounded set of projects visible to the connected user.",
  ),
  action(
    "linear_issue_change_prepare",
    "Prepare an issue change",
    "Prepare and hash one exact issue change locally without changing Linear.",
  ),
];
const writes = [
  action(
    "linear_issue_create",
    "Create an issue",
    "Create one issue in an explicit team.",
  ),
  action(
    "linear_issue_update",
    "Update an issue",
    "Update bounded fields on one explicit issue.",
  ),
  action(
    "linear_comment_create",
    "Post a comment",
    "Post one comment on an explicit issue.",
  ),
];
const blockedActions = [
  blocked(
    "linear_admin",
    "Administer Linear",
    "Workspace, member, team, OAuth-app, webhook, and billing administration are outside V1.",
  ),
  blocked(
    "linear_destructive",
    "Delete or archive work",
    "Deleting, archiving, restoring, or bulk-changing Linear work is outside V1.",
  ),
  blocked(
    "linear_raw_graphql",
    "Run arbitrary GraphQL",
    "Raw GraphQL documents, introspection, unbounded traversal, and arbitrary mutations are never exposed.",
  ),
];

export const LINEAR_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "linear",
  name: "Linear",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://linear.app/developers",
  providerWebsiteUrl: "https://linear.app/",
  capabilities: [
    {
      ...capability(
        "team_read",
        "View teams",
        "List bounded teams visible to the connection.",
        true,
      ),
      platformCapability: "linear_team_read",
    },
    {
      ...capability(
        "issue_read",
        "Find and read issues",
        "Find bounded issues and read one issue with bounded comments.",
        true,
      ),
      platformCapability: "linear_issue_read",
    },
    {
      ...capability(
        "project_read",
        "View projects",
        "List bounded projects visible to the connection.",
        true,
      ),
      platformCapability: "linear_project_read",
    },
    {
      ...capability(
        "issue_draft",
        "Prepare changes",
        "Prepare exact issue changes locally.",
        true,
      ),
      platformCapability: "linear_issue_draft",
    },
    {
      ...capability(
        "issue_write",
        "Create and update issues",
        "Create one issue or update bounded fields on one explicit issue.",
        true,
      ),
      platformCapability: "linear_issue_write",
    },
    {
      ...capability(
        "comment_write",
        "Post comments",
        "Post one bounded comment on one explicit issue.",
        true,
      ),
      platformCapability: "linear_comment_write",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://linear.app/oauth/authorize",
      tokenUrl: "https://api.linear.app/oauth/token",
      refreshUrl: "https://api.linear.app/oauth/token",
      revocationUrl: "https://api.linear.app/oauth/revoke",
      userInfoUrl: "https://api.linear.app/graphql",
      requiredScopes: ["read", "write"],
      optionalScopes: [],
      pkce: true,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "LINEAR_CLIENT_ID",
        label: "Linear OAuth client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText: "Railway-held Relay Console Linear OAuth application ID.",
      },
      {
        name: "LINEAR_CLIENT_SECRET",
        label: "Linear OAuth client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Railway-held Linear client secret; never sent to clients or agents.",
      },
    ],
  },
  tools: [
    {
      name: "relay_linear_list_teams",
      functionName: "relay_linear_list_teams",
      aliases: ["linear_team_list"],
      capability: "team_read",
      platformCapability: "linear_team_read",
      action: "read",
      approvalRequired: false,
      description: "List at most twenty-five visible Linear teams.",
      inputSchema: {
        type: "object",
        properties: {
          maxResults: { type: "integer", minimum: 1, maximum: 25 },
        },
        additionalProperties: false,
      },
    },
    {
      name: "relay_linear_search_issues",
      functionName: "relay_linear_search_issues",
      aliases: ["linear_issue_search"],
      capability: "issue_read",
      platformCapability: "linear_issue_read",
      action: "read",
      approvalRequired: false,
      description: "Find at most twenty-five Linear issues by title.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", minLength: 1, maxLength: 200 },
          teamId: { type: "string", minLength: 1, maxLength: 100 },
          maxResults: { type: "integer", minimum: 1, maximum: 25 },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
    {
      name: "relay_linear_get_issue",
      functionName: "relay_linear_get_issue",
      aliases: ["linear_issue_read"],
      capability: "issue_read",
      platformCapability: "linear_issue_read",
      action: "read",
      approvalRequired: false,
      description: "Read one explicit issue and at most twenty-five comments.",
      inputSchema: {
        type: "object",
        properties: {
          issueId: { type: "string", minLength: 1, maxLength: 100 },
          maxComments: { type: "integer", minimum: 1, maximum: 25 },
        },
        required: ["issueId"],
        additionalProperties: false,
      },
    },
    {
      name: "relay_linear_list_projects",
      functionName: "relay_linear_list_projects",
      aliases: ["linear_project_list"],
      capability: "project_read",
      platformCapability: "linear_project_read",
      action: "read",
      approvalRequired: false,
      description: "List at most twenty-five visible Linear projects.",
      inputSchema: {
        type: "object",
        properties: {
          maxResults: { type: "integer", minimum: 1, maximum: 25 },
        },
        additionalProperties: false,
      },
    },
    {
      name: "relay_linear_draft_issue_change",
      functionName: "relay_linear_draft_issue_change",
      aliases: ["linear_issue_change_prepare"],
      capability: "issue_draft",
      platformCapability: "linear_issue_draft",
      action: "draft",
      approvalRequired: false,
      description:
        "Prepare one bounded issue create or update payload locally.",
      inputSchema: {
        type: "object",
        properties: {
          operation: { type: "string", enum: ["create", "update"] },
          issueId: { type: "string", maxLength: 100 },
          fields: { type: "object" },
        },
        required: ["operation", "fields"],
        additionalProperties: false,
      },
    },
    {
      name: "relay_linear_create_issue",
      functionName: "relay_linear_create_issue",
      aliases: ["linear_issue_create"],
      capability: "issue_write",
      platformCapability: "linear_issue_write",
      action: "write",
      approvalRequired: true,
      description: "Create one issue in an explicit Linear team.",
      inputSchema: {
        type: "object",
        properties: {
          teamId: { type: "string", minLength: 1, maxLength: 100 },
          title: { type: "string", minLength: 1, maxLength: 200 },
          description: { type: "string", maxLength: 20000 },
          projectId: { type: "string", maxLength: 100 },
          assigneeId: { type: "string", maxLength: 100 },
          stateId: { type: "string", maxLength: 100 },
          priority: { type: "integer", minimum: 0, maximum: 4 },
          idempotencyKey: { type: "string", minLength: 8, maxLength: 128 },
          approvalId: { type: "string" },
        },
        required: ["teamId", "title", "idempotencyKey"],
        additionalProperties: false,
      },
    },
    {
      name: "relay_linear_update_issue",
      functionName: "relay_linear_update_issue",
      aliases: ["linear_issue_update"],
      capability: "issue_write",
      platformCapability: "linear_issue_write",
      action: "write",
      approvalRequired: true,
      description: "Update bounded fields on one explicit Linear issue.",
      inputSchema: {
        type: "object",
        properties: {
          issueId: { type: "string", minLength: 1, maxLength: 100 },
          title: { type: "string", minLength: 1, maxLength: 200 },
          description: { type: "string", maxLength: 20000 },
          projectId: { type: ["string", "null"], maxLength: 100 },
          assigneeId: { type: ["string", "null"], maxLength: 100 },
          stateId: { type: "string", maxLength: 100 },
          priority: { type: "integer", minimum: 0, maximum: 4 },
          idempotencyKey: { type: "string", minLength: 8, maxLength: 128 },
          approvalId: { type: "string" },
        },
        required: ["issueId", "idempotencyKey"],
        additionalProperties: false,
      },
    },
    {
      name: "relay_linear_create_comment",
      functionName: "relay_linear_create_comment",
      aliases: ["linear_comment_create"],
      capability: "comment_write",
      platformCapability: "linear_comment_write",
      action: "write",
      approvalRequired: true,
      description: "Post one bounded comment on one explicit Linear issue.",
      inputSchema: {
        type: "object",
        properties: {
          issueId: { type: "string", minLength: 1, maxLength: 100 },
          body: { type: "string", minLength: 1, maxLength: 10000 },
          idempotencyKey: { type: "string", minLength: 8, maxLength: 128 },
          approvalId: { type: "string" },
        },
        required: ["issueId", "body", "idempotencyKey"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "linear_safe",
      label: "Safe",
      description:
        "Bounded reads and local drafts run directly; each Linear write requires matching approval.",
      defaultSelected: true,
      allowedActions: readsAndDrafts,
      approvalRequiredActions: writes,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Every selected supported Linear operation runs without Relay per-action approval; provider-granted access and safety bounds still apply.",
      defaultSelected: false,
      allowedActions: [...readsAndDrafts, ...writes],
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    { id: "linear_viewer", label: "Linear user and workspace authorization" },
  ],
};
