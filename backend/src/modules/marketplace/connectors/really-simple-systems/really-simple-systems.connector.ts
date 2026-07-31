import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const read = action(
  "really_simple_systems_api_read",
  "Read Spotler CRM",
  "Read bounded CRM, marketing, service, document, opportunity, data-dictionary, and lookup data through exact V4 operations.",
);
const manage = action(
  "really_simple_systems_api_manage",
  "Manage Spotler CRM",
  "Create, update, or delete supported records, or append lookup values, through an exact V4 operation.",
);
const guards = [
  action(
    "really_simple_systems_secret_exposure",
    "Expose credentials",
    "The customer-generated Spotler CRM access token never enters agent-visible requests or results.",
  ),
  action(
    "really_simple_systems_unofficial_origin",
    "Use another API origin",
    "Every request stays on Spotler CRM's documented HTTPS V4 API origin.",
  ),
  action(
    "really_simple_systems_unsupported_endpoint",
    "Call another endpoint",
    "Relay permits only the eleven documented record resources plus bounded data-dictionary and lookup operations.",
  ),
  action(
    "really_simple_systems_unbounded_transfer",
    "Run an unbounded transfer",
    "Relay bounds pagination, filter and order JSON, arrays, bodies, responses, redirects, nesting, and execution time.",
  ),
];
const querySchema = {
  type: "object",
  properties: {
    limit: { type: "integer", minimum: 1, maximum: 100 },
    page: { type: "integer", minimum: 1, maximum: 10000 },
    lines: { type: "boolean" },
    q: { type: "string", maxLength: 10000 },
    order: { type: "string", maxLength: 10000 },
  },
  additionalProperties: false,
};

export const REALLY_SIMPLE_SYSTEMS_CONNECTOR_MANIFEST: MarketplaceConnectorManifest =
  {
    slug: "really-simple-systems",
    name: "Spotler CRM",
    connectorType: "native_clawchat",
    providerDocsUrl: "https://support.reallysimplesystems.com/api-v4/",
    providerWebsiteUrl: "https://spotler.com/en-gb/crm",
    capabilities: [
      {
        ...capability(
          "crm_read",
          "Read CRM and configuration",
          "Read supported accounts, activities, contacts, campaigns, campaign details and stages, cases, documents, opportunities and histories, opportunity lines, data dictionaries, and lookup values.",
          true,
        ),
        platformCapability: "really_simple_systems_crm_read",
      },
      {
        ...capability(
          "crm_manage",
          "Manage CRM records and lookups",
          "Create, update, and delete all eleven documented record types and append provider lookup-list values, subject to the connected user's plan, add-ons, and permissions.",
          true,
        ),
        platformCapability: "really_simple_systems_crm_manage",
      },
    ],
    auth: {
      type: "api_key",
      credentialSchema: [
        {
          name: "SPOTLER_CRM_ACCESS_TOKEN",
          label: "Spotler CRM V4 access token",
          required: true,
          secret: true,
          storedIn: "encrypted_secret",
          helpText:
            "Enable API V4 for a dedicated least-privilege user, generate its one-time token under Manage API Keys and Alerts, and paste it here. Relay encrypts it and sends it only to apiv4.reallysimplesystems.com.",
        },
      ],
    },
    tools: [
      {
        name: "really-simple-systems.read",
        functionName: "really_simple_systems_api_read",
        aliases: [
          "really-simple-systems.read",
          "really_simple_systems_api_read",
          "spotler-crm.read",
        ],
        capability: "crm_read",
        platformCapability: "really_simple_systems_crm_read",
        action: "read",
        approvalRequired: false,
        description:
          "Read one exact Spotler CRM V4 record, dictionary, or lookup route with bounded query parameters.",
        inputSchema: {
          type: "object",
          properties: {
            path: { type: "string", minLength: 1, maxLength: 500 },
            query: querySchema,
          },
          required: ["path"],
          additionalProperties: false,
        },
      },
      {
        name: "really-simple-systems.manage",
        functionName: "really_simple_systems_api_manage",
        aliases: [
          "really-simple-systems.manage",
          "really_simple_systems_api_manage",
          "spotler-crm.manage",
        ],
        capability: "crm_manage",
        platformCapability: "really_simple_systems_crm_manage",
        action: "write",
        approvalRequired: true,
        description:
          "Run one exact Spotler CRM V4 record or lookup mutation; Safe mode requires approval.",
        inputSchema: {
          type: "object",
          properties: {
            method: { type: "string", enum: ["POST", "PATCH", "DELETE"] },
            path: { type: "string", minLength: 1, maxLength: 500 },
            query: querySchema,
            json: {
              oneOf: [{ type: "object" }, { type: "array", maxItems: 1000 }],
            },
            approvalId: { type: "string", maxLength: 200 },
          },
          required: ["method", "path"],
          additionalProperties: false,
        },
      },
    ],
    approvalProfiles: [
      {
        id: "really_simple_systems_safe",
        label: "Safe",
        description:
          "Selected bounded reads run directly. Every CRM, marketing, service, document, opportunity, lookup, and deletion mutation requires approval.",
        defaultSelected: true,
        allowedActions: [read],
        approvalRequiredActions: [manage],
        blockedActions: guards,
      },
      {
        id: "dangerously_skip_permissions",
        label: "Dangerously skip permissions",
        description:
          "Every selected V4 mutation authorized by the connected Spotler CRM user runs without Relay per-action approval. Connection ownership, provider roles and plan, exact routes, fixed origin, bounds, redaction, provider limits, and audits still apply.",
        defaultSelected: false,
        allowedActions: [read, manage],
        approvalRequiredActions: [],
        blockedActions: guards,
      },
    ],
    healthChecks: [
      { id: "access-token", label: "Spotler CRM V4 access-token validation" },
    ],
  };
