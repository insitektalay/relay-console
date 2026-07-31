import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "slack_enterprise_identity_read",
    "Validate Enterprise authorization",
    "Validate the customer-owned organization token and return its bounded Slack identity metadata.",
  ),
  action(
    "slack_enterprise_workspaces_list",
    "List organization workspaces",
    "List one bounded page of workspaces in the authorized Enterprise organization without owner contact data.",
  ),
  action(
    "slack_enterprise_workspace_admins_list",
    "List workspace admins",
    "List bounded admin IDs for one explicit workspace.",
  ),
  action(
    "slack_enterprise_workspace_owners_list",
    "List workspace owners",
    "List bounded owner IDs for one explicit workspace.",
  ),
];

const blockedActions = [
  blocked(
    "slack_enterprise_mutations",
    "Block organization mutations",
    "App approvals, user lifecycle, workspace creation and settings, channel administration, roles and IDP changes are not exposed.",
  ),
  blocked(
    "slack_enterprise_sensitive_exports",
    "Block sensitive exports",
    "Audit Logs, Discovery APIs, message content, emails, profiles, files, access logs and bulk exports are not exposed.",
  ),
  blocked(
    "slack_enterprise_raw_api",
    "Block raw Slack access",
    "Arbitrary Slack methods, caller-selected origins, raw tokens and unbounded pagination are not exposed.",
  ),
];

export const SLACK_ENTERPRISE_GRID_CONNECTOR_MANIFEST: MarketplaceConnectorManifest =
  {
    slug: "slack-enterprise-grid",
    name: "Slack Enterprise Grid",
    connectorType: "native_clawchat",
    providerDocsUrl:
      "https://docs.slack.dev/enterprise/organization-ready-apps",
    providerWebsiteUrl: "https://slack.com/enterprise-grid",
    capabilities: [
      {
        ...capability(
          "organization_read",
          "Read Enterprise organization metadata",
          "Validate one organization token and inspect bounded workspace, admin and owner metadata.",
          true,
        ),
        platformCapability: "slack_enterprise_organization_read",
      },
    ],
    auth: {
      type: "api_key",
      credentialSchema: [
        {
          name: "SLACK_ENTERPRISE_ADMIN_TOKEN",
          label: "Slack Enterprise organization admin token",
          required: true,
          secret: true,
          storedIn: "encrypted_secret",
          requiredForAuthTypes: ["api_key"],
          helpText:
            "An Enterprise org owner or admin obtains this user token by installing the customer's own org-ready Slack app with admin.teams:read. Railway stores it encrypted and sends it only to slack.com/api.",
        },
      ],
    },
    tools: [
      {
        name: "slackEnterprise.identity",
        functionName: "slack_enterprise_identity_read",
        aliases: ["slackEnterprise.identity", "slack_enterprise_identity_read"],
        capability: "organization_read",
        platformCapability: "slack_enterprise_organization_read",
        action: "read",
        approvalRequired: false,
        description: "Validate the Slack Enterprise organization token.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
      {
        name: "slackEnterprise.listWorkspaces",
        functionName: "slack_enterprise_workspaces_list",
        aliases: [
          "slackEnterprise.listWorkspaces",
          "slack_enterprise_workspaces_list",
        ],
        capability: "organization_read",
        platformCapability: "slack_enterprise_organization_read",
        action: "read",
        approvalRequired: false,
        description:
          "List one bounded page of Enterprise organization workspaces.",
        inputSchema: {
          type: "object",
          properties: { limit: { type: "integer", minimum: 1, maximum: 100 } },
          additionalProperties: false,
        },
      },
      {
        name: "slackEnterprise.listWorkspaceAdmins",
        functionName: "slack_enterprise_workspace_admins_list",
        aliases: [
          "slackEnterprise.listWorkspaceAdmins",
          "slack_enterprise_workspace_admins_list",
        ],
        capability: "organization_read",
        platformCapability: "slack_enterprise_organization_read",
        action: "read",
        approvalRequired: false,
        description:
          "List bounded admin IDs for one explicit Enterprise workspace.",
        inputSchema: {
          type: "object",
          properties: {
            teamId: { type: "string", pattern: "^T[A-Z0-9]{2,31}$" },
            limit: { type: "integer", minimum: 1, maximum: 100 },
          },
          required: ["teamId"],
          additionalProperties: false,
        },
      },
      {
        name: "slackEnterprise.listWorkspaceOwners",
        functionName: "slack_enterprise_workspace_owners_list",
        aliases: [
          "slackEnterprise.listWorkspaceOwners",
          "slack_enterprise_workspace_owners_list",
        ],
        capability: "organization_read",
        platformCapability: "slack_enterprise_organization_read",
        action: "read",
        approvalRequired: false,
        description:
          "List bounded owner IDs for one explicit Enterprise workspace.",
        inputSchema: {
          type: "object",
          properties: {
            teamId: { type: "string", pattern: "^T[A-Z0-9]{2,31}$" },
            limit: { type: "integer", minimum: 1, maximum: 100 },
          },
          required: ["teamId"],
          additionalProperties: false,
        },
      },
    ],
    approvalProfiles: [
      {
        id: "slack_enterprise_safe",
        label: "Safe",
        description:
          "Only bounded organization identity, workspace, admin-ID and owner-ID reads are mounted.",
        defaultSelected: true,
        allowedActions: reads,
        approvalRequiredActions: [],
        blockedActions,
      },
      {
        id: "dangerously_skip_permissions",
        label: "Dangerously skip permissions",
        description:
          "The same selected read-only operations run directly; encrypted token storage, fixed methods, response shaping, request bounds, audits, Slack scopes, organization grants and rate limits remain enforced.",
        defaultSelected: false,
        allowedActions: reads,
        approvalRequiredActions: [],
        blockedActions,
      },
    ],
    healthChecks: [
      {
        id: "organization_auth",
        label: "Slack Enterprise organization authorization",
        requiredScopes: ["admin.teams:read"],
      },
    ],
  };
