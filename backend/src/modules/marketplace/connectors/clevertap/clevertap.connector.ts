import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "clevertap_bound_user_profile_get",
    "Get bound CleverTap user profile",
    "Read one exact connection-bound profile with custom values and device identifiers excluded.",
  ),
];

export const CLEVERTAP_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "clevertap",
  name: "CleverTap",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developer.clevertap.com/docs/get-user-profiles-api",
  providerWebsiteUrl: "https://clevertap.com/",
  capabilities: [
    {
      ...capability(
        "bound_user_profile_read",
        "Read one bound user profile",
        "Read one connection-bound identity with sensitive raw fields excluded.",
        true,
      ),
      platformCapability: "clevertap_bound_user_profile_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "CLEVERTAP_ACCOUNT_ID",
        label: "CleverTap Account ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText: "Use the Project ID from CleverTap Settings.",
      },
      {
        name: "CLEVERTAP_PASSCODE",
        label: "CleverTap API passcode",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText: "Prefer a dedicated expiring account or user passcode.",
      },
      {
        name: "CLEVERTAP_REGION",
        label: "CleverTap data-center region",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText: "Use eu1, in1, sg1, us1, aps3, or mec1.",
      },
      {
        name: "CLEVERTAP_PROFILE_IDENTITY",
        label: "Bound CleverTap profile identity",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText: "Bind this connection to one exact existing profile identity.",
      },
    ],
  },
  tools: [
    {
      name: "clevertap.getBoundUserProfile",
      functionName: "clevertap_bound_user_profile_get",
      aliases: [
        "clevertap.getBoundUserProfile",
        "clevertap_bound_user_profile_get",
      ],
      capability: "bound_user_profile_read",
      platformCapability: "clevertap_bound_user_profile_read",
      action: "read",
      approvalRequired: true,
      description:
        "Read one connection-bound CleverTap profile with custom values and device identifiers excluded.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "clevertap_safe",
      label: "Safe",
      description:
        "The bounded profile read requires approval; exports, other identities, analytics, campaigns, writes, deletes, administration, raw APIs, pagination, and bulk remain blocked.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: reads,
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The same bounded profile read runs directly; exact region/identity binding, redaction, response caps, audits, and provider authorization remain mandatory.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    { id: "bound-profile", label: "CleverTap credentials and bound profile validation" },
  ],
};
