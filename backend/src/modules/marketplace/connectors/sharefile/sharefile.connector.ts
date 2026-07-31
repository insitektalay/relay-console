import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import {
  SHAREFILE_ADMIN_OPERATION_IDS,
  SHAREFILE_CONTENT_WRITE_OPERATION_IDS,
  SHAREFILE_READ_OPERATION_IDS,
} from "./sharefile-operation-registry";

const reads = [
  action(
    "sharefile_read",
    "Read ShareFile",
    "Read bounded files, folders, shares, users, workflows, reports, permissions, and account metadata.",
  ),
];
const contentWrites = [
  action(
    "sharefile_content_write",
    "Manage ShareFile content",
    "Create, upload, update, move, share, request, restore, or delete content; Safe mode requires approval.",
  ),
];
const adminWrites = [
  action(
    "sharefile_admin",
    "Administer ShareFile",
    "Manage users, groups, permissions, policies, reports, storage, integrations, and webhooks where the connected account permits it; Safe mode requires approval.",
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
  body: objectSchema,
};

export const SHAREFILE_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "sharefile",
  name: "ShareFile",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://api.sharefile.com/docs/",
  providerWebsiteUrl: "https://www.sharefile.com/",
  capabilities: [
    {
      ...capability(
        "sharefile_read",
        "Read ShareFile",
        "Use all 141 selected documented ShareFile retrieval operations with bounded results and the connected user's authority.",
        true,
      ),
      platformCapability: "sharefile_read",
    },
    {
      ...capability(
        "sharefile_content_write",
        "Manage files and workflows",
        "Use all 59 selected content, sharing, email, session, workflow, and collaboration mutations.",
        true,
      ),
      platformCapability: "sharefile_content_write",
    },
    {
      ...capability(
        "sharefile_admin",
        "Administer ShareFile",
        "Use all 109 selected user, group, access-control, policy, reporting, integration, storage, and webhook mutations when the account permits it.",
        true,
      ),
      platformCapability: "sharefile_admin",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://secure.sharefile.com/oauth/authorize",
      tokenUrl: "https://secure.sharefile.com/oauth/token",
      userInfoUrl: "https://example.sf-api.com/sf/v3/Users",
      requiredScopes: [],
      optionalScopes: [],
      pkce: false,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "SHAREFILE_CLIENT_ID",
        label: "ShareFile client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText: "Relay-owned OAuth client configured on Railway.",
      },
      {
        name: "SHAREFILE_CLIENT_SECRET",
        label: "ShareFile client secret",
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
      name: "sharefile.read",
      functionName: "sharefile_read",
      aliases: ["sharefile.read", "sharefile_read"],
      capability: "sharefile_read",
      platformCapability: "sharefile_read",
      action: "read",
      approvalRequired: false,
      description:
        "Run one of the 141 pinned official ShareFile GET operations against the connected account's fixed API authority.",
      inputSchema: {
        type: "object",
        properties: {
          operation: {
            type: "string",
            enum: [...SHAREFILE_READ_OPERATION_IDS],
          },
          ...commonProperties,
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
    {
      name: "sharefile.manageContent",
      functionName: "sharefile_manage_content",
      aliases: ["sharefile.manageContent", "sharefile_manage_content"],
      capability: "sharefile_content_write",
      platformCapability: "sharefile_content_write",
      action: "write",
      approvalRequired: true,
      description:
        "Run one pinned ShareFile content or collaboration mutation. Safe mode requires approval and request bodies are capped at 2 MB.",
      inputSchema: {
        type: "object",
        properties: {
          operation: {
            type: "string",
            enum: [...SHAREFILE_CONTENT_WRITE_OPERATION_IDS],
          },
          ...commonProperties,
          approvalId: { type: "string" },
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
    {
      name: "sharefile.admin",
      functionName: "sharefile_admin",
      aliases: ["sharefile.admin", "sharefile_admin"],
      capability: "sharefile_admin",
      platformCapability: "sharefile_admin",
      action: "admin",
      approvalRequired: true,
      description:
        "Run one pinned ShareFile administrative mutation. Safe mode requires approval and ShareFile enforces the connected account's authority.",
      inputSchema: {
        type: "object",
        properties: {
          operation: {
            type: "string",
            enum: [...SHAREFILE_ADMIN_OPERATION_IDS],
          },
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
      id: "sharefile_safe",
      label: "Safe",
      description:
        "All 141 bounded ShareFile reads run directly; every content, sharing, destructive, or administrative mutation requires approval.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [...contentWrites, ...adminWrites],
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "All 309 selected and ShareFile-authorized operations run without Relay per-action approval; ownership, tenant authority, exact routes, bounds, audits, redaction, provider limits, and account authority still apply.",
      defaultSelected: false,
      allowedActions: [...reads, ...contentWrites, ...adminWrites],
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    {
      id: "user_and_tenant",
      label:
        "ShareFile connected user, refreshable OAuth token, and tenant authority binding",
    },
  ],
};
