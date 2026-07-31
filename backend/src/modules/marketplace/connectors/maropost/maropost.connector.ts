import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import {
  MAROPOST_MANAGE_OPERATION_IDS,
  MAROPOST_OPERATIONS,
  MAROPOST_SENSITIVE_READ_OPERATION_IDS,
  MAROPOST_STRUCTURAL_READ_OPERATION_IDS,
} from "./maropost-operation-registry";

const structure = action(
  "maropost_structural_read",
  "List Maropost campaigns",
  "List one bounded page of campaign metadata from the account's documented regional API origin.",
);
const sensitive = action(
  "maropost_sensitive_read",
  "Read Maropost campaign or contact",
  "Read one exact campaign or one exact contact lookup with approval.",
);
const manage = action(
  "maropost_manage",
  "Manage Maropost list contacts",
  "Upsert or update one authorized email contact in one exact list with explicit subscription state and approval.",
);
const blocks = [
  blocked(
    "maropost_secret_exposure",
    "Expose credentials",
    "Account IDs, API keys, authorization headers, and credential-bearing response fields never enter agent-visible inputs or results.",
  ),
  blocked(
    "maropost_bulk_streaming",
    "Run bulk or streaming APIs",
    "GraphQL, streaming, Data Journeys, imports, exports, relational tables, reports containing recipient events, and unbounded pagination are excluded.",
  ),
  blocked(
    "maropost_campaign_admin",
    "Send or administer campaigns",
    "Campaign/content/list creation, sending, deletion, journey control, SMS/push, suppression removal, account/key administration, and remote content URLs remain provider-side.",
  ),
  blocked(
    "maropost_unbounded_api",
    "Use arbitrary APIs",
    "Only five pinned REST routes run on account-derived documented regional origins; arbitrary URLs, methods, headers, query fields, bodies, and oversized results are blocked.",
  ),
];

export const MAROPOST_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "maropost",
  name: "Maropost",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://api.maropost.com/api/",
  providerWebsiteUrl: "https://www.maropost.com/",
  capabilities: [
    {
      ...capability(
        "structural_read",
        "List campaigns",
        "Use one bounded page of campaign metadata.",
        true,
      ),
      platformCapability: "maropost_structural_read",
    },
    {
      ...capability(
        "sensitive_read",
        "Read campaign or contact",
        "Use one exact campaign read and one email contact lookup with approval.",
        false,
      ),
      platformCapability: "maropost_sensitive_read",
    },
    {
      ...capability(
        "manage",
        "Manage list contacts",
        "Use two single-contact list writes with approval and contact authorization attestation.",
        false,
      ),
      platformCapability: "maropost_manage",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "MAROPOST_ACCOUNT_ID",
        label: "Maropost account ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Use the exact customer-owned Marketing Cloud account ID; Relay derives the documented regional API origin from it.",
      },
      {
        name: "MAROPOST_API_KEY",
        label: "Maropost API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Use a dedicated least-privilege customer-owned key, optionally restricted to Railway staging egress IPs.",
      },
    ],
  },
  tools: [
    tool(
      "maropost.read",
      "maropost_read",
      "structural_read",
      "maropost_structural_read",
      "read",
      false,
      MAROPOST_STRUCTURAL_READ_OPERATION_IDS,
    ),
    tool(
      "maropost.readSensitive",
      "maropost_read_sensitive",
      "sensitive_read",
      "maropost_sensitive_read",
      "read",
      true,
      MAROPOST_SENSITIVE_READ_OPERATION_IDS,
    ),
    tool(
      "maropost.manage",
      "maropost_manage",
      "manage",
      "maropost_manage",
      "write",
      true,
      MAROPOST_MANAGE_OPERATION_IDS,
    ),
  ],
  approvalProfiles: [
    {
      id: "maropost_safe",
      label: "Safe",
      description:
        "One bounded campaign listing runs directly; exact campaign/contact reads and both single-contact writes require approval, and writes also require explicit recorded contact authorization.",
      defaultSelected: true,
      allowedActions: [structure],
      approvalRequiredActions: [sensitive, manage],
      blockedActions: blocks,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description: `All ${MAROPOST_OPERATIONS.length} selected operations run without Relay per-action approval; contact authorization, fixed regional routing, allowlists, bounds, audits, and bulk/send/admin blocks remain enforced.`,
      defaultSelected: false,
      allowedActions: [structure, sensitive, manage],
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
  ],
  healthChecks: [
    {
      id: "campaign_listing",
      label: "Maropost account-region and API-key binding",
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
      "Run one pinned Maropost Marketing Cloud REST operation with regional routing and bounded JSON input/output.",
    inputSchema: {
      type: "object",
      properties: {
        operation: { type: "string", enum: operations },
        path: { type: "object", maxProperties: 2 },
        query: { type: "object", maxProperties: 4 },
        contact: { type: "object", maxProperties: 5 },
        consentAttestation: { type: "boolean" },
        approvalId: { type: "string", maxLength: 200 },
      },
      required: ["operation"],
      additionalProperties: false,
    },
  };
}
