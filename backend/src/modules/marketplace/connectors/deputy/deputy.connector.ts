import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import {
  DEPUTY_OPERATIONS,
  DEPUTY_READ_OPERATION_IDS,
  DEPUTY_WRITE_OPERATION_IDS,
} from "./deputy-operation-registry";

const reads = [
  action(
    "deputy_read",
    "Read Deputy",
    "Read bounded workforce, scheduling, time, attendance, leave, task, communication, and account data.",
  ),
];
const writes = [
  action(
    "deputy_write",
    "Manage Deputy",
    "Create, update, publish, approve, archive, or delete data where the connected Deputy user is authorized; Safe mode requires approval.",
  ),
];
const objectSchema = {
  type: "object",
  maxProperties: 500,
  additionalProperties: true,
};
const commonProperties = {
  pathParameters: objectSchema,
  query: objectSchema,
  headers: objectSchema,
  body: objectSchema,
  contentBase64: { type: "string", maxLength: 2_700_000 },
  fileName: { type: "string", maxLength: 255 },
  mimeType: { type: "string", maxLength: 200 },
};

export const DEPUTY_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "deputy",
  name: "Deputy",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developer.deputy.com/",
  providerWebsiteUrl: "https://www.deputy.com/",
  capabilities: [
    {
      ...capability(
        "deputy_read",
        "Read Deputy",
        `Use all ${DEPUTY_READ_OPERATION_IDS.length} pinned active Deputy retrieval operations with bounded results and the connected user's authority.`,
        true,
      ),
      platformCapability: "deputy_read",
    },
    {
      ...capability(
        "deputy_write",
        "Manage Deputy",
        `Use all ${DEPUTY_WRITE_OPERATION_IDS.length} pinned active public Deputy mutations for workforce, scheduling, time, attendance, leave, tasks, communication, and administration.`,
        true,
      ),
      platformCapability: "deputy_write",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://once.deputy.com/my/oauth/login",
      tokenUrl: "https://once.deputy.com/my/oauth/access_token",
      userInfoUrl: "https://{install}.{geo}.deputy.com/api/v1/me",
      requiredScopes: ["longlife_refresh_token"],
      optionalScopes: [],
      pkce: false,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "DEPUTY_CLIENT_ID",
        label: "Deputy client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText: "Relay-owned public OAuth client configured on Railway.",
      },
      {
        name: "DEPUTY_CLIENT_SECRET",
        label: "Deputy client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Relay-owned OAuth secret configured on Railway and never exposed to clients or agents.",
      },
    ],
  },
  tools: [
    {
      name: "deputy.read",
      functionName: "deputy_read",
      aliases: ["deputy.read", "deputy_read"],
      capability: "deputy_read",
      platformCapability: "deputy_read",
      action: "read",
      approvalRequired: false,
      description:
        "Run one pinned active official Deputy GET operation against the OAuth-bound customer install.",
      inputSchema: {
        type: "object",
        properties: {
          operation: { type: "string", enum: [...DEPUTY_READ_OPERATION_IDS] },
          ...commonProperties,
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
    {
      name: "deputy.manage",
      functionName: "deputy_manage",
      aliases: ["deputy.manage", "deputy_manage"],
      capability: "deputy_write",
      platformCapability: "deputy_write",
      action: "write",
      approvalRequired: true,
      description:
        "Run one pinned active official Deputy mutation. Safe mode requires approval and Deputy enforces the connected user's authority.",
      inputSchema: {
        type: "object",
        properties: {
          operation: { type: "string", enum: [...DEPUTY_WRITE_OPERATION_IDS] },
          ...commonProperties,
          approvalId: { type: "string" },
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "deputy_safe",
      label: "Safe",
      description: `All ${DEPUTY_READ_OPERATION_IDS.length} bounded Deputy reads run directly; every mutation requires approval.`,
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: writes,
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description: `All ${DEPUTY_OPERATIONS.length} selected and Deputy-authorized public operations run without Relay per-action approval; connection ownership, fixed install authority, exact routes, bounds, audits, redaction, provider limits, and account authority still apply.`,
      defaultSelected: false,
      allowedActions: [...reads, ...writes],
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    {
      id: "user_and_install",
      label:
        "Deputy connected user, rotating refresh token, and customer-install authority binding",
    },
  ],
};
