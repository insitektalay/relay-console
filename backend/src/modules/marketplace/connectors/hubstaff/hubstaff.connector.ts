import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import {
  HUBSTAFF_MANAGE_OPERATION_IDS,
  HUBSTAFF_OPERATIONS,
  HUBSTAFF_READ_OPERATION_IDS,
} from "./hubstaff-operation-registry";

const read = action(
  "hubstaff_read",
  "Read Hubstaff",
  "Read bounded organization, people, projects, tasks, time, attendance, activity, billing, workforce, location, and insight data.",
);
const manage = action(
  "hubstaff_manage",
  "Manage Hubstaff",
  "Create, update, archive, restore, assign, invite, approve, or delete authorized Hubstaff records; Safe mode requires approval.",
);

export const HUBSTAFF_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "hubstaff",
  name: "Hubstaff",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developer.hubstaff.com/",
  providerWebsiteUrl: "https://hubstaff.com/",
  capabilities: [
    {
      ...capability(
        "hubstaff_read",
        "Read time, workforce, and organization data",
        `Use all ${HUBSTAFF_READ_OPERATION_IDS.length} pinned official reads across Hubstaff v2.`,
        true,
      ),
      platformCapability: "hubstaff_read",
    },
    {
      ...capability(
        "hubstaff_manage",
        "Manage Hubstaff",
        `Use all ${HUBSTAFF_MANAGE_OPERATION_IDS.length} pinned official mutations across Hubstaff v2.`,
        true,
      ),
      platformCapability: "hubstaff_manage",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://account.hubstaff.com/authorizations/new",
      tokenUrl: "https://account.hubstaff.com/access_tokens",
      userInfoUrl: "https://api.hubstaff.com/v2/users/me",
      requiredScopes: [
        "openid",
        "profile",
        "email",
        "hubstaff:read",
        "hubstaff:write",
      ],
      optionalScopes: [],
      pkce: true,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "HUBSTAFF_CLIENT_ID",
        label: "Hubstaff client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Relay-owned Hubstaff OAuth application ID configured on the service.",
      },
      {
        name: "HUBSTAFF_CLIENT_SECRET",
        label: "Hubstaff client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Relay-owned Hubstaff OAuth secret configured only on the service.",
      },
    ],
  },
  tools: [
    {
      name: "hubstaff.read",
      functionName: "hubstaff_read",
      aliases: ["hubstaff.read", "hubstaff_read"],
      capability: "hubstaff_read",
      platformCapability: "hubstaff_read",
      action: "read",
      approvalRequired: false,
      description:
        "Run one pinned official Hubstaff GET operation with bounded arguments and results.",
      inputSchema: {
        type: "object",
        properties: {
          operation: { type: "string", enum: [...HUBSTAFF_READ_OPERATION_IDS] },
          pathParameters: { type: "object", maxProperties: 10 },
          query: { type: "object", maxProperties: 50 },
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
    {
      name: "hubstaff.manage",
      functionName: "hubstaff_manage",
      aliases: ["hubstaff.manage", "hubstaff_manage"],
      capability: "hubstaff_manage",
      platformCapability: "hubstaff_manage",
      action: "write",
      approvalRequired: true,
      description:
        "Run one pinned official Hubstaff mutation; Safe mode requires approval.",
      inputSchema: {
        type: "object",
        properties: {
          operation: {
            type: "string",
            enum: [...HUBSTAFF_MANAGE_OPERATION_IDS],
          },
          pathParameters: { type: "object", maxProperties: 10 },
          query: { type: "object", maxProperties: 50 },
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
      id: "hubstaff_safe",
      label: "Safe",
      description: `All ${HUBSTAFF_READ_OPERATION_IDS.length} bounded reads run directly; every mutation requires approval.`,
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [manage],
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description: `All ${HUBSTAFF_OPERATIONS.length} selected and provider-authorized operations run without Relay per-action approval; ownership, OAuth authority, exact routes, bounds, audits, redaction, plan limits, rate limits, and Hubstaff permissions still apply.`,
      defaultSelected: false,
      allowedActions: [read, manage],
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    { id: "current-user", label: "Hubstaff connected user access" },
  ],
};
