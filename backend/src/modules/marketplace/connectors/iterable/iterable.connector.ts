import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import {
  ITERABLE_MANAGE_OPERATION_IDS,
  ITERABLE_OPERATIONS,
  ITERABLE_SAFE_READ_OPERATION_IDS,
  ITERABLE_SENSITIVE_READ_OPERATION_IDS,
} from "./iterable-operation-registry";

const structure = action(
  "iterable_structural_read",
  "Read Iterable structure",
  "Read bounded campaign, channel, experiment, journey, list, message-type, snippet, template, field, and webhook metadata.",
);
const sensitive = action(
  "iterable_sensitive_read",
  "Read Iterable users and metrics",
  "Read bounded campaign/experiment metrics and user, event, list-membership, and sent-message data with approval.",
);
const manage = action(
  "iterable_manage",
  "Manage Iterable engagement",
  "Track events and commerce, update users and subscriptions, send or cancel messages, and trigger journeys with approval.",
);
const blocks = [
  blocked(
    "iterable_secret_exposure",
    "Expose credentials",
    "Server/client API keys, JWTs, authorization headers, and secrets never enter agent-visible inputs or results.",
  ),
  blocked(
    "iterable_destructive_admin",
    "Delete or forget data",
    "User forgetting/deletion, catalog/list/template/metadata deletion, key management, and other destructive administration are not agent-facing.",
  ),
  blocked(
    "iterable_exports_bulk",
    "Export or bulk-transfer data",
    "CSV/JSON exports, export jobs/files, bulk user/event/template operations, and unbounded pagination are excluded.",
  ),
  blocked(
    "iterable_unbounded_api",
    "Use arbitrary APIs",
    "Only 39 pinned REST operations run on the configured US or EU origin; arbitrary paths, origins, headers, and query/body API keys are blocked.",
  ),
];

export const ITERABLE_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "iterable",
  name: "Iterable",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://support.iterable.com/hc/en-us/articles/41044692130196-Getting-Started-with-Iterable-s-API",
  providerWebsiteUrl: "https://iterable.com/",
  capabilities: [
    {
      ...capability(
        "structural_read",
        "Read project structure",
        "Use 15 bounded project metadata reads.",
        true,
      ),
      platformCapability: "iterable_structural_read",
    },
    {
      ...capability(
        "sensitive_read",
        "Read users and metrics",
        "Use eight bounded user, event, membership, message, and metrics reads with approval.",
        false,
      ),
      platformCapability: "iterable_sensitive_read",
    },
    {
      ...capability(
        "manage",
        "Manage engagement",
        "Use 16 event, commerce, user, subscription, message, cancellation, and journey mutations with approval.",
        false,
      ),
      platformCapability: "iterable_manage",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "ITERABLE_SERVER_API_KEY",
        label: "Iterable server-side API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Use a dedicated server-side key for the exact Iterable project; a read-only key is insufficient for manage tools.",
      },
      {
        name: "ITERABLE_REGION",
        label: "Iterable data center",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Set to us for USDC or eu for EDC; Relay maps this enum to a fixed Iterable origin.",
      },
    ],
  },
  tools: [
    tool(
      "iterable.read",
      "iterable_read",
      "structural_read",
      "iterable_structural_read",
      "read",
      false,
      ITERABLE_SAFE_READ_OPERATION_IDS,
    ),
    tool(
      "iterable.readSensitive",
      "iterable_read_sensitive",
      "sensitive_read",
      "iterable_sensitive_read",
      "read",
      true,
      ITERABLE_SENSITIVE_READ_OPERATION_IDS,
    ),
    tool(
      "iterable.manage",
      "iterable_manage",
      "manage",
      "iterable_manage",
      "write",
      true,
      ITERABLE_MANAGE_OPERATION_IDS,
    ),
  ],
  approvalProfiles: [
    {
      id: "iterable_safe",
      label: "Safe",
      description:
        "Fifteen structural reads run directly; eight user/metrics reads and all 16 mutations require approval.",
      defaultSelected: true,
      allowedActions: [structure],
      approvalRequiredActions: [sensitive, manage],
      blockedActions: blocks,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description: `All ${ITERABLE_OPERATIONS.length} selected and project-authorized operations run without Relay per-action approval; fixed data-center routing, bounds, audits, and secret/destructive/export blocks remain enforced.`,
      defaultSelected: false,
      allowedActions: [structure, sensitive, manage],
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
  ],
  healthChecks: [
    {
      id: "channels",
      label: "Iterable API key and exact project/data-center binding",
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
      "Run one pinned Iterable REST operation with bounded input and output.",
    inputSchema: {
      type: "object",
      properties: {
        operation: { type: "string", enum: operations },
        pathParams: { type: "object", maxProperties: 1 },
        query: { type: "object", maxProperties: 8 },
        body: { type: "object", maxProperties: 100 },
        approvalId: { type: "string", maxLength: 200 },
      },
      required: ["operation"],
      additionalProperties: false,
    },
  };
}
