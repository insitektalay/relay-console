import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "metricool_brand_list",
    "List Metricool brand references",
    "List at most twenty-five brand IDs accessible to the bound user without names, URLs, owners, collaborators, or social identity.",
  ),
  action(
    "metricool_connected_network_list",
    "List connected network types",
    "List at most twenty-five connected social-network types for the exact bound brand without profile names, handles, IDs, URLs, or content.",
  ),
];

export const METRICOOL_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "metricool",
  name: "Metricool",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://app.metricool.com/resources/apidocs/index.html",
  providerWebsiteUrl: "https://metricool.com/",
  capabilities: [
    {
      ...capability(
        "brand_structure_read",
        "Read brand structure",
        "Read bounded identity-redacted brand references and connected network types for one exact Metricool user and brand.",
        true,
      ),
      platformCapability: "metricool_brand_structure_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "METRICOOL_USER_TOKEN",
        label: "Metricool user token",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Copy the API access token from Metricool Account Settings > API on an Advanced or Custom plan. Relay encrypts it and sends it only as X-Mc-Auth to https://app.metricool.com.",
      },
      {
        name: "METRICOOL_USER_ID",
        label: "Metricool user ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Paste the exact numeric userId documented by Metricool for your account.",
      },
      {
        name: "METRICOOL_BLOG_ID",
        label: "Metricool brand ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Paste one exact numeric blogId for the brand this Relay connection may inspect.",
      },
    ],
  },
  tools: [
    {
      name: "metricool.listBrands",
      functionName: "metricool_brand_list",
      aliases: ["metricool.listBrands", "metricool_brand_list"],
      capability: "brand_structure_read",
      platformCapability: "metricool_brand_structure_read",
      action: "read",
      approvalRequired: true,
      description:
        "List at most twenty-five numeric brand IDs without names, URLs, owners, collaborators, connected-account identity, or content.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "metricool.listConnectedNetworks",
      functionName: "metricool_connected_network_list",
      aliases: [
        "metricool.listConnectedNetworks",
        "metricool_connected_network_list",
      ],
      capability: "brand_structure_read",
      platformCapability: "metricool_brand_structure_read",
      action: "read",
      approvalRequired: true,
      description:
        "List at most twenty-five network type keys and connection booleans for the exact bound brand without identity or content.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "metricool_safe",
      label: "Safe",
      description:
        "Both bounded identity-redacted reads require approval; names, handles, URLs, owners, collaborators, social content, analytics, ads, competitors, inbox, scheduling, publishing, writes, raw APIs, arbitrary paths, pagination, bulk, and export remain blocked.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: reads,
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The same two bounded reads run directly; exact user/brand binding, fixed paths, identity redaction, response caps, audits, and Relay's local request ceiling remain mandatory.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    {
      id: "brand",
      label: "Metricool token and exact user/brand validation",
    },
  ],
};
