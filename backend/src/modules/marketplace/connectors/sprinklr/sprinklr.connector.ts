import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "sprinklr_governance_status_get",
    "Get Sprinklr governance status",
    "Verify the exact primary workspace binding and return only a safe user type plus customer/workspace binding booleans.",
  ),
];

export const SPRINKLR_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "sprinklr",
  name: "Sprinklr",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://dev.sprinklr.com/api-overview",
  providerWebsiteUrl: "https://www.sprinklr.com/",
  capabilities: [
    {
      ...capability(
        "governance_status_read",
        "Read governance status",
        "Verify exact environment/workspace authority while excluding identity and broader platform data.",
        true,
      ),
      platformCapability: "sprinklr_governance_status_read",
    },
  ],
  auth: {
    type: "custom",
    credentialSchema: [
      {
        name: "SPRINKLR_API_KEY",
        label: "Sprinklr API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["custom"],
        helpText: "Use the key from the customer's Sprinklr application.",
      },
      {
        name: "SPRINKLR_ACCESS_TOKEN",
        label: "Sprinklr OAuth access token",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["custom"],
        helpText: "Supply the current customer-authorized bearer token.",
      },
      {
        name: "SPRINKLR_ENVIRONMENT",
        label: "Sprinklr environment",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["custom"],
        helpText: "Use production or the exact prodN environment.",
      },
      {
        name: "SPRINKLR_WORKSPACE_ID",
        label: "Sprinklr primary workspace ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["custom"],
        helpText: "Paste the exact positive-decimal primary workspace ID.",
      },
    ],
  },
  tools: [
    {
      name: "sprinklr.getGovernanceStatus",
      functionName: "sprinklr_governance_status_get",
      aliases: [
        "sprinklr.getGovernanceStatus",
        "sprinklr_governance_status_get",
      ],
      capability: "governance_status_read",
      platformCapability: "sprinklr_governance_status_read",
      action: "read",
      approvalRequired: true,
      description:
        "Verify exact environment/workspace authority and return only redacted governance status.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "sprinklr_safe",
      label: "Safe",
      description:
        "The bounded governance-status read requires approval; identity, content, profiles, analytics, publishing, writes, administration, raw APIs, pagination, bulk, and export remain blocked.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: reads,
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The same bounded read runs directly; exact environment/workspace binding, fixed endpoint, redaction, response caps, audits, and provider governance remain mandatory.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    {
      id: "me",
      label: "Sprinklr environment and primary workspace validation",
    },
  ],
};
