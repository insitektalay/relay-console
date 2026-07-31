import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import {
  EMARSYS_MANAGE_OPERATION_IDS,
  EMARSYS_OPERATIONS,
  EMARSYS_SENSITIVE_READ_OPERATION_IDS,
  EMARSYS_STRUCTURAL_READ_OPERATION_IDS,
} from "./emarsys-operation-registry";

const structure = action(
  "emarsys_structural_read",
  "Read Emarsys fields and categories",
  "Read bounded account field definitions or email campaign categories from fixed v3 routes.",
);
const sensitive = action(
  "emarsys_sensitive_read",
  "Read Emarsys campaign or contact",
  "Read one exact email campaign without raw content or look up one contact by email with approval.",
);
const manage = action(
  "emarsys_manage",
  "Create or update one Emarsys contact",
  "Create or update one authorized email contact with explicit opt-in state and approval.",
);
const blocks = [
  blocked(
    "emarsys_secret_exposure",
    "Expose credentials",
    "Client credentials, access tokens, authorization headers, and credential-bearing response fields never enter agent-visible inputs or results.",
  ),
  blocked(
    "emarsys_bulk_export",
    "Run bulk or export APIs",
    "Batch contact operations, exports, imports, response streams, relational data, Open Data, and unbounded reads are excluded.",
  ),
  blocked(
    "emarsys_send_admin",
    "Send or administer campaigns",
    "Campaign launch, transactional/event triggers, content/templates, lists/segments, automations, SMS, loyalty, vouchers, keys/users, and destructive operations remain provider-side.",
  ),
  blocked(
    "emarsys_unbounded_api",
    "Use arbitrary APIs",
    "Only six pinned v3 routes run on fixed API/token origins; arbitrary paths, URLs, methods, headers, dynamic fields, raw campaign content, and oversized results are blocked.",
  ),
];

export const EMARSYS_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "emarsys",
  name: "Emarsys",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://dev.emarsys.com/",
  providerWebsiteUrl: "https://emarsys.com/",
  capabilities: [
    {
      ...capability(
        "structural_read",
        "Read fields and categories",
        "Use two bounded account-configuration reads.",
        true,
      ),
      platformCapability: "emarsys_structural_read",
    },
    {
      ...capability(
        "sensitive_read",
        "Read campaign or contact",
        "Use one exact non-raw campaign read and one exact email contact lookup with approval.",
        false,
      ),
      platformCapability: "emarsys_sensitive_read",
    },
    {
      ...capability(
        "manage",
        "Manage one contact",
        "Use two one-contact writes with approval, authorization, and double-opt-in enforcement.",
        false,
      ),
      platformCapability: "emarsys_manage",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "EMARSYS_CLIENT_ID",
        label: "Emarsys OAuth client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Use a dedicated customer-owned least-privilege API user client ID.",
      },
      {
        name: "EMARSYS_CLIENT_SECRET",
        label: "Emarsys OAuth client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Relay exchanges this customer-owned secret at the fixed Emarsys token endpoint and never exposes it to agents.",
      },
    ],
  },
  tools: [
    tool(
      "emarsys.read",
      "emarsys_read",
      "structural_read",
      "emarsys_structural_read",
      "read",
      false,
      EMARSYS_STRUCTURAL_READ_OPERATION_IDS,
    ),
    tool(
      "emarsys.readSensitive",
      "emarsys_read_sensitive",
      "sensitive_read",
      "emarsys_sensitive_read",
      "read",
      true,
      EMARSYS_SENSITIVE_READ_OPERATION_IDS,
    ),
    tool(
      "emarsys.manage",
      "emarsys_manage",
      "manage",
      "emarsys_manage",
      "write",
      true,
      EMARSYS_MANAGE_OPERATION_IDS,
    ),
  ],
  approvalProfiles: [
    {
      id: "emarsys_safe",
      label: "Safe",
      description:
        "Field/category reads run directly; exact campaign/contact reads and both one-contact writes require approval, writes require contact authorization, and opt-in=true additionally requires recorded double-opt-in evidence.",
      defaultSelected: true,
      allowedActions: [structure],
      approvalRequiredActions: [sensitive, manage],
      blockedActions: blocks,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description: `All ${EMARSYS_OPERATIONS.length} selected operations run without Relay per-action approval; contact/double-opt-in attestations, fixed routing, allowlists, bounds, audits, and bulk/send/admin blocks remain enforced.`,
      defaultSelected: false,
      allowedActions: [structure, sensitive, manage],
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
  ],
  healthChecks: [
    {
      id: "available_fields",
      label: "Emarsys client-credentials and v3 field access",
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
      "Run one pinned Emarsys v3 operation through fixed OAuth/API origins with bounded input and JSON output.",
    inputSchema: {
      type: "object",
      properties: {
        operation: { type: "string", enum: operations },
        emailId: { type: "integer", minimum: 1 },
        email: { type: "string", format: "email", maxLength: 320 },
        firstName: { type: "string", maxLength: 200 },
        lastName: { type: "string", maxLength: 200 },
        optIn: { type: "boolean" },
        consentAttestation: { type: "boolean" },
        doubleOptInAttestation: { type: "boolean" },
        approvalId: { type: "string", maxLength: 200 },
      },
      required: ["operation"],
      additionalProperties: false,
    },
  };
}
