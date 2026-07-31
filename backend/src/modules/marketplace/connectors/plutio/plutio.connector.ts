import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import {
  PLUTIO_MANAGE_OPERATION_IDS,
  PLUTIO_OPERATIONS,
  PLUTIO_READ_OPERATION_IDS,
} from "./plutio-operation-registry";

const read = action(
  "plutio_read",
  "Read Plutio",
  "Read bounded workspace, people, project, scheduling, finance, document, form, content, file, message, dashboard, and system data.",
);
const manage = action(
  "plutio_manage",
  "Manage Plutio",
  "Create, update, move, copy, archive, email, share, bulk-edit, or delete authorized Plutio records; Safe mode requires approval.",
);
const guards = [
  action(
    "plutio_secret_exposure",
    "Expose credentials",
    "Client credentials and derived access tokens never enter agent-visible requests or results.",
  ),
  action(
    "plutio_unofficial_origin",
    "Use another API origin",
    "Every token and data request stays on Plutio's fixed versioned HTTPS API origin.",
  ),
  action(
    "plutio_unsupported_endpoint",
    "Call another endpoint",
    "Relay permits only the 219 operations published in Plutio API version 1.11.",
  ),
  action(
    "plutio_unbounded_transfer",
    "Run an unbounded transfer",
    "Relay bounds pagination, query values, request bodies, responses, redirects, nesting, and execution time.",
  ),
];

export const PLUTIO_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "plutio",
  name: "Plutio",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://docs.plutio.com/",
  providerWebsiteUrl: "https://www.plutio.com/",
  capabilities: [
    {
      ...capability(
        "plutio_read",
        "Read business operations",
        `Use all ${PLUTIO_READ_OPERATION_IDS.length} documented version 1.11 reads across the connected workspace.`,
        true,
      ),
      platformCapability: "plutio_read",
    },
    {
      ...capability(
        "plutio_manage",
        "Manage business operations",
        `Use all ${PLUTIO_MANAGE_OPERATION_IDS.length} documented version 1.11 mutations across projects, clients, scheduling, finance, documents, forms, files, messages, dashboards, and workspace configuration.`,
        true,
      ),
      platformCapability: "plutio_manage",
    },
  ],
  auth: {
    type: "custom",
    credentialSchema: [
      {
        name: "PLUTIO_CLIENT_ID",
        label: "Plutio client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Create a dedicated API client in Plutio Settings > API manager.",
      },
      {
        name: "PLUTIO_CLIENT_SECRET",
        label: "Plutio client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Store the dedicated client secret only in Relay's encrypted credential boundary.",
      },
      {
        name: "PLUTIO_BUSINESS_SUBDOMAIN",
        label: "Plutio workspace subdomain",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Enter only the first part of the workspace domain, such as studio from studio.plutio.com.",
      },
    ],
  },
  tools: [
    {
      name: "plutio.read",
      functionName: "plutio_read",
      aliases: ["plutio.read", "plutio_read"],
      capability: "plutio_read",
      platformCapability: "plutio_read",
      action: "read",
      approvalRequired: false,
      description:
        "Run one pinned Plutio v1.11 GET operation with bounded filtering and pagination.",
      inputSchema: {
        type: "object",
        properties: {
          operation: { type: "string", enum: [...PLUTIO_READ_OPERATION_IDS] },
          query: { type: "object", maxProperties: 50 },
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
    {
      name: "plutio.manage",
      functionName: "plutio_manage",
      aliases: ["plutio.manage", "plutio_manage"],
      capability: "plutio_manage",
      platformCapability: "plutio_manage",
      action: "write",
      approvalRequired: true,
      description:
        "Run one pinned Plutio v1.11 mutation; Safe mode requires approval.",
      inputSchema: {
        type: "object",
        properties: {
          operation: { type: "string", enum: [...PLUTIO_MANAGE_OPERATION_IDS] },
          query: { type: "object", maxProperties: 50 },
          json: { type: "object", maxProperties: 500 },
          approvalId: { type: "string", maxLength: 200 },
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "plutio_safe",
      label: "Safe",
      description: `All ${PLUTIO_READ_OPERATION_IDS.length} bounded reads run directly; every mutation requires approval.`,
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [manage],
      blockedActions: guards,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description: `All ${PLUTIO_OPERATIONS.length} selected and client-authorized operations run without Relay per-action approval; workspace binding, exact routes, bounds, audits, redaction, rate limits, and Plutio role permissions still apply.`,
      defaultSelected: false,
      allowedActions: [read, manage],
      approvalRequiredActions: [],
      blockedActions: guards,
    },
  ],
  healthChecks: [
    { id: "workspace", label: "Plutio client, workspace, and role validation" },
  ],
};
