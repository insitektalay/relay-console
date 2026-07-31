import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import {
  ANYTYPE_MANAGE_OPERATIONS,
  ANYTYPE_READ_OPERATIONS,
} from "./anytype-local-api.adapter";

const reads = [
  action(
    "anytype_api_read",
    "Read Anytype knowledge",
    "Run one bounded, enumerated read against the selected source host's Anytype Local API.",
  ),
];
const manages = [
  action(
    "anytype_api_manage",
    "Manage Anytype knowledge",
    "Run one bounded, enumerated Anytype mutation; Safe mode requires approval.",
  ),
];
const blockedActions = [
  blocked(
    "anytype_raw_api",
    "Call arbitrary Anytype APIs",
    "Agents choose only enumerated versioned JSON operations; raw paths, methods, auth, files, streams, and experimental endpoints are unavailable.",
  ),
  blocked(
    "anytype_secret_exposure",
    "Expose local authority",
    "The API key and provider-local origin remain outside tool inputs, results, logs, and audits.",
  ),
  blocked(
    "anytype_unbounded_transfer",
    "Transfer unbounded vault data",
    "Requests, responses, arrays, strings, and nesting remain inside Relay bounds.",
  ),
];
const common = {
  pathParams: { type: "object", additionalProperties: true },
  query: { type: "object", additionalProperties: true },
};

export const ANYTYPE_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "anytype",
  name: "Anytype",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developers.anytype.io/",
  providerWebsiteUrl: "https://anytype.io/",
  capabilities: [
    {
      ...capability(
        "knowledge_read",
        "Read local-first knowledge",
        "Search and read bounded spaces, objects, chats, lists, members, properties, tags, types, and templates.",
        true,
      ),
      platformCapability: "anytype_knowledge_read",
    },
    {
      ...capability(
        "knowledge_manage",
        "Manage local-first knowledge",
        "Create, update, archive, organize, and collaborate through stable JSON space, chat, list, object, property, tag, and type operations.",
        true,
      ),
      platformCapability: "anytype_knowledge_manage",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "ANYTYPE_API_KEY",
        label: "Anytype API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Create a dedicated API key in Anytype settings and store it encrypted in Relay.",
      },
      {
        name: "ANYTYPE_SOURCE_HOST_ID",
        label: "Source host ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Select the exact connected host running Anytype Desktop or Anytype CLI.",
      },
      {
        name: "ANYTYPE_SOURCE_HOST_TYPE",
        label: "Source host type",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["api_key"],
        helpText: "Use hermes_bridge, openclaw_bridge, or runtime_host.",
      },
      {
        name: "ANYTYPE_RUNTIME",
        label: "Anytype runtime",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Choose desktop or cli so Relay pins the provider-local API port.",
      },
    ],
  },
  tools: [
    {
      name: "anytype.read",
      functionName: "anytype_api_read",
      aliases: ["anytype.read", "anytype_api_read"],
      capability: "knowledge_read",
      platformCapability: "anytype_knowledge_read",
      action: "read",
      approvalRequired: false,
      description:
        "Run one enumerated Anytype Local API read through the selected source host.",
      inputSchema: {
        type: "object",
        properties: {
          operation: { type: "string", enum: [...ANYTYPE_READ_OPERATIONS] },
          ...common,
          body: { type: "object" },
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
    {
      name: "anytype.manage",
      functionName: "anytype_api_manage",
      aliases: ["anytype.manage", "anytype_api_manage"],
      capability: "knowledge_manage",
      platformCapability: "anytype_knowledge_manage",
      action: "write",
      approvalRequired: true,
      description:
        "Run one enumerated Anytype Local API mutation through the selected source host.",
      inputSchema: {
        type: "object",
        properties: {
          operation: { type: "string", enum: [...ANYTYPE_MANAGE_OPERATIONS] },
          ...common,
          body: { type: "object" },
          approvalId: { type: "string", maxLength: 200 },
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "anytype_safe",
      label: "Safe",
      description:
        "Bounded reads run directly; every Anytype mutation requires approval.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: manages,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "All selected stable JSON operations run without Relay per-action approval; source-host binding, API version, provider authority, allowlists, bounds, redaction, and audits still apply.",
      defaultSelected: false,
      allowedActions: [...reads, ...manages],
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "source_host_local_api",
      label: "Anytype source-host Local API and bounded space-list validation",
    },
  ],
};
