import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import {
  FUNDRAISE_UP_MANAGE_OPERATION_IDS,
  FUNDRAISE_UP_OPERATIONS,
  FUNDRAISE_UP_READ_OPERATION_IDS,
} from "./fundraise-up-operation-registry";

const read = action(
  "fundraise_up_read",
  "Read Fundraise Up",
  "Read campaigns, designations, donations, events, fundraisers, recurring plans and supporters.",
);
const manage = action(
  "fundraise_up_manage",
  "Manage Fundraise Up",
  "Create or update donations, fundraisers and designations, assign designations, or generate portal and upgrade links; Safe mode requires approval.",
);

export const FUNDRAISE_UP_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "fundraise-up",
  name: "Fundraise Up",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://api.fundraiseup.com/",
  providerWebsiteUrl: "https://fundraiseup.com/",
  capabilities: [
    {
      ...capability(
        "fundraise_up_read",
        "Read fundraising data",
        `Use all ${FUNDRAISE_UP_READ_OPERATION_IDS.length} official API reads.`,
        true,
      ),
      platformCapability: "fundraise_up_read",
    },
    {
      ...capability(
        "fundraise_up_manage",
        "Manage fundraising data",
        `Use all ${FUNDRAISE_UP_MANAGE_OPERATION_IDS.length} official API mutations.`,
        true,
      ),
      platformCapability: "fundraise_up_manage",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "FUNDRAISE_UP_API_KEY",
        label: "Fundraise Up API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Generate a granular API key in Dashboard, Settings, API keys. Relay encrypts it and sends it only to api.fundraiseup.com in the Bearer header.",
      },
    ],
  },
  tools: [
    {
      name: "fundraiseUp.read",
      functionName: "fundraise_up_read",
      aliases: ["fundraiseUp.read", "fundraise_up_read"],
      capability: "fundraise_up_read",
      platformCapability: "fundraise_up_read",
      action: "read",
      approvalRequired: false,
      description: "Run one pinned Fundraise Up API read.",
      inputSchema: {
        type: "object",
        properties: {
          operation: {
            type: "string",
            enum: [...FUNDRAISE_UP_READ_OPERATION_IDS],
          },
          pathParameters: { type: "object", maxProperties: 4 },
          query: { type: "object", maxProperties: 50 },
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
    {
      name: "fundraiseUp.manage",
      functionName: "fundraise_up_manage",
      aliases: ["fundraiseUp.manage", "fundraise_up_manage"],
      capability: "fundraise_up_manage",
      platformCapability: "fundraise_up_manage",
      action: "write",
      approvalRequired: true,
      description:
        "Run one pinned Fundraise Up mutation; Safe mode requires approval.",
      inputSchema: {
        type: "object",
        properties: {
          operation: {
            type: "string",
            enum: [...FUNDRAISE_UP_MANAGE_OPERATION_IDS],
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
      id: "fundraise_up_safe",
      label: "Safe",
      description: `All ${FUNDRAISE_UP_READ_OPERATION_IDS.length} reads run directly; all ${FUNDRAISE_UP_MANAGE_OPERATION_IDS.length} mutations require approval.`,
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [manage],
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description: `All ${FUNDRAISE_UP_OPERATIONS.length} operations run without Relay per-action approval; API-key permissions, live/test mode, fixed routes, audits, bounds and provider limits still apply.`,
      defaultSelected: false,
      allowedActions: [read, manage],
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    {
      id: "api_key_and_campaigns",
      label: "Fundraise Up API key and test-mode campaign access check",
    },
  ],
};
