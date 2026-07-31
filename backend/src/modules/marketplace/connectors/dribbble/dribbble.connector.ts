import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { DRIBBBLE_OPERATIONS } from "./dribbble-operation-registry";

const read = action(
  "dribbble_read",
  "Read Dribbble",
  "Run one pinned read operation against the authenticated member's API-visible resources.",
);
const manage = action(
  "dribbble_manage",
  "Manage Dribbble",
  "Create, update, or delete one shot, project, or attachment; Safe mode requires explicit approval.",
);
const blockedActions = [
  blocked(
    "dribbble_secret_exposure",
    "Expose Dribbble secrets",
    "OAuth client secrets, access tokens, cookies, and authorization headers are never exposed.",
  ),
  blocked(
    "dribbble_unrequested_automation",
    "Automate unrequested social actions",
    "Relay exposes only the documented member publishing surface and every mutation must be specifically requested; automated likes, follows, comments, and similar engagement are blocked.",
  ),
  blocked(
    "dribbble_unofficial_interface",
    "Use unofficial Dribbble interfaces",
    "Scraping, browser automation, arbitrary endpoints, private application calls, and partner-only job tokens are blocked.",
  ),
  blocked(
    "dribbble_unbounded_transfer",
    "Transfer unbounded content",
    "Reads are bounded to one page, request bodies to 1 MB, responses to 5 MB, and uploads to 8 MB.",
  ),
];

export const DRIBBBLE_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "dribbble",
  name: "Dribbble",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developer.dribbble.com/v2/",
  providerWebsiteUrl: "https://dribbble.com/",
  capabilities: [
    {
      ...capability(
        "dribbble_read",
        "Read member publishing resources",
        "Read the authenticated user, projects, shots, and attachments through every documented OAuth-accessible GET operation.",
        true,
      ),
      platformCapability: "dribbble_read",
    },
    {
      ...capability(
        "dribbble_manage",
        "Manage member publishing resources",
        "Create, update, and delete projects and shots, and create or delete shot attachments.",
        true,
      ),
      platformCapability: "dribbble_manage",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://dribbble.com/oauth/authorize",
      tokenUrl: "https://dribbble.com/oauth/token",
      userInfoUrl: "https://api.dribbble.com/v2/user",
      requiredScopes: ["public", "upload"],
      optionalScopes: [],
      pkce: false,
      supportsRefresh: false,
    },
    credentialSchema: [
      {
        name: "DRIBBBLE_CLIENT_ID",
        label: "Dribbble client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Relay-owned OAuth application client ID issued after provider-console registration.",
      },
      {
        name: "DRIBBBLE_CLIENT_SECRET",
        label: "Dribbble client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText: "Relay-owned OAuth secret stored only in Railway.",
      },
    ],
  },
  tools: [
    {
      name: "dribbble.read",
      functionName: "dribbble_read",
      aliases: ["dribbble.read", "dribbble_read"],
      capability: "dribbble_read",
      platformCapability: "dribbble_read",
      action: "read",
      approvalRequired: false,
      description: "Run one pinned Dribbble GET operation.",
      inputSchema: operationSchema(false),
    },
    {
      name: "dribbble.manage",
      functionName: "dribbble_manage",
      aliases: ["dribbble.manage", "dribbble_manage"],
      capability: "dribbble_manage",
      platformCapability: "dribbble_manage",
      action: "write",
      approvalRequired: true,
      description:
        "Run one pinned Dribbble mutation; Safe mode requires approval.",
      inputSchema: operationSchema(true),
    },
  ],
  approvalProfiles: [
    {
      id: "dribbble_safe",
      label: "Safe",
      description:
        "Bounded reads run directly; every project, shot, and attachment mutation requires approval.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [manage],
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Selected OAuth-authorized publishing mutations run without Relay per-action approval; specific user intent, fixed origins, pinned operations, bounds, audits, redaction, and provider terms still apply.",
      defaultSelected: false,
      allowedActions: [read, manage],
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "authenticated_user",
      label: "Dribbble authenticated-user validation",
      requiredScopes: ["public", "upload"],
    },
  ],
};

function operationSchema(manage: boolean) {
  const operations = DRIBBBLE_OPERATIONS.filter((operation) =>
    manage ? operation.method !== "GET" : operation.method === "GET",
  ).map((operation) => operation.id);
  return {
    type: "object",
    properties: {
      operation: { type: "string", enum: operations },
      path: { type: "object", maxProperties: 3 },
      query: { type: "object", maxProperties: 20 },
      json: { type: "object", maxProperties: 30 },
      base64: { type: "string", maxLength: 12_000_000 },
      fileName: { type: "string", maxLength: 250 },
      mimeType: {
        type: "string",
        enum: ["image/jpeg", "image/png", "image/gif"],
      },
      approvalId: { type: "string", maxLength: 200 },
    },
    required: ["operation"],
    additionalProperties: false,
  };
}
