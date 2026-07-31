import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import {
  ACTITIME_MANAGE_OPERATION_IDS,
  ACTITIME_OPERATIONS,
  ACTITIME_READ_OPERATION_IDS,
} from "./actitime-operation-registry";

const read = action(
  "actitime_read",
  "Read actiTIME",
  "Read authorized customers, projects, tasks, time, leave, users, departments, rates, settings, and webhook subscriptions.",
);
const manage = action(
  "actitime_manage",
  "Manage actiTIME",
  "Create, update, lock, unlock, invite, replace, subscribe, batch, or delete authorized actiTIME records; Safe mode requires approval.",
);

export const ACTITIME_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "actitime",
  name: "ActiTIME",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://www.actitime.com/api-documentation",
  providerWebsiteUrl: "https://www.actitime.com/",
  capabilities: [
    {
      ...capability(
        "actitime_read",
        "Read time, work, people, and settings",
        `Use all ${ACTITIME_READ_OPERATION_IDS.length} pinned reads in actiTIME's public REST API.`,
        true,
      ),
      platformCapability: "actitime_read",
    },
    {
      ...capability(
        "actitime_manage",
        "Manage time, work, people, and settings",
        `Use all ${ACTITIME_MANAGE_OPERATION_IDS.length} pinned mutations in actiTIME's public REST API.`,
        true,
      ),
      platformCapability: "actitime_manage",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "ACTITIME_INSTALLATION_URL",
        label: "actiTIME installation URL",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Enter the HTTPS address you use to open actiTIME. Relay limits requests to that installation's /api/v1 route.",
      },
      {
        name: "ACTITIME_USERNAME",
        label: "actiTIME username",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Use a dedicated actiTIME integration user with only the permissions your agents need.",
      },
      {
        name: "ACTITIME_PASSWORD",
        label: "actiTIME password",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Enter that integration user's password. Relay encrypts it and sends it only to the configured actiTIME installation.",
      },
    ],
  },
  tools: [
    {
      name: "actiTime.read",
      functionName: "actitime_read",
      aliases: ["actiTime.read", "actitime_read"],
      capability: "actitime_read",
      platformCapability: "actitime_read",
      action: "read",
      approvalRequired: false,
      description:
        "Run one pinned, read-only actiTIME operation with bounded arguments and results.",
      inputSchema: {
        type: "object",
        properties: {
          operation: { type: "string", enum: [...ACTITIME_READ_OPERATION_IDS] },
          pathParameters: { type: "object", maxProperties: 10 },
          query: { type: "object", maxProperties: 100 },
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
    {
      name: "actiTime.manage",
      functionName: "actitime_manage",
      aliases: ["actiTime.manage", "actitime_manage"],
      capability: "actitime_manage",
      platformCapability: "actitime_manage",
      action: "write",
      approvalRequired: true,
      description:
        "Run one pinned actiTIME mutation; Safe mode requires approval.",
      inputSchema: {
        type: "object",
        properties: {
          operation: {
            type: "string",
            enum: [...ACTITIME_MANAGE_OPERATION_IDS],
          },
          pathParameters: { type: "object", maxProperties: 10 },
          query: { type: "object", maxProperties: 100 },
          json: { type: ["object", "array"] },
          approvalId: { type: "string", maxLength: 200 },
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "actitime_safe",
      label: "Safe",
      description: `All ${ACTITIME_READ_OPERATION_IDS.length} bounded reads run directly; every mutation requires approval.`,
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [manage],
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description: `All ${ACTITIME_OPERATIONS.length} selected and user-authorized operations run without Relay per-action approval; installation ownership, actiTIME permissions, exact routes, bounds, audits, redaction, plan limits, and credential non-exposure still apply.`,
      defaultSelected: false,
      allowedActions: [read, manage],
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    { id: "current-user", label: "actiTIME connected user access" },
  ],
};
