import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import {
  LITTLE_GREEN_LIGHT_MANAGE_OPERATION_IDS,
  LITTLE_GREEN_LIGHT_OPERATIONS,
  LITTLE_GREEN_LIGHT_READ_OPERATION_IDS,
} from "./little-green-light-operation-registry";

const read = action(
  "little_green_light_read",
  "Read Little Green Light",
  "Use every documented read in Little Green Light's public REST API.",
);
const manage = action(
  "little_green_light_manage",
  "Manage Little Green Light",
  "Create, update or delete authorized nonprofit CRM records; Safe mode requires approval.",
);

export const LITTLE_GREEN_LIGHT_CONNECTOR_MANIFEST: MarketplaceConnectorManifest =
  {
    slug: "little-green-light",
    name: "Little Green Light",
    connectorType: "native_clawchat",
    providerDocsUrl: "https://api.littlegreenlight.com/api-docs/static.html",
    providerWebsiteUrl: "https://www.littlegreenlight.com/",
    capabilities: [
      {
        ...capability(
          "little_green_light_read",
          "Read nonprofit CRM data",
          `Use all ${LITTLE_GREEN_LIGHT_READ_OPERATION_IDS.length} documented REST reads.`,
          true,
        ),
        platformCapability: "little_green_light_read",
      },
      {
        ...capability(
          "little_green_light_manage",
          "Manage nonprofit CRM data",
          `Use all ${LITTLE_GREEN_LIGHT_MANAGE_OPERATION_IDS.length} documented REST mutations.`,
          true,
        ),
        platformCapability: "little_green_light_manage",
      },
    ],
    auth: {
      type: "api_key",
      credentialSchema: [
        {
          name: "LITTLE_GREEN_LIGHT_API_KEY",
          label: "Little Green Light API key",
          required: true,
          secret: true,
          storedIn: "encrypted_secret",
          requiredForAuthTypes: ["api_key"],
          helpText:
            "An administrator generates the API key under Settings, Integration settings, LGL API. Relay encrypts it and sends it only to api.littlegreenlight.com in the Bearer authorization header.",
        },
      ],
    },
    tools: [
      {
        name: "littleGreenLight.read",
        functionName: "little_green_light_read",
        aliases: ["littleGreenLight.read", "little_green_light_read"],
        capability: "little_green_light_read",
        platformCapability: "little_green_light_read",
        action: "read",
        approvalRequired: false,
        description:
          "Run one pinned read from Little Green Light's complete documented REST surface.",
        inputSchema: {
          type: "object",
          properties: {
            operation: {
              type: "string",
              enum: [...LITTLE_GREEN_LIGHT_READ_OPERATION_IDS],
            },
            pathParameters: { type: "object", maxProperties: 4 },
            query: { type: "object", maxProperties: 50 },
          },
          required: ["operation"],
          additionalProperties: false,
        },
      },
      {
        name: "littleGreenLight.manage",
        functionName: "little_green_light_manage",
        aliases: ["littleGreenLight.manage", "little_green_light_manage"],
        capability: "little_green_light_manage",
        platformCapability: "little_green_light_manage",
        action: "write",
        approvalRequired: true,
        description:
          "Run one pinned Little Green Light mutation; Safe mode requires approval.",
        inputSchema: {
          type: "object",
          properties: {
            operation: {
              type: "string",
              enum: [...LITTLE_GREEN_LIGHT_MANAGE_OPERATION_IDS],
            },
            pathParameters: { type: "object", maxProperties: 4 },
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
        id: "little_green_light_safe",
        label: "Safe",
        description: `All ${LITTLE_GREEN_LIGHT_READ_OPERATION_IDS.length} reads run directly; all ${LITTLE_GREEN_LIGHT_MANAGE_OPERATION_IDS.length} mutations require approval.`,
        defaultSelected: true,
        allowedActions: [read],
        approvalRequiredActions: [manage],
        blockedActions: [],
      },
      {
        id: "dangerously_skip_permissions",
        label: "Dangerously skip permissions",
        description: `All ${LITTLE_GREEN_LIGHT_OPERATIONS.length} documented REST operations run without Relay per-action approval; fixed routes, audits, bounds, provider permissions and limits still apply.`,
        defaultSelected: false,
        allowedActions: [read, manage],
        approvalRequiredActions: [],
        blockedActions: [],
      },
    ],
    healthChecks: [
      {
        id: "api_key_and_account_types",
        label: "Little Green Light API key and account-types check",
      },
    ],
  };
