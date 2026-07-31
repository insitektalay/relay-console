import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { CLEARBIT_READ_OPERATIONS } from "./clearbit-api.adapter";

const read = action(
  "clearbit_read",
  "Look up a Clearbit company",
  "Retrieve one minimized company profile by exact domain through the legacy Company API.",
);
const manage = blocked(
  "clearbit_manage",
  "Access broader Clearbit data",
  "Person enrichment, Reveal, IP lookup, discovery, audiences, webhooks, tracking, logos, contact channels, technologies, and mutations are outside Relay's V1 contract.",
);

export const CLEARBIT_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "clearbit",
  name: "Clearbit",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://help.clearbit.com/hc/en-us/categories/360000913214-APIs",
  providerWebsiteUrl: "https://clearbit.com/",
  capabilities: [
    {
      ...capability(
        "clearbit_read",
        "Look up companies",
        "Use one pinned, versioned legacy Company API domain lookup and return minimized company-only fields.",
        true,
      ),
      platformCapability: "clearbit_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "CLEARBIT_API_KEY",
        label: "Legacy Clearbit secret API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Use the secret key from an eligible Clearbit account created in 2023 or earlier. Relay encrypts it server-side.",
      },
    ],
  },
  tools: [
    {
      name: "clearbit.findCompany",
      functionName: "clearbit_read",
      aliases: ["clearbit.findCompany", "clearbit_read"],
      capability: "clearbit_read",
      platformCapability: "clearbit_read",
      action: "read",
      approvalRequired: false,
      description: "Look up one minimized Clearbit company profile by domain.",
      inputSchema: {
        type: "object",
        properties: {
          operation: { type: "string", enum: [...CLEARBIT_READ_OPERATIONS] },
          domain: { type: "string", minLength: 4, maxLength: 253 },
        },
        required: ["operation", "domain"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "clearbit_safe",
      label: "Safe",
      description:
        "One company-only domain lookup runs directly. Person data, contact channels, Reveal, visitor IPs, technologies, audiences, webhooks, arbitrary API access, and mutations remain blocked.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [],
      blockedActions: [manage],
    },
  ],
  healthChecks: [
    {
      id: "legacy_api_key_configured",
      label: "Eligible legacy API key configuration check",
    },
  ],
};
