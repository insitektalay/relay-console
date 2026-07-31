import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import {
  ACTION_NETWORK_MANAGE_OPERATION_IDS,
  ACTION_NETWORK_OPERATIONS,
  ACTION_NETWORK_SENSITIVE_READ_OPERATION_IDS,
  ACTION_NETWORK_SYSTEM_READ_OPERATION_IDS,
} from "./action-network-operation-registry";

const systemRead = action(
  "action_network_system_read",
  "Read Action Network API metadata",
  "Read the API entry point, provider metadata and custom-field definitions.",
);
const sensitiveRead = action(
  "action_network_sensitive_read",
  "Read Action Network organizing data",
  "Read campaigns, activists, actions, targeting, donations and message data; Safe mode requires approval.",
);
const manage = action(
  "action_network_manage",
  "Manage Action Network",
  "Create or update organizing records, targeting and messages, and schedule or send mass email; Safe mode requires approval.",
);

const tool = (
  suffix: string,
  capabilityId: string,
  actionType: "read" | "write",
  approvalRequired: boolean,
  operations: readonly string[],
  description: string,
) => ({
  name: `action-network.${suffix}`,
  functionName: `action_network_${suffix}`,
  aliases: [`action-network.${suffix}`, `action_network_${suffix}`],
  capability: capabilityId,
  platformCapability: capabilityId,
  action: actionType,
  approvalRequired,
  description,
  inputSchema: {
    type: "object" as const,
    properties: {
      operation: { type: "string", enum: [...operations] },
      pathParameters: { type: "object", maxProperties: 3 },
      query: { type: "object", maxProperties: 50 },
      ...(actionType === "write" ? { json: {} } : {}),
      ...(approvalRequired
        ? { approvalId: { type: "string", maxLength: 200 } }
        : {}),
    },
    required: ["operation"],
    additionalProperties: false,
  },
});

export const ACTION_NETWORK_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "action-network",
  name: "Action Network",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://actionnetwork.org/docs/v2/",
  providerWebsiteUrl: "https://actionnetwork.org/",
  capabilities: [
    {
      ...capability(
        "action_network_system_read",
        "Read API metadata",
        `Use ${ACTION_NETWORK_SYSTEM_READ_OPERATION_IDS.length} bounded API discovery reads.`,
        true,
      ),
      platformCapability: "action_network_system_read",
    },
    {
      ...capability(
        "action_network_sensitive_read",
        "Read organizing and activist data",
        `Use ${ACTION_NETWORK_SENSITIVE_READ_OPERATION_IDS.length} campaign, person, action, targeting, donation and message reads under approval.`,
        true,
      ),
      platformCapability: "action_network_sensitive_read",
    },
    {
      ...capability(
        "action_network_manage",
        "Manage organizing and mass email",
        `Use all ${ACTION_NETWORK_MANAGE_OPERATION_IDS.length} documented v2 mutations under approval.`,
        true,
      ),
      platformCapability: "action_network_manage",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "ACTION_NETWORK_API_KEY",
        label: "Action Network API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "A dedicated partner API key generated for the exact personal or group list Relay may access.",
      },
    ],
  },
  tools: [
    tool(
      "systemRead",
      "action_network_system_read",
      "read",
      false,
      ACTION_NETWORK_SYSTEM_READ_OPERATION_IDS,
      "Read pinned Action Network API metadata without activist records.",
    ),
    tool(
      "sensitiveRead",
      "action_network_sensitive_read",
      "read",
      true,
      ACTION_NETWORK_SENSITIVE_READ_OPERATION_IDS,
      "Read one pinned account-data operation; Safe mode requires approval.",
    ),
    tool(
      "manage",
      "action_network_manage",
      "write",
      true,
      ACTION_NETWORK_MANAGE_OPERATION_IDS,
      "Run one pinned Action Network mutation; Safe mode requires approval.",
    ),
  ],
  approvalProfiles: [
    {
      id: "action_network_safe",
      label: "Safe",
      description:
        "API metadata reads run directly; all organizing-data reads and every mutation require approval.",
      defaultSelected: true,
      allowedActions: [systemRead],
      approvalRequiredActions: [sensitiveRead, manage],
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description: `All ${ACTION_NETWORK_OPERATIONS.length} pinned v2 operations run without Relay per-action approval; account-key scope, fixed routes, payload bounds, audits and provider limits still apply.`,
      defaultSelected: false,
      allowedActions: [systemRead, sensitiveRead, manage],
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    { id: "partner_api_key", label: "Action Network partner API key check" },
  ],
};
