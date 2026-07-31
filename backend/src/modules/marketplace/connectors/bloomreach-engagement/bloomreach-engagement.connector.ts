import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import {
  BLOOMREACH_ENGAGEMENT_MANAGE_OPERATION_IDS,
  BLOOMREACH_ENGAGEMENT_OPERATIONS,
  BLOOMREACH_ENGAGEMENT_SENSITIVE_READ_OPERATION_IDS,
  BLOOMREACH_ENGAGEMENT_STRUCTURAL_READ_OPERATION_IDS,
} from "./bloomreach-engagement-operation-registry";
const structure = action(
  "bloomreach_engagement_structural_read",
  "Read Bloomreach Engagement catalogs",
  "Read the catalog inventory or one exact catalog name.",
);
const sensitive = action(
  "bloomreach_engagement_sensitive_read",
  "Read Bloomreach Engagement customer",
  "Read up to 20 named properties for one exact customer with approval.",
);
const manage = action(
  "bloomreach_engagement_manage",
  "Manage Bloomreach Engagement customer",
  "Update up to 20 non-consent properties for one authorized customer with approval.",
);
const blocks = [
  blocked(
    "bloomreach_engagement_secret_exposure",
    "Expose credentials",
    "Project tokens, private API credentials, Basic authorization, and credential-bearing fields never enter agent-visible inputs or results.",
  ),
  blocked(
    "bloomreach_engagement_bulk_transfer",
    "Run bulk transfers",
    "Batch commands, imports, exports, customer collections, catalog-item traversal, and mass data movement are excluded.",
  ),
  blocked(
    "bloomreach_engagement_send_admin",
    "Send or administer campaigns",
    "Email sends/campaigns, events, analyses, catalogs/items mutations, GDPR deletion/anonymization, consent, subscription, and access-key administration remain provider-side.",
  ),
  blocked(
    "bloomreach_engagement_unbounded_api",
    "Use arbitrary APIs",
    "Only four pinned routes run on the standard fixed API origin; custom origins, arbitrary paths, queries, headers, customer structures, and oversized results are blocked.",
  ),
];
export const BLOOMREACH_ENGAGEMENT_CONNECTOR_MANIFEST: MarketplaceConnectorManifest =
  {
    slug: "bloomreach-engagement",
    name: "Bloomreach Engagement",
    connectorType: "native_clawchat",
    providerDocsUrl:
      "https://documentation.bloomreach.com/engagement/reference/welcome",
    providerWebsiteUrl: "https://www.bloomreach.com/en/products/engagement",
    capabilities: [
      {
        ...capability(
          "structural_read",
          "Read catalogs",
          "Use catalog inventory and exact-catalog reads.",
          true,
        ),
        platformCapability: "bloomreach_engagement_structural_read",
      },
      {
        ...capability(
          "sensitive_read",
          "Read customer",
          "Read named properties for one exact customer with approval.",
          false,
        ),
        platformCapability: "bloomreach_engagement_sensitive_read",
      },
      {
        ...capability(
          "manage",
          "Manage one customer",
          "Update bounded non-consent properties for one authorized customer with approval.",
          false,
        ),
        platformCapability: "bloomreach_engagement_manage",
      },
    ],
    auth: {
      type: "api_key",
      credentialSchema: [
        {
          name: "BLOOMREACH_ENGAGEMENT_PROJECT_TOKEN",
          label: "Bloomreach Engagement project token",
          required: true,
          secret: false,
          storedIn: "metadata",
          helpText:
            "Use the project token bound to the dedicated private API group.",
        },
        {
          name: "BLOOMREACH_ENGAGEMENT_API_KEY_ID",
          label: "Bloomreach Engagement API key ID",
          required: true,
          secret: false,
          storedIn: "metadata",
          helpText:
            "Use a dedicated private API group with only catalog-read and customer property get/set permissions.",
        },
        {
          name: "BLOOMREACH_ENGAGEMENT_API_SECRET",
          label: "Bloomreach Engagement API secret",
          required: true,
          secret: true,
          storedIn: "encrypted_secret",
          helpText:
            "Relay uses this only for Basic authentication to the fixed standard API origin.",
        },
      ],
    },
    tools: [
      tool(
        "bloomreach-engagement.read",
        "bloomreach_engagement_read",
        "structural_read",
        "bloomreach_engagement_structural_read",
        "read",
        false,
        BLOOMREACH_ENGAGEMENT_STRUCTURAL_READ_OPERATION_IDS,
      ),
      tool(
        "bloomreach-engagement.readSensitive",
        "bloomreach_engagement_read_sensitive",
        "sensitive_read",
        "bloomreach_engagement_sensitive_read",
        "read",
        true,
        BLOOMREACH_ENGAGEMENT_SENSITIVE_READ_OPERATION_IDS,
      ),
      tool(
        "bloomreach-engagement.manage",
        "bloomreach_engagement_manage",
        "manage",
        "bloomreach_engagement_manage",
        "write",
        true,
        BLOOMREACH_ENGAGEMENT_MANAGE_OPERATION_IDS,
      ),
    ],
    approvalProfiles: [
      {
        id: "bloomreach_engagement_safe",
        label: "Safe",
        description:
          "Catalog reads run directly; exact customer-property reads and one-customer updates require approval, and writes require customer authorization while consent/subscription properties remain blocked.",
        defaultSelected: true,
        allowedActions: [structure],
        approvalRequiredActions: [sensitive, manage],
        blockedActions: blocks,
      },
      {
        id: "dangerously_skip_permissions",
        label: "Dangerously skip permissions",
        description: `All ${BLOOMREACH_ENGAGEMENT_OPERATIONS.length} selected operations run without Relay per-action approval; customer authorization, fixed routing, field/response bounds, audits, and bulk/send/admin/consent blocks remain enforced.`,
        defaultSelected: false,
        allowedActions: [structure, sensitive, manage],
        approvalRequiredActions: [],
        blockedActions: blocks,
      },
    ],
    healthChecks: [
      {
        id: "catalog_inventory",
        label: "Bloomreach Engagement credentials and catalog-list access",
      },
    ],
  };
function tool(
  name: string,
  functionName: string,
  capabilityId: string,
  platformCapability: string,
  actionType: "read" | "write",
  approvalRequired: boolean,
  operations: string[],
) {
  return {
    name,
    functionName,
    aliases: [name, functionName],
    capability: capabilityId,
    platformCapability,
    action: actionType,
    approvalRequired,
    description:
      "Run one pinned Bloomreach Engagement project API operation with bounded JSON.",
    inputSchema: {
      type: "object",
      properties: {
        operation: { type: "string", enum: operations },
        catalogId: { type: "string", maxLength: 200 },
        customerIds: {
          type: "object",
          minProperties: 1,
          maxProperties: 3,
          additionalProperties: { type: "string", maxLength: 500 },
        },
        propertyNames: {
          type: "array",
          minItems: 1,
          maxItems: 20,
          items: { type: "string", maxLength: 200 },
        },
        properties: {
          type: "object",
          minProperties: 1,
          maxProperties: 20,
          additionalProperties: { type: ["string", "number", "boolean"] },
        },
        consentAttestation: { type: "boolean" },
        approvalId: { type: "string", maxLength: 200 },
      },
      required: ["operation"],
      additionalProperties: false,
    },
  };
}
