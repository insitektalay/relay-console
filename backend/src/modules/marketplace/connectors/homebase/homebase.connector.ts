import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { HOMEBASE_OPERATION_IDS } from "./homebase-operation-registry";

const read = action(
  "homebase_read",
  "Read Homebase",
  "Read the selected company, location, employee, shift, timecard, labor, plan, or time-clock status through Homebase's current public API.",
);

export const HOMEBASE_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "homebase",
  name: "Homebase",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://app.joinhomebase.com/api-docs",
  providerWebsiteUrl: "https://www.joinhomebase.com/",
  capabilities: [
    {
      ...capability(
        "homebase_read",
        "Read Homebase",
        `Use all ${HOMEBASE_OPERATION_IDS.length} operations in Homebase's current read-only public API with the connected account's authority.`,
        true,
      ),
      platformCapability: "homebase_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "HOMEBASE_API_KEY",
        label: "Homebase API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Request a read-only key from Homebase API Settings. Relay encrypts it and sends it only to api.joinhomebase.com.",
      },
    ],
  },
  tools: [
    {
      name: "homebase.read",
      functionName: "homebase_read",
      aliases: ["homebase.read", "homebase_read"],
      capability: "homebase_read",
      platformCapability: "homebase_read",
      action: "read",
      approvalRequired: false,
      description:
        "Run one pinned operation from Homebase's current read-only public API.",
      inputSchema: {
        type: "object",
        properties: {
          operation: { type: "string", enum: [...HOMEBASE_OPERATION_IDS] },
          pathParameters: { type: "object", maxProperties: 8 },
          query: { type: "object", maxProperties: 20 },
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "homebase_safe",
      label: "Safe",
      description:
        "All 16 bounded Homebase public API reads run directly; the public contract contains no write operations.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [],
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "All selected Homebase API-key-authorized operations run directly. Homebase's current public contract is read-only, so this mode grants no undocumented write authority.",
      defaultSelected: false,
      allowedActions: [read],
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    { id: "company", label: "Homebase API key and company validation" },
  ],
};
