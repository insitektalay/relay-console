import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "hightouch_model_readiness_summary_get",
    "Get Hightouch model readiness summary",
    "Return only the aggregate model count without model identity, definitions, queries, sources, destinations, syncs, runs, or customer data.",
  ),
];

export const HIGHTOUCH_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "hightouch",
  name: "Hightouch",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://hightouch.com/docs/developer-tools/api-guide",
  providerWebsiteUrl: "https://hightouch.com/",
  capabilities: [
    {
      ...capability(
        "model_readiness_summary_read",
        "Read model readiness summary",
        "Read one identity-free aggregate model count from the Hightouch workspace.",
        true,
      ),
      platformCapability: "hightouch_model_readiness_summary_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "HIGHTOUCH_API_KEY",
        label: "Hightouch API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Create a separate Admin-issued workspace API key for Relay, store it securely, and revoke it if exposure is suspected. Hightouch keys carry read/write workspace authority even though this wrapper only reads.",
      },
    ],
  },
  tools: [
    {
      name: "hightouch.getModelReadinessSummary",
      functionName: "hightouch_model_readiness_summary_get",
      aliases: [
        "hightouch.getModelReadinessSummary",
        "hightouch_model_readiness_summary_get",
      ],
      capability: "model_readiness_summary_read",
      platformCapability: "hightouch_model_readiness_summary_read",
      action: "read",
      approvalRequired: true,
      description: "Read only the aggregate model count.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
  ],
  approvalProfiles: [
    {
      id: "hightouch_safe",
      label: "Safe",
      description:
        "The bounded model count requires approval; identities, definitions, customer data, syncs, runs, triggers, writes, administration, raw APIs, and bulk remain blocked.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: reads,
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The same bounded count runs directly; workspace ownership, redaction, response cap, audits, and Hightouch limits remain mandatory.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    { id: "models", label: "Hightouch key and model-list validation" },
  ],
};
