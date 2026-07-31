import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import {
  SEVEN_SHIFTS_MANAGE_OPERATION_IDS,
  SEVEN_SHIFTS_READ_OPERATION_IDS,
} from "./seven-shifts-operation-registry";

const read = action(
  "seven_shifts_read",
  "Read 7shifts",
  "Read restaurant workforce, scheduling, time, labor, engagement, and reporting data.",
);
const manage = action(
  "seven_shifts_manage",
  "Manage 7shifts",
  "Create, update, or delete data through an exact operation in 7shifts' public API.",
);

export const SEVEN_SHIFTS_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "7shifts",
  name: "7shifts",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developers.7shifts.com/reference",
  providerWebsiteUrl: "https://www.7shifts.com/",
  capabilities: [
    {
      ...capability(
        "seven_shifts_read",
        "Read 7shifts",
        `Use all ${SEVEN_SHIFTS_READ_OPERATION_IDS.length} current public read operations.`,
        true,
      ),
      platformCapability: "seven_shifts_read",
    },
    {
      ...capability(
        "seven_shifts_manage",
        "Manage 7shifts",
        `Use all ${SEVEN_SHIFTS_MANAGE_OPERATION_IDS.length} current public mutation operations.`,
        true,
      ),
      platformCapability: "seven_shifts_manage",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://app.7shifts.com/generate_token",
      tokenUrl: "https://app.7shifts.com/oauth2/token",
      requiredScopes: [
        "v1_access",
        "companies:read",
        "companies:write",
        "departments:read",
        "departments:write",
        "locations:read",
        "locations:write",
        "roles:read",
        "roles:write",
        "users:read",
        "users:write",
        "sales:read",
        "sales:write",
        "shifts:read",
        "shifts:write",
        "time_punches:read",
        "time_punches:write",
        "events:read",
        "events:write",
      ],
      optionalScopes: [],
      pkce: false,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "SEVEN_SHIFTS_CLIENT_ID",
        label: "Relay-owned 7shifts client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["oauth2"],
        helpText:
          "Issued to Relay Console after 7shifts technology-partner approval.",
      },
      {
        name: "SEVEN_SHIFTS_CLIENT_SECRET",
        label: "Relay-owned 7shifts client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["oauth2"],
        helpText: "Stored only in Railway and never shown to users or agents.",
      },
    ],
  },
  tools: [
    {
      name: "7shifts.read",
      functionName: "seven_shifts_read",
      aliases: ["7shifts.read", "seven_shifts_read"],
      capability: "seven_shifts_read",
      platformCapability: "seven_shifts_read",
      action: "read",
      approvalRequired: false,
      description:
        "Run one pinned GET operation from the current 7shifts public API.",
      inputSchema: {
        type: "object",
        properties: {
          operation: {
            type: "string",
            enum: [...SEVEN_SHIFTS_READ_OPERATION_IDS],
          },
          pathParameters: { type: "object", maxProperties: 10 },
          query: { type: "object", maxProperties: 30 },
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
    {
      name: "7shifts.manage",
      functionName: "seven_shifts_manage",
      aliases: ["7shifts.manage", "seven_shifts_manage"],
      capability: "seven_shifts_manage",
      platformCapability: "seven_shifts_manage",
      action: "write",
      approvalRequired: true,
      description:
        "Run one pinned mutation from the current 7shifts public API.",
      inputSchema: {
        type: "object",
        properties: {
          operation: {
            type: "string",
            enum: [...SEVEN_SHIFTS_MANAGE_OPERATION_IDS],
          },
          pathParameters: { type: "object", maxProperties: 10 },
          query: { type: "object", maxProperties: 30 },
          json: { type: "object", maxProperties: 100 },
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "seven_shifts_safe",
      label: "Safe",
      description: "Reads run directly; every change requires confirmation.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [manage],
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "All selected 7shifts operations run without per-action Relay confirmation, within the connected company's provider authority.",
      defaultSelected: false,
      allowedActions: [read, manage],
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [{ id: "whoami", label: "7shifts company authorization" }],
};
