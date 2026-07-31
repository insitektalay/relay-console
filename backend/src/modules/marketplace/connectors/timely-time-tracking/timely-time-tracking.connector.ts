import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import {
  TIMELY_TIME_TRACKING_MANAGE_OPERATION_IDS,
  TIMELY_TIME_TRACKING_OPERATIONS,
  TIMELY_TIME_TRACKING_READ_OPERATION_IDS,
} from "./timely-time-tracking-operation-registry";

const read = action(
  "timely_time_tracking_read",
  "Read Timely",
  "Read bounded accounts, time entries, projects, clients, people, teams, tasks, reports, capacities, permissions, tags, states, and webhooks.",
);
const manage = action(
  "timely_time_tracking_manage",
  "Manage Timely",
  "Create, update, start, stop, invite, or delete authorized Timely records; Safe mode requires approval.",
);

export const TIMELY_TIME_TRACKING_CONNECTOR_MANIFEST: MarketplaceConnectorManifest =
  {
    slug: "timely-time-tracking",
    name: "Timely Time Tracking",
    connectorType: "native_clawchat",
    providerDocsUrl: "https://developer.timely.com/",
    providerWebsiteUrl: "https://www.timely.com/",
    capabilities: [
      {
        ...capability(
          "timely_time_tracking_read",
          "Read time and workspace data",
          `Use all ${TIMELY_TIME_TRACKING_READ_OPERATION_IDS.length} pinned official reads for accounts, time, projects, clients, people, teams, tasks, reports, capacities, permissions, tags, states, and webhooks.`,
          true,
        ),
        platformCapability: "timely_time_tracking_read",
      },
      {
        ...capability(
          "timely_time_tracking_manage",
          "Manage time and workspaces",
          `Use all ${TIMELY_TIME_TRACKING_MANAGE_OPERATION_IDS.length} pinned official mutations for time, timers, projects, clients, people, teams, tasks, tags, states, permissions, and webhooks.`,
          true,
        ),
        platformCapability: "timely_time_tracking_manage",
      },
    ],
    auth: {
      type: "oauth2_authorization_code",
      oauth: {
        authorizationUrl: "https://api.timelyapp.com/1.1/oauth/authorize",
        tokenUrl: "https://api.timelyapp.com/1.1/oauth/token",
        userInfoUrl: "https://api.timelyapp.com/1.1/accounts",
        requiredScopes: ["manage"],
        optionalScopes: [],
        pkce: false,
        supportsRefresh: true,
      },
      credentialSchema: [
        {
          name: "TIMELY_TIME_TRACKING_CLIENT_ID",
          label: "Timely client ID",
          required: true,
          secret: false,
          storedIn: "metadata",
          helpText:
            "Relay-owned confidential OAuth application ID configured on Railway.",
        },
        {
          name: "TIMELY_TIME_TRACKING_CLIENT_SECRET",
          label: "Timely client secret",
          required: true,
          secret: true,
          storedIn: "encrypted_secret",
          helpText: "Relay-owned OAuth secret configured only on Railway.",
        },
      ],
    },
    tools: [
      {
        name: "timely-time-tracking.read",
        functionName: "timely_time_tracking_read",
        aliases: ["timely-time-tracking.read", "timely_time_tracking_read"],
        capability: "timely_time_tracking_read",
        platformCapability: "timely_time_tracking_read",
        action: "read",
        approvalRequired: false,
        description:
          "Run one pinned official Timely GET operation with bounded arguments and results.",
        inputSchema: {
          type: "object",
          properties: {
            operation: {
              type: "string",
              enum: [...TIMELY_TIME_TRACKING_READ_OPERATION_IDS],
            },
            pathParameters: { type: "object", maxProperties: 10 },
            query: { type: "object", maxProperties: 40 },
          },
          required: ["operation"],
          additionalProperties: false,
        },
      },
      {
        name: "timely-time-tracking.manage",
        functionName: "timely_time_tracking_manage",
        aliases: ["timely-time-tracking.manage", "timely_time_tracking_manage"],
        capability: "timely_time_tracking_manage",
        platformCapability: "timely_time_tracking_manage",
        action: "write",
        approvalRequired: true,
        description:
          "Run one pinned official Timely mutation; Safe mode requires approval.",
        inputSchema: {
          type: "object",
          properties: {
            operation: {
              type: "string",
              enum: [...TIMELY_TIME_TRACKING_MANAGE_OPERATION_IDS],
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
        id: "timely_time_tracking_safe",
        label: "Safe",
        description: `All ${TIMELY_TIME_TRACKING_READ_OPERATION_IDS.length} bounded reads run directly; every mutation requires approval.`,
        defaultSelected: true,
        allowedActions: [read],
        approvalRequiredActions: [manage],
        blockedActions: [],
      },
      {
        id: "dangerously_skip_permissions",
        label: "Dangerously skip permissions",
        description: `All ${TIMELY_TIME_TRACKING_OPERATIONS.length} selected and provider-authorized operations run without Relay per-action approval; ownership, OAuth authority, exact routes, bounds, audits, redaction, provider limits, and Timely permissions still apply.`,
        defaultSelected: false,
        allowedActions: [read, manage],
        approvalRequiredActions: [],
        blockedActions: [],
      },
    ],
    healthChecks: [
      { id: "accounts", label: "Timely connected user and workspace access" },
    ],
  };
