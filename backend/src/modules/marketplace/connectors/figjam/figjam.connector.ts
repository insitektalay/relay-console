import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "figjam_api_read",
    "Read FigJam boards",
    "Use any supported read operation for an authorized FigJam file, its comments, versions, renders, or webhooks.",
  ),
];
const writes = [
  action(
    "figjam_api_write",
    "Change FigJam comments or webhooks",
    "Post or delete comments and reactions, or create, update, or delete board webhooks; Safe mode requires approval.",
  ),
];
const unavailable = [
  blocked(
    "figjam_canvas_write",
    "Edit the FigJam canvas remotely",
    "Figma exposes canvas creation and editing only to plugins running inside the FigJam editor, not to external OAuth REST clients.",
  ),
];

export const FIGJAM_SCOPES = [
  "current_user:read",
  "file_content:read",
  "file_metadata:read",
  "file_comments:read",
  "file_comments:write",
  "file_versions:read",
  "webhooks:read",
  "webhooks:write",
] as const;

export const FIGJAM_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "figjam",
  name: "FigJam",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developers.figma.com/docs/rest-api/",
  providerWebsiteUrl: "https://www.figma.com/figjam/",
  capabilities: [
    {
      ...capability(
        "board_read",
        "Read FigJam boards",
        "Read an authorized board's metadata, node tree, selected nodes, image fills, rendered images, comments, reactions, and version history.",
        true,
      ),
      platformCapability: "figjam_board_read",
    },
    {
      ...capability(
        "comment_management",
        "Manage comments and reactions",
        "Post, reply to, delete, and react to comments on authorized FigJam boards.",
        true,
      ),
      platformCapability: "figjam_comment_management",
    },
    {
      ...capability(
        "webhook_management",
        "Manage board webhooks",
        "Create, inspect, update, and delete Figma webhooks for explicitly selected FigJam files.",
        true,
      ),
      platformCapability: "figjam_webhook_management",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://www.figma.com/oauth",
      tokenUrl: "https://api.figma.com/v1/oauth/token",
      refreshUrl: "https://api.figma.com/v1/oauth/token",
      userInfoUrl: "https://api.figma.com/v1/me",
      requiredScopes: [...FIGJAM_SCOPES],
      optionalScopes: [],
      pkce: true,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "FIGMA_CLIENT_ID",
        label: "Figma OAuth client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText: "Relay-owned Figma app client ID configured on Railway.",
      },
      {
        name: "FIGMA_CLIENT_SECRET",
        label: "Figma OAuth client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Relay-owned Figma app client secret stored only in Railway secret variables.",
      },
    ],
  },
  tools: [
    {
      name: "figjam.read",
      functionName: "figjam_read",
      aliases: ["figjam.read", "figjam_read", "figjam_api_read"],
      capability: "board_read",
      platformCapability: "figjam_board_read",
      action: "read",
      approvalRequired: false,
      description:
        "Call one exact supported GET route on Figma's fixed API origin for an authorized FigJam board.",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string", pattern: "^/v[12]/" },
          query: { type: "object" },
        },
        required: ["path"],
        additionalProperties: false,
      },
    },
    {
      name: "figjam.write",
      functionName: "figjam_write",
      aliases: ["figjam.write", "figjam_write", "figjam_api_write"],
      capability: "comment_management",
      platformCapability: "figjam_comment_management",
      action: "write",
      approvalRequired: true,
      description:
        "Call one exact supported FigJam comment, reaction, or webhook mutation on Figma's fixed API origin.",
      inputSchema: {
        type: "object",
        properties: {
          method: { type: "string", enum: ["POST", "PUT", "DELETE"] },
          path: { type: "string", pattern: "^/v[12]/" },
          query: { type: "object" },
          json: { type: "object" },
          approvalId: { type: "string" },
        },
        required: ["method", "path"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "figjam_safe",
      label: "Safe",
      description:
        "Board, comment, version, render, and webhook reads run directly; comment, reaction, and webhook mutations require approval. Remote canvas editing remains unavailable because Figma does not expose it through OAuth REST.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: writes,
      blockedActions: unavailable,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Every selected OAuth-authorized FigJam REST operation runs without Relay per-action approval; fixed Figma origins, exact route allowlists, request bounds, audits, redaction, provider permissions, rate limits, and the absence of a remote canvas-write API still apply.",
      defaultSelected: false,
      allowedActions: [...reads, ...writes],
      approvalRequiredActions: [],
      blockedActions: unavailable,
    },
  ],
  healthChecks: [
    {
      id: "current_user",
      label: "Figma OAuth token and current-user validation",
      requiredScopes: ["current_user:read"],
    },
  ],
};
