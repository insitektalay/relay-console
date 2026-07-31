import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import {
  CRAFT_MANAGE_OPERATIONS,
  CRAFT_READ_OPERATIONS,
} from "./craft-api.adapter";

const reads = [
  action(
    "craft_api_read",
    "Read Craft content",
    "Use one stable, allowlisted Craft Space API read against the connection's selected content.",
  ),
];
const manages = [
  action(
    "craft_api_manage",
    "Manage Craft content",
    "Use one stable, allowlisted Craft Space API mutation; Safe mode requires approval.",
  ),
];
const blockedActions = [
  blocked(
    "craft_raw_api",
    "Call arbitrary Craft APIs",
    "Agents choose only an enumerated stable operation; raw paths, methods, and experimental endpoints are unavailable.",
  ),
  blocked(
    "craft_secret_exposure",
    "Expose the API connection URL",
    "The secret Craft connection URL remains encrypted and never enters tool inputs, results, logs, or audits.",
  ),
  blocked(
    "craft_unbounded_transfer",
    "Transfer unbounded content",
    "Requests, responses, arrays, nesting, and query fields remain inside Relay bounds.",
  ),
];

const commonProperties = {
  pathParams: {
    type: "object",
    properties: {
      collectionId: { type: "string", minLength: 1, maxLength: 200 },
    },
    additionalProperties: false,
  },
  query: { type: "object", additionalProperties: true },
};

export const CRAFT_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "craft",
  name: "Craft",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://connect.craft.do/api-docs/space",
  providerWebsiteUrl: "https://www.craft.do/",
  capabilities: [
    {
      ...capability(
        "knowledge_read",
        "Read workspace knowledge",
        "Fetch and search selected documents and blocks, then list authorized collections, folders, documents, and tasks.",
        true,
      ),
      platformCapability: "craft_knowledge_read",
    },
    {
      ...capability(
        "knowledge_manage",
        "Manage workspace knowledge",
        "Insert, update, move, and delete authorized blocks, collection items, documents, folders, and tasks.",
        true,
      ),
      platformCapability: "craft_knowledge_manage",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "CRAFT_API_URL",
        label: "Craft API connection URL",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Create a least-privilege API Connection in Craft's Imagine tab and paste its full https://connect.craft.do/link/.../api/v1 URL.",
      },
    ],
  },
  tools: [
    {
      name: "craft.read",
      functionName: "craft_api_read",
      aliases: ["craft.read", "craft_api_read"],
      capability: "knowledge_read",
      platformCapability: "craft_knowledge_read",
      action: "read",
      approvalRequired: false,
      description:
        "Run one enumerated stable Craft read with bounded path parameters and query fields.",
      inputSchema: {
        type: "object",
        properties: {
          operation: { type: "string", enum: [...CRAFT_READ_OPERATIONS] },
          ...commonProperties,
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
    {
      name: "craft.manage",
      functionName: "craft_api_manage",
      aliases: ["craft.manage", "craft_api_manage"],
      capability: "knowledge_manage",
      platformCapability: "craft_knowledge_manage",
      action: "write",
      approvalRequired: true,
      description:
        "Run one enumerated stable Craft mutation with bounded parameters and a JSON body.",
      inputSchema: {
        type: "object",
        properties: {
          operation: { type: "string", enum: [...CRAFT_MANAGE_OPERATIONS] },
          ...commonProperties,
          body: { type: "object" },
          approvalId: { type: "string", maxLength: 200 },
        },
        required: ["operation", "body"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "craft_safe",
      label: "Safe",
      description:
        "Bounded reads run directly; every Craft content or organization mutation requires approval.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: manages,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Every selected connection-authorized Craft operation runs without Relay per-action approval; exact authority, provider permissions, operation allowlists, bounds, redaction, audits, and fair-use limits still apply.",
      defaultSelected: false,
      allowedActions: [...reads, ...manages],
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "scoped_api_connection",
      label: "Craft scoped API connection and folder-list validation",
    },
  ],
};
