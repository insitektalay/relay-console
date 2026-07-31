import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import {
  NATIONBUILDER_MANAGE_OPERATION_IDS,
  NATIONBUILDER_OPERATIONS,
  NATIONBUILDER_READ_OPERATION_IDS,
} from "./nationbuilder-operation-registry";

const read = action(
  "nationbuilder_read",
  "Read NationBuilder",
  "Read authorized people, donations, events, lists, memberships, paths, petitions, surveys, voters and organizing data.",
);
const manage = action(
  "nationbuilder_manage",
  "Manage NationBuilder",
  "Create, update, archive or delete authorized NationBuilder records; Safe mode requires approval.",
);

export const NATIONBUILDER_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "nationbuilder",
  name: "NationBuilder",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://nationbuilder.com/api/v2/reference",
  providerWebsiteUrl: "https://nationbuilder.com/",
  capabilities: [
    {
      ...capability(
        "nationbuilder_read",
        "Read organizing and community data",
        `Use all ${NATIONBUILDER_READ_OPERATION_IDS.length} current official V2 API reads.`,
        true,
      ),
      platformCapability: "nationbuilder_read",
    },
    {
      ...capability(
        "nationbuilder_manage",
        "Manage organizing and community data",
        `Use all ${NATIONBUILDER_MANAGE_OPERATION_IDS.length} current official V2 API mutations.`,
        true,
      ),
      platformCapability: "nationbuilder_manage",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://nationbuilder.com/oauth/authorize",
      tokenUrl: "https://nationbuilder.com/oauth/token",
      userInfoUrl: "https://nationbuilder.com/api/v2/signups/me",
      requiredScopes: ["default"],
      optionalScopes: [],
      pkce: true,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "NATIONBUILDER_CLIENT_ID",
        label: "NationBuilder OAuth client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Railway-held Relay Console client ID issued after NationBuilder developer certification and app registration.",
      },
      {
        name: "NATIONBUILDER_CLIENT_SECRET",
        label: "NationBuilder OAuth client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Railway-held Relay Console client secret; never sent to agents, browsers or clients.",
      },
    ],
  },
  tools: [
    {
      name: "nationbuilder.read",
      functionName: "nationbuilder_read",
      aliases: ["nationbuilder.read", "nationbuilder_read"],
      capability: "nationbuilder_read",
      platformCapability: "nationbuilder_read",
      action: "read",
      approvalRequired: false,
      description: "Run one pinned NationBuilder V2 API read.",
      inputSchema: {
        type: "object",
        properties: {
          operation: {
            type: "string",
            enum: [...NATIONBUILDER_READ_OPERATION_IDS],
          },
          pathParameters: { type: "object", maxProperties: 1 },
          query: { type: "object", maxProperties: 50 },
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
    {
      name: "nationbuilder.manage",
      functionName: "nationbuilder_manage",
      aliases: ["nationbuilder.manage", "nationbuilder_manage"],
      capability: "nationbuilder_manage",
      platformCapability: "nationbuilder_manage",
      action: "write",
      approvalRequired: true,
      description:
        "Run one pinned NationBuilder V2 API mutation; Safe mode requires approval.",
      inputSchema: {
        type: "object",
        properties: {
          operation: {
            type: "string",
            enum: [...NATIONBUILDER_MANAGE_OPERATION_IDS],
          },
          pathParameters: { type: "object", maxProperties: 1 },
          query: { type: "object", maxProperties: 50 },
          json: {},
          approvalId: { type: "string", maxLength: 200 },
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "nationbuilder_safe",
      label: "Safe",
      description: `All ${NATIONBUILDER_READ_OPERATION_IDS.length} reads run directly; all ${NATIONBUILDER_MANAGE_OPERATION_IDS.length} mutations require approval.`,
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [manage],
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description: `All ${NATIONBUILDER_OPERATIONS.length} pinned V2 operations run without Relay per-action approval; nation binding, user permissions, rotating OAuth, fixed routes, audits, bounds and provider limits still apply.`,
      defaultSelected: false,
      allowedActions: [read, manage],
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    {
      id: "oauth_admin_and_nation_binding",
      label: "NationBuilder OAuth admin and exact nation access check",
      requiredScopes: ["default"],
    },
  ],
};
