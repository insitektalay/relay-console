import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import {
  PCLOUD_READ_OPERATION_IDS,
  PCLOUD_WRITE_OPERATION_IDS,
} from "./pcloud-operation-registry";

const reads = [
  action(
    "pcloud_read",
    "Read pCloud",
    "Read bounded pCloud files, folders, shares, links, media, archives, revisions, trash, and collections.",
  ),
];
const writes = [
  action(
    "pcloud_write",
    "Manage pCloud content",
    "Upload, create, copy, move, rename, share, restore, or delete pCloud content; Safe mode requires approval.",
  ),
];
const parameters = {
  type: "object",
  maxProperties: 100,
  additionalProperties: true,
};

export const PCLOUD_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "pcloud",
  name: "pCloud",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://docs.pcloud.com/",
  providerWebsiteUrl: "https://www.pcloud.com/",
  capabilities: [
    {
      ...capability(
        "pcloud_read",
        "Read pCloud",
        "Use all 47 selected documented retrieval operations with bounded results and the connected user's regional authority.",
        true,
      ),
      platformCapability: "pcloud_read",
    },
    {
      ...capability(
        "pcloud_write",
        "Manage pCloud content",
        "Use all 47 selected upload, content, sharing, archive, trash, and collection mutations.",
        true,
      ),
      platformCapability: "pcloud_write",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://my.pcloud.com/oauth2/authorize",
      tokenUrl: "https://api.pcloud.com/oauth2_token",
      userInfoUrl: "https://api.pcloud.com/userinfo",
      requiredScopes: ["manageshares"],
      optionalScopes: [],
      pkce: false,
      supportsRefresh: false,
    },
    credentialSchema: [
      {
        name: "PCLOUD_CLIENT_ID",
        label: "pCloud client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText: "Relay-owned OAuth client configured on Railway.",
      },
      {
        name: "PCLOUD_CLIENT_SECRET",
        label: "pCloud client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Relay-owned OAuth secret configured on Railway and never exposed to clients or agents.",
      },
    ],
  },
  tools: [
    {
      name: "pcloud.read",
      functionName: "pcloud_read",
      aliases: ["pcloud.read", "pcloud_read"],
      capability: "pcloud_read",
      platformCapability: "pcloud_read",
      action: "read",
      approvalRequired: false,
      description:
        "Run one of the 47 pinned official pCloud retrieval operations against the OAuth-bound US or Europe API host.",
      inputSchema: {
        type: "object",
        properties: {
          operation: { type: "string", enum: [...PCLOUD_READ_OPERATION_IDS] },
          parameters,
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
    {
      name: "pcloud.manage",
      functionName: "pcloud_manage",
      aliases: ["pcloud.manage", "pcloud_manage"],
      capability: "pcloud_write",
      platformCapability: "pcloud_write",
      action: "write",
      approvalRequired: true,
      description:
        "Run one pinned pCloud content mutation. Safe mode requires approval; file uploads are capped at 2 MB.",
      inputSchema: {
        type: "object",
        properties: {
          operation: { type: "string", enum: [...PCLOUD_WRITE_OPERATION_IDS] },
          parameters,
          fileBase64: { type: "string", maxLength: 2800000 },
          fileName: { type: "string", maxLength: 255 },
          approvalId: { type: "string" },
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "pcloud_safe",
      label: "Safe",
      description:
        "All 47 bounded pCloud reads run directly; every upload, content, sharing, destructive, trash, or collection mutation requires approval.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: writes,
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "All 94 selected pCloud operations run without Relay per-action approval; ownership, regional authority, exact routes, bounds, audits, redaction, and provider limits still apply.",
      defaultSelected: false,
      allowedActions: [...reads, ...writes],
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    {
      id: "user_and_region",
      label:
        "pCloud connected user, non-expiring OAuth token, and US or Europe API authority binding",
    },
  ],
};
