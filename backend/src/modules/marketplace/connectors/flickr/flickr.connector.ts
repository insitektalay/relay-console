import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const describe = action(
  "flickr_describe",
  "Describe Flickr methods",
  "Inspect the official reflected contract for one published Flickr API method.",
);
const read = action(
  "flickr_read",
  "Read Flickr",
  "Run one bounded reflected read-style Flickr API method.",
);
const manage = action(
  "flickr_manage",
  "Manage Flickr",
  "Run one reflected Flickr API method through POST; Safe mode requires approval.",
);
const upload = action(
  "flickr_upload",
  "Upload Flickr media",
  "Upload or replace one bounded photo or video; Safe mode requires approval.",
);
const blockedActions = [
  blocked(
    "flickr_secret_exposure",
    "Expose Flickr secrets",
    "API secrets, OAuth token pairs, cookies, and signed authorization headers are never exposed.",
  ),
  blocked(
    "flickr_unofficial_interface",
    "Use unofficial Flickr interfaces",
    "Scraping, browser automation, legacy authentication methods, arbitrary origins, and private application calls are blocked.",
  ),
  blocked(
    "flickr_unbounded_transfer",
    "Transfer unbounded content",
    "Each action is one reflected method or one upload, with bounded arguments, responses, and media size.",
  ),
];

export const FLICKR_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "flickr",
  name: "Flickr",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://www.flickr.com/services/api/",
  providerWebsiteUrl: "https://www.flickr.com/",
  capabilities: [
    {
      ...capability(
        "flickr_describe",
        "Discover API methods",
        "Inspect arguments, errors, authentication, and permission requirements for any published Flickr method.",
        true,
      ),
      platformCapability: "flickr_describe",
    },
    {
      ...capability(
        "flickr_read",
        "Read Flickr resources",
        "Read photos, albums, galleries, groups, favorites, contacts, collections, tags, places, and other reflected resources.",
        true,
      ),
      platformCapability: "flickr_read",
    },
    {
      ...capability(
        "flickr_manage",
        "Manage Flickr resources",
        "Invoke the complete reflected API surface, including writes and deletes, through approval-gated POST requests.",
        true,
      ),
      platformCapability: "flickr_manage",
    },
    {
      ...capability(
        "flickr_upload",
        "Upload and replace media",
        "Upload one bounded photo or video, or replace the binary for one explicit photo.",
        true,
      ),
      platformCapability: "flickr_upload",
    },
  ],
  auth: {
    type: "oauth1",
    oauth: {
      authorizationUrl: "https://www.flickr.com/services/oauth/authorize",
      tokenUrl: "https://www.flickr.com/services/oauth/access_token",
      userInfoUrl:
        "https://www.flickr.com/services/rest?method=flickr.test.login",
      requiredScopes: ["read", "write", "delete"],
      optionalScopes: [],
      pkce: false,
      supportsRefresh: false,
    },
    credentialSchema: [
      {
        name: "FLICKR_API_KEY",
        label: "Flickr API key",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Relay-owned API key issued after the provider acceptance owner obtains Flickr's required business permission and registers the application.",
      },
      {
        name: "FLICKR_API_SECRET",
        label: "Flickr API secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Relay-owned API secret held only by Railway and used to sign OAuth 1.0a requests.",
      },
    ],
  },
  tools: [
    {
      name: "flickr.describe",
      functionName: "flickr_describe",
      aliases: ["flickr.describe", "flickr_describe"],
      capability: "flickr_describe",
      platformCapability: "flickr_describe",
      action: "read",
      approvalRequired: false,
      description:
        "Describe one published Flickr API method through reflection.",
      inputSchema: methodSchema(false),
    },
    {
      name: "flickr.read",
      functionName: "flickr_read",
      aliases: ["flickr.read", "flickr_read"],
      capability: "flickr_read",
      platformCapability: "flickr_read",
      action: "read",
      approvalRequired: false,
      description: "Run one reflected read-style Flickr API method.",
      inputSchema: methodSchema(true),
    },
    {
      name: "flickr.manage",
      functionName: "flickr_manage",
      aliases: ["flickr.manage", "flickr_manage"],
      capability: "flickr_manage",
      platformCapability: "flickr_manage",
      action: "write",
      approvalRequired: true,
      description:
        "Run one reflected Flickr API method through POST; Safe mode requires approval.",
      inputSchema: methodSchema(true, true),
    },
    {
      name: "flickr.upload",
      functionName: "flickr_upload",
      aliases: ["flickr.upload", "flickr_upload"],
      capability: "flickr_upload",
      platformCapability: "flickr_upload",
      action: "write",
      approvalRequired: true,
      description:
        "Upload or replace one base64-encoded photo or video of at most 25 MB.",
      inputSchema: uploadSchema(),
    },
  ],
  approvalProfiles: [
    {
      id: "flickr_safe",
      label: "Safe",
      description:
        "Method descriptions and bounded reads run directly; every mutation, delete, upload, and replacement requires approval.",
      defaultSelected: true,
      allowedActions: [describe, read],
      approvalRequiredActions: [manage, upload],
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Every selected OAuth-authorized method and bounded upload runs without Relay per-action approval; account authority, fixed origins, reflected validation, bounds, audits, redaction, and provider limits still apply.",
      defaultSelected: false,
      allowedActions: [describe, read, manage, upload],
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "test_login",
      label: "Flickr authenticated-user validation",
      requiredScopes: ["read", "write", "delete"],
    },
  ],
};

function methodSchema(withArguments: boolean, approval = false) {
  return {
    type: "object",
    properties: {
      method: {
        type: "string",
        pattern: "^flickr(?:\\.[a-z][A-Za-z0-9]*){2,6}$",
        maxLength: 200,
      },
      ...(withArguments
        ? { arguments: { type: "object", maxProperties: 60 } }
        : {}),
      ...(approval ? { approvalId: { type: "string", maxLength: 200 } } : {}),
    },
    required: ["method"],
    additionalProperties: false,
  };
}

function uploadSchema() {
  return {
    type: "object",
    properties: {
      operation: { type: "string", enum: ["upload", "replace"] },
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
      photoId: { type: "string", maxLength: 100 },
      title: { type: "string", maxLength: 2_000 },
      description: { type: "string", maxLength: 2_000 },
      tags: { type: "string", maxLength: 2_000 },
      is_public: { type: ["string", "number", "boolean"] },
      is_friend: { type: ["string", "number", "boolean"] },
      is_family: { type: ["string", "number", "boolean"] },
      safety_level: { type: ["string", "number"] },
      content_type: { type: ["string", "number"] },
      hidden: { type: ["string", "number", "boolean"] },
      approvalId: { type: "string", maxLength: 200 },
    },
    required: ["operation", "base64", "mimeType", "fileName"],
    additionalProperties: false,
  };
}
