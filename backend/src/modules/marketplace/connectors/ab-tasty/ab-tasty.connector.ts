import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { AB_TASTY_READ_OPERATIONS } from "./ab-tasty-api.adapter";

const read = action(
  "ab_tasty_read",
  "List AB Tasty projects",
  "List up to 100 project IDs and names for one exact account without environments, campaigns, flags, users, targeting, results, or writes.",
);
const manage = blocked(
  "ab_tasty_manage",
  "Access broader AB Tasty data",
  "Environments, campaigns, variations, flags, users, targeting, goals, decisions, results, arbitrary routes, and every mutation are outside Relay's V1 contract.",
);

export const AB_TASTY_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "ab-tasty",
  name: "AB Tasty",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://docs.abtasty.com/server-side/remote-control-api",
  providerWebsiteUrl: "https://www.abtasty.com/",
  capabilities: [
    {
      ...capability(
        "ab_tasty_read",
        "List projects",
        "Use only the first 100 projects for one credential-bound account and return IDs and names.",
        true,
      ),
      platformCapability: "ab_tasty_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "AB_TASTY_ACCESS_TOKEN",
        label: "AB Tasty Remote Control API token",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Use a customer-owned token generated from an access limited to the project read action. Relay encrypts it server-side.",
      },
      {
        name: "AB_TASTY_ACCOUNT_ID",
        label: "AB Tasty account ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Enter the exact account ID bound to the Remote Control access.",
      },
    ],
  },
  tools: [
    {
      name: "abTasty.listProjects",
      functionName: "ab_tasty_read",
      aliases: ["abTasty.listProjects", "ab_tasty_read"],
      capability: "ab_tasty_read",
      platformCapability: "ab_tasty_read",
      action: "read",
      approvalRequired: false,
      description: "List minimized AB Tasty project summaries.",
      inputSchema: {
        type: "object",
        properties: {
          operation: { type: "string", enum: [...AB_TASTY_READ_OPERATIONS] },
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "ab_tasty_safe",
      label: "Safe",
      description:
        "One minimized account-bound project-directory read runs directly. Environments, campaigns, flags, users, targeting, arbitrary API access, and mutations remain blocked.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [],
      blockedActions: [manage],
    },
  ],
  healthChecks: [
    {
      id: "token_account_and_project_list",
      label: "Token, account, and project-list access check",
    },
  ],
};
