import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import {
  REPLICON_MANAGE_OPERATION_IDS,
  REPLICON_OPERATIONS,
  REPLICON_READ_OPERATION_IDS,
} from "./replicon-operation-registry";

const read = action(
  "replicon_read",
  "Read Replicon",
  "Read bounded projects, tasks, clients, users, activities, time, billing, costing, permissions, and configuration data.",
);
const manage = action(
  "replicon_manage",
  "Manage Replicon",
  "Create, update, assign, approve, enable, disable, execute, or delete authorized Replicon records; Safe mode requires approval.",
);

export const REPLICON_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "replicon",
  name: "Replicon",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://sb1.replicon.com/services/docs/projects.html",
  providerWebsiteUrl: "https://www.replicon.com/",
  capabilities: [
    {
      ...capability(
        "replicon_read",
        "Read time, work, people, and financial data",
        `Use all ${REPLICON_READ_OPERATION_IDS.length} pinned reads in Replicon's public REST reference.`,
        true,
      ),
      platformCapability: "replicon_read",
    },
    {
      ...capability(
        "replicon_manage",
        "Manage time, work, people, and financial data",
        `Use all ${REPLICON_MANAGE_OPERATION_IDS.length} pinned mutations in Replicon's public REST reference.`,
        true,
      ),
      platformCapability: "replicon_manage",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "REPLICON_COMPANY_KEY",
        label: "Replicon company key",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Enter the company key used in your Replicon sign-in URL. Relay uses it to discover and pin your tenant endpoint.",
      },
      {
        name: "REPLICON_ACCESS_TOKEN",
        label: "Replicon access token",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Create an access token in Replicon, then paste it here. Relay encrypts it and sends it only to your discovered replicon.com tenant.",
      },
    ],
  },
  tools: [
    {
      name: "replicon.read",
      functionName: "replicon_read",
      aliases: ["replicon.read", "replicon_read"],
      capability: "replicon_read",
      platformCapability: "replicon_read",
      action: "read",
      approvalRequired: false,
      description:
        "Run one pinned, read-only Replicon operation with bounded arguments and results.",
      inputSchema: {
        type: "object",
        properties: {
          operation: { type: "string", enum: [...REPLICON_READ_OPERATION_IDS] },
          json: { type: "object", maxProperties: 2_000 },
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
    {
      name: "replicon.manage",
      functionName: "replicon_manage",
      aliases: ["replicon.manage", "replicon_manage"],
      capability: "replicon_manage",
      platformCapability: "replicon_manage",
      action: "write",
      approvalRequired: true,
      description:
        "Run one pinned Replicon mutation; Safe mode requires approval.",
      inputSchema: {
        type: "object",
        properties: {
          operation: {
            type: "string",
            enum: [...REPLICON_MANAGE_OPERATION_IDS],
          },
          json: { type: "object", maxProperties: 2_000 },
          approvalId: { type: "string", maxLength: 200 },
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "replicon_safe",
      label: "Safe",
      description: `All ${REPLICON_READ_OPERATION_IDS.length} bounded reads run directly; every mutation requires approval.`,
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [manage],
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description: `All ${REPLICON_OPERATIONS.length} selected and token-authorized operations run without Relay per-action approval; tenant ownership, Replicon permissions, exact routes, bounds, audits, redaction, plan limits, and credential non-exposure still apply.`,
      defaultSelected: false,
      allowedActions: [read, manage],
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    { id: "my-identity", label: "Replicon connected identity access" },
  ],
};
