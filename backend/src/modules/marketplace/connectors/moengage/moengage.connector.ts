import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import {
  MOENGAGE_MANAGE_OPERATION_IDS,
  MOENGAGE_SENSITIVE_READ_OPERATION_IDS,
} from "./moengage-operation-registry";
const sensitive = action(
  "moengage_sensitive_read",
  "Read MoEngage user",
  "Export one exact customer profile with approval.",
);
const manage = action(
  "moengage_manage",
  "Manage MoEngage user",
  "Update bounded non-consent attributes for one authorized user with approval.",
);
const blocks = [
  blocked(
    "moengage_secret_exposure",
    "Expose credentials",
    "Workspace IDs, API keys, Basic authorization, health customer IDs, and credential-bearing fields never enter agent-visible inputs or results.",
  ),
  blocked(
    "moengage_bulk_transfer",
    "Run bulk transfers",
    "Bulk import, user collections, segments, exports beyond one exact user, and mass data movement are excluded.",
  ),
  blocked(
    "moengage_send_admin",
    "Send or administer campaigns",
    "Events, devices, user merge/delete, campaigns, push, email, SMS, WhatsApp, cards, content, and consent/subscription changes remain provider-side.",
  ),
  blocked(
    "moengage_unbounded_api",
    "Use arbitrary APIs",
    "Only two pinned Data/Get User routes run on enumerated DC-01 through DC-06 origins; arbitrary paths, data centers, queries, headers, attributes, and oversized results are blocked.",
  ),
];
export const MOENGAGE_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "moengage",
  name: "MoEngage",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://www.postman.com/moengage-dev/api-docs/documentation/p593wcu/moengage-data-apis",
  providerWebsiteUrl: "https://www.moengage.com/",
  capabilities: [
    {
      ...capability(
        "sensitive_read",
        "Read user",
        "Export one exact customer profile with approval.",
        false,
      ),
      platformCapability: "moengage_sensitive_read",
    },
    {
      ...capability(
        "manage",
        "Manage one user",
        "Update bounded non-consent attributes for one authorized user with approval.",
        false,
      ),
      platformCapability: "moengage_manage",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "MOENGAGE_WORKSPACE_ID",
        label: "MoEngage workspace ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Use the workspace ID associated with the dedicated Data API key.",
      },
      {
        name: "MOENGAGE_DATA_API_KEY",
        label: "MoEngage Data API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Use a dedicated customer-owned key for User API and support-enabled Get User access only.",
      },
      {
        name: "MOENGAGE_DATA_CENTER",
        label: "MoEngage data center",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText: "Enter the workspace REST data center, 01 through 06.",
      },
      {
        name: "MOENGAGE_HEALTH_CUSTOMER_ID",
        label: "MoEngage health customer ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Use one dedicated non-production customer for connection health checks.",
      },
    ],
  },
  tools: [
    tool(
      "moengage.readSensitive",
      "moengage_read_sensitive",
      "sensitive_read",
      "moengage_sensitive_read",
      "read",
      true,
      MOENGAGE_SENSITIVE_READ_OPERATION_IDS,
    ),
    tool(
      "moengage.manage",
      "moengage_manage",
      "manage",
      "moengage_manage",
      "write",
      true,
      MOENGAGE_MANAGE_OPERATION_IDS,
    ),
  ],
  approvalProfiles: [
    {
      id: "moengage_safe",
      label: "Safe",
      description:
        "Every selected operation requires approval; one-user writes additionally require user authorization, while consent/subscription attributes and all bulk/send/admin APIs remain blocked.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: [sensitive, manage],
      blockedActions: blocks,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description: `Both selected operations run without Relay per-action approval; user authorization, fixed data-center routing, field/response bounds, audits, and bulk/send/admin/consent blocks remain enforced.`,
      defaultSelected: false,
      allowedActions: [sensitive, manage],
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
  ],
  healthChecks: [
    {
      id: "health_user",
      label: "MoEngage credentials and exact staging-user access",
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
      "Run one pinned MoEngage exact-user operation on an enumerated data-center origin with bounded JSON.",
    inputSchema: {
      type: "object",
      properties: {
        operation: { type: "string", enum: operations },
        customerId: { type: "string", maxLength: 500 },
        attributes: {
          type: "object",
          minProperties: 1,
          maxProperties: 20,
          additionalProperties: { type: ["string", "number", "boolean"] },
        },
        consentAttestation: { type: "boolean" },
        approvalId: { type: "string", maxLength: 200 },
      },
      required: ["operation"],
      additionalProperties: false,
    },
  };
}
