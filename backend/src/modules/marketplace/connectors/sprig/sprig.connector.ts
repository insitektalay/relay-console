import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { SPRIG_READ_OPERATIONS } from "./sprig-api.adapter";

const read = action(
  "sprig_read",
  "Read Sprig study metadata",
  "Read one bounded, minimized study index without questions, targeting, responses, users, or cursors.",
);
const manage = blocked(
  "sprig_manage",
  "Change Sprig",
  "Users, events, attributes, studies, responses, themes, visitors, purges, and every mutation remain blocked.",
);

export const SPRIG_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "sprig",
  name: "Sprig",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://docs.sprig.com/reference/sprig-api/overview",
  providerWebsiteUrl: "https://sprig.com/",
  capabilities: [
    {
      ...capability(
        "sprig_read",
        "Read study metadata",
        "Use one pinned GET for a bounded, minimized study-configuration index.",
        true,
      ),
      platformCapability: "sprig_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "SPRIG_API_KEY",
        label: "Sprig API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Use a customer-owned Sprig Data Export API key for the intended environment.",
      },
    ],
  },
  tools: [
    {
      name: "sprig.read",
      functionName: "sprig_read",
      aliases: ["sprig.read", "sprig_read"],
      capability: "sprig_read",
      platformCapability: "sprig_read",
      action: "read",
      approvalRequired: false,
      description: "Read a bounded, minimized Sprig study index.",
      inputSchema: {
        type: "object",
        properties: {
          operation: { type: "string", enum: [...SPRIG_READ_OPERATIONS] },
          limit: { type: "integer", minimum: 1, maximum: 25 },
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "sprig_safe",
      label: "Safe",
      description:
        "One bounded minimized study index runs directly. Questions, targeting, responses, users, themes, cursors, arbitrary APIs, and every mutation remain blocked.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [],
      blockedActions: [manage],
    },
  ],
  healthChecks: [
    {
      id: "api_key_and_studies",
      label: "API key and study-index access check",
    },
  ],
};
