import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import {
  VIRTUOUS_CRM_MANAGE_OPERATION_IDS,
  VIRTUOUS_CRM_OPERATIONS,
  VIRTUOUS_CRM_READ_OPERATION_IDS,
} from "./virtuous-crm-operation-registry";

const read = action(
  "virtuous_crm_read",
  "Read Virtuous CRM",
  "Read authorized contacts, giving, campaigns, projects, events, grants, volunteering, email, task and webhook data.",
);
const manage = action(
  "virtuous_crm_manage",
  "Manage Virtuous CRM",
  "Create, update or delete authorized CRM records; Safe mode requires approval.",
);

export const VIRTUOUS_CRM_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "virtuous-crm",
  name: "Virtuous CRM",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://docs.virtuoussoftware.com/",
  providerWebsiteUrl: "https://virtuous.org/products/crm/",
  capabilities: [
    {
      ...capability(
        "virtuous_crm_read",
        "Read nonprofit CRM data",
        `Use all ${VIRTUOUS_CRM_READ_OPERATION_IDS.length} current official API reads.`,
        true,
      ),
      platformCapability: "virtuous_crm_read",
    },
    {
      ...capability(
        "virtuous_crm_manage",
        "Manage nonprofit CRM data",
        `Use all ${VIRTUOUS_CRM_MANAGE_OPERATION_IDS.length} current official API mutations.`,
        true,
      ),
      platformCapability: "virtuous_crm_manage",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "VIRTUOUS_CRM_API_KEY",
        label: "Virtuous CRM API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Create a dedicated API key with a least-privilege permission group in Virtuous CRM+. Relay encrypts it and sends it only to api.virtuoussoftware.com as a Bearer token.",
      },
    ],
  },
  tools: [
    {
      name: "virtuousCrm.read",
      functionName: "virtuous_crm_read",
      aliases: ["virtuousCrm.read", "virtuous_crm_read"],
      capability: "virtuous_crm_read",
      platformCapability: "virtuous_crm_read",
      action: "read",
      approvalRequired: false,
      description: "Run one pinned Virtuous CRM API read.",
      inputSchema: {
        type: "object",
        properties: {
          operation: {
            type: "string",
            enum: [...VIRTUOUS_CRM_READ_OPERATION_IDS],
          },
          pathParameters: { type: "object", maxProperties: 4 },
          query: { type: "object", maxProperties: 50 },
          json: {},
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
    {
      name: "virtuousCrm.manage",
      functionName: "virtuous_crm_manage",
      aliases: ["virtuousCrm.manage", "virtuous_crm_manage"],
      capability: "virtuous_crm_manage",
      platformCapability: "virtuous_crm_manage",
      action: "write",
      approvalRequired: true,
      description:
        "Run one pinned Virtuous CRM mutation; Safe mode requires approval.",
      inputSchema: {
        type: "object",
        properties: {
          operation: {
            type: "string",
            enum: [...VIRTUOUS_CRM_MANAGE_OPERATION_IDS],
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
      id: "virtuous_crm_safe",
      label: "Safe",
      description: `All ${VIRTUOUS_CRM_READ_OPERATION_IDS.length} semantic reads run directly; all ${VIRTUOUS_CRM_MANAGE_OPERATION_IDS.length} mutations require approval.`,
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [manage],
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description: `All ${VIRTUOUS_CRM_OPERATIONS.length} current operations run without Relay per-action approval; API-key permission groups, fixed routes, audits, bounds and provider limits still apply.`,
      defaultSelected: false,
      allowedActions: [read, manage],
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    {
      id: "api_key_and_current_organization",
      label: "Virtuous CRM API key and current organization access check",
    },
  ],
};
