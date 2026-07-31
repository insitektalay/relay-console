import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import {
  RESCUETIME_MANAGE_OPERATION_IDS,
  RESCUETIME_OPERATIONS,
  RESCUETIME_READ_OPERATION_IDS,
} from "./rescuetime-operation-registry";

const read = action(
  "rescuetime_read",
  "Read RescueTime",
  "Read bounded analytics, users, accounts, organizations, time, focus, projects, tasks, calendars, classifications, alerts, goals, notifications, preferences, devices, and events.",
);
const manage = action(
  "rescuetime_manage",
  "Manage RescueTime",
  "Create, update, start, stop, archive, finalize, or delete authorized RescueTime records; Safe mode requires approval.",
);

export const RESCUETIME_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "rescuetime",
  name: "RescueTime",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://www.rescuetime.com/api-docs",
  providerWebsiteUrl: "https://www.rescuetime.com/",
  capabilities: [
    {
      ...capability(
        "rescuetime_read",
        "Read time, productivity, and account data",
        `Use all ${RESCUETIME_READ_OPERATION_IDS.length} pinned official reads across the RescueTime Resource and Analytic APIs.`,
        true,
      ),
      platformCapability: "rescuetime_read",
    },
    {
      ...capability(
        "rescuetime_manage",
        "Manage RescueTime",
        `Use all ${RESCUETIME_MANAGE_OPERATION_IDS.length} pinned official mutations across the RescueTime Resource and Analytic APIs.`,
        true,
      ),
      platformCapability: "rescuetime_manage",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://www.rescuetime.com/oauth/authorize",
      tokenUrl: "https://www.rescuetime.com/oauth/token",
      userInfoUrl: "https://www.rescuetime.com/api/resource/users",
      requiredScopes: [
        "time_data",
        "category_data",
        "productivity_data",
        "alert_data",
        "highlight_data",
        "focustime_data",
      ],
      optionalScopes: [],
      pkce: false,
      supportsRefresh: false,
    },
    credentialSchema: [
      {
        name: "RESCUETIME_CLIENT_ID",
        label: "RescueTime client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText: "Relay-owned provider-approved OAuth application ID configured on Railway.",
      },
      {
        name: "RESCUETIME_CLIENT_SECRET",
        label: "RescueTime client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText: "Relay-owned OAuth secret configured only on Railway.",
      },
    ],
  },
  tools: [
    {
      name: "rescuetime.read",
      functionName: "rescuetime_read",
      aliases: ["rescuetime.read", "rescuetime_read"],
      capability: "rescuetime_read",
      platformCapability: "rescuetime_read",
      action: "read",
      approvalRequired: false,
      description: "Run one pinned official RescueTime GET operation with bounded arguments and results.",
      inputSchema: {
        type: "object",
        properties: {
          operation: { type: "string", enum: [...RESCUETIME_READ_OPERATION_IDS] },
          pathParameters: { type: "object", maxProperties: 10 },
          query: { type: "object", maxProperties: 40 },
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
    {
      name: "rescuetime.manage",
      functionName: "rescuetime_manage",
      aliases: ["rescuetime.manage", "rescuetime_manage"],
      capability: "rescuetime_manage",
      platformCapability: "rescuetime_manage",
      action: "write",
      approvalRequired: true,
      description: "Run one pinned official RescueTime mutation; Safe mode requires approval.",
      inputSchema: {
        type: "object",
        properties: {
          operation: { type: "string", enum: [...RESCUETIME_MANAGE_OPERATION_IDS] },
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
      id: "rescuetime_safe",
      label: "Safe",
      description: `All ${RESCUETIME_READ_OPERATION_IDS.length} bounded reads run directly; every mutation requires approval.`,
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [manage],
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description: `All ${RESCUETIME_OPERATIONS.length} selected and provider-authorized operations run without Relay per-action approval; ownership, OAuth authority, exact routes, bounds, audits, redaction, plan limits, provider limits, and RescueTime permissions still apply.`,
      defaultSelected: false,
      allowedActions: [read, manage],
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [{ id: "users", label: "RescueTime connected user access" }],
};
