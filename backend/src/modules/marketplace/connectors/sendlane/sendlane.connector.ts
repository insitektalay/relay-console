import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import {
  SENDLANE_OPERATIONS,
  SENDLANE_READ_OPERATION_IDS,
  SENDLANE_TRACK_OPERATION_IDS,
} from "./sendlane-operation-registry";

const structure = action(
  "sendlane_structural_read",
  "Read Sendlane senders",
  "Read the bounded sender configuration visible to the connected API v2 token.",
);
const track = action(
  "sendlane_track",
  "Send Sendlane commerce events",
  "Send customer, product, browse, cart, checkout, and order events with approval.",
);
const blocks = [
  blocked(
    "sendlane_secret_exposure",
    "Expose credentials",
    "API v2, custom-integration, and custom-event tokens plus authorization headers never enter agent-visible inputs or results.",
  ),
  blocked(
    "sendlane_custom_event_token",
    "Supply custom-event tokens",
    "Per-event tokens are credential lifecycle material and cannot be supplied by an agent; custom-event delivery is excluded until separately stored credentials can be bound.",
  ),
  blocked(
    "sendlane_browser_tracking",
    "Install browser tracking",
    "Relay does not inject Beacon, pusher.js, cookies, identify calls, or tracking snippets into customer websites.",
  ),
  blocked(
    "sendlane_unbounded_api",
    "Use arbitrary or legacy APIs",
    "Only seven pinned v2 operations run; legacy v1 query credentials, arbitrary paths, origins, headers, and oversized transfers are blocked.",
  ),
];

export const SENDLANE_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "sendlane",
  name: "Sendlane",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://help.sendlane.com/articles/3807111349-sendlane-custom-integration-setup-api-v2",
  providerWebsiteUrl: "https://www.sendlane.com/",
  capabilities: [
    {
      ...capability(
        "structural_read",
        "Read sender structure",
        "Use one bounded API v2 sender read.",
        true,
      ),
      platformCapability: "sendlane_structural_read",
    },
    {
      ...capability(
        "track",
        "Track commerce events",
        "Use six fixed custom-integration event writes with approval.",
        false,
      ),
      platformCapability: "sendlane_track",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "SENDLANE_API_V2_TOKEN",
        label: "Sendlane API v2 token",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Use a dedicated customer-owned API v2 token created for this Relay connection.",
      },
      {
        name: "SENDLANE_CUSTOM_INTEGRATION_TOKEN",
        label: "Sendlane custom integration token",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Use the token for the exact customer-owned custom integration whose commerce events Relay may send.",
      },
    ],
  },
  tools: [
    tool(
      "sendlane.read",
      "sendlane_read",
      "structural_read",
      "sendlane_structural_read",
      "read",
      false,
      SENDLANE_READ_OPERATION_IDS,
    ),
    tool(
      "sendlane.track",
      "sendlane_track",
      "track",
      "sendlane_track",
      "write",
      true,
      SENDLANE_TRACK_OPERATION_IDS,
    ),
  ],
  approvalProfiles: [
    {
      id: "sendlane_safe",
      label: "Safe",
      description:
        "The sender read runs directly; all six customer and commerce event writes require approval.",
      defaultSelected: true,
      allowedActions: [structure],
      approvalRequiredActions: [track],
      blockedActions: blocks,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description: `All ${SENDLANE_OPERATIONS.length} selected operations run without Relay per-action approval; fixed v2 routes, server-side credential injection, bounds, audits, and secret/browser/legacy blocks remain enforced.`,
      defaultSelected: false,
      allowedActions: [structure, track],
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
  ],
  healthChecks: [
    {
      id: "api_v2",
      label: "Sendlane API v2 token and configured integration binding",
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
      "Run one pinned Sendlane v2 operation with bounded input and output.",
    inputSchema: {
      type: "object",
      properties: {
        operation: { type: "string", enum: operations },
        body: { type: "object", maxProperties: 100 },
        approvalId: { type: "string", maxLength: 200 },
      },
      required: ["operation"],
      additionalProperties: false,
    },
  };
}
