import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "imgix_read",
    "Read Imgix data",
    "Run one bounded documented read operation against the customer's Imgix account.",
  ),
];
const writes = [
  action(
    "imgix_manage",
    "Change Imgix data",
    "Run one documented source, asset, upload, publishing, or purge mutation; Safe mode requires approval.",
  ),
];
const blocked = [
  action(
    "imgix_secret_exposure",
    "Expose credentials",
    "Management keys, origin credentials, secure URL tokens, and signed report links never enter agent-visible results.",
  ),
  action(
    "imgix_unbounded_transfer",
    "Transfer unbounded data",
    "API results and direct uploads stay within Relay's bounded envelopes.",
  ),
  action(
    "imgix_untrusted_origin",
    "Call an alternate origin",
    "Management requests remain pinned to Imgix's documented HTTPS API origin.",
  ),
];

const commonProperties = {
  operation: { type: "string" },
  sourceId: { type: "string", minLength: 1, maxLength: 128 },
  originPath: { type: "string", minLength: 1, maxLength: 2048 },
  sessionId: { type: "string", minLength: 1, maxLength: 128 },
  reportId: { type: "string", minLength: 1, maxLength: 128 },
  query: { type: "object" },
};

export const IMGIX_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "imgix",
  name: "Imgix",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://docs.imgix.com/apis/management",
  providerWebsiteUrl: "https://www.imgix.com/",
  capabilities: [
    {
      ...capability(
        "media_read",
        "Read media and account data",
        "List and inspect authorized sources, assets, upload sessions, and retained analytics reports.",
        true,
      ),
      platformCapability: "imgix_media_read",
    },
    {
      ...capability(
        "media_manage",
        "Manage media delivery",
        "Create and update sources, edit or upload assets, refresh processing, publish or unpublish media, and purge cached derivatives.",
        true,
      ),
      platformCapability: "imgix_media_manage",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "IMGIX_MANAGEMENT_API_KEY",
        label: "Imgix Management API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Create a key in the Imgix dashboard with the Asset Browse, Asset Edit, Asset Purge, Sources, and Analytics permissions agents should use.",
      },
    ],
  },
  tools: [
    {
      name: "imgix.read",
      functionName: "imgix_read",
      aliases: ["imgix.read", "imgix_read"],
      capability: "media_read",
      platformCapability: "imgix_media_read",
      action: "read",
      approvalRequired: false,
      description:
        "List or inspect authorized Imgix sources, assets, upload sessions, and reports through exact documented endpoints.",
      inputSchema: {
        type: "object",
        properties: {
          ...commonProperties,
          operation: {
            type: "string",
            enum: [
              "list_sources",
              "get_source",
              "list_assets",
              "get_asset",
              "get_upload_session",
              "list_reports",
              "get_report",
            ],
          },
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
    {
      name: "imgix.manage",
      functionName: "imgix_manage",
      aliases: ["imgix.manage", "imgix_manage"],
      capability: "media_manage",
      platformCapability: "imgix_media_manage",
      action: "write",
      approvalRequired: true,
      description:
        "Run one exact documented Imgix source, asset, upload, publishing, or cache mutation at the fixed Management API origin.",
      inputSchema: {
        type: "object",
        properties: {
          ...commonProperties,
          operation: {
            type: "string",
            enum: [
              "create_source",
              "update_source",
              "update_asset",
              "upload_asset",
              "open_upload_session",
              "close_upload_session",
              "cancel_upload_session",
              "add_asset",
              "refresh_asset",
              "unpublish_asset",
              "publish_asset",
              "purge_asset",
            ],
          },
          attributes: { type: "object" },
          contentBase64: { type: "string", minLength: 4, maxLength: 7000000 },
          contentType: { type: "string", maxLength: 200 },
          overwrite: { type: "boolean" },
          url: { type: "string", minLength: 8, maxLength: 4096 },
          subImage: { type: "boolean" },
          approvalId: { type: "string", maxLength: 200 },
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "imgix_safe",
      label: "Safe",
      description:
        "Bounded reads run directly; every source, asset, upload, publishing, and cache mutation requires approval.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: writes,
      blockedActions: blocked,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Every selected Imgix operation runs without Relay per-action approval; ownership, provider-key permissions, fixed origin, bounds, redaction, audits, plan limits, and provider rate limits still apply.",
      defaultSelected: false,
      allowedActions: [...reads, ...writes],
      approvalRequiredActions: [],
      blockedActions: blocked,
    },
  ],
  healthChecks: [
    {
      id: "management-api",
      label: "Imgix Management API key and Sources permission check",
    },
  ],
};
