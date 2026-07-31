import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import {
  WUFOO_MANAGE_OPERATION_IDS,
  WUFOO_OPERATIONS,
  WUFOO_READ_OPERATION_IDS,
} from "./wufoo-operation-registry";

const read = action(
  "wufoo_read",
  "Read Wufoo",
  "Read authorized forms, fields, comments, entries, reports, report widgets, and account users.",
);
const manage = action(
  "wufoo_manage",
  "Submit entries and manage webhooks",
  "Submit a form entry or add or remove a form webhook. Safe mode requires approval.",
);

export const WUFOO_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "wufoo",
  name: "Wufoo",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://wufoo.github.io/docs/",
  providerWebsiteUrl: "https://www.wufoo.com/",
  capabilities: [
    {
      ...capability(
        "wufoo_read",
        "Read forms and results",
        `Use all ${WUFOO_READ_OPERATION_IDS.length} documented reads for forms, fields, comments, entries, reports, widgets, and users.`,
        true,
      ),
      platformCapability: "wufoo_read",
    },
    {
      ...capability(
        "wufoo_manage",
        "Submit entries and manage webhooks",
        `Use all ${WUFOO_MANAGE_OPERATION_IDS.length} documented mutations to submit entries and add or remove form webhooks.`,
        true,
      ),
      platformCapability: "wufoo_manage",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "WUFOO_API_KEY",
        label: "Wufoo API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Copy the API key from API Information on any form. A dedicated sub-user key can limit Relay to that user's Wufoo permissions.",
      },
      {
        name: "WUFOO_SUBDOMAIN",
        label: "Wufoo account name",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Enter only the account name before .wufoo.com, for example fishbowl from fishbowl.wufoo.com.",
      },
    ],
  },
  tools: [
    {
      name: "wufoo.read",
      functionName: "wufoo_read",
      aliases: ["wufoo.read", "wufoo_read"],
      capability: "wufoo_read",
      platformCapability: "wufoo_read",
      action: "read",
      approvalRequired: false,
      description:
        "Run one pinned, semantically read-only Wufoo API v3 operation with bounded arguments and results.",
      inputSchema: {
        type: "object",
        properties: {
          operation: { type: "string", enum: [...WUFOO_READ_OPERATION_IDS] },
          pathParameters: { type: "object", maxProperties: 4 },
          query: { type: "object", maxProperties: 60 },
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
    {
      name: "wufoo.manage",
      functionName: "wufoo_manage",
      aliases: ["wufoo.manage", "wufoo_manage"],
      capability: "wufoo_manage",
      platformCapability: "wufoo_manage",
      action: "write",
      approvalRequired: true,
      description:
        "Submit one entry or add or delete one webhook through a pinned Wufoo API v3 operation; Safe mode requires approval.",
      inputSchema: {
        type: "object",
        properties: {
          operation: { type: "string", enum: [...WUFOO_MANAGE_OPERATION_IDS] },
          pathParameters: { type: "object", maxProperties: 4 },
          form: { type: "object", maxProperties: 250 },
          approvalId: { type: "string", maxLength: 200 },
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "wufoo_safe",
      label: "Safe",
      description: `All ${WUFOO_READ_OPERATION_IDS.length} documented reads run directly; entry submissions and webhook changes require approval.`,
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [manage],
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description: `All ${WUFOO_OPERATIONS.length} selected and API-key-authorized Wufoo operations run without Relay per-action approval. Wufoo user permissions, plan limits, connection ownership, fixed-account routing, bounds, audits, redaction, and provider limits remain enforced.`,
      defaultSelected: false,
      allowedActions: [read, manage],
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    {
      id: "api_key_subdomain_and_forms",
      label: "Wufoo API key, account name, and form-list access check",
    },
  ],
};
