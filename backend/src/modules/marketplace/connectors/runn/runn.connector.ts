import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import {
  RUNN_MANAGE_OPERATION_IDS,
  RUNN_OPERATIONS,
  RUNN_READ_OPERATION_IDS,
} from "./runn-operation-registry";

const read = action(
  "runn_read",
  "Read Runn",
  "Read bounded people, projects, schedules, assignments, capacity, actuals, timesheets, forecasts, clients, rates, teams, leave, and settings.",
);
const manage = action(
  "runn_manage",
  "Manage Runn",
  "Create, update, invite, archive, or delete authorized Runn records; Safe mode requires approval.",
);

export const RUNN_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "runn",
  name: "Runn",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developer.runn.io/docs/getting-started",
  providerWebsiteUrl: "https://www.runn.io/",
  capabilities: [
    {
      ...capability(
        "runn_read",
        "Read resource planning",
        `Use all ${RUNN_READ_OPERATION_IDS.length} pinned official reads for people, projects, schedules, capacity, time, forecasts, clients, rates, teams, and settings.`,
        true,
      ),
      platformCapability: "runn_read",
    },
    {
      ...capability(
        "runn_manage",
        "Manage resource planning",
        `Use all ${RUNN_MANAGE_OPERATION_IDS.length} pinned official mutations for workforce plans, projects, assignments, actuals, invitations, rates, teams, leave, and account configuration.`,
        true,
      ),
      platformCapability: "runn_manage",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "RUNN_API_TOKEN",
        label: "Runn API token",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "An account admin creates a read/write token in Runn Settings > API. Relay encrypts it and sends it only to the selected Runn API region.",
      },
      {
        name: "RUNN_API_ORIGIN",
        label: "Runn data region",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Choose Europe (api.runn.io) or United States (api.us.runn.io) to match the API URL shown in Runn Settings > API.",
      },
    ],
  },
  tools: [
    {
      name: "runn.read",
      functionName: "runn_read",
      aliases: ["runn.read", "runn_read"],
      capability: "runn_read",
      platformCapability: "runn_read",
      action: "read",
      approvalRequired: false,
      description:
        "Run one pinned official Runn GET operation with bounded arguments and results.",
      inputSchema: {
        type: "object",
        properties: {
          operation: { type: "string", enum: [...RUNN_READ_OPERATION_IDS] },
          pathParameters: { type: "object", maxProperties: 10 },
          query: { type: "object", maxProperties: 40 },
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
    {
      name: "runn.manage",
      functionName: "runn_manage",
      aliases: ["runn.manage", "runn_manage"],
      capability: "runn_manage",
      platformCapability: "runn_manage",
      action: "write",
      approvalRequired: true,
      description:
        "Run one pinned official Runn mutation; Safe mode requires approval.",
      inputSchema: {
        type: "object",
        properties: {
          operation: { type: "string", enum: [...RUNN_MANAGE_OPERATION_IDS] },
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
      id: "runn_safe",
      label: "Safe",
      description: `All ${RUNN_READ_OPERATION_IDS.length} bounded reads run directly; every mutation requires approval.`,
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [manage],
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description: `All ${RUNN_OPERATIONS.length} selected and token-authorized operations run without Relay per-action approval; ownership, exact routes, bounds, audits, redaction, rate limits, and Runn permissions still apply.`,
      defaultSelected: false,
      allowedActions: [read, manage],
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [{ id: "me", label: "Runn account and token validation" }],
};
