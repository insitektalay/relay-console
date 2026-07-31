import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import {
  EVERHOUR_MANAGE_OPERATION_IDS,
  EVERHOUR_OPERATIONS,
  EVERHOUR_READ_OPERATION_IDS,
} from "./everhour-operation-registry";

const read = action(
  "everhour_read",
  "Read Everhour",
  "Read bounded clients, projects, tasks, time, timers, timecards, timesheets, expenses, invoices, resource plans, reports, users, and webhooks.",
);
const manage = action(
  "everhour_manage",
  "Manage Everhour",
  "Create, update, approve, export, archive, or delete authorized Everhour records; Safe mode requires approval.",
);

export const EVERHOUR_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "everhour",
  name: "Everhour",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://everhour.docs.apiary.io/",
  providerWebsiteUrl: "https://everhour.com/",
  capabilities: [
    {
      ...capability(
        "everhour_read",
        "Read time and project data",
        `Use all ${EVERHOUR_READ_OPERATION_IDS.length} pinned official reads for time, projects, tasks, clients, billing, planning, people, reports, and settings.`,
        true,
      ),
      platformCapability: "everhour_read",
    },
    {
      ...capability(
        "everhour_manage",
        "Manage time and projects",
        `Use all ${EVERHOUR_MANAGE_OPERATION_IDS.length} pinned official mutations for time, timers, timecards, timesheets, projects, tasks, clients, invoices, expenses, planning, and webhooks.`,
        true,
      ),
      platformCapability: "everhour_manage",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "EVERHOUR_API_KEY",
        label: "Everhour API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Copy the API key from the bottom of your Everhour profile. Relay encrypts it and sends it only to api.everhour.com.",
      },
    ],
  },
  tools: [
    {
      name: "everhour.read",
      functionName: "everhour_read",
      aliases: ["everhour.read", "everhour_read"],
      capability: "everhour_read",
      platformCapability: "everhour_read",
      action: "read",
      approvalRequired: false,
      description:
        "Run one pinned official Everhour GET operation with bounded arguments and results.",
      inputSchema: {
        type: "object",
        properties: {
          operation: { type: "string", enum: [...EVERHOUR_READ_OPERATION_IDS] },
          pathParameters: { type: "object", maxProperties: 10 },
          query: { type: "object", maxProperties: 40 },
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
    {
      name: "everhour.manage",
      functionName: "everhour_manage",
      aliases: ["everhour.manage", "everhour_manage"],
      capability: "everhour_manage",
      platformCapability: "everhour_manage",
      action: "write",
      approvalRequired: true,
      description:
        "Run one pinned official Everhour mutation; Safe mode requires approval.",
      inputSchema: {
        type: "object",
        properties: {
          operation: {
            type: "string",
            enum: [...EVERHOUR_MANAGE_OPERATION_IDS],
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
      id: "everhour_safe",
      label: "Safe",
      description: `All ${EVERHOUR_READ_OPERATION_IDS.length} bounded reads run directly; every mutation requires approval.`,
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [manage],
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description: `All ${EVERHOUR_OPERATIONS.length} selected and key-authorized operations run without Relay per-action approval; ownership, exact routes, bounds, audits, redaction, rate limits, and Everhour permissions still apply.`,
      defaultSelected: false,
      allowedActions: [read, manage],
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [{ id: "me", label: "Everhour user and team access" }],
};
