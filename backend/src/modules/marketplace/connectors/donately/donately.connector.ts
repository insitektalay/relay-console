import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import {
  DONATELY_MANAGE_OPERATION_IDS,
  DONATELY_OPERATIONS,
  DONATELY_READ_OPERATION_IDS,
} from "./donately-operation-registry";

const read = action(
  "donately_read",
  "Read Donately",
  "Read account, campaign, donation, subscription, person, fundraiser, form and webhook data.",
);
const manage = action(
  "donately_manage",
  "Manage Donately",
  "Create, update, refund, charge, resend, default or delete authorized Donately resources; Safe mode requires approval.",
);

export const DONATELY_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "donately",
  name: "Donately",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developer.donate.ly/api/",
  providerWebsiteUrl: "https://donately.com/",
  capabilities: [
    {
      ...capability(
        "donately_read",
        "Read fundraising data",
        `Use all ${DONATELY_READ_OPERATION_IDS.length} documented Donately API v2 reads.`,
        true,
      ),
      platformCapability: "donately_read",
    },
    {
      ...capability(
        "donately_manage",
        "Manage fundraising data",
        `Use all ${DONATELY_MANAGE_OPERATION_IDS.length} documented Donately API v2 mutations.`,
        true,
      ),
      platformCapability: "donately_manage",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "DONATELY_ACCOUNT_ID",
        label: "Donately account ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Copy the act_-prefixed account ID. Relay binds every request to it with the Donately-Account header.",
      },
      {
        name: "DONATELY_API_TOKEN",
        label: "Donately API token",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Copy the API token from Dashboard, Settings, API. Relay encrypts it and uses it only as the username in HTTP Basic authentication to api.donately.com.",
      },
    ],
  },
  tools: [
    {
      name: "donately.read",
      functionName: "donately_read",
      aliases: ["donately.read", "donately_read"],
      capability: "donately_read",
      platformCapability: "donately_read",
      action: "read",
      approvalRequired: false,
      description:
        "Run one pinned read from Donately's complete documented API v2 surface.",
      inputSchema: {
        type: "object",
        properties: {
          operation: { type: "string", enum: [...DONATELY_READ_OPERATION_IDS] },
          pathParameters: { type: "object", maxProperties: 4 },
          query: { type: "object", maxProperties: 50 },
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
    {
      name: "donately.manage",
      functionName: "donately_manage",
      aliases: ["donately.manage", "donately_manage"],
      capability: "donately_manage",
      platformCapability: "donately_manage",
      action: "write",
      approvalRequired: true,
      description:
        "Run one pinned Donately mutation; Safe mode requires approval.",
      inputSchema: {
        type: "object",
        properties: {
          operation: {
            type: "string",
            enum: [...DONATELY_MANAGE_OPERATION_IDS],
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
      id: "donately_safe",
      label: "Safe",
      description: `All ${DONATELY_READ_OPERATION_IDS.length} reads run directly; all ${DONATELY_MANAGE_OPERATION_IDS.length} mutations require approval.`,
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [manage],
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description: `All ${DONATELY_OPERATIONS.length} documented API v2 operations run without Relay per-action approval; account binding, fixed routes, audits, bounds and provider limits still apply.`,
      defaultSelected: false,
      allowedActions: [read, manage],
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    {
      id: "account_id_token_and_current_account",
      label: "Donately account ID, API token and current-account check",
    },
  ],
};
