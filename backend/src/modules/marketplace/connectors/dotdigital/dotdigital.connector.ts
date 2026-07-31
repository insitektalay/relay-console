import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import {
  DOTDIGITAL_MANAGE_OPERATION_IDS,
  DOTDIGITAL_OPERATIONS,
  DOTDIGITAL_SENSITIVE_READ_OPERATION_IDS,
  DOTDIGITAL_STRUCTURAL_READ_OPERATION_IDS,
} from "./dotdigital-operation-registry";

const structure = action(
  "dotdigital_structural_read",
  "Read Dotdigital address books",
  "Read a bounded address-book inventory or one exact address book.",
);
const sensitive = action(
  "dotdigital_sensitive_read",
  "Read Dotdigital contact",
  "Read one exact email contact with approval.",
);
const manage = action(
  "dotdigital_manage",
  "Manage Dotdigital contact",
  "Update one authorized contact's email subscription state with approval.",
);
const blocks = [
  blocked(
    "dotdigital_secret_exposure",
    "Expose credentials",
    "API credentials, Basic authorization, and credential-bearing fields never enter agent-visible inputs or results.",
  ),
  blocked(
    "dotdigital_bulk_transfer",
    "Run bulk transfers",
    "Contact collections, imports, exports, bulk deletes, suppression downloads, and unbounded address-book traversal are excluded.",
  ),
  blocked(
    "dotdigital_send_admin",
    "Send or administer campaigns",
    "Campaign sends, programs, transactional email, SMS, WhatsApp, Insight data, preferences, address-book mutations, and contact deletes remain provider-side.",
  ),
  blocked(
    "dotdigital_unbounded_api",
    "Use arbitrary APIs",
    "Only four pinned v2/v3 routes run after fixed regional discovery; arbitrary origins, paths, queries, fields, headers, resubscribe overrides, and oversized results are blocked.",
  ),
];

export const DOTDIGITAL_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "dotdigital",
  name: "Dotdigital",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developer.dotdigital.com/",
  providerWebsiteUrl: "https://dotdigital.com/",
  capabilities: [
    {
      ...capability(
        "structural_read",
        "Read address books",
        "Use bounded address-book inventory and exact-address-book reads.",
        true,
      ),
      platformCapability: "dotdigital_structural_read",
    },
    {
      ...capability(
        "sensitive_read",
        "Read contact",
        "Use one exact email-contact lookup with approval.",
        false,
      ),
      platformCapability: "dotdigital_sensitive_read",
    },
    {
      ...capability(
        "manage",
        "Manage one contact",
        "Use one contact subscription-state update with approval and consent enforcement.",
        false,
      ),
      platformCapability: "dotdigital_manage",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "DOTDIGITAL_API_USERNAME",
        label: "Dotdigital API username",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Use a dedicated customer-owned API user with least-privilege address-book and contact access.",
      },
      {
        name: "DOTDIGITAL_API_PASSWORD",
        label: "Dotdigital API password",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Relay uses this only for Basic authentication to the fixed discovery and allowlisted regional API origins.",
      },
    ],
  },
  tools: [
    tool(
      "dotdigital.read",
      "dotdigital_read",
      "structural_read",
      "dotdigital_structural_read",
      "read",
      false,
      DOTDIGITAL_STRUCTURAL_READ_OPERATION_IDS,
    ),
    tool(
      "dotdigital.readSensitive",
      "dotdigital_read_sensitive",
      "sensitive_read",
      "dotdigital_sensitive_read",
      "read",
      true,
      DOTDIGITAL_SENSITIVE_READ_OPERATION_IDS,
    ),
    tool(
      "dotdigital.manage",
      "dotdigital_manage",
      "manage",
      "dotdigital_manage",
      "write",
      true,
      DOTDIGITAL_MANAGE_OPERATION_IDS,
    ),
  ],
  approvalProfiles: [
    {
      id: "dotdigital_safe",
      label: "Safe",
      description:
        "Bounded address-book reads run directly; exact contact reads and one-contact writes require approval, writes require contact authorization, and subscription additionally requires double-opt-in evidence.",
      defaultSelected: true,
      allowedActions: [structure],
      approvalRequiredActions: [sensitive, manage],
      blockedActions: blocks,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description: `All ${DOTDIGITAL_OPERATIONS.length} selected operations run without Relay per-action approval; authorization/double-opt-in attestations, fixed regional routing, bounds, audits, and bulk/send/admin blocks remain enforced.`,
      defaultSelected: false,
      allowedActions: [structure, sensitive, manage],
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
  ],
  healthChecks: [
    {
      id: "account_region",
      label: "Dotdigital credentials and regional endpoint discovery",
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
      "Run one pinned Dotdigital v2/v3 operation through fixed regional discovery with bounded JSON.",
    inputSchema: {
      type: "object",
      properties: {
        operation: { type: "string", enum: operations },
        addressBookId: { type: "integer", minimum: 1 },
        email: { type: "string", format: "email", maxLength: 320 },
        select: { type: "integer", minimum: 1, maximum: 50 },
        skip: { type: "integer", minimum: 0, maximum: 5000 },
        emailStatus: {
          type: "string",
          enum: ["subscribed", "unsubscribed"],
        },
        consentAttestation: { type: "boolean" },
        doubleOptInAttestation: { type: "boolean" },
        approvalId: { type: "string", maxLength: 200 },
      },
      required: ["operation"],
      additionalProperties: false,
    },
  };
}
