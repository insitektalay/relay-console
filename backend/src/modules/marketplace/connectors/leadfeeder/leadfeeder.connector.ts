import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { LEADFEEDER_READ_OPERATIONS } from "./leadfeeder-api.adapter";

const read = action(
  "leadfeeder_read",
  "List Leadfeeder accounts",
  "List up to 100 accessible account IDs and names without credit details, visitor data, company data, or writes.",
);
const manage = blocked(
  "leadfeeder_manage",
  "Access broader Leadfeeder data",
  "Companies, contacts, website visits, IPs, signals, financials, credits, enrichment, lists, tags, custom fields, tracking, and every mutation are outside Relay's V1 contract.",
);

export const LEADFEEDER_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "leadfeeder",
  name: "Leadfeeder",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://docs.leadfeeder.com/api/public",
  providerWebsiteUrl: "https://www.leadfeeder.com/",
  capabilities: [
    {
      ...capability(
        "leadfeeder_read",
        "List accounts",
        "Use only the unfiltered /v1/accounts route and return account IDs and names without credit or request metadata.",
        true,
      ),
      platformCapability: "leadfeeder_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "LEADFEEDER_API_KEY",
        label: "Leadfeeder API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Use a user-generated API key with Manage API keys and use API permission. Relay encrypts it server-side.",
      },
    ],
  },
  tools: [
    {
      name: "leadfeeder.listAccounts",
      functionName: "leadfeeder_read",
      aliases: ["leadfeeder.listAccounts", "leadfeeder_read"],
      capability: "leadfeeder_read",
      platformCapability: "leadfeeder_read",
      action: "read",
      approvalRequired: false,
      description: "List minimized Leadfeeder account identifiers and names.",
      inputSchema: {
        type: "object",
        properties: {
          operation: {
            type: "string",
            enum: [...LEADFEEDER_READ_OPERATIONS],
          },
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "leadfeeder_safe",
      label: "Safe",
      description:
        "One minimized account-directory read runs directly. Credits, companies, contacts, visitor activity, IPs, signals, enrichment, tracking, arbitrary API or MCP access, and mutations remain blocked.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [],
      blockedActions: [manage],
    },
  ],
  healthChecks: [
    {
      id: "api_key_and_account_list",
      label: "API key and account-list access check",
    },
  ],
};
