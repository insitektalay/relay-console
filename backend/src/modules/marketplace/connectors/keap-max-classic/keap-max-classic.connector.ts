import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const read = action(
  "keap_max_classic_api_read",
  "Read Keap Max Classic",
  "Read bounded Keap Max Classic CRM, marketing, ecommerce, product, order, campaign, appointment, task, note, user, and account data through documented REST API operations.",
);
const manage = action(
  "keap_max_classic_api_manage",
  "Manage Keap Max Classic",
  "Create, update, delete, or trigger one exact documented Keap Max Classic REST API operation.",
);
const guards = [
  action(
    "keap_max_classic_secret_exposure",
    "Expose credentials",
    "OAuth client secrets, access tokens, refresh tokens, personal access tokens, service account keys, and credential-shaped fields never enter agent-visible requests or results.",
  ),
  action(
    "keap_max_classic_unofficial_origin",
    "Use another API origin",
    "Every request stays on Keap's documented https://api.infusionsoft.com origin.",
  ),
  action(
    "keap_max_classic_unsupported_endpoint",
    "Call another endpoint",
    "Relay permits only pinned Keap REST v1 routes and blocks raw URLs, private application endpoints, XML-RPC, bulk imports, exports, and arbitrary API access.",
  ),
  action(
    "keap_max_classic_unbounded_transfer",
    "Run an unbounded transfer",
    "Relay bounds pages, page sizes, query fields, arrays, bodies, responses, redirects, nesting, and execution time and never follows pagination automatically.",
  ),
];

const querySchema = {
  type: "object",
  additionalProperties: {
    oneOf: [
      { type: "string" },
      { type: "number" },
      { type: "boolean" },
      {
        type: "array",
        items: {
          oneOf: [{ type: "string" }, { type: "number" }, { type: "boolean" }],
        },
        maxItems: 100,
      },
    ],
  },
};

export const KEAP_MAX_CLASSIC_CONNECTOR_MANIFEST: MarketplaceConnectorManifest =
  {
    slug: "keap-max-classic",
    name: "Keap Max Classic",
    connectorType: "native_clawchat",
    providerDocsUrl: "https://developer.keap.com/docs/rest/",
    providerWebsiteUrl: "https://keap.com/infusionsoft-is-now-keap",
    capabilities: [
      {
        ...capability(
          "crm_read",
          "Read CRM and commerce",
          "Read bounded Keap Max Classic account, contact, company, opportunity, appointment, task, note, campaign, product, order, user, tag, and locale data.",
          true,
        ),
        platformCapability: "keap_max_classic_crm_read",
      },
      {
        ...capability(
          "crm_manage",
          "Manage CRM and automation",
          "Use documented Keap Max Classic mutations for selected contacts, companies, opportunities, appointments, tasks, notes, products, campaign goals and sequences, tags, and related records.",
          true,
        ),
        platformCapability: "keap_max_classic_crm_manage",
      },
    ],
    auth: {
      type: "oauth2_authorization_code",
      oauth: {
        authorizationUrl: "https://signin.infusionsoft.com/app/oauth/authorize",
        tokenUrl: "https://api.infusionsoft.com/token",
        requiredScopes: ["full"],
        pkce: false,
        supportsRefresh: true,
      },
      credentialSchema: [],
    },
    tools: [
      {
        name: "keapMaxClassic.read",
        functionName: "keap_max_classic_api_read",
        aliases: ["keapMaxClassic.read", "keap_max_classic_api_read"],
        capability: "crm_read",
        platformCapability: "keap_max_classic_crm_read",
        action: "read",
        approvalRequired: false,
        description:
          "Read one exact documented Keap REST v1 endpoint with bounded query parameters.",
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
        name: "keapMaxClassic.manage",
        functionName: "keap_max_classic_api_manage",
        aliases: ["keapMaxClassic.manage", "keap_max_classic_api_manage"],
        capability: "crm_manage",
        platformCapability: "keap_max_classic_crm_manage",
        action: "write",
        approvalRequired: true,
        description:
          "Run one exact documented Keap REST v1 mutation; Safe mode requires approval.",
        inputSchema: {
          type: "object",
          properties: {
            method: {
              type: "string",
              enum: ["POST", "PUT", "PATCH", "DELETE"],
            },
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
        id: "keap_max_classic_safe",
        label: "Safe",
        description:
          "Documented bounded reads run directly. Every CRM, campaign, ecommerce, automation, communication, and deletion mutation requires approval.",
        defaultSelected: true,
        allowedActions: [read],
        approvalRequiredActions: [manage],
        blockedActions: guards,
      },
      {
        id: "dangerously_skip_permissions",
        label: "Dangerously skip permissions",
        description:
          "Every pinned REST operation authorized by the connected Keap user runs without Relay per-action approval. Connection ownership, OAuth grant, Max Classic plan and user authority, exact routes, bounds, redaction, provider limits, and audits still apply.",
        defaultSelected: false,
        allowedActions: [read, manage],
        approvalRequiredActions: [],
        blockedActions: guards,
      },
    ],
    healthChecks: [
      { id: "account-profile", label: "Keap account profile validation" },
    ],
  };
