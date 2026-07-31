import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import {
  NEON_CRM_MANAGE_OPERATION_IDS,
  NEON_CRM_OPERATIONS,
  NEON_CRM_READ_OPERATION_IDS,
} from "./neon-crm-operation-registry";

const read = action(
  "neon_crm_read",
  "Read Neon CRM",
  "Use every documented semantic read in Neon CRM API v2.11, including GET resources and provider-defined search or calculation POSTs.",
);
const manage = action(
  "neon_crm_manage",
  "Manage Neon CRM",
  "Create, update, patch, link, refund or delete authorized Neon CRM records; Safe mode requires approval.",
);

export const NEON_CRM_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "neon-crm",
  name: "Neon CRM",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developer.neoncrm.com/api-v2/",
  providerWebsiteUrl: "https://neonone.com/products/neon-crm/",
  capabilities: [
    {
      ...capability(
        "neon_crm_read",
        "Read nonprofit CRM data",
        `Use all ${NEON_CRM_READ_OPERATION_IDS.length} documented semantic reads in Neon CRM API v2.11.`,
        true,
      ),
      platformCapability: "neon_crm_read",
    },
    {
      ...capability(
        "neon_crm_manage",
        "Manage nonprofit CRM data",
        `Use all ${NEON_CRM_MANAGE_OPERATION_IDS.length} documented mutations in Neon CRM API v2.11.`,
        true,
      ),
      platformCapability: "neon_crm_manage",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "NEON_CRM_ORG_ID",
        label: "Neon CRM Organization ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Copy the Organization ID from Settings, Organization Profile. Relay stores it with the API key and uses it only as the HTTP Basic username for api.neoncrm.com.",
      },
      {
        name: "NEON_CRM_API_KEY",
        label: "Neon CRM API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Create a dedicated least-privilege system user, enable API Access, and copy its API key. Relay encrypts it and uses it only as the HTTP Basic password for api.neoncrm.com.",
      },
    ],
  },
  tools: [
    {
      name: "neonCrm.read",
      functionName: "neon_crm_read",
      aliases: ["neonCrm.read", "neon_crm_read"],
      capability: "neon_crm_read",
      platformCapability: "neon_crm_read",
      action: "read",
      approvalRequired: false,
      description:
        "Run one pinned semantic read from Neon CRM's complete official API v2.11 contract.",
      inputSchema: {
        type: "object",
        properties: {
          operation: {
            type: "string",
            enum: [...NEON_CRM_READ_OPERATION_IDS],
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
      name: "neonCrm.manage",
      functionName: "neon_crm_manage",
      aliases: ["neonCrm.manage", "neon_crm_manage"],
      capability: "neon_crm_manage",
      platformCapability: "neon_crm_manage",
      action: "write",
      approvalRequired: true,
      description:
        "Run one pinned Neon CRM mutation from the official API v2.11 contract; Safe mode requires approval.",
      inputSchema: {
        type: "object",
        properties: {
          operation: {
            type: "string",
            enum: [...NEON_CRM_MANAGE_OPERATION_IDS],
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
      id: "neon_crm_safe",
      label: "Safe",
      description: `All ${NEON_CRM_READ_OPERATION_IDS.length} semantic reads run directly; all ${NEON_CRM_MANAGE_OPERATION_IDS.length} mutations require approval.`,
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [manage],
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description: `All ${NEON_CRM_OPERATIONS.length} selected API v2.11 operations run without Relay per-action approval; connection ownership, fixed routes, audits, bounds, user permissions and provider limits still apply.`,
      defaultSelected: false,
      allowedActions: [read, manage],
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    {
      id: "org_id_api_key_and_user",
      label: "Neon CRM Organization ID, API key and current system-user check",
    },
  ],
};
