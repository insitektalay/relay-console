import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import {
  MESSAGEGEARS_MANAGE_OPERATION_IDS,
  MESSAGEGEARS_OPERATIONS,
  MESSAGEGEARS_SENSITIVE_READ_OPERATION_IDS,
  MESSAGEGEARS_STRUCTURAL_READ_OPERATION_IDS,
} from "./messagegears-operation-registry";

const structure = action(
  "messagegears_structural_read",
  "Read MessageGears account summary",
  "Read one aggregate daily account summary from the fixed Cloud web service.",
);
const sensitive = action(
  "messagegears_sensitive_read",
  "Read MessageGears job or preview data",
  "Read an exact bulk-job aggregate or render a bounded one-recipient preview with approval.",
);
const manage = action(
  "messagegears_manage",
  "Send MessageGears transactional messages",
  "Send one authorized recipient a direct-template or promoted-campaign transactional message with approval.",
);
const blocks = [
  blocked(
    "messagegears_secret_exposure",
    "Expose credentials",
    "Account IDs, API keys, authorization parameters, and credential-bearing response elements never enter agent-visible inputs or results.",
  ),
  blocked(
    "messagegears_bulk_streaming",
    "Run bulk or streaming APIs",
    "Bulk job/campaign sends, daily activity file streams, SQS/event feeds, recipient-list URLs, imports, exports, and unbounded transfers are excluded.",
  ),
  blocked(
    "messagegears_admin_attachments",
    "Administer accounts or attach content",
    "Account creation/update, key rotation, attachments, thumbnails, forwarding, custom headers/tracking domains, and delivery infrastructure remain provider-side.",
  ),
  blocked(
    "messagegears_unbounded_api",
    "Use arbitrary APIs",
    "Only five pinned actions run via POST form data on the fixed 3.1 Cloud web service; arbitrary actions, URLs, headers, XML entities, and oversized requests are blocked.",
  ),
];

export const MESSAGEGEARS_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "messagegears",
  name: "MessageGears",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://support.messagegears.com/hc/en-us/articles/115001492508-API-v3-1-Overview",
  providerWebsiteUrl: "https://messagegears.com/",
  capabilities: [
    {
      ...capability(
        "structural_read",
        "Read account summary",
        "Use one aggregate daily account summary read.",
        true,
      ),
      platformCapability: "messagegears_structural_read",
    },
    {
      ...capability(
        "sensitive_read",
        "Read job or preview data",
        "Use one exact bulk-job summary and one bounded message preview with approval.",
        false,
      ),
      platformCapability: "messagegears_sensitive_read",
    },
    {
      ...capability(
        "manage",
        "Send transactional messages",
        "Use two one-recipient transactional email sends with approval and authorization attestation.",
        false,
      ),
      platformCapability: "messagegears_manage",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "MESSAGEGEARS_ACCOUNT_ID",
        label: "MessageGears account ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText: "Use the exact customer-owned MessageGears Cloud account ID.",
      },
      {
        name: "MESSAGEGEARS_API_KEY",
        label: "MessageGears API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Use a dedicated customer-owned API key for the exact account.",
      },
    ],
  },
  tools: [
    tool(
      "messagegears.read",
      "messagegears_read",
      "structural_read",
      "messagegears_structural_read",
      "read",
      false,
      MESSAGEGEARS_STRUCTURAL_READ_OPERATION_IDS,
    ),
    tool(
      "messagegears.readSensitive",
      "messagegears_read_sensitive",
      "sensitive_read",
      "messagegears_sensitive_read",
      "read",
      true,
      MESSAGEGEARS_SENSITIVE_READ_OPERATION_IDS,
    ),
    tool(
      "messagegears.manage",
      "messagegears_manage",
      "manage",
      "messagegears_manage",
      "write",
      true,
      MESSAGEGEARS_MANAGE_OPERATION_IDS,
    ),
  ],
  approvalProfiles: [
    {
      id: "messagegears_safe",
      label: "Safe",
      description:
        "The aggregate account summary runs directly; exact job/preview reads and both one-recipient sends require approval, and sends also require explicit recipient authorization attestation.",
      defaultSelected: true,
      allowedActions: [structure],
      approvalRequiredActions: [sensitive, manage],
      blockedActions: blocks,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description: `All ${MESSAGEGEARS_OPERATIONS.length} selected operations run without Relay per-action approval; recipient authorization, fixed Cloud routing, allowlists, bounds, audits, and bulk/admin/attachment blocks remain enforced.`,
      defaultSelected: false,
      allowedActions: [structure, sensitive, manage],
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
  ],
  healthChecks: [
    {
      id: "account_summary",
      label: "MessageGears Cloud account ID and API-key binding",
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
      "Run one pinned MessageGears 3.1 Cloud action with bounded form input and XML output.",
    inputSchema: {
      type: "object",
      properties: {
        operation: { type: "string", enum: operations },
        parameters: { type: "object", maxProperties: 10 },
        consentAttestation: { type: "boolean" },
        approvalId: { type: "string", maxLength: 200 },
      },
      required: ["operation"],
      additionalProperties: false,
    },
  };
}
