import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { PODBEAN_OPERATIONS } from "./podbean-api.adapter";
const read = action(
  "podbean_read",
  "Read Podbean",
  "Read one pinned podcast, episode, chapter, analytics, or statistics operation.",
);
const manage = action(
  "podbean_manage",
  "Manage Podbean episodes",
  "Create, update, delete, or save chapters for one episode; Safe mode requires approval.",
);
const upload = action(
  "podbean_upload",
  "Upload Podbean media",
  "Authorize and upload one bounded file without exposing the presigned storage credential; Safe mode requires approval.",
);
const blockedActions = [
  blocked(
    "podbean_secret_exposure",
    "Expose Podbean secrets",
    "Client secrets, access and refresh tokens, presigned URLs, and authorization headers are never exposed.",
  ),
  blocked(
    "podbean_remote_fetch",
    "Make Podbean fetch arbitrary URLs",
    "Remote media, image, and transcript URL fields are blocked to prevent server-side request forgery.",
  ),
  blocked(
    "podbean_private_members",
    "Manage private members",
    "Business-master private-member authority and personally identifying membership operations are not requested or exposed.",
  ),
  blocked(
    "podbean_unbounded_transfer",
    "Transfer unbounded podcast data",
    "Calls are pinned and bounded; pages cap at 100, responses at 5 MB, and uploads at 25 MB.",
  ),
];
export const PODBEAN_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "podbean",
  name: "Podbean",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developers.podbean.com/podbean-api-docs/",
  providerWebsiteUrl: "https://www.podbean.com/",
  capabilities: [
    {
      ...capability(
        "podbean_read",
        "Read podcasts, episodes, and analytics",
        "Read the authorized podcast, episodes, chapters, download and engagement statistics, retention, platforms, sources, and reports.",
        true,
      ),
      platformCapability: "podbean_read",
    },
    {
      ...capability(
        "podbean_manage",
        "Manage episodes and chapters",
        "Create, update, delete, and chapter one explicit episode.",
        true,
      ),
      platformCapability: "podbean_manage",
    },
    {
      ...capability(
        "podbean_upload",
        "Upload episode assets",
        "Upload one bounded audio, video, image, or transcript asset and return only its Podbean file key.",
        true,
      ),
      platformCapability: "podbean_upload",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://api.podbean.com/v1/dialog/oauth",
      tokenUrl: "https://api.podbean.com/v1/oauth/token",
      refreshUrl: "https://api.podbean.com/v1/oauth/token",
      requiredScopes: [
        "podcast_read",
        "podcast_update",
        "episode_read",
        "episode_publish",
      ],
      optionalScopes: [],
      pkce: false,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "PODBEAN_CLIENT_ID",
        label: "Podbean app ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText: "Relay-owned Podbean developer application ID.",
      },
      {
        name: "PODBEAN_CLIENT_SECRET",
        label: "Podbean app secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText: "Relay-owned app secret stored only in Railway.",
      },
    ],
  },
  tools: [
    {
      name: "podbean.read",
      functionName: "podbean_read",
      aliases: ["podbean.read", "podbean_read"],
      capability: "podbean_read",
      platformCapability: "podbean_read",
      action: "read",
      approvalRequired: false,
      description: "Run one pinned Podbean read.",
      inputSchema: schema(false),
    },
    {
      name: "podbean.manage",
      functionName: "podbean_manage",
      aliases: ["podbean.manage", "podbean_manage"],
      capability: "podbean_manage",
      platformCapability: "podbean_manage",
      action: "write",
      approvalRequired: true,
      description: "Run one pinned episode mutation.",
      inputSchema: schema(true),
    },
    {
      name: "podbean.upload",
      functionName: "podbean_upload",
      aliases: ["podbean.upload", "podbean_upload"],
      capability: "podbean_upload",
      platformCapability: "podbean_upload",
      action: "write",
      approvalRequired: true,
      description: "Upload one bounded file and return its file key.",
      inputSchema: {
        type: "object",
        properties: {
          base64: { type: "string", maxLength: 35000000 },
          fileName: { type: "string", maxLength: 250 },
          contentType: { type: "string", maxLength: 100 },
          approvalId: { type: "string", maxLength: 200 },
        },
        required: ["base64", "fileName", "contentType"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "podbean_safe",
      label: "Safe",
      description:
        "Bounded reads run directly; every episode mutation and file upload requires approval.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [manage, upload],
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Selected publishing actions run without Relay per-action approval; fixed origins, bounds, audits, redaction, and provider rules still apply.",
      defaultSelected: false,
      allowedActions: [read, manage, upload],
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "podcast",
      label: "Podbean authorized-podcast validation",
      requiredScopes: [
        "podcast_read",
        "podcast_update",
        "episode_read",
        "episode_publish",
      ],
    },
  ],
};
function schema(manage: boolean) {
  return {
    type: "object",
    properties: {
      operation: {
        type: "string",
        enum: PODBEAN_OPERATIONS.filter((item) =>
          manage ? item.method === "POST" : item.method === "GET",
        ).map((item) => item.id),
      },
      path: { type: "object", maxProperties: 2 },
      parameters: { type: "object", maxProperties: 60 },
      ...(manage ? { approvalId: { type: "string", maxLength: 200 } } : {}),
    },
    required: ["operation"],
    additionalProperties: false,
  };
}
