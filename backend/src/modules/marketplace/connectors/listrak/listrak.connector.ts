import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import {
  LISTRAK_MANAGE_OPERATION_IDS,
  LISTRAK_OPERATIONS,
  LISTRAK_SENSITIVE_READ_OPERATION_IDS,
  LISTRAK_STRUCTURAL_READ_OPERATION_IDS,
} from "./listrak-operation-registry";

const structure = action(
  "listrak_structural_read",
  "Read Listrak lists",
  "Read the account list inventory or one exact list configuration.",
);
const sensitive = action(
  "listrak_sensitive_read",
  "Read Listrak contact",
  "Read one exact email contact from one exact list with approval.",
);
const manage = action(
  "listrak_manage",
  "Manage Listrak contact",
  "Create or update one authorized contact with explicit subscription state and approval.",
);
const blocks = [
  blocked(
    "listrak_secret_exposure",
    "Expose credentials",
    "Client credentials, access tokens, authorization headers, and credential-bearing response fields never enter agent-visible inputs or results.",
  ),
  blocked(
    "listrak_bulk_import",
    "Run bulk or import APIs",
    "Contact collections, list imports, profile-field bulk updates, exports, clickers/activity, and unbounded transfers are excluded.",
  ),
  blocked(
    "listrak_send_admin",
    "Send or administer campaigns",
    "Message/transactional sends, campaigns, content, lists, events, conversations, saved audiences, profile-field administration, and deletes remain provider-side.",
  ),
  blocked(
    "listrak_unbounded_api",
    "Use arbitrary APIs",
    "Only four pinned Email v1 routes run on fixed token/API origins; unsubscribe overrides, arbitrary paths, queries, fields, URLs, headers, and oversized results are blocked.",
  ),
];

export const LISTRAK_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "listrak",
  name: "Listrak",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://api.listrak.com/email",
  providerWebsiteUrl: "https://www.listrak.com/",
  capabilities: [
    {
      ...capability(
        "structural_read",
        "Read lists",
        "Use the list inventory and exact-list configuration reads.",
        true,
      ),
      platformCapability: "listrak_structural_read",
    },
    {
      ...capability(
        "sensitive_read",
        "Read contact",
        "Use one exact list/contact lookup with approval.",
        false,
      ),
      platformCapability: "listrak_sensitive_read",
    },
    {
      ...capability(
        "manage",
        "Manage one contact",
        "Use one one-contact write with approval, authorization, and double-opt-in enforcement.",
        false,
      ),
      platformCapability: "listrak_manage",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "LISTRAK_CLIENT_ID",
        label: "Listrak client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Use a dedicated customer-owned Email REST integration with least-privilege List and Contact access.",
      },
      {
        name: "LISTRAK_CLIENT_SECRET",
        label: "Listrak client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Relay exchanges this only at the fixed Listrak token endpoint.",
      },
    ],
  },
  tools: [
    tool(
      "listrak.read",
      "listrak_read",
      "structural_read",
      "listrak_structural_read",
      "read",
      false,
      LISTRAK_STRUCTURAL_READ_OPERATION_IDS,
    ),
    tool(
      "listrak.readSensitive",
      "listrak_read_sensitive",
      "sensitive_read",
      "listrak_sensitive_read",
      "read",
      true,
      LISTRAK_SENSITIVE_READ_OPERATION_IDS,
    ),
    tool(
      "listrak.manage",
      "listrak_manage",
      "manage",
      "listrak_manage",
      "write",
      true,
      LISTRAK_MANAGE_OPERATION_IDS,
    ),
  ],
  approvalProfiles: [
    {
      id: "listrak_safe",
      label: "Safe",
      description:
        "List reads run directly; exact contact reads and one-contact writes require approval, writes require contact authorization, and subscription additionally requires double-opt-in evidence.",
      defaultSelected: true,
      allowedActions: [structure],
      approvalRequiredActions: [sensitive, manage],
      blockedActions: blocks,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description: `All ${LISTRAK_OPERATIONS.length} selected operations run without Relay per-action approval; authorization/double-opt-in attestations, fixed routing, bounds, audits, and bulk/send/admin blocks remain enforced.`,
      defaultSelected: false,
      allowedActions: [structure, sensitive, manage],
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
  ],
  healthChecks: [
    {
      id: "list_inventory",
      label: "Listrak client-credentials and List access",
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
      "Run one pinned Listrak Email v1 operation through fixed OAuth/API origins with bounded JSON.",
    inputSchema: {
      type: "object",
      properties: {
        operation: { type: "string", enum: operations },
        listId: { type: "integer", minimum: 1 },
        email: { type: "string", format: "email", maxLength: 320 },
        subscriptionState: {
          type: "string",
          enum: ["Subscribed", "Unsubscribed"],
        },
        externalContactId: { type: "string", maxLength: 200 },
        consentAttestation: { type: "boolean" },
        doubleOptInAttestation: { type: "boolean" },
        approvalId: { type: "string", maxLength: 200 },
      },
      required: ["operation"],
      additionalProperties: false,
    },
  };
}
