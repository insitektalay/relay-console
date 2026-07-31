import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import {
  EVERYACTION_MANAGE_OPERATION_IDS,
  EVERYACTION_OPERATIONS,
  EVERYACTION_READ_OPERATION_IDS,
} from "./everyaction-operation-registry";

const read = action(
  "everyaction_read",
  "Read EveryAction",
  "Read authorized people, canvass, activist-code, contribution, event, signup, target, survey and worksite data.",
);
const manage = action(
  "everyaction_manage",
  "Manage EveryAction",
  "Create, update or delete authorized EveryAction records; Safe mode requires approval.",
);
const processPayments = action(
  "everyaction_process_payments",
  "Process payments",
  "Card and EFT payment processing is excluded because it uses a separate PCI-sensitive API host and data boundary.",
);

export const EVERYACTION_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "everyaction",
  name: "EveryAction",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://docs.everyaction.com/",
  providerWebsiteUrl: "https://www.everyaction.com/",
  capabilities: [
    {
      ...capability(
        "everyaction_read",
        "Read organizing and nonprofit CRM data",
        `Use all ${EVERYACTION_READ_OPERATION_IDS.length} current official API reads.`,
        true,
      ),
      platformCapability: "everyaction_read",
    },
    {
      ...capability(
        "everyaction_manage",
        "Manage organizing and nonprofit CRM data",
        `Use all ${EVERYACTION_MANAGE_OPERATION_IDS.length} current official non-payment mutations.`,
        true,
      ),
      platformCapability: "everyaction_manage",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "EVERYACTION_APPLICATION_NAME",
        label: "EveryAction application name",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Use the application name paired with the client-requested EveryAction API key. Relay sends it only as the Basic-auth username to api.securevan.com.",
      },
      {
        name: "EVERYACTION_API_KEY",
        label: "EveryAction API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Use a client-requested production key for the intended My Voters or My Campaign database. Relay encrypts it and sends it only as the Basic-auth password to api.securevan.com.",
      },
    ],
  },
  tools: [
    {
      name: "everyaction.read",
      functionName: "everyaction_read",
      aliases: ["everyaction.read", "everyaction_read"],
      capability: "everyaction_read",
      platformCapability: "everyaction_read",
      action: "read",
      approvalRequired: false,
      description: "Run one pinned EveryAction API read.",
      inputSchema: {
        type: "object",
        properties: {
          operation: {
            type: "string",
            enum: [...EVERYACTION_READ_OPERATION_IDS],
          },
          pathParameters: { type: "object", maxProperties: 3 },
          query: { type: "object", maxProperties: 50 },
          json: {},
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
    {
      name: "everyaction.manage",
      functionName: "everyaction_manage",
      aliases: ["everyaction.manage", "everyaction_manage"],
      capability: "everyaction_manage",
      platformCapability: "everyaction_manage",
      action: "write",
      approvalRequired: true,
      description:
        "Run one pinned non-payment mutation; Safe mode requires approval.",
      inputSchema: {
        type: "object",
        properties: {
          operation: {
            type: "string",
            enum: [...EVERYACTION_MANAGE_OPERATION_IDS],
          },
          pathParameters: { type: "object", maxProperties: 3 },
          query: { type: "object", maxProperties: 50 },
          json: {},
          approvalId: { type: "string", maxLength: 200 },
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "everyaction_safe",
      label: "Safe",
      description: `All ${EVERYACTION_READ_OPERATION_IDS.length} reads run directly; all ${EVERYACTION_MANAGE_OPERATION_IDS.length} non-payment mutations require approval; payment processing remains blocked.`,
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [manage],
      blockedActions: [processPayments],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description: `All ${EVERYACTION_OPERATIONS.length} pinned non-payment operations run without Relay per-action approval; payment processing remains blocked and API-key permissions, fixed routes, audits, bounds and provider limits still apply.`,
      defaultSelected: false,
      allowedActions: [read, manage],
      approvalRequiredActions: [],
      blockedActions: [processPayments],
    },
  ],
  healthChecks: [
    {
      id: "application_name_api_key_and_database_access",
      label: "EveryAction application name, API key and database access check",
    },
  ],
};
