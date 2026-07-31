import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { REFINER_READ_OPERATIONS } from "./refiner-api.adapter";

const read = action(
  "refiner_read",
  "Read Refiner",
  "Read bounded, minimized surveys, responses, reporting, segments, and account metadata.",
);
const manage = blocked(
  "refiner_manage",
  "Change Refiner",
  "Contacts, responses, segments, survey configuration, and every mutation are outside Relay's V1 contract.",
);

export const REFINER_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "refiner",
  name: "Refiner",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://refiner.io/docs/api/",
  providerWebsiteUrl: "https://refiner.io/",
  capabilities: [
    {
      ...capability(
        "refiner_read",
        "Read feedback",
        "Use five pinned REST API v1 reads with paging capped at 25 and minimized identities.",
        true,
      ),
      platformCapability: "refiner_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "REFINER_API_KEY",
        label: "Refiner API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Use a customer-owned personal API key from Refiner's REST API integration; Relay sends it only in the Bearer Authorization header.",
      },
    ],
  },
  tools: [
    {
      name: "refiner.read",
      functionName: "refiner_read",
      aliases: ["refiner.read", "refiner_read"],
      capability: "refiner_read",
      platformCapability: "refiner_read",
      action: "read",
      approvalRequired: false,
      description: "Run one pinned, bounded Refiner REST API v1 read.",
      inputSchema: {
        type: "object",
        properties: {
          operation: { type: "string", enum: [...REFINER_READ_OPERATIONS] },
          page: { type: "integer", minimum: 1, maximum: 10000 },
          limit: { type: "integer", minimum: 1, maximum: 25 },
          list: {
            type: "string",
            enum: ["all", "published", "drafts", "archived"],
          },
          formUuid: { type: "string", format: "uuid" },
          type: {
            type: "string",
            enum: ["nps", "csat", "ratings", "distribution", "count"],
          },
          dateStart: { type: "string", maxLength: 40 },
          dateEnd: { type: "string", maxLength: 40 },
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "refiner_safe",
      label: "Safe",
      description:
        "Five bounded reads run directly. Contact directories, broad identity attributes, arbitrary filters, response writes, segment sync, and every mutation remain blocked.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [],
      blockedActions: [manage],
    },
  ],
  healthChecks: [
    { id: "api_key_and_account", label: "API key and account access check" },
  ],
};
