import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "asset_bank_read",
    "Read Asset Bank data",
    "Run one bounded read in the connected Asset Bank site.",
  ),
];
const writes = [
  action(
    "asset_bank_manage",
    "Change Asset Bank data",
    "Run one documented mutation or bounded upload; Safe mode requires approval.",
  ),
];
const blocked = [
  action(
    "asset_bank_secret_exposure",
    "Expose credentials",
    "OAuth credentials never enter agent-visible results.",
  ),
  action(
    "asset_bank_signed_url",
    "Create signed URLs",
    "Relay returns bounded content instead of provider-signed URLs.",
  ),
  action(
    "asset_bank_untrusted_origin",
    "Call another origin",
    "Requests remain pinned to the connected Asset Bank site.",
  ),
  action(
    "asset_bank_unbounded_transfer",
    "Transfer unbounded data",
    "Requests and responses remain inside Relay's bounded envelopes.",
  ),
];

const requestProperties = {
  path: {
    type: "string",
    minLength: 5,
    maxLength: 500,
    pattern: "^/rest(?:/|$)",
  },
  query: { type: "object" },
};

export const ASSET_BANK_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "asset-bank",
  name: "Asset Bank",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://documenter.getpostman.com/view/10518051/TVK8Zyxr",
  providerWebsiteUrl: "https://www.assetbank.co.uk/",
  capabilities: [
    {
      ...capability(
        "dam_read",
        "Browse digital assets",
        "Search and read authorized assets, content, conversions, metadata, categories, access levels, users, lightboxes, approvals, publishing records, and library structure.",
        true,
      ),
      platformCapability: "asset_bank_dam_read",
    },
    {
      ...capability(
        "dam_manage",
        "Manage digital assets",
        "Create and change authorized assets, content, metadata, access levels, list values, users, lightboxes, publishing actions, images, and chunked uploads.",
        true,
      ),
      platformCapability: "asset_bank_dam_manage",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://{customer-site}/{context}/oauth/authorize",
      tokenUrl: "https://{customer-site}/{context}/oauth/token",
      userInfoUrl: "https://{customer-site}/{context}/rest/authenticated-user",
      requiredScopes: [],
      optionalScopes: [],
      pkce: false,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "ASSET_BANK_BASE_URL",
        label: "Asset Bank site",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText: "Your hosted Asset Bank URL, including its site path.",
      },
      {
        name: "ASSET_BANK_CLIENT_ID",
        label: "Client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText: "Copy the Client ID from Admin > System > API.",
      },
      {
        name: "ASSET_BANK_CLIENT_SECRET",
        label: "Client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText: "Copy the Client Secret from the same OAuth credentials.",
      },
    ],
  },
  tools: [
    {
      name: "asset-bank.read",
      functionName: "asset_bank_read",
      aliases: ["asset-bank.read", "asset_bank_read"],
      capability: "dam_read",
      platformCapability: "asset_bank_dam_read",
      action: "read",
      approvalRequired: false,
      description:
        "Run one bounded GET against a documented Asset Bank REST route.",
      inputSchema: {
        type: "object",
        properties: requestProperties,
        required: ["path"],
        additionalProperties: false,
      },
    },
    {
      name: "asset-bank.manage",
      functionName: "asset_bank_manage",
      aliases: ["asset-bank.manage", "asset_bank_manage"],
      capability: "dam_manage",
      platformCapability: "asset_bank_dam_manage",
      action: "write",
      approvalRequired: true,
      description: "Run one documented Asset Bank mutation or bounded upload.",
      inputSchema: {
        type: "object",
        properties: {
          ...requestProperties,
          method: { type: "string", enum: ["POST", "PUT", "DELETE"] },
          json: {},
          contentBase64: { type: "string", maxLength: 7_000_000 },
          contentType: { type: "string", maxLength: 200 },
          multipartField: { type: "string", maxLength: 100 },
          approvalId: { type: "string", maxLength: 200 },
        },
        required: ["method", "path"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "asset_bank_safe",
      label: "Safe",
      description:
        "Bounded reads run directly; every mutation requires approval.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: writes,
      blockedActions: blocked,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Every selected site-authorized operation runs without Relay per-action approval; fixed authority, bounds, redaction, audits, rate limits, and provider enforcement still apply.",
      defaultSelected: false,
      allowedActions: [...reads, ...writes],
      approvalRequiredActions: [],
      blockedActions: blocked,
    },
  ],
  healthChecks: [
    {
      id: "authenticated_user",
      label: "Asset Bank OAuth token and connected-user validation",
    },
  ],
};
