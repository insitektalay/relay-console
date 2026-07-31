import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import {
  RESOURCE_GURU_MANAGE_OPERATION_IDS,
  RESOURCE_GURU_OPERATIONS,
  RESOURCE_GURU_READ_OPERATION_IDS,
} from "./resource-guru-operation-registry";

const read = action(
  "resource_guru_read",
  "Read Resource Guru",
  "Read bounded accounts, schedules, bookings, resources, projects, clients, time off, timesheets, reports, and configuration data.",
);
const manage = action(
  "resource_guru_manage",
  "Manage Resource Guru",
  "Create, update, approve, archive, or delete authorized Resource Guru records; Safe mode requires approval.",
);

export const RESOURCE_GURU_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "resource-guru",
  name: "Resource Guru",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://resourceguruapp.com/docs/api",
  providerWebsiteUrl: "https://resourceguruapp.com/",
  capabilities: [
    {
      ...capability(
        "resource_guru_read",
        "Read resource planning",
        `Use all ${RESOURCE_GURU_READ_OPERATION_IDS.length} pinned official read operations for accounts, schedules, bookings, resources, projects, clients, time off, timesheets, reports, and settings.`,
        true,
      ),
      platformCapability: "resource_guru_read",
    },
    {
      ...capability(
        "resource_guru_manage",
        "Manage resource planning",
        `Use all ${RESOURCE_GURU_MANAGE_OPERATION_IDS.length} pinned official mutations for bookings, people and resources, projects, clients, leave, timesheets, webhooks, and account configuration.`,
        true,
      ),
      platformCapability: "resource_guru_manage",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://api.resourceguruapp.com/oauth/authorize",
      tokenUrl: "https://api.resourceguruapp.com/oauth/token",
      userInfoUrl: "https://api.resourceguruapp.com/v1/me",
      requiredScopes: [],
      optionalScopes: [],
      pkce: false,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "RESOURCE_GURU_CLIENT_ID",
        label: "Resource Guru client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Relay-owned confidential OAuth application ID configured on Railway.",
      },
      {
        name: "RESOURCE_GURU_CLIENT_SECRET",
        label: "Resource Guru client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText: "Relay-owned OAuth secret configured only on Railway.",
      },
    ],
  },
  tools: [
    {
      name: "resource-guru.read",
      functionName: "resource_guru_read",
      aliases: ["resource-guru.read", "resource_guru_read"],
      capability: "resource_guru_read",
      platformCapability: "resource_guru_read",
      action: "read",
      approvalRequired: false,
      description:
        "Run one pinned official Resource Guru GET operation with bounded arguments and results.",
      inputSchema: {
        type: "object",
        properties: {
          operation: {
            type: "string",
            enum: [...RESOURCE_GURU_READ_OPERATION_IDS],
          },
          pathParameters: { type: "object", maxProperties: 10 },
          query: { type: "object", maxProperties: 40 },
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
    {
      name: "resource-guru.manage",
      functionName: "resource_guru_manage",
      aliases: ["resource-guru.manage", "resource_guru_manage"],
      capability: "resource_guru_manage",
      platformCapability: "resource_guru_manage",
      action: "write",
      approvalRequired: true,
      description:
        "Run one pinned official Resource Guru mutation; Safe mode requires approval.",
      inputSchema: {
        type: "object",
        properties: {
          operation: {
            type: "string",
            enum: [...RESOURCE_GURU_MANAGE_OPERATION_IDS],
          },
          pathParameters: { type: "object", maxProperties: 10 },
          query: { type: "object", maxProperties: 40 },
          json: { type: "object", maxProperties: 500 },
          approvalId: { type: "string", maxLength: 200 },
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "resource_guru_safe",
      label: "Safe",
      description: `All ${RESOURCE_GURU_READ_OPERATION_IDS.length} bounded reads run directly; every mutation requires approval.`,
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [manage],
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description: `All ${RESOURCE_GURU_OPERATIONS.length} selected and provider-authorized operations run without Relay per-action approval; ownership, OAuth authority, exact routes, bounds, audits, redaction, rate limits, and provider permissions still apply.`,
      defaultSelected: false,
      allowedActions: [read, manage],
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    { id: "me", label: "Resource Guru connected user and account access" },
  ],
};
