import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import {
  QUICKBOOKS_TIME_MANAGE_OPERATION_IDS,
  QUICKBOOKS_TIME_OPERATIONS,
  QUICKBOOKS_TIME_READ_OPERATION_IDS,
} from "./quickbooks-time-operation-registry";

const read = action(
  "quickbooks_time_read",
  "Read QuickBooks Time",
  "Read bounded people, jobs, time, projects, schedules, time off, locations, settings, files, activity, and reports.",
);
const manage = action(
  "quickbooks_time_manage",
  "Manage QuickBooks Time",
  "Create, update, assign, notify, schedule, approve, archive, or delete authorized QuickBooks Time records; Safe mode requires approval.",
);

export const QUICKBOOKS_TIME_CONNECTOR_MANIFEST: MarketplaceConnectorManifest =
  {
    slug: "quickbooks-time",
    name: "QuickBooks Time",
    connectorType: "native_clawchat",
    providerDocsUrl: "https://tsheetsteam.github.io/api_docs/",
    providerWebsiteUrl: "https://quickbooks.intuit.com/time-tracking/",
    capabilities: [
      {
        ...capability(
          "quickbooks_time_read",
          "Read time and workforce data",
          `Use all ${QUICKBOOKS_TIME_READ_OPERATION_IDS.length} pinned reads across QuickBooks Time v1.`,
          true,
        ),
        platformCapability: "quickbooks_time_read",
      },
      {
        ...capability(
          "quickbooks_time_manage",
          "Manage time and workforce data",
          `Use all ${QUICKBOOKS_TIME_MANAGE_OPERATION_IDS.length} pinned mutations across QuickBooks Time v1.`,
          true,
        ),
        platformCapability: "quickbooks_time_manage",
      },
    ],
    auth: {
      type: "api_key",
      credentialSchema: [
        {
          name: "QUICKBOOKS_TIME_ACCESS_TOKEN",
          label: "QuickBooks Time access token",
          required: true,
          secret: true,
          storedIn: "encrypted_secret",
          requiredForAuthTypes: ["api_key"],
          helpText:
            "Create an access token in your QuickBooks Time API Add-On, then paste it here. Relay encrypts it and sends it only to rest.tsheets.com.",
        },
      ],
    },
    tools: [
      {
        name: "quickBooksTime.read",
        functionName: "quickbooks_time_read",
        aliases: ["quickBooksTime.read", "quickbooks_time_read"],
        capability: "quickbooks_time_read",
        platformCapability: "quickbooks_time_read",
        action: "read",
        approvalRequired: false,
        description:
          "Run one pinned QuickBooks Time GET operation with bounded arguments and results.",
        inputSchema: {
          type: "object",
          properties: {
            operation: {
              type: "string",
              enum: [...QUICKBOOKS_TIME_READ_OPERATION_IDS],
            },
            query: { type: "object", maxProperties: 50 },
          },
          required: ["operation"],
          additionalProperties: false,
        },
      },
      {
        name: "quickBooksTime.manage",
        functionName: "quickbooks_time_manage",
        aliases: ["quickBooksTime.manage", "quickbooks_time_manage"],
        capability: "quickbooks_time_manage",
        platformCapability: "quickbooks_time_manage",
        action: "write",
        approvalRequired: true,
        description:
          "Run one pinned QuickBooks Time mutation; Safe mode requires approval.",
        inputSchema: {
          type: "object",
          properties: {
            operation: {
              type: "string",
              enum: [...QUICKBOOKS_TIME_MANAGE_OPERATION_IDS],
            },
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
        id: "quickbooks_time_safe",
        label: "Safe",
        description: `All ${QUICKBOOKS_TIME_READ_OPERATION_IDS.length} bounded reads run directly; every mutation requires approval.`,
        defaultSelected: true,
        allowedActions: [read],
        approvalRequiredActions: [manage],
        blockedActions: [],
      },
      {
        id: "dangerously_skip_permissions",
        label: "Dangerously skip permissions",
        description: `All ${QUICKBOOKS_TIME_OPERATIONS.length} selected and token-authorized operations run without Relay per-action approval; ownership, user permissions, exact routes, bounds, audits, redaction, billing, rate limits, and QuickBooks Time authority still apply.`,
        defaultSelected: false,
        allowedActions: [read, manage],
        approvalRequiredActions: [],
        blockedActions: [],
      },
    ],
    healthChecks: [
      { id: "current-user", label: "QuickBooks Time connected user access" },
    ],
  };
