import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import {
  ZOHO_WORKDRIVE_ADMIN_OPERATION_IDS,
  ZOHO_WORKDRIVE_CONTENT_WRITE_OPERATION_IDS,
  ZOHO_WORKDRIVE_READ_OPERATION_IDS,
  ZOHO_WORKDRIVE_REQUIRED_SCOPES,
} from "./zoho-workdrive-operation-registry";

const reads = [
  action(
    "zoho_workdrive_read",
    "Read Zoho WorkDrive",
    "Read bounded WorkDrive teams, files, folders, sharing, comments, collections, labels, templates, workflows, and policy metadata.",
  ),
];
const contentWrites = [
  action(
    "zoho_workdrive_content_write",
    "Manage WorkDrive content",
    "Create, upload, update, move, share, comment on, restore, or delete WorkDrive content; Safe mode requires approval.",
  ),
];
const adminWrites = [
  action(
    "zoho_workdrive_admin",
    "Administer Zoho WorkDrive",
    "Manage teams, members, groups, team folders, templates, custom fields, libraries, and data policies where the connected account permits it; Safe mode requires approval.",
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

export const ZOHO_WORKDRIVE_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "zoho-workdrive",
  name: "Zoho WorkDrive",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://workdrive.zoho.com/apidocs/v1/",
  providerWebsiteUrl: "https://www.zoho.com/workdrive/",
  capabilities: [
    {
      ...capability(
        "workdrive_read",
        "Read WorkDrive",
        "Read all 90 documented WorkDrive retrieval operations with bounded results and the connected user's provider authority.",
        true,
      ),
      platformCapability: "zoho_workdrive_read",
    },
    {
      ...capability(
        "workdrive_content_write",
        "Manage files and collaboration",
        "Use all documented non-admin content, upload, folder, share, comment, collection, label, and workflow mutations.",
        true,
      ),
      platformCapability: "zoho_workdrive_content_write",
    },
    {
      ...capability(
        "workdrive_admin",
        "Administer WorkDrive",
        "Use all documented team, member, group, team-folder, data-template, library, and data-policy mutations when the Zoho account is authorized.",
        true,
      ),
      platformCapability: "zoho_workdrive_admin",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://accounts.zoho.com/oauth/v2/auth",
      tokenUrl: "https://accounts.zoho.com/oauth/v2/token",
      revocationUrl: "https://accounts.zoho.com/oauth/v2/token/revoke",
      userInfoUrl: "https://www.zohoapis.com/workdrive/api/v1/users/me",
      requiredScopes: [...ZOHO_WORKDRIVE_REQUIRED_SCOPES],
      optionalScopes: [],
      pkce: false,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "ZOHO_WORKDRIVE_CLIENT_ID",
        label: "Zoho client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Relay-owned multi-data-center Zoho web client ID configured on Railway.",
      },
      {
        name: "ZOHO_WORKDRIVE_CLIENT_SECRET",
        label: "Zoho client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText: "Relay-owned Zoho client secret stored only in Railway.",
      },
    ],
  },
  tools: [
    {
      name: "zohoWorkDrive.read",
      functionName: "zoho_workdrive_read",
      aliases: ["zohoWorkDrive.read", "zoho_workdrive_read"],
      capability: "workdrive_read",
      platformCapability: "zoho_workdrive_read",
      action: "read",
      approvalRequired: false,
      description:
        "Run one of the 90 pinned official Zoho WorkDrive GET operations. The operation selects an exact method, route, regional origin, and documented parameter allowlist.",
      inputSchema: {
        type: "object",
        properties: {
          operation: {
            type: "string",
            enum: [...ZOHO_WORKDRIVE_READ_OPERATION_IDS],
          },
          ...commonProperties,
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
    {
      name: "zohoWorkDrive.manageContent",
      functionName: "zoho_workdrive_manage_content",
      aliases: ["zohoWorkDrive.manageContent", "zoho_workdrive_manage_content"],
      capability: "workdrive_content_write",
      platformCapability: "zoho_workdrive_content_write",
      action: "write",
      approvalRequired: true,
      description:
        "Run one pinned official WorkDrive content or collaboration mutation. Safe mode requires approval; upload content is base64 and capped at 2 MB.",
      inputSchema: {
        type: "object",
        properties: {
          operation: {
            type: "string",
            enum: [...ZOHO_WORKDRIVE_CONTENT_WRITE_OPERATION_IDS],
          },
          ...commonProperties,
          approvalId: { type: "string" },
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
    {
      name: "zohoWorkDrive.admin",
      functionName: "zoho_workdrive_admin",
      aliases: ["zohoWorkDrive.admin", "zoho_workdrive_admin"],
      capability: "workdrive_admin",
      platformCapability: "zoho_workdrive_admin",
      action: "admin",
      approvalRequired: true,
      description:
        "Run one pinned official team, member, group, team-folder, template, library, or data-policy mutation. Safe mode requires approval and Zoho enforces the connected user's admin authority.",
      inputSchema: {
        type: "object",
        properties: {
          operation: {
            type: "string",
            enum: [...ZOHO_WORKDRIVE_ADMIN_OPERATION_IDS],
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
      id: "zoho_workdrive_safe",
      label: "Safe",
      description:
        "All 90 bounded WorkDrive reads run directly; every content, collaboration, workflow, destructive, or administrative mutation requires approval.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [...contentWrites, ...adminWrites],
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "All 229 selected and Zoho-authorized WorkDrive operations run without Relay per-action approval; connection ownership, regional origins, exact routes, scopes, bounds, audits, redaction, and Zoho account authority still apply.",
      defaultSelected: false,
      allowedActions: [...reads, ...contentWrites, ...adminWrites],
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    {
      id: "current_user_and_region",
      label:
        "Zoho WorkDrive current user, offline refresh token, and data-center binding",
    },
  ],
};
