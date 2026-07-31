import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const BYNDER_SCOPES = [
  "offline",
  "current.profile:read",
  "current.user:read",
  "asset:read",
  "asset:write",
  "asset.usage:read",
  "asset.usage:write",
  "collection:read",
  "collection:write",
  "meta.assetbank:read",
  "meta.assetbank:write",
  "meta.workflow:read",
  "workflow.campaign:read",
  "workflow.campaign:write",
  "workflow.group:read",
  "workflow.group:write",
  "workflow.job:read",
  "workflow.job:write",
  "workflow.job:approve",
  "workflow.preset:read",
  "brandstore.order:read",
  "brandstore.order:write",
  "analytics.api:read",
  "antivirus.asset.audit:read",
  "antivirus.asset.audit:write",
  "webhooks.config:read",
  "webhooks.config:write",
  "admin.profile:read",
  "admin.user:read",
  "admin.user:write",
] as const;

const reads = [
  action(
    "bynder_read",
    "Read Bynder data",
    "Run one bounded documented GET operation in the connected Bynder portal.",
  ),
];
const writes = [
  action(
    "bynder_manage",
    "Change Bynder data",
    "Run one documented Bynder mutation; Safe mode requires approval.",
  ),
];
const blocked = [
  action(
    "bynder_secret_exposure",
    "Expose credentials",
    "OAuth credentials and signed provider URLs never enter agent-visible results.",
  ),
  action(
    "bynder_untrusted_origin",
    "Call another origin",
    "Requests remain pinned to the connected HTTPS Bynder portal.",
  ),
  action(
    "bynder_unbounded_transfer",
    "Transfer unbounded data",
    "Requests and responses remain inside Relay's bounded envelopes.",
  ),
];

const requestProperties = {
  path: {
    type: "string",
    minLength: 2,
    maxLength: 3000,
    pattern: "^/(api|v7)/",
  },
  query: { type: "object" },
};

export const BYNDER_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "bynder",
  name: "Bynder",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://api.bynder.com/docs/getting-started",
  providerWebsiteUrl: "https://www.bynder.com/",
  capabilities: [
    {
      ...capability(
        "dam_read",
        "Browse digital assets",
        "Read authorized assets, metadata, collections, users, workflows, orders, analytics, quarantine records, and webhook configuration.",
        true,
      ),
      platformCapability: "bynder_dam_read",
    },
    {
      ...capability(
        "dam_manage",
        "Manage digital assets",
        "Create and change assets, metadata, collections, workflows, orders, webhooks, users, and other portal-authorized resources.",
        true,
      ),
      platformCapability: "bynder_dam_manage",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl:
        "https://{customer-portal}/v6/authentication/oauth2/auth",
      tokenUrl: "https://{customer-portal}/v6/authentication/oauth2/token",
      userInfoUrl: "https://{customer-portal}/api/v4/currentuser/",
      requiredScopes: [...BYNDER_SCOPES],
      optionalScopes: [],
      pkce: false,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "BYNDER_PORTAL_DOMAIN",
        label: "Bynder portal",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "The organization's Bynder portal hostname, such as acme.bynder.com.",
      },
      {
        name: "BYNDER_CLIENT_ID",
        label: "OAuth client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Create an OAuth app in the organization's Bynder portal and copy its client ID.",
      },
      {
        name: "BYNDER_CLIENT_SECRET",
        label: "OAuth client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Copy the one-time secret shown when the Bynder OAuth app is created.",
      },
    ],
  },
  tools: [
    {
      name: "bynder.read",
      functionName: "bynder_read",
      aliases: ["bynder.read", "bynder_read"],
      capability: "dam_read",
      platformCapability: "bynder_dam_read",
      action: "read",
      approvalRequired: false,
      description:
        "Run one bounded GET against a documented Bynder API path on the connected portal.",
      inputSchema: {
        type: "object",
        properties: requestProperties,
        required: ["path"],
        additionalProperties: false,
      },
    },
    {
      name: "bynder.manage",
      functionName: "bynder_manage",
      aliases: ["bynder.manage", "bynder_manage"],
      capability: "dam_manage",
      platformCapability: "bynder_dam_manage",
      action: "write",
      approvalRequired: true,
      description:
        "Run one documented mutation on the connected Bynder portal.",
      inputSchema: {
        type: "object",
        properties: {
          ...requestProperties,
          method: { type: "string", enum: ["POST", "PUT", "PATCH", "DELETE"] },
          json: { type: "object" },
          form: { type: "object" },
          contentBase64: { type: "string", maxLength: 7000000 },
          contentType: { type: "string", maxLength: 200 },
          approvalId: { type: "string", maxLength: 200 },
        },
        required: ["method", "path"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "bynder_safe",
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
        "Every selected portal- and scope-authorized operation runs without Relay per-action approval; fixed authority, bounds, redaction, audits, rate limits, and provider enforcement still apply.",
      defaultSelected: false,
      allowedActions: [...reads, ...writes],
      approvalRequiredActions: [],
      blockedActions: blocked,
    },
  ],
  healthChecks: [
    {
      id: "current_user",
      label: "Bynder OAuth token and connected-user validation",
    },
  ],
};
