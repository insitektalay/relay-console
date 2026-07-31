import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "blueconic_segment_readiness_summary_get",
    "Get BlueConic segment readiness summary",
    "Return only the aggregate number of segments without tenant, segment, profile, member, or customer-data details.",
  ),
];

export const BLUECONIC_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "blueconic",
  name: "BlueConic",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://support.blueconic.com/en/articles/248009-using-the-blueconic-rest-api-v2",
  providerWebsiteUrl: "https://www.blueconic.com/",
  capabilities: [
    {
      ...capability(
        "segment_readiness_summary_read",
        "Read segment readiness summary",
        "Read one identity-free aggregate segment count for the bound BlueConic tenant.",
        true,
      ),
      platformCapability: "blueconic_segment_readiness_summary_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "BLUECONIC_TENANT_NAME",
        label: "BlueConic tenant name",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Enter only the tenant label from www.{tenant}.blueconic.net; Relay binds requests to that exact official HTTPS host.",
      },
      {
        name: "BLUECONIC_CLIENT_ID",
        label: "BlueConic OAuth client ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Use a dedicated customer-owned client-credentials application whose scopes permit only the required segment read.",
      },
      {
        name: "BLUECONIC_CLIENT_SECRET",
        label: "BlueConic OAuth client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Relay encrypts the matching secret and exchanges it only at the bound tenant's documented token endpoint.",
      },
    ],
  },
  tools: [
    {
      name: "blueconic.getSegmentReadinessSummary",
      functionName: "blueconic_segment_readiness_summary_get",
      aliases: [
        "blueconic.getSegmentReadinessSummary",
        "blueconic_segment_readiness_summary_get",
      ],
      capability: "segment_readiness_summary_read",
      platformCapability: "blueconic_segment_readiness_summary_read",
      action: "read",
      approvalRequired: true,
      description: "Read only the aggregate segment count for the bound tenant.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
  ],
  approvalProfiles: [
    {
      id: "blueconic_safe",
      label: "Safe",
      description:
        "The aggregate segment count requires approval; identity, profiles, customer data, activation, writes, administration, raw APIs, and bulk remain blocked.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: reads,
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The same bounded count runs directly; exact tenant binding, short-lived token exchange, redaction, response cap, audits, and provider limits remain mandatory.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    { id: "segments", label: "BlueConic tenant, OAuth, and segment-read validation" },
  ],
};
