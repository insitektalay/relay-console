import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "common_room_token_status",
    "Validate room token",
    "Validate the connected room-admin API token without exposing it.",
  ),
  action(
    "common_room_list_segments",
    "List segments",
    "List one bounded page of segment summaries.",
  ),
  action(
    "common_room_list_providers",
    "List signal providers",
    "List one bounded page of visible signal-provider summaries.",
  ),
];
const writes = [
  action(
    "common_room_v2_request",
    "Use documented API v2",
    "Call one bounded documented Common Room API v2 operation; Safe mode requires approval for every call outside the three pinned reads.",
  ),
];
const blocked = [
  action(
    "common_room_private_export",
    "Export private people data",
    "Bulk contact, organization, activity, website-visit, enrichment, email, social-profile, and custom-field exports are not mounted as direct tools.",
  ),
  action(
    "common_room_raw_origin",
    "Use arbitrary endpoints",
    "Caller-selected origins, v1 ingestion, SCIM, RTBF, private endpoints, browser automation, and undocumented paths are blocked.",
  ),
];

export const COMMON_ROOM_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "common-room",
  name: "Common Room",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://api.commonroom.io/docs/api-v2.html",
  providerWebsiteUrl: "https://www.commonroom.io/",
  capabilities: [
    {
      ...capability(
        "workspace_read",
        "Read workspace metadata",
        "Validate the token and list bounded segments and visible signal providers.",
        true,
      ),
      platformCapability: "common_room_workspace_read",
    },
    {
      ...capability(
        "v2_api",
        "Common Room API v2",
        "Use the complete documented API v2 surface authorized by the customer's room-admin token.",
        true,
      ),
      platformCapability: "common_room_v2_api",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "COMMON_ROOM_API_TOKEN",
        label: "Common Room API token",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "A room admin creates this token in Common Room Settings > API tokens. Railway stores it encrypted and attaches it only to api.commonroom.io.",
      },
    ],
  },
  tools: [
    {
      name: "commonRoom.tokenStatus",
      functionName: "common_room_token_status",
      aliases: ["commonRoom.tokenStatus", "common_room_token_status"],
      capability: "workspace_read",
      platformCapability: "common_room_workspace_read",
      action: "read",
      approvalRequired: false,
      description: "Validate the connected Common Room token.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "commonRoom.listSegments",
      functionName: "common_room_list_segments",
      aliases: ["commonRoom.listSegments", "common_room_list_segments"],
      capability: "workspace_read",
      platformCapability: "common_room_workspace_read",
      action: "read",
      approvalRequired: false,
      description: "List one bounded page of segment summaries.",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "number", minimum: 1, maximum: 100 },
          query: { type: "string", maxLength: 200 },
        },
        additionalProperties: false,
      },
    },
    {
      name: "commonRoom.listProviders",
      functionName: "common_room_list_providers",
      aliases: ["commonRoom.listProviders", "common_room_list_providers"],
      capability: "workspace_read",
      platformCapability: "common_room_workspace_read",
      action: "read",
      approvalRequired: false,
      description:
        "List one bounded page of visible signal-provider summaries.",
      inputSchema: {
        type: "object",
        properties: { limit: { type: "number", minimum: 1, maximum: 100 } },
        additionalProperties: false,
      },
    },
    {
      name: "commonRoom.requestV2",
      functionName: "common_room_v2_request",
      aliases: ["commonRoom.requestV2", "common_room_v2_request"],
      capability: "v2_api",
      platformCapability: "common_room_v2_api",
      action: "admin",
      approvalRequired: true,
      description:
        "Call one documented /api/v2 operation through the fixed Common Room origin.",
      inputSchema: {
        type: "object",
        properties: {
          method: { type: "string", enum: ["GET", "POST", "PATCH", "DELETE"] },
          path: { type: "string", pattern: "^/api/v2/", maxLength: 500 },
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
      id: "common_room_safe",
      label: "Safe",
      description:
        "Pinned workspace-metadata reads run directly; every other documented API v2 operation requires matching approval.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: writes,
      blockedActions: blocked,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Every selected token-authorized API v2 operation runs without Relay per-action approval while fixed origin, credential secrecy, request bounds, audits, provider authority, and provider limits remain enforced.",
      defaultSelected: false,
      allowedActions: [...reads, ...writes],
      approvalRequiredActions: [],
      blockedActions: blocked,
    },
  ],
  healthChecks: [{ id: "token_auth", label: "Common Room token validation" }],
};
