import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import {
  ORTTO_MANAGE_OPERATION_IDS,
  ORTTO_OPERATIONS,
  ORTTO_SENSITIVE_READ_OPERATION_IDS,
  ORTTO_STRUCTURAL_READ_OPERATION_IDS,
} from "./ortto-operation-registry";

const structure = action(
  "ortto_structural_read",
  "Read Ortto structure",
  "Read bounded schema, audiences, custom fields, tags, campaign calendar, and report-list metadata.",
);
const sensitive = action(
  "ortto_sensitive_read",
  "Read Ortto customer and report data",
  "Read bounded people, accounts, subscriptions, campaign reports, and saved reports with approval.",
);
const manage = action(
  "ortto_manage",
  "Manage Ortto engagement",
  "Merge bounded people/accounts, update attested audience permissions, create activities, and send transactional email or push with approval.",
);
const blocks = [
  blocked(
    "ortto_secret_exposure",
    "Expose credentials",
    "Custom API keys, authorization headers, secrets, and credential-bearing URLs never enter agent-visible inputs or results.",
  ),
  blocked(
    "ortto_destructive_admin",
    "Delete or administer Ortto data",
    "Archive, restore, delete, suppression, email-identity, custom-field, activity-definition, business-field, API-key, and integration administration are excluded.",
  ),
  blocked(
    "ortto_exports_attachments",
    "Export or attach bulk data",
    "Campaign exports, files, attachments, unbounded pagination, arbitrary Talk messages, and bulk transfers are excluded.",
  ),
  blocked(
    "ortto_unbounded_api",
    "Use arbitrary APIs",
    "Only 19 pinned v1 operations run on the configured default, Australia, or Europe origin; arbitrary routes, origins, headers, and oversized requests are blocked.",
  ),
];

export const ORTTO_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "ortto",
  name: "Ortto",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://help.ortto.com/a-223-developer-guide",
  providerWebsiteUrl: "https://ortto.com/",
  capabilities: [
    {
      ...capability(
        "structural_read",
        "Read CDP structure",
        "Use seven bounded schema, audience, field, tag, campaign, and report-list reads.",
        true,
      ),
      platformCapability: "ortto_structural_read",
    },
    {
      ...capability(
        "sensitive_read",
        "Read customer and report data",
        "Use five bounded customer, subscription, account, and report reads with approval.",
        false,
      ),
      platformCapability: "ortto_sensitive_read",
    },
    {
      ...capability(
        "manage",
        "Manage CDP engagement",
        "Use seven bounded record, audience, activity, email, and push mutations with approval.",
        false,
      ),
      platformCapability: "ortto_manage",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "ORTTO_CUSTOM_API_KEY",
        label: "Ortto custom API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Use a dedicated customer-owned custom API key for the exact Ortto account and Relay application.",
      },
      {
        name: "ORTTO_REGION",
        label: "Ortto account region",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Set to default, au, or eu; Relay maps this enum to Ortto's fixed regional API origin.",
      },
    ],
  },
  tools: [
    tool(
      "ortto.read",
      "ortto_read",
      "structural_read",
      "ortto_structural_read",
      "read",
      false,
      ORTTO_STRUCTURAL_READ_OPERATION_IDS,
    ),
    tool(
      "ortto.readSensitive",
      "ortto_read_sensitive",
      "sensitive_read",
      "ortto_sensitive_read",
      "read",
      true,
      ORTTO_SENSITIVE_READ_OPERATION_IDS,
    ),
    tool(
      "ortto.manage",
      "ortto_manage",
      "manage",
      "ortto_manage",
      "write",
      true,
      ORTTO_MANAGE_OPERATION_IDS,
    ),
  ],
  approvalProfiles: [
    {
      id: "ortto_safe",
      label: "Safe",
      description:
        "Seven structural reads run directly; five customer/report reads and all seven mutations require approval, with explicit consent attestation for opt-ins.",
      defaultSelected: true,
      allowedActions: [structure],
      approvalRequiredActions: [sensitive, manage],
      blockedActions: blocks,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description: `All ${ORTTO_OPERATIONS.length} selected account-authorized operations run without Relay per-action approval; fixed regional routing, bounds, audits, consent attestation, and secret/destructive/export blocks remain enforced.`,
      defaultSelected: false,
      allowedActions: [structure, sensitive, manage],
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
  ],
  healthChecks: [
    {
      id: "instance_schema",
      label: "Ortto custom API key and exact account/region binding",
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
      "Run one pinned Ortto v1 operation with bounded input and output.",
    inputSchema: {
      type: "object",
      properties: {
        operation: { type: "string", enum: operations },
        body: { type: "object", maxProperties: 100 },
        consentAttestation: { type: "boolean" },
        approvalId: { type: "string", maxLength: 200 },
      },
      required: ["operation"],
      additionalProperties: false,
    },
  };
}
