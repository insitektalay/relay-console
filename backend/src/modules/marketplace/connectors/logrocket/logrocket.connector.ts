import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "logrocket_find_issues",
    "Find project issues",
    "Run the exact find_issues tool against one project-scoped LogRocket issues MCP endpoint.",
  ),
];
const blockedActions = [
  blocked(
    "logrocket_session_data",
    "Access session recordings",
    "Session discovery, replay watching, user/account targeting, console logs, network bodies, DOM content, and session URLs are blocked.",
  ),
  blocked(
    "logrocket_metrics_galileo",
    "Use metrics or Galileo",
    "Metrics, natural-language Galileo queries, generated investigations, funnels, heatmaps, dashboards, and arbitrary analytics are blocked.",
  ),
  blocked(
    "logrocket_broader_account",
    "Access broader LogRocket account data",
    "Organization/project discovery, other projects, users, roles, settings, API keys, audit data, exports, integrations, and administration are blocked.",
  ),
  blocked(
    "logrocket_raw_mcp",
    "Use raw or broad MCP access",
    "Raw tool names, tool discovery, unrestricted toolsets, custom MCP origins, pagination, polling, retries, batches, and provider-response pass-through are blocked.",
  ),
];

export const LOGROCKET_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "logrocket",
  name: "LogRocket",
  connectorType: "mcp_backed",
  providerDocsUrl: "https://docs.logrocket.com/docs/mcp",
  providerWebsiteUrl: "https://logrocket.com/",
  capabilities: [
    {
      ...capability(
        "project_issues_find",
        "Find project issues",
        "Query one exact project's issue summaries through LogRocket's issues-only MCP toolset.",
        true,
      ),
      platformCapability: "logrocket_project_issues_find",
    },
  ],
  auth: {
    type: "mcp",
    credentialSchema: [
      {
        name: "LOGROCKET_API_KEY",
        label: "LogRocket project API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["mcp"],
        helpText:
          "Create a dedicated project-scoped API key in LogRocket Settings > API Keys and store it only through Relay's encrypted connection flow.",
      },
      {
        name: "LOGROCKET_ORGANIZATION_ID",
        label: "LogRocket organization ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["mcp"],
        helpText:
          "Enter the organization component from the exact project App ID.",
      },
      {
        name: "LOGROCKET_PROJECT_ID",
        label: "LogRocket project ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["mcp"],
        helpText: "Enter the project component from the exact project App ID.",
      },
    ],
  },
  tools: [
    {
      name: "logrocket.findIssues",
      functionName: "logrocket_find_issues",
      aliases: ["logrocket.findIssues", "logrocket_find_issues"],
      capability: "project_issues_find",
      platformCapability: "logrocket_project_issues_find",
      action: "read",
      approvalRequired: true,
      description:
        "Call only LogRocket's dynamically described find_issues tool for one exact project.",
      inputSchema: {
        type: "object",
        properties: {
          arguments: {
            type: "object",
            description:
              "Arguments validated against the provider-returned find_issues schema at execution time.",
          },
        },
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "logrocket_issues_safe",
      label: "Safe",
      description:
        "The one project-scoped issue query requires approval; session replay, metrics, Galileo, discovery, administration, exports, and raw MCP remain blocked.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: reads,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The one project-scoped issue query runs without Relay per-action approval; exact project binding, issues-only toolset, dynamic schema check, encrypted key, output bounds, audits, and no-write behavior remain enforced.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "mcp_initialize_find_issues",
      label: "Project-scoped issues MCP initialize and find_issues discovery",
    },
  ],
};
