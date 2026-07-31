import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { GIVE_LIVELY_OPERATIONS } from "./give-lively-operation-registry";

const read = action(
  "give_lively_read",
  "Read Give Lively donations",
  "Validate the connected nonprofit credentials and read the official donation JSON feed with an optional created-or-updated-since timestamp.",
);

export const GIVE_LIVELY_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "give-lively",
  name: "Give Lively",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://www.givelively.org/resources/get-started-with-give-livelys-zapier-integration",
  providerWebsiteUrl: "https://www.givelively.org/",
  capabilities: [
    {
      ...capability(
        "give_lively_read",
        "Read donation updates",
        "Validate one nonprofit's Give Lively integration credentials and read its official donation JSON feed.",
        true,
      ),
      platformCapability: "give_lively_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "GIVE_LIVELY_ORGANIZATION_ID",
        label: "Give Lively Organization ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Copy the nonprofit Organization ID from Give Lively's Zapier settings. Relay stores it with the API key and uses it only on the fixed secure.givelively.org JSON routes.",
      },
      {
        name: "GIVE_LIVELY_API_KEY",
        label: "Give Lively Zapier API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Generate the API key in Give Lively's Nonprofit Admin Portal under Zapier settings. Relay encrypts it and constructs the provider-documented secret-bearing path only on Railway.",
      },
    ],
  },
  tools: [
    {
      name: "giveLively.read",
      functionName: "give_lively_read",
      aliases: ["giveLively.read", "give_lively_read"],
      capability: "give_lively_read",
      platformCapability: "give_lively_read",
      action: "read",
      approvalRequired: false,
      description:
        "Run one of Give Lively's two official read-only JSON integration endpoints with bounded output.",
      inputSchema: {
        type: "object",
        properties: {
          operation: {
            type: "string",
            enum: GIVE_LIVELY_OPERATIONS.map((item) => item.id),
          },
          query: {
            type: "object",
            properties: {
              start_time_ms: { type: "integer", minimum: 0 },
            },
            additionalProperties: false,
          },
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "give_lively_safe",
      label: "Safe",
      description:
        "Credential validation and bounded donation-feed reads run directly; Give Lively documents no mutation endpoint for this integration.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [],
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The same complete read-only integration surface runs without Relay per-action approval; connection ownership, fixed routes, response bounds, audits and secret isolation still apply.",
      defaultSelected: false,
      allowedActions: [read],
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    {
      id: "organization_and_api_key",
      label: "Give Lively Organization ID and Zapier API key validation",
    },
  ],
};
