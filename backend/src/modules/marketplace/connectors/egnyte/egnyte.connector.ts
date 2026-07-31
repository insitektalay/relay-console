import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import {
  EGNYTE_ADMIN_OPERATION_IDS,
  EGNYTE_CONTENT_WRITE_OPERATION_IDS,
  EGNYTE_READ_OPERATION_IDS,
} from "./egnyte-operation-registry";

const reads = [
  action(
    "egnyte_read",
    "Read Egnyte",
    "Read bounded files, folders, search results, permissions, links, workflows, reports, users, and governance metadata.",
  ),
];
const contentWrites = [
  action(
    "egnyte_content_write",
    "Manage Egnyte content",
    "Create, upload, update, move, share, sign, restore, or delete content; Safe mode requires approval.",
  ),
];
const adminWrites = [
  action(
    "egnyte_admin",
    "Administer Egnyte",
    "Manage users, groups, permissions, metadata, reports, integrations, and webhooks where the connected account permits it; Safe mode requires approval.",
  ),
];

const objectSchema = {
  type: "object",
  maxProperties: 500,
  additionalProperties: true,
};
const commonProperties = {
  pathParameters: objectSchema,
  query: objectSchema,
  headers: objectSchema,
  body: objectSchema,
  contentBase64: { type: "string", maxLength: 2_700_000 },
  fileName: { type: "string", maxLength: 255 },
  mimeType: { type: "string", maxLength: 200 },
};

export const EGNYTE_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "egnyte",
  name: "Egnyte",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://developers.egnyte.com/integration/cfs/api-docs/overview",
  providerWebsiteUrl: "https://www.egnyte.com/",
  capabilities: [
    {
      ...capability(
        "egnyte_read",
        "Read Egnyte",
        "Use all 71 active documented Egnyte retrieval operations with bounded results and the connected user's authority.",
        true,
      ),
      platformCapability: "egnyte_read",
    },
    {
      ...capability(
        "egnyte_content_write",
        "Manage content and workflows",
        "Use all 46 selected non-admin content, sharing, signing, AI, workflow, and collaboration mutations.",
        true,
      ),
      platformCapability: "egnyte_content_write",
    },
    {
      ...capability(
        "egnyte_admin",
        "Administer Egnyte",
        "Use all 51 selected user, group, permission, metadata, reporting, integration, and webhook mutations when the Egnyte account permits it.",
        true,
      ),
      platformCapability: "egnyte_admin",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://example.egnyte.com/puboauth/token",
      tokenUrl: "https://example.egnyte.com/puboauth/token",
      userInfoUrl: "https://example.egnyte.com/pubapi/v1/userinfo",
      requiredScopes: [],
      optionalScopes: [],
      pkce: false,
      supportsRefresh: false,
    },
    credentialSchema: [
      {
        name: "EGNYTE_CLIENT_ID",
        label: "Egnyte API key",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText: "Relay-owned public Egnyte API key configured on Railway.",
      },
    ],
  },
  tools: [
    {
      name: "egnyte.read",
      functionName: "egnyte_read",
      aliases: ["egnyte.read", "egnyte_read"],
      capability: "egnyte_read",
      platformCapability: "egnyte_read",
      action: "read",
      approvalRequired: false,
      description:
        "Run one of the 71 pinned active official Egnyte GET operations against the connected customer's fixed Egnyte domain.",
      inputSchema: {
        type: "object",
        properties: {
          operation: { type: "string", enum: [...EGNYTE_READ_OPERATION_IDS] },
          ...commonProperties,
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
    {
      name: "egnyte.manageContent",
      functionName: "egnyte_manage_content",
      aliases: ["egnyte.manageContent", "egnyte_manage_content"],
      capability: "egnyte_content_write",
      platformCapability: "egnyte_content_write",
      action: "write",
      approvalRequired: true,
      description:
        "Run one pinned active Egnyte content or collaboration mutation. Safe mode requires approval; upload content is base64 and capped at 2 MB.",
      inputSchema: {
        type: "object",
        properties: {
          operation: {
            type: "string",
            enum: [...EGNYTE_CONTENT_WRITE_OPERATION_IDS],
          },
          ...commonProperties,
          approvalId: { type: "string" },
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
    {
      name: "egnyte.admin",
      functionName: "egnyte_admin",
      aliases: ["egnyte.admin", "egnyte_admin"],
      capability: "egnyte_admin",
      platformCapability: "egnyte_admin",
      action: "admin",
      approvalRequired: true,
      description:
        "Run one pinned active Egnyte administrative mutation. Safe mode requires approval and Egnyte enforces the connected user's account authority.",
      inputSchema: {
        type: "object",
        properties: {
          operation: { type: "string", enum: [...EGNYTE_ADMIN_OPERATION_IDS] },
          ...commonProperties,
          approvalId: { type: "string" },
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "egnyte_safe",
      label: "Safe",
      description:
        "All 71 bounded Egnyte reads run directly; every content, sharing, workflow, destructive, or administrative mutation requires approval.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [...contentWrites, ...adminWrites],
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "All 168 selected and Egnyte-authorized operations run without Relay per-action approval; ownership, fixed customer domain, exact routes, bounds, audits, redaction, provider limits, and account authority still apply.",
      defaultSelected: false,
      allowedActions: [...reads, ...contentWrites, ...adminWrites],
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    {
      id: "user_and_domain",
      label:
        "Egnyte connected user, public OAuth token, and customer-domain binding",
    },
  ],
};
