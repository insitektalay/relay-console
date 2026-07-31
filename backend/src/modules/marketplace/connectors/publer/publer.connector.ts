import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "publer_workspace_list",
    "List Publer workspace references",
    "List at most twenty-five workspace IDs without names, pictures, owners, members, plans, or other identity.",
  ),
  action(
    "publer_account_structure_list",
    "List Publer account structure",
    "List at most twenty-five account IDs, providers, and account types for one exact workspace without names, social IDs, pictures, profile identity, or content.",
  ),
];

export const PUBLER_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "publer",
  name: "Publer",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://publer.com/docs/",
  providerWebsiteUrl: "https://publer.com/",
  capabilities: [
    {
      ...capability(
        "workspace_account_structure_read",
        "Read workspace and account structure",
        "Read bounded identity-redacted workspace references and account provider/type structure for one exact Publer workspace.",
        true,
      ),
      platformCapability: "publer_workspace_account_structure_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "PUBLER_API_KEY",
        label: "Publer API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Create a dedicated least-privilege key with only workspaces and accounts scopes in Settings > Access & Login > API Keys. Relay encrypts it and sends it only as Bearer-API to https://app.publer.com.",
      },
      {
        name: "PUBLER_WORKSPACE_ID",
        label: "Publer workspace ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Paste one exact workspace ID returned by the official List Workspaces endpoint.",
      },
    ],
  },
  tools: [
    {
      name: "publer.listWorkspaces",
      functionName: "publer_workspace_list",
      aliases: ["publer.listWorkspaces", "publer_workspace_list"],
      capability: "workspace_account_structure_read",
      platformCapability: "publer_workspace_account_structure_read",
      action: "read",
      approvalRequired: true,
      description:
        "List at most twenty-five workspace IDs without names, pictures, owners, members, plans, or other identity.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "publer.listAccounts",
      functionName: "publer_account_structure_list",
      aliases: ["publer.listAccounts", "publer_account_structure_list"],
      capability: "workspace_account_structure_read",
      platformCapability: "publer_workspace_account_structure_read",
      action: "read",
      approvalRequired: true,
      description:
        "List at most twenty-five account IDs, providers, and account types for the exact bound workspace without social identity or content.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "publer_safe",
      label: "Safe",
      description:
        "Both bounded identity-redacted reads require approval; user/member identity, names, pictures, plans, social IDs, profile identity, posts, media, analytics, publishing, writes, arbitrary APIs, pagination, bulk, and export remain blocked.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: reads,
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The same two bounded reads run directly; exact workspace binding, fixed paths, identity redaction, response caps, audits, and Publer's rate limit remain mandatory.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    {
      id: "workspace",
      label: "Publer API key and exact workspace validation",
    },
  ],
};
