import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import {
  ATTENTIVE_MANAGE_OPERATION_IDS,
  ATTENTIVE_OPERATIONS,
  ATTENTIVE_SAFE_READ_OPERATION_IDS,
  ATTENTIVE_SENSITIVE_READ_OPERATION_IDS,
} from "./attentive-operation-registry";

const structuralRead = action(
  "attentive_structural_read",
  "Read Attentive structure",
  "Read company binding, webhook structure, catalog ingestion, bounded segments, and redacted bulk-job status.",
);
const sensitiveRead = action(
  "attentive_sensitive_read",
  "Read subscriber or privacy data",
  "Read one user's attributes or subscription eligibility, or one privacy-delete request; approval is required.",
);
const manage = action(
  "attentive_manage",
  "Manage Attentive",
  "Create events, subscriptions, attributes, identifiers, catalogs, webhooks, segments, bulk jobs, or privacy requests; approval is required.",
);
const blocks = [
  blocked(
    "attentive_secret_exposure",
    "Expose credentials",
    "Private-app API keys and authorization headers never enter agent-visible inputs or results.",
  ),
  blocked(
    "attentive_legacy_api",
    "Use legacy messaging APIs",
    "Legacy direct SMS/MMS and legacy subscriber endpoints use separate tokens and remain outside this connector.",
  ),
  blocked(
    "attentive_bulk_download",
    "Download bulk results",
    "Bulk-job download URLs and result files can contain personal data and are redacted and blocked.",
  ),
  blocked(
    "attentive_unbounded_api",
    "Use arbitrary or unbounded APIs",
    "Only 32 published v1/v2 operations run; arbitrary paths, headers, origins, pagination loops, and oversized transfers are blocked.",
  ),
];

export const ATTENTIVE_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "attentive",
  name: "Attentive",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://docs.attentive.com/docs/introduction",
  providerWebsiteUrl: "https://www.attentive.com/",
  capabilities: [
    {
      ...capability(
        "structural_read",
        "Read account structure",
        "Use eight bounded non-subscriber reads across account, webhook, catalog, segment, and job metadata.",
        true,
      ),
      platformCapability: "attentive_structural_read",
    },
    {
      ...capability(
        "sensitive_read",
        "Read subscriber data",
        "Use three exact subscriber, subscription, and privacy-request reads with approval.",
        false,
      ),
      platformCapability: "attentive_sensitive_read",
    },
    {
      ...capability(
        "manage",
        "Manage messaging data",
        "Use all 21 published mutations for events, subscriptions, attributes, identity, catalogs, webhooks, privacy, bulk operations, and segments.",
        false,
      ),
      platformCapability: "attentive_manage",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "ATTENTIVE_API_KEY",
        label: "Attentive private-app API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Create a dedicated private custom app with only the selected API permissions and store its one-time API key in Relay.",
      },
    ],
  },
  tools: [
    tool(
      "attentive.read",
      "attentive_read",
      "structural_read",
      "attentive_structural_read",
      "read",
      false,
      ATTENTIVE_SAFE_READ_OPERATION_IDS,
    ),
    tool(
      "attentive.readSensitive",
      "attentive_read_sensitive",
      "sensitive_read",
      "attentive_sensitive_read",
      "read",
      true,
      ATTENTIVE_SENSITIVE_READ_OPERATION_IDS,
    ),
    tool(
      "attentive.manage",
      "attentive_manage",
      "manage",
      "attentive_manage",
      "write",
      true,
      ATTENTIVE_MANAGE_OPERATION_IDS,
    ),
  ],
  approvalProfiles: [
    {
      id: "attentive_safe",
      label: "Safe",
      description:
        "Eight structural reads run directly; all subscriber/privacy reads and mutations require approval.",
      defaultSelected: true,
      allowedActions: [structuralRead],
      approvalRequiredActions: [sensitiveRead, manage],
      blockedActions: blocks,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description: `All ${ATTENTIVE_OPERATIONS.length} selected and private-app-authorized operations run without Relay per-action approval; fixed routes, bounds, redaction, audits, provider permissions, and legacy/download blocks remain enforced.`,
      defaultSelected: false,
      allowedActions: [structuralRead, sensitiveRead, manage],
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
  ],
  healthChecks: [
    { id: "me", label: "Attentive private-app key and exact company binding" },
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
      "Run one pinned Attentive v1/v2 operation with bounded input and output.",
    inputSchema: {
      type: "object",
      properties: {
        operation: { type: "string", enum: operations },
        pathParams: { type: "object", maxProperties: 2 },
        query: { type: "object", maxProperties: 5 },
        body: { type: "object", maxProperties: 200 },
        approvalId: { type: "string", maxLength: 200 },
      },
      required: ["operation"],
      additionalProperties: false,
    },
  };
}
