import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import {
  SAILTHRU_MANAGE_OPERATION_IDS,
  SAILTHRU_OPERATIONS,
  SAILTHRU_SENSITIVE_READ_OPERATION_IDS,
  SAILTHRU_STRUCTURAL_READ_OPERATION_IDS,
} from "./sailthru-operation-registry";

const structure = action(
  "sailthru_structural_read",
  "Read Sailthru list",
  "Read aggregate metadata for one exact natural list.",
);
const sensitive = action(
  "sailthru_sensitive_read",
  "Read Sailthru user or template",
  "Read one email user profile or one named messaging template with approval.",
);
const manage = action(
  "sailthru_manage",
  "Manage Sailthru preferences",
  "Change one authorized user's exact list membership or email opt-out status with approval.",
);
const blocks = [
  blocked(
    "sailthru_secret_exposure",
    "Expose credentials",
    "API keys, secrets, request signatures, and credential-bearing response fields never enter agent-visible inputs or results.",
  ),
  blocked(
    "sailthru_bulk_jobs",
    "Run bulk or job APIs",
    "Jobs, imports, exports, multi-send, files, purchase/event streams, recommendations, and unbounded reads are excluded.",
  ),
  blocked(
    "sailthru_send_admin",
    "Send or administer messaging",
    "Send/blast launch, content/template/list mutation, user deletion, webhooks, settings, and account administration remain provider-side.",
  ),
  blocked(
    "sailthru_unbounded_api",
    "Use arbitrary APIs",
    "Only five pinned operations run on three fixed endpoints; arbitrary endpoints, methods, fields, URLs, headers, and oversized data are blocked.",
  ),
];

export const SAILTHRU_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "sailthru",
  name: "Sailthru",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://getstarted.meetmarigold.com/engagebysailthru/Content/developers/api-basics/technical.html",
  providerWebsiteUrl:
    "https://www.meetmarigold.com/products/engage-by-sailthru",
  capabilities: [
    {
      ...capability(
        "structural_read",
        "Read one list",
        "Use one exact aggregate list read.",
        true,
      ),
      platformCapability: "sailthru_structural_read",
    },
    {
      ...capability(
        "sensitive_read",
        "Read user or template",
        "Use exact user/template reads with approval.",
        false,
      ),
      platformCapability: "sailthru_sensitive_read",
    },
    {
      ...capability(
        "manage",
        "Manage user preferences",
        "Use exact list/opt-out writes with approval and authorization attestations.",
        false,
      ),
      platformCapability: "sailthru_manage",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "SAILTHRU_API_KEY",
        label: "Sailthru API key",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Use a dedicated customer-owned API key, preferably restricted to Railway staging egress IPs.",
      },
      {
        name: "SAILTHRU_API_SECRET",
        label: "Sailthru API secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Relay uses this only to calculate the provider-required per-request signature.",
      },
      {
        name: "SAILTHRU_HEALTH_LIST",
        label: "Sailthru health-check list",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Use one non-sensitive staging list name for exact read-only health checks.",
      },
    ],
  },
  tools: [
    tool(
      "sailthru.read",
      "sailthru_read",
      "structural_read",
      "sailthru_structural_read",
      "read",
      false,
      SAILTHRU_STRUCTURAL_READ_OPERATION_IDS,
    ),
    tool(
      "sailthru.readSensitive",
      "sailthru_read_sensitive",
      "sensitive_read",
      "sailthru_sensitive_read",
      "read",
      true,
      SAILTHRU_SENSITIVE_READ_OPERATION_IDS,
    ),
    tool(
      "sailthru.manage",
      "sailthru_manage",
      "manage",
      "sailthru_manage",
      "write",
      true,
      SAILTHRU_MANAGE_OPERATION_IDS,
    ),
  ],
  approvalProfiles: [
    {
      id: "sailthru_safe",
      label: "Safe",
      description:
        "One exact list read runs directly; exact user/template reads and preference writes require approval, writes require contact authorization, and subscribing or removing opt-out additionally requires double-opt-in evidence.",
      defaultSelected: true,
      allowedActions: [structure],
      approvalRequiredActions: [sensitive, manage],
      blockedActions: blocks,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description: `All ${SAILTHRU_OPERATIONS.length} selected operations run without Relay per-action approval; authorization/double-opt-in attestations, fixed routing, signing, bounds, audits, and bulk/send/admin blocks remain enforced.`,
      defaultSelected: false,
      allowedActions: [structure, sensitive, manage],
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
  ],
  healthChecks: [
    { id: "health_list", label: "Sailthru signed API and exact list access" },
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
      "Run one pinned Sailthru operation through fixed endpoints with signed, bounded JSON input/output.",
    inputSchema: {
      type: "object",
      properties: {
        operation: { type: "string", enum: operations },
        list: { type: "string", maxLength: 200 },
        email: { type: "string", format: "email", maxLength: 320 },
        template: { type: "string", maxLength: 200 },
        subscribed: { type: "boolean" },
        optoutEmail: { type: "string", enum: ["all", "blast", "none"] },
        consentAttestation: { type: "boolean" },
        doubleOptInAttestation: { type: "boolean" },
        approvalId: { type: "string", maxLength: 200 },
      },
      required: ["operation"],
      additionalProperties: false,
    },
  };
}
