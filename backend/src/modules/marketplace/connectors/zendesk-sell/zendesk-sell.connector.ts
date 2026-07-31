import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const read = action(
  "zendesk_sell_api_read",
  "Read Zendesk Sell",
  "Read bounded Sales CRM leads, contacts, deals, tasks, notes, calls, visits, products, pipelines, stages, users, account, and configuration data through documented Core API operations.",
);
const manage = action(
  "zendesk_sell_api_manage",
  "Manage Zendesk Sell",
  "Create, update, delete, convert, or associate one exact documented Sales CRM record through a pinned Core API mutation.",
);
const guards = [
  action(
    "zendesk_sell_secret_exposure",
    "Expose credentials",
    "OAuth client secrets, access tokens, refresh tokens, and credential-shaped provider fields never enter agent-visible requests or results.",
  ),
  action(
    "zendesk_sell_unofficial_origin",
    "Use another API origin",
    "Every request stays on Zendesk Sell's documented https://api.getbase.com origin.",
  ),
  action(
    "zendesk_sell_unsupported_endpoint",
    "Call another endpoint",
    "Relay permits only pinned Sales CRM Core API v2 routes and blocks Search, Sync, Firehose, Apps, raw URLs, and arbitrary endpoints.",
  ),
  action(
    "zendesk_sell_unbounded_transfer",
    "Run an unbounded transfer",
    "Relay bounds list pages, page sizes, query fields, arrays, bodies, responses, redirects, nesting, and execution time and never follows pagination automatically.",
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

export const ZENDESK_SELL_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "zendesk-sell",
  name: "Zendesk Sell",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developer.zendesk.com/api-reference/sales-crm/",
  providerWebsiteUrl: "https://www.zendesk.com/sell/",
  capabilities: [
    {
      ...capability(
        "sales_crm_read",
        "Read sales CRM",
        "Read documented Zendesk Sell Core API resources for leads, contacts, deals, tasks, notes, calls, visits, products, pipelines, stages, users, account, and selected configuration records.",
        true,
      ),
      platformCapability: "zendesk_sell_sales_crm_read",
    },
    {
      ...capability(
        "sales_crm_manage",
        "Manage sales CRM",
        "Use documented Core API mutations for selected leads, contacts, deals, tasks, notes, calls, visits, products, sequence enrollments, tags, and associations.",
        true,
      ),
      platformCapability: "zendesk_sell_sales_crm_manage",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://api.getbase.com/oauth2/authorize",
      tokenUrl: "https://api.getbase.com/oauth2/token",
      revocationUrl: "https://api.getbase.com/oauth2/revoke",
      requiredScopes: ["read", "write", "profile"],
      pkce: false,
      supportsRefresh: true,
    },
    credentialSchema: [],
  },
  tools: [
    {
      name: "zendeskSell.read",
      functionName: "zendesk_sell_api_read",
      aliases: ["zendeskSell.read", "zendesk_sell_api_read"],
      capability: "sales_crm_read",
      platformCapability: "zendesk_sell_sales_crm_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read one exact documented Zendesk Sell Core API endpoint with bounded query parameters.",
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
      name: "zendeskSell.manage",
      functionName: "zendesk_sell_api_manage",
      aliases: ["zendeskSell.manage", "zendesk_sell_api_manage"],
      capability: "sales_crm_manage",
      platformCapability: "zendesk_sell_sales_crm_manage",
      action: "write",
      approvalRequired: true,
      description:
        "Run one exact documented Zendesk Sell Core API mutation; Safe mode requires approval.",
      inputSchema: {
        type: "object",
        properties: {
          method: { type: "string", enum: ["POST", "PUT", "DELETE"] },
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
      id: "zendesk_sell_safe",
      label: "Safe",
      description:
        "Documented bounded reads run directly. Every sales-record, activity, sequence, association, tag, and deletion mutation requires approval.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [manage],
      blockedActions: guards,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Every pinned Core API operation authorized by the connected Sell user runs without Relay per-action approval. Connection ownership, OAuth scopes, provider roles, exact routes, bounds, retirement status, redaction, provider limits, and audits still apply.",
      defaultSelected: false,
      allowedActions: [read, manage],
      approvalRequiredActions: [],
      blockedActions: guards,
    },
  ],
  healthChecks: [
    { id: "token-info", label: "Zendesk Sell OAuth token validation" },
    { id: "account", label: "Zendesk Sell account binding" },
  ],
};
