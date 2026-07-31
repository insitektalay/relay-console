import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const describe = action(
  "smugmug_describe",
  "Describe SmugMug resources",
  "Use the provider's self-documenting OPTIONS contract for one canonical API URI.",
);
const read = action(
  "smugmug_read",
  "Read SmugMug",
  "Read one bounded page from any canonical API v2 resource exposed by the connected account.",
);
const manage = action(
  "smugmug_manage",
  "Manage SmugMug",
  "Create, update, or delete one API v2 resource; Safe mode requires approval.",
);
const upload = action(
  "smugmug_upload",
  "Upload SmugMug media",
  "Upload one bounded photo or video into one explicit album; Safe mode requires approval.",
);
const blockedActions = [
  blocked(
    "smugmug_secret_exposure",
    "Expose SmugMug secrets",
    "Consumer credentials, OAuth token pairs, cookies, and signed authorization headers are never exposed.",
  ),
  blocked(
    "smugmug_unofficial_interface",
    "Use unofficial SmugMug interfaces",
    "Legacy APIs removed by SmugMug, private app calls, scraping, browser automation, arbitrary origins, and non-canonical paths are blocked.",
  ),
  blocked(
    "smugmug_unbounded_transfer",
    "Transfer unbounded content",
    "Each request is bounded to one canonical resource, JSON bodies to 2 MB, responses to 5 MB, and uploads to 25 MB.",
  ),
];

export const SMUGMUG_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "smugmug",
  name: "SmugMug",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://api.smugmug.com/api/v2/doc",
  providerWebsiteUrl: "https://www.smugmug.com/",
  capabilities: [
    {
      ...capability(
        "smugmug_describe",
        "Discover API resources",
        "Inspect the supported methods, parameters, fields, and relationships for one canonical SmugMug API v2 URI.",
        true,
      ),
      platformCapability: "smugmug_describe",
    },
    {
      ...capability(
        "smugmug_read",
        "Read SmugMug resources",
        "Read bounded users, profiles, nodes, folders, albums, images, and every related resource exposed by the API v2 hypermedia contract.",
        true,
      ),
      platformCapability: "smugmug_read",
    },
    {
      ...capability(
        "smugmug_manage",
        "Manage SmugMug resources",
        "Create, edit, organize, and delete resources through canonical API v2 URIs.",
        true,
      ),
      platformCapability: "smugmug_manage",
    },
    {
      ...capability(
        "smugmug_upload",
        "Upload photos and videos",
        "Upload one bounded photo or video to an explicit album through the official Uploader API.",
        true,
      ),
      platformCapability: "smugmug_upload",
    },
  ],
  auth: {
    type: "oauth1",
    oauth: {
      authorizationUrl: "https://api.smugmug.com/services/oauth/1.0a/authorize",
      tokenUrl: "https://api.smugmug.com/services/oauth/1.0a/getAccessToken",
      userInfoUrl: "https://api.smugmug.com/api/v2!authuser",
      requiredScopes: ["Full", "Modify"],
      optionalScopes: [],
      pkce: false,
      supportsRefresh: false,
    },
    credentialSchema: [
      {
        name: "SMUGMUG_API_KEY",
        label: "SmugMug API key",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Relay-owned application key issued after the provider-console acceptance owner registers and accepts SmugMug API terms.",
      },
      {
        name: "SMUGMUG_API_SECRET",
        label: "SmugMug API secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Relay-owned application secret held only by Railway and used to sign OAuth 1.0a requests.",
      },
    ],
  },
  tools: [
    {
      name: "smugmug.describe",
      functionName: "smugmug_describe",
      aliases: ["smugmug.describe", "smugmug_describe"],
      capability: "smugmug_describe",
      platformCapability: "smugmug_describe",
      action: "read",
      approvalRequired: false,
      description:
        "Describe one canonical SmugMug API v2 resource through its official OPTIONS contract.",
      inputSchema: requestSchema(false),
    },
    {
      name: "smugmug.read",
      functionName: "smugmug_read",
      aliases: ["smugmug.read", "smugmug_read"],
      capability: "smugmug_read",
      platformCapability: "smugmug_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read one bounded page from one canonical SmugMug API v2 resource.",
      inputSchema: requestSchema(false),
    },
    {
      name: "smugmug.manage",
      functionName: "smugmug_manage",
      aliases: ["smugmug.manage", "smugmug_manage"],
      capability: "smugmug_manage",
      platformCapability: "smugmug_manage",
      action: "write",
      approvalRequired: true,
      description:
        "Create, update, or delete one canonical SmugMug API v2 resource; Safe mode requires approval.",
      inputSchema: requestSchema(true),
    },
    {
      name: "smugmug.upload",
      functionName: "smugmug_upload",
      aliases: ["smugmug.upload", "smugmug_upload"],
      capability: "smugmug_upload",
      platformCapability: "smugmug_upload",
      action: "write",
      approvalRequired: true,
      description:
        "Upload one base64-encoded photo or video of at most 25 MB to one explicit album; Safe mode requires approval.",
      inputSchema: {
        type: "object",
        properties: {
          albumUri: { type: "string", pattern: "^/api/v2/album/" },
          base64: { type: "string", minLength: 1, maxLength: 35_000_000 },
          mimeType: {
            type: "string",
            enum: [
              "image/jpeg",
              "image/png",
              "image/gif",
              "image/webp",
              "video/mp4",
              "video/quicktime",
            ],
          },
          fileName: { type: "string", minLength: 1, maxLength: 250 },
          title: { type: "string", maxLength: 250 },
          caption: { type: "string", maxLength: 2_000 },
          approvalId: { type: "string", maxLength: 200 },
        },
        required: ["albumUri", "base64", "mimeType", "fileName"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "smugmug_safe",
      label: "Safe",
      description:
        "Self-description and bounded reads run directly; every resource mutation and upload requires approval.",
      defaultSelected: true,
      allowedActions: [describe, read],
      approvalRequiredActions: [manage, upload],
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Every selected OAuth-authorized API v2 operation and bounded upload runs without Relay per-action approval; ownership, Full/Modify authority, fixed origins, canonical URIs, bounds, audits, redaction, and provider limits still apply.",
      defaultSelected: false,
      allowedActions: [describe, read, manage, upload],
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "authuser",
      label: "SmugMug authenticated-user validation",
      requiredScopes: ["Full", "Modify"],
    },
  ],
};

function requestSchema(manage: boolean) {
  return {
    type: "object",
    properties: {
      ...(manage
        ? { method: { type: "string", enum: ["POST", "PATCH", "DELETE"] } }
        : {}),
      uri: { type: "string", pattern: "^/api/v2", maxLength: 2_000 },
      query: { type: "object", maxProperties: 40 },
      ...(manage ? { json: { type: "object", maxProperties: 1_000 } } : {}),
      ...(manage ? { approvalId: { type: "string", maxLength: 200 } } : {}),
    },
    required: manage ? ["method", "uri"] : ["uri"],
    additionalProperties: false,
  };
}
