import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import {
  ADOBE_REAL_TIME_CDP_OPERATIONS,
  ADOBE_REAL_TIME_CDP_SENSITIVE_READ_OPERATION_IDS,
  ADOBE_REAL_TIME_CDP_STRUCTURAL_READ_OPERATION_IDS,
} from "./adobe-real-time-cdp-operation-registry";

const structure = action(
  "adobe_real_time_cdp_structural_read",
  "Read Adobe dataset metadata",
  "List at most twenty bounded dataset metadata records.",
);
const sensitive = action(
  "adobe_real_time_cdp_sensitive_read",
  "Read Adobe audiences or profile",
  "List bounded audience definitions or retrieve one exact profile with approval.",
);
const blocks = [
  blocked(
    "adobe_real_time_cdp_secret_exposure",
    "Expose credentials",
    "OAuth credentials, IMS tokens, organization and sandbox routing headers, and credential-bearing fields never enter agent-visible inputs or results.",
  ),
  blocked(
    "adobe_real_time_cdp_bulk_transfer",
    "Run bulk transfers",
    "Exports, destinations, ingestion, batches, files, pagination beyond the selected offset, multi-profile access, events, and responses above 1 MB are excluded.",
  ),
  blocked(
    "adobe_real_time_cdp_mutation_admin",
    "Mutate or administer Platform",
    "Dataset, schema, profile, audience, identity, destination, source, policy, sandbox, permission, user, and project mutations remain provider-side.",
  ),
  blocked(
    "adobe_real_time_cdp_arbitrary_api",
    "Use arbitrary APIs",
    "Only three pinned GET routes run on platform.adobe.io with fixed headers and bounds; arbitrary origins, paths, headers, queries, fields, and raw APIs are blocked.",
  ),
];

export const ADOBE_REAL_TIME_CDP_CONNECTOR_MANIFEST: MarketplaceConnectorManifest =
  {
    slug: "adobe-real-time-cdp",
    name: "Adobe Real-Time CDP",
    connectorType: "native_clawchat",
    providerDocsUrl:
      "https://experienceleague.adobe.com/en/docs/experience-platform/profile/api/overview",
    providerWebsiteUrl:
      "https://business.adobe.com/products/real-time-customer-data-platform/rtcdp.html",
    capabilities: [
      {
        ...capability(
          "structural_read",
          "Read datasets",
          "List bounded dataset metadata.",
          true,
        ),
        platformCapability: "adobe_real_time_cdp_structural_read",
      },
      {
        ...capability(
          "sensitive_read",
          "Read audiences and profiles",
          "List audience definitions or retrieve one exact profile with approval.",
          false,
        ),
        platformCapability: "adobe_real_time_cdp_sensitive_read",
      },
    ],
    auth: {
      type: "api_key",
      credentialSchema: [
        {
          name: "ADOBE_REAL_TIME_CDP_CLIENT_ID",
          label: "Adobe OAuth client ID",
          required: true,
          secret: false,
          storedIn: "metadata",
          helpText:
            "Use a dedicated customer-owned OAuth Server-to-Server credential.",
        },
        {
          name: "ADOBE_REAL_TIME_CDP_CLIENT_SECRET",
          label: "Adobe OAuth client secret",
          required: true,
          secret: true,
          storedIn: "encrypted_secret",
          helpText:
            "Relay sends this only to Adobe's fixed IMS token endpoint.",
        },
        {
          name: "ADOBE_REAL_TIME_CDP_SCOPES",
          label: "Adobe OAuth scopes",
          required: true,
          secret: false,
          storedIn: "metadata",
          helpText:
            "Copy the least-privilege scopes assigned to the server-to-server credential.",
        },
        {
          name: "ADOBE_REAL_TIME_CDP_ORGANIZATION_ID",
          label: "Adobe organization ID",
          required: true,
          secret: false,
          storedIn: "metadata",
          helpText: "Use the exact organization ID ending in @AdobeOrg.",
        },
        {
          name: "ADOBE_REAL_TIME_CDP_SANDBOX_NAME",
          label: "Adobe sandbox name",
          required: true,
          secret: false,
          storedIn: "metadata",
          helpText: "Use one exact non-production sandbox binding.",
        },
      ],
    },
    tools: [
      tool(
        "adobe-real-time-cdp.readStructure",
        "adobe_real_time_cdp_read_structure",
        "structural_read",
        "adobe_real_time_cdp_structural_read",
        false,
        ADOBE_REAL_TIME_CDP_STRUCTURAL_READ_OPERATION_IDS,
      ),
      tool(
        "adobe-real-time-cdp.readSensitive",
        "adobe_real_time_cdp_read_sensitive",
        "sensitive_read",
        "adobe_real_time_cdp_sensitive_read",
        true,
        ADOBE_REAL_TIME_CDP_SENSITIVE_READ_OPERATION_IDS,
      ),
    ],
    approvalProfiles: [
      {
        id: "adobe_real_time_cdp_safe",
        label: "Safe",
        description:
          "Bounded dataset metadata runs directly; audience definitions and one exact profile require approval while org, sandbox, field, page, and response bounds remain enforced.",
        defaultSelected: true,
        allowedActions: [structure],
        approvalRequiredActions: [sensitive],
        blockedActions: blocks,
      },
      {
        id: "dangerously_skip_permissions",
        label: "Dangerously skip permissions",
        description: `All ${ADOBE_REAL_TIME_CDP_OPERATIONS.length} selected reads run without Relay per-action approval; fixed IMS/API origins, exact org/sandbox binding, list/profile/field/response bounds, audits, and mutation/admin/bulk blocks remain enforced.`,
        defaultSelected: false,
        allowedActions: [structure, sensitive],
        approvalRequiredActions: [],
        blockedActions: blocks,
      },
    ],
    healthChecks: [
      {
        id: "ims_token_exchange",
        label: "Adobe IMS server-to-server token exchange",
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
      "Run one pinned Adobe Experience Platform GET route with exact organization and sandbox binding and bounded JSON.",
    inputSchema: {
      type: "object",
      properties: {
        operation: { type: "string", enum: operations },
        start: { type: "integer", minimum: 0, maximum: 10_000 },
        entityId: { type: "string", minLength: 1, maxLength: 500 },
        entityIdNamespace: {
          type: "string",
          pattern: "^[A-Za-z0-9@._:-]{1,100}$",
        },
        fields: {
          type: "array",
          minItems: 1,
          maxItems: 4,
          uniqueItems: true,
          items: {
            type: "string",
            enum: ["identities", "person.name", "personalEmail", "workEmail"],
          },
        },
        approvalId: { type: "string", maxLength: 200 },
      },
      required: ["operation"],
      additionalProperties: false,
    },
  };
}
