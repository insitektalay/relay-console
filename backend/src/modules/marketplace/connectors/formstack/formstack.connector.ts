import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import {
  FORMSTACK_MANAGE_OPERATION_IDS,
  FORMSTACK_OPERATIONS,
  FORMSTACK_READ_OPERATION_IDS,
} from "./formstack-operation-registry";

const read = action(
  "formstack_read",
  "Read Formstack",
  "Read authorized forms, fields, submissions, partial submissions, folders, themes, emails, submit actions, webhooks, smart lists, portals, and subaccounts.",
);
const manage = action(
  "formstack_manage",
  "Manage Formstack",
  "Create, update, copy, assign, or delete supported Formstack resources. Safe mode requires approval.",
);

export const FORMSTACK_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "formstack",
  name: "Formstack",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developers.formstack.com/reference/api-overview",
  providerWebsiteUrl: "https://www.formstack.com/",
  capabilities: [
    {
      ...capability(
        "formstack_read",
        "Read forms and workflows",
        `Use all ${FORMSTACK_READ_OPERATION_IDS.length} pinned JSON reads across the connected Formstack account.`,
        true,
      ),
      platformCapability: "formstack_read",
    },
    {
      ...capability(
        "formstack_manage",
        "Manage forms and workflows",
        `Use all ${FORMSTACK_MANAGE_OPERATION_IDS.length} pinned JSON mutations across authorized Formstack resources.`,
        true,
      ),
      platformCapability: "formstack_manage",
    },
  ],
  auth: {
    type: "pat",
    credentialSchema: [
      {
        name: "FORMSTACK_PERSONAL_ACCESS_TOKEN",
        label: "Formstack Personal Access Token",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["pat"],
        helpText:
          "Generate a dedicated fs_pat_ token in Formstack Admin with the user permissions and optional expiry appropriate for Relay.",
      },
    ],
  },
  tools: [
    {
      name: "formstack.read",
      functionName: "formstack_read",
      aliases: ["formstack.read", "formstack_read"],
      capability: "formstack_read",
      platformCapability: "formstack_read",
      action: "read",
      approvalRequired: false,
      description:
        "Run one pinned, semantically read-only Formstack V2025 JSON operation with bounded arguments and results.",
      inputSchema: {
        type: "object",
        properties: {
          operation: {
            type: "string",
            enum: [...FORMSTACK_READ_OPERATION_IDS],
          },
          pathParameters: { type: "object", maxProperties: 4 },
          query: { type: "object", maxProperties: 30 },
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
    {
      name: "formstack.manage",
      functionName: "formstack_manage",
      aliases: ["formstack.manage", "formstack_manage"],
      capability: "formstack_manage",
      platformCapability: "formstack_manage",
      action: "write",
      approvalRequired: true,
      description:
        "Run one pinned Formstack V2025 JSON mutation; Safe mode requires approval.",
      inputSchema: {
        type: "object",
        properties: {
          operation: {
            type: "string",
            enum: [...FORMSTACK_MANAGE_OPERATION_IDS],
          },
          pathParameters: { type: "object", maxProperties: 4 },
          query: { type: "object", maxProperties: 30 },
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
      id: "formstack_safe",
      label: "Safe",
      description: `All ${FORMSTACK_READ_OPERATION_IDS.length} JSON reads run directly; every mutation requires approval.`,
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [manage],
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description: `All ${FORMSTACK_OPERATIONS.length} selected PAT-authorized JSON operations run without Relay per-action approval. Token user permissions and expiry, account plan, daily limits, connection ownership, fixed-host routing, bounds, audits, redaction, and provider limits remain enforced.`,
      defaultSelected: false,
      allowedActions: [read, manage],
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    {
      id: "pat_and_forms",
      label: "Formstack PAT and bounded form-list access check",
    },
  ],
};
