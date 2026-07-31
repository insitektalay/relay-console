import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { UNBOUNCE_READ_OPERATIONS } from "./unbounce-api.adapter";

const read = action(
  "unbounce_read",
  "List Unbounce pages",
  "List up to 100 accessible page IDs, names, publication states, and domains without leads, form fields, integrations, stats, or writes.",
);
const manage = blocked(
  "unbounce_manage",
  "Access broader Unbounce data",
  "Leads, form fields, user details, accounts, clients, domains, groups, stats, integrations, arbitrary routes, and every mutation are outside Relay's V1 contract.",
);

export const UNBOUNCE_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "unbounce",
  name: "Unbounce",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developer.unbounce.com/",
  providerWebsiteUrl: "https://unbounce.com/",
  capabilities: [
    {
      ...capability(
        "unbounce_read",
        "List pages",
        "Use only GET /pages with limit 100 and return minimized page summaries.",
        true,
      ),
      platformCapability: "unbounce_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "UNBOUNCE_API_KEY",
        label: "Unbounce API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Use a customer-owned Unbounce API key. Relay encrypts it server-side and uses it only with HTTP Basic authentication.",
      },
    ],
  },
  tools: [
    {
      name: "unbounce.listPages",
      functionName: "unbounce_read",
      aliases: ["unbounce.listPages", "unbounce_read"],
      capability: "unbounce_read",
      platformCapability: "unbounce_read",
      action: "read",
      approvalRequired: false,
      description: "List minimized Unbounce page summaries.",
      inputSchema: {
        type: "object",
        properties: {
          operation: {
            type: "string",
            enum: [...UNBOUNCE_READ_OPERATIONS],
          },
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "unbounce_safe",
      label: "Safe",
      description:
        "One bounded page-directory read runs directly. Leads, form fields, users, accounts, clients, domains, groups, stats, integrations, arbitrary API access, and mutations remain blocked.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [],
      blockedActions: [manage],
    },
  ],
  healthChecks: [
    {
      id: "api_key_and_page_list",
      label: "API key and page-list access check",
    },
  ],
};
