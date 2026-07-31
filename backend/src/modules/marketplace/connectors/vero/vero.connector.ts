import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import {
  VERO_MANAGE_OPERATION_IDS,
  VERO_OPERATIONS,
  VERO_SENSITIVE_READ_OPERATION_IDS,
  VERO_STRUCTURAL_READ_OPERATION_IDS,
} from "./vero-operation-registry";

const structure = action(
  "vero_structural_read",
  "Read Vero campaign structure",
  "Read bounded broadcast and journey metadata, graphs, messages, and content-variant metadata.",
);
const sensitive = action(
  "vero_sensitive_read",
  "Read Vero message content",
  "Read exact broadcast or journey message content bodies with approval.",
);
const manage = action(
  "vero_manage",
  "Manage Vero tracking and drafts",
  "Identify or update users, track events, manage tags/subscriptions/aliases, and create or update unscheduled broadcast drafts with approval.",
);
const blocks = [
  blocked(
    "vero_secret_exposure",
    "Expose credentials",
    "Tracking keys, Campaigns API secret keys, authorization headers, and credential-bearing URLs never enter agent-visible inputs or results.",
  ),
  blocked(
    "vero_delete_export",
    "Delete or export data",
    "User deletion, campaign/customer exports, bulk imports, arbitrary pagination, and destructive administration are excluded.",
  ),
  blocked(
    "vero_send_schedule_setup",
    "Send, schedule, or configure delivery",
    "Broadcast audience/scheduling, publishing, live sends, webhooks, domains, email/SMS/push providers, API-key administration, and project send-mode changes remain provider-side.",
  ),
  blocked(
    "vero_unbounded_api",
    "Use arbitrary APIs",
    "Only 24 pinned v2 operations run on api.getvero.com with bounded input/output and a pinned Campaigns API revision; arbitrary routes, origins, headers, and legacy browser tracking are blocked.",
  ),
];

export const VERO_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "vero",
  name: "Vero",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://help.getvero.com/api-reference/overview",
  providerWebsiteUrl: "https://www.getvero.com/",
  capabilities: [
    {
      ...capability(
        "structural_read",
        "Read campaign structure",
        "Use ten bounded broadcast and journey metadata reads.",
        true,
      ),
      platformCapability: "vero_structural_read",
    },
    {
      ...capability(
        "sensitive_read",
        "Read message content",
        "Use two exact content-body reads with approval.",
        false,
      ),
      platformCapability: "vero_sensitive_read",
    },
    {
      ...capability(
        "manage",
        "Manage tracking and drafts",
        "Use six Track API mutations and six unscheduled broadcast-draft mutations with approval.",
        false,
      ),
      platformCapability: "vero_manage",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "VERO_TRACKING_API_KEY",
        label: "Vero tracking API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Use a dedicated customer-owned Tracking API key for the exact Vero project.",
      },
      {
        name: "VERO_CAMPAIGNS_API_SECRET_KEY",
        label: "Vero Campaigns API secret key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Use a dedicated customer-owned Campaigns API secret key after Vero grants public-preview access.",
      },
    ],
  },
  tools: [
    tool(
      "vero.read",
      "vero_read",
      "structural_read",
      "vero_structural_read",
      "read",
      false,
      VERO_STRUCTURAL_READ_OPERATION_IDS,
    ),
    tool(
      "vero.readSensitive",
      "vero_read_sensitive",
      "sensitive_read",
      "vero_sensitive_read",
      "read",
      true,
      VERO_SENSITIVE_READ_OPERATION_IDS,
    ),
    tool(
      "vero.manage",
      "vero_manage",
      "manage",
      "vero_manage",
      "write",
      true,
      VERO_MANAGE_OPERATION_IDS,
    ),
  ],
  approvalProfiles: [
    {
      id: "vero_safe",
      label: "Safe",
      description:
        "Ten structural reads run directly; two content reads and all 12 Track/draft mutations require approval, with explicit consent attestation for profile creation, event ingestion, and resubscription.",
      defaultSelected: true,
      allowedActions: [structure],
      approvalRequiredActions: [sensitive, manage],
      blockedActions: blocks,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description: `All ${VERO_OPERATIONS.length} selected operations run without Relay per-action approval; fixed v2 routing, pinned revision, bounds, audits, consent attestation, and delete/export/send/setup blocks remain enforced.`,
      defaultSelected: false,
      allowedActions: [structure, sensitive, manage],
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
  ],
  healthChecks: [
    {
      id: "broadcasts",
      label: "Vero project keys and Campaigns API public-preview access",
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
      "Run one pinned Vero v2 operation with bounded input and output.",
    inputSchema: {
      type: "object",
      properties: {
        operation: { type: "string", enum: operations },
        pathParams: { type: "object", maxProperties: 3 },
        query: { type: "object", maxProperties: 3 },
        body: { type: "object", maxProperties: 100 },
        consentAttestation: { type: "boolean" },
        approvalId: { type: "string", maxLength: 200 },
      },
      required: ["operation"],
      additionalProperties: false,
    },
  };
}
