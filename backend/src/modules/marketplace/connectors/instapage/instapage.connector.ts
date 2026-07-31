import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { INSTAPAGE_READ_OPERATIONS } from "./instapage-api.adapter";

const read = action(
  "instapage_read",
  "List Instapage workspaces",
  "List the first 100 accessible workspace IDs, names, and the token holder's access levels without owner IDs, timestamps, pages, leads, analytics, or writes.",
);
const manage = blocked(
  "instapage_manage",
  "Access broader Instapage data",
  "Pages, leads, submissions, analytics, members, domains, groups, collections, experiments, assets, arbitrary routes, and every mutation are outside Relay's V1 contract.",
);

export const INSTAPAGE_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "instapage",
  name: "Instapage",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://devdocs.instapage.com/",
  providerWebsiteUrl: "https://instapage.com/",
  capabilities: [
    {
      ...capability(
        "instapage_read",
        "List workspaces",
        "Use only GET /v1/workspaces?page=1 and return minimized workspace summaries.",
        true,
      ),
      platformCapability: "instapage_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "INSTAPAGE_API_TOKEN",
        label: "Instapage personal API token",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Use a customer-owned personal API token from an account with Developer Access and the least necessary workspace role. Relay encrypts it server-side.",
      },
    ],
  },
  tools: [
    {
      name: "instapage.listWorkspaces",
      functionName: "instapage_read",
      aliases: ["instapage.listWorkspaces", "instapage_read"],
      capability: "instapage_read",
      platformCapability: "instapage_read",
      action: "read",
      approvalRequired: false,
      description: "List minimized Instapage workspace summaries.",
      inputSchema: {
        type: "object",
        properties: {
          operation: {
            type: "string",
            enum: [...INSTAPAGE_READ_OPERATIONS],
          },
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "instapage_safe",
      label: "Safe",
      description:
        "One minimized first-page workspace-directory read runs directly. Pages, leads, analytics, members, assets, arbitrary API access, and mutations remain blocked.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [],
      blockedActions: [manage],
    },
  ],
  healthChecks: [
    {
      id: "api_token_and_workspace_list",
      label: "API token and workspace-list access check",
    },
  ],
};
