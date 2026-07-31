import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import {
  GIVEBUTTER_MANAGE_OPERATION_IDS,
  GIVEBUTTER_OPERATIONS,
  GIVEBUTTER_READ_OPERATION_IDS,
} from "./givebutter-operation-registry";

const read = action(
  "givebutter_read",
  "Read Givebutter",
  "Read authorized account, campaign, contact, activity, fund, household, message, payout, recurring-plan, ticket, transaction and webhook data.",
);
const manage = action(
  "givebutter_manage",
  "Manage Givebutter",
  "Create, update, archive, restore, associate, tag or delete authorized Givebutter records; Safe mode requires approval.",
);

export const GIVEBUTTER_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "givebutter",
  name: "Givebutter",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://docs.givebutter.com/api-reference/authentication",
  providerWebsiteUrl: "https://givebutter.com/",
  capabilities: [
    {
      ...capability(
        "givebutter_read",
        "Read fundraising and CRM data",
        `Use all ${GIVEBUTTER_READ_OPERATION_IDS.length} pinned read operations in Givebutter's public API.`,
        true,
      ),
      platformCapability: "givebutter_read",
    },
    {
      ...capability(
        "givebutter_manage",
        "Manage fundraising and CRM data",
        `Use all ${GIVEBUTTER_MANAGE_OPERATION_IDS.length} pinned mutations in Givebutter's public API.`,
        true,
      ),
      platformCapability: "givebutter_manage",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "GIVEBUTTER_API_KEY",
        label: "Givebutter API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "An account administrator creates an API key under Settings, Developers, API. Relay encrypts it and sends it only to api.givebutter.com in the Bearer authorization header.",
      },
    ],
  },
  tools: [
    {
      name: "givebutter.read",
      functionName: "givebutter_read",
      aliases: ["givebutter.read", "givebutter_read"],
      capability: "givebutter_read",
      platformCapability: "givebutter_read",
      action: "read",
      approvalRequired: false,
      description:
        "Run one pinned, semantically read-only Givebutter public API operation with bounded arguments and results.",
      inputSchema: {
        type: "object",
        properties: {
          operation: {
            type: "string",
            enum: [...GIVEBUTTER_READ_OPERATION_IDS],
          },
          pathParameters: { type: "object", maxProperties: 4 },
          query: { type: "object", maxProperties: 50 },
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
    {
      name: "givebutter.manage",
      functionName: "givebutter_manage",
      aliases: ["givebutter.manage", "givebutter_manage"],
      capability: "givebutter_manage",
      platformCapability: "givebutter_manage",
      action: "write",
      approvalRequired: true,
      description:
        "Run one pinned Givebutter mutation with bounded arguments and results; Safe mode requires approval.",
      inputSchema: {
        type: "object",
        properties: {
          operation: {
            type: "string",
            enum: [...GIVEBUTTER_MANAGE_OPERATION_IDS],
          },
          pathParameters: { type: "object", maxProperties: 4 },
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
      id: "givebutter_safe",
      label: "Safe",
      description: `All ${GIVEBUTTER_READ_OPERATION_IDS.length} semantic reads run directly; every mutation requires approval.`,
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [manage],
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description: `All ${GIVEBUTTER_OPERATIONS.length} selected and API-key-authorized operations run without Relay per-action approval; connection ownership, exact routes, bounds, audits, redaction and provider limits still apply.`,
      defaultSelected: false,
      allowedActions: [read, manage],
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    {
      id: "api_key_and_account",
      label: "Givebutter API key and authenticated-account access check",
    },
  ],
};
