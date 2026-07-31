import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import {
  PAPERFORM_BUSINESS_OPERATION_IDS,
  PAPERFORM_MANAGE_OPERATION_IDS,
  PAPERFORM_OPERATIONS,
  PAPERFORM_READ_OPERATION_IDS,
  PAPERFORM_STANDARD_OPERATION_IDS,
} from "./paperform-operation-registry";

const read = action(
  "paperform_read",
  "Read Paperform",
  "Read authorized forms, fields, submissions, partial submissions, products, coupons, webhooks, spaces, translations, and file links.",
);
const manage = action(
  "paperform_manage",
  "Manage Paperform",
  "Update forms and fields; delete submissions; manage products, coupons, webhooks, spaces, and translations. Safe mode requires approval.",
);

export const PAPERFORM_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "paperform",
  name: "Paperform",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://paperform.readme.io/reference/getting-started-1",
  providerWebsiteUrl: "https://paperform.co/",
  capabilities: [
    {
      ...capability(
        "paperform_read",
        "Read forms and results",
        `Use all ${PAPERFORM_READ_OPERATION_IDS.length} pinned semantic reads for forms, fields, responses, commerce configuration, organization, and file links.`,
        true,
      ),
      platformCapability: "paperform_read",
    },
    {
      ...capability(
        "paperform_manage",
        "Manage forms and workflows",
        `Use all ${PAPERFORM_MANAGE_OPERATION_IDS.length} pinned mutations for authorized forms, responses, products, coupons, webhooks, spaces, and translations.`,
        true,
      ),
      platformCapability: "paperform_manage",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "PAPERFORM_API_KEY",
        label: "Paperform API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Create a dedicated API key on your Paperform account page. Standard API access requires Pro or above; Business operations require Business or Enterprise.",
      },
      {
        name: "PAPERFORM_API_REGION",
        label: "Account region",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Enter US for ordinary accounts. Use AU or EU only when Paperform has placed your Enterprise account in that secondary region.",
      },
    ],
  },
  tools: [
    {
      name: "paperform.read",
      functionName: "paperform_read",
      aliases: ["paperform.read", "paperform_read"],
      capability: "paperform_read",
      platformCapability: "paperform_read",
      action: "read",
      approvalRequired: false,
      description:
        "Run one pinned, semantically read-only Paperform operation with bounded arguments and results.",
      inputSchema: {
        type: "object",
        properties: {
          operation: {
            type: "string",
            enum: [...PAPERFORM_READ_OPERATION_IDS],
          },
          pathParameters: { type: "object", maxProperties: 10 },
          query: { type: "object", maxProperties: 100 },
          json: {},
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
    {
      name: "paperform.manage",
      functionName: "paperform_manage",
      aliases: ["paperform.manage", "paperform_manage"],
      capability: "paperform_manage",
      platformCapability: "paperform_manage",
      action: "write",
      approvalRequired: true,
      description:
        "Run one pinned Paperform mutation with bounded arguments and results; Safe mode requires approval.",
      inputSchema: {
        type: "object",
        properties: {
          operation: {
            type: "string",
            enum: [...PAPERFORM_MANAGE_OPERATION_IDS],
          },
          pathParameters: { type: "object", maxProperties: 10 },
          query: { type: "object", maxProperties: 100 },
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
      id: "paperform_safe",
      label: "Safe",
      description: `All ${PAPERFORM_READ_OPERATION_IDS.length} semantic reads run directly; every mutation requires approval.`,
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [manage],
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description: `All ${PAPERFORM_OPERATIONS.length} selected and API-key-authorized operations run without Relay per-action approval. Paperform plan entitlements still limit the ${PAPERFORM_STANDARD_OPERATION_IDS.length} Standard and ${PAPERFORM_BUSINESS_OPERATION_IDS.length} Business operations, and connection ownership, fixed-region routing, bounds, audits, redaction, and provider limits remain enforced.`,
      defaultSelected: false,
      allowedActions: [read, manage],
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    {
      id: "api_key_region_and_forms",
      label: "Paperform API key, account region, and form-list access check",
    },
  ],
};
