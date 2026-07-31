import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import {
  SALESFORCE_DATA_CLOUD_OPERATIONS,
  SALESFORCE_DATA_CLOUD_SENSITIVE_READ_OPERATION_IDS,
  SALESFORCE_DATA_CLOUD_STRUCTURAL_READ_OPERATION_IDS,
} from "./salesforce-data-cloud-operation-registry";

const structure = action(
  "salesforce_data_cloud_structural_read",
  "Read Data Cloud query metadata",
  "Read the output schema for one exact existing query.",
);
const sensitive = action(
  "salesforce_data_cloud_sensitive_read",
  "Query Data Cloud data",
  "Submit, monitor, or retrieve one bounded Data Cloud query with approval.",
);
const blocks = [
  blocked(
    "salesforce_data_cloud_secret_exposure",
    "Expose credentials",
    "Client credentials, core and Data Cloud tokens, authorization headers, and credential-bearing fields never enter agent-visible inputs or results.",
  ),
  blocked(
    "salesforce_data_cloud_bulk_transfer",
    "Run bulk transfers",
    "Wildcards, exports, ingestion, streams, chunks, bulk APIs, unbounded queries, responses above 1.25 MB, and more than 200 requested rows are excluded.",
  ),
  blocked(
    "salesforce_data_cloud_mutation_admin",
    "Mutate or administer Data Cloud",
    "Ingestion, profile writes, activation, segmentation, modeling, identity resolution, metadata changes, query cancellation, permissions, users, apps, and tenant administration remain provider-side.",
  ),
  blocked(
    "salesforce_data_cloud_arbitrary_api",
    "Use arbitrary APIs",
    "Only four pinned Query API v3 routes run on the tenant origin returned by Salesforce; arbitrary origins, paths, headers, parameters, SQL forms, and legacy APIs are blocked.",
  ),
];

export const SALESFORCE_DATA_CLOUD_CONNECTOR_MANIFEST: MarketplaceConnectorManifest =
  {
    slug: "salesforce-data-cloud",
    name: "Salesforce Data Cloud",
    connectorType: "native_clawchat",
    providerDocsUrl:
      "https://developer.salesforce.com/docs/data/data-cloud-query-guide/references/data-cloud-query-api-reference",
    providerWebsiteUrl: "https://www.salesforce.com/data/",
    capabilities: [
      {
        ...capability(
          "structural_read",
          "Read query metadata",
          "Read one existing query's output schema.",
          true,
        ),
        platformCapability: "salesforce_data_cloud_structural_read",
      },
      {
        ...capability(
          "sensitive_read",
          "Query Data Cloud data",
          "Submit, monitor, and retrieve one bounded query with approval.",
          false,
        ),
        platformCapability: "salesforce_data_cloud_sensitive_read",
      },
    ],
    auth: {
      type: "api_key",
      credentialSchema: [
        {
          name: "SALESFORCE_DATA_CLOUD_CLIENT_ID",
          label: "Salesforce external client app ID",
          required: true,
          secret: false,
          storedIn: "metadata",
          helpText:
            "Use a dedicated customer-owned External Client App with api and cdp_query_api only.",
        },
        {
          name: "SALESFORCE_DATA_CLOUD_CLIENT_SECRET",
          label: "Salesforce external client app secret",
          required: true,
          secret: true,
          storedIn: "encrypted_secret",
          helpText:
            "Relay sends this only to the selected fixed Salesforce login origin.",
        },
        {
          name: "SALESFORCE_DATA_CLOUD_LOGIN_ENVIRONMENT",
          label: "Salesforce login environment",
          required: true,
          secret: false,
          storedIn: "metadata",
          helpText: "Enter exactly production or sandbox.",
        },
      ],
    },
    tools: [
      tool(
        "salesforce-data-cloud.readStructure",
        "salesforce_data_cloud_read_structure",
        "structural_read",
        "salesforce_data_cloud_structural_read",
        false,
        SALESFORCE_DATA_CLOUD_STRUCTURAL_READ_OPERATION_IDS,
      ),
      tool(
        "salesforce-data-cloud.readSensitive",
        "salesforce_data_cloud_read_sensitive",
        "sensitive_read",
        "salesforce_data_cloud_sensitive_read",
        true,
        SALESFORCE_DATA_CLOUD_SENSITIVE_READ_OPERATION_IDS,
      ),
    ],
    approvalProfiles: [
      {
        id: "salesforce_data_cloud_safe",
        label: "Safe",
        description:
          "One existing query's schema can be read directly; query submission, status, and bounded rows require approval while tenant, SQL, row, byte, and response bounds remain enforced.",
        defaultSelected: true,
        allowedActions: [structure],
        approvalRequiredActions: [sensitive],
        blockedActions: blocks,
      },
      {
        id: "dangerously_skip_permissions",
        label: "Dangerously skip permissions",
        description: `All ${SALESFORCE_DATA_CLOUD_OPERATIONS.length} selected reads run without Relay per-action approval; two-stage token exchange, exact tenant routing, SELECT-only SQL, row/byte/response bounds, audits, and mutation/admin/bulk blocks remain enforced.`,
        defaultSelected: false,
        allowedActions: [structure, sensitive],
        approvalRequiredActions: [],
        blockedActions: blocks,
      },
    ],
    healthChecks: [
      {
        id: "data_cloud_token_exchange",
        label: "Salesforce and Data Cloud token exchange",
      },
    ],
  };

function tool(
  name: string,
  functionName: string,
  capabilityId: string,
  platformCapability: string,
  approvalRequired: boolean,
  operations: string[],
) {
  return {
    name,
    functionName,
    aliases: [name, functionName],
    capability: capabilityId,
    platformCapability,
    action: "read" as const,
    approvalRequired,
    description:
      "Run one pinned Salesforce Data Cloud Query API v3 read on the verified tenant origin with bounded JSON.",
    inputSchema: {
      type: "object",
      properties: {
        operation: { type: "string", enum: operations },
        queryId: {
          type: "string",
          pattern: "^[A-Za-z0-9._~-]{1,300}$",
        },
        sql: { type: "string", minLength: 1, maxLength: 8_000 },
        rowLimit: { type: "integer", minimum: 1, maximum: 200 },
        offset: { type: "integer", minimum: 0, maximum: 1_000_000 },
        approvalId: { type: "string", maxLength: 200 },
      },
      required: ["operation"],
      additionalProperties: false,
    },
  };
}
