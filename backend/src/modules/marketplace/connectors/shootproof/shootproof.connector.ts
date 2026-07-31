import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import {
  SHOOTPROOF_MANAGE_OPERATION_IDS,
  SHOOTPROOF_OPERATIONS,
  SHOOTPROOF_READ_OPERATION_IDS,
} from "./shootproof-operation-registry";

const read = action(
  "shootproof_read",
  "Read ShootProof",
  "Read bounded studio, brand, contact, contract, event, gallery, album, photo, invoice, order, price-sheet, music, and account data.",
);
const manage = action(
  "shootproof_manage",
  "Manage ShootProof",
  "Create, update, send, pay, refund, sign, batch-change, or delete authorized ShootProof records; Safe mode requires approval.",
);
const blockedActions = [
  blocked(
    "shootproof_secret_exposure",
    "Expose ShootProof secrets",
    "OAuth tokens, app material, cookies, credentials, and authorization headers are never exposed.",
  ),
  blocked(
    "shootproof_unofficial_origin",
    "Use unofficial ShootProof interfaces",
    "Private app calls, scraping, browser automation, arbitrary URLs, and legacy raw API access are blocked.",
  ),
  blocked(
    "shootproof_unbounded_transfer",
    "Transfer unbounded content",
    "Relay limits request bodies to 2 MB, responses and downloads to 5 MB, and performs one pinned operation per tool call.",
  ),
];

export const SHOOTPROOF_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "shootproof",
  name: "ShootProof",
  connectorType: "openapi_generated",
  providerDocsUrl: "https://developer.shootproof.com/",
  providerWebsiteUrl: "https://www.shootproof.com/",
  capabilities: [
    {
      ...capability(
        "shootproof_read",
        "Read photography studio data",
        `Use all ${SHOOTPROOF_READ_OPERATION_IDS.length} pinned official reads across the ShootProof Studio API.`,
        true,
      ),
      platformCapability: "shootproof_read",
    },
    {
      ...capability(
        "shootproof_manage",
        "Manage photography studio data",
        `Use all ${SHOOTPROOF_MANAGE_OPERATION_IDS.length} pinned official mutations across brands, contacts, contracts, galleries, photos, invoices, orders, price sheets, music, and account settings.`,
        true,
      ),
      platformCapability: "shootproof_manage",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://auth.shootproof.com/oauth2/authorization/new",
      tokenUrl: "https://auth.shootproof.com/oauth2/authorization/token",
      refreshUrl: "https://auth.shootproof.com/oauth2/authorization/token",
      userInfoUrl: "https://api.shootproof.com/studio/me",
      requiredScopes: ["studio"],
      optionalScopes: [],
      pkce: false,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "SHOOTPROOF_CLIENT_ID",
        label: "ShootProof OAuth client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "ShootProof issues the application client ID after reviewing the app identity, support contact, description, website, avatar, and Relay callback URL.",
      },
    ],
  },
  tools: [
    {
      name: "shootproof.read",
      functionName: "shootproof_read",
      aliases: ["shootproof.read", "shootproof_read"],
      capability: "shootproof_read",
      platformCapability: "shootproof_read",
      action: "read",
      approvalRequired: false,
      description:
        "Run one pinned official ShootProof GET operation with bounded inputs and output.",
      inputSchema: {
        type: "object",
        properties: {
          operation: {
            type: "string",
            enum: [...SHOOTPROOF_READ_OPERATION_IDS],
          },
          pathParameters: { type: "object", maxProperties: 12 },
          query: { type: "object", maxProperties: 40 },
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
    {
      name: "shootproof.manage",
      functionName: "shootproof_manage",
      aliases: ["shootproof.manage", "shootproof_manage"],
      capability: "shootproof_manage",
      platformCapability: "shootproof_manage",
      action: "write",
      approvalRequired: true,
      description:
        "Run one pinned official ShootProof mutation; Safe mode requires approval.",
      inputSchema: {
        type: "object",
        properties: {
          operation: {
            type: "string",
            enum: [...SHOOTPROOF_MANAGE_OPERATION_IDS],
          },
          pathParameters: { type: "object", maxProperties: 12 },
          query: { type: "object", maxProperties: 40 },
          json: { type: "object", maxProperties: 1_000 },
          approvalId: { type: "string", maxLength: 200 },
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "shootproof_safe",
      label: "Safe",
      description: `All ${SHOOTPROOF_READ_OPERATION_IDS.length} bounded reads run directly; every provider mutation requires approval.`,
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [manage],
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description: `All ${SHOOTPROOF_OPERATIONS.length} selected and OAuth-authorized operations run without Relay per-action approval; ownership, exact routes, bounds, audits, redaction, provider limits, and ShootProof permissions still apply.`,
      defaultSelected: false,
      allowedActions: [read, manage],
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "me",
      label: "ShootProof authenticated user validation",
      requiredScopes: ["studio"],
    },
  ],
};
