import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const read = action(
  "yodlee_fastlink_read",
  "Read Yodlee data",
  "Read bounded financial-account data for the exact partner-defined user.",
);
const manage = action(
  "yodlee_fastlink_full_api",
  "Use full Yodlee API",
  "Use a documented Yodlee 1.1 operation under the partner account; Safe mode requires approval.",
);
const guards = [
  action(
    "yodlee_secret_exposure",
    "Expose credentials",
    "Partner credentials and short-lived user tokens never enter agent-visible data.",
  ),
  action(
    "yodlee_other_origin",
    "Use another origin",
    "Requests stay on the configured official Yodlee environment.",
  ),
  action(
    "yodlee_unbounded_transfer",
    "Run an unbounded transfer",
    "Relay bounds query fields, bodies, results, redirects, and execution time.",
  ),
];
const query = {
  type: "object",
  additionalProperties: {
    oneOf: [
      { type: "string" },
      { type: "number" },
      { type: "boolean" },
      { type: "array", items: { type: "string" }, maxItems: 100 },
    ],
  },
};

export const YODLEE_FASTLINK_CONNECTOR_MANIFEST: MarketplaceConnectorManifest =
  {
    slug: "yodlee-fastlink",
    name: "Yodlee FastLink",
    connectorType: "native_clawchat",
    providerDocsUrl:
      "https://developer.yodlee.com/products/yodlee/core-apis/docs/api-reference",
    providerWebsiteUrl: "https://www.yodlee.com/fastlink",
    capabilities: [
      {
        ...capability(
          "financial_data_read",
          "Read financial data",
          "Read exact-user accounts, transactions, holdings, statements, and derived summaries from enabled Yodlee datasets.",
          true,
        ),
        platformCapability: "yodlee_fastlink_read",
      },
      {
        ...capability(
          "full_api",
          "Full Yodlee 1.1 API",
          "Use the complete documented API surface enabled for the customer's Yodlee contract.",
          true,
        ),
        platformCapability: "yodlee_fastlink_full_api",
      },
    ],
    auth: {
      type: "api_key",
      credentialSchema: [
        {
          name: "YODLEE_API_ORIGIN",
          label: "Yodlee API origin",
          required: true,
          secret: false,
          storedIn: "metadata",
          helpText:
            "Use the exact official Yodlee API origin assigned to the partner environment.",
        },
        {
          name: "YODLEE_CLIENT_ID",
          label: "Yodlee client ID",
          required: true,
          secret: true,
          storedIn: "encrypted_secret",
        },
        {
          name: "YODLEE_CLIENT_SECRET",
          label: "Yodlee client secret",
          required: true,
          secret: true,
          storedIn: "encrypted_secret",
        },
        {
          name: "YODLEE_LOGIN_NAME",
          label: "Partner-defined Yodlee user ID",
          required: true,
          secret: false,
          storedIn: "metadata",
        },
      ],
    },
    tools: [
      {
        name: "yodleeFastlink.read",
        functionName: "yodlee_fastlink_read",
        aliases: ["yodlee-fastlink.read"],
        capability: "financial_data_read",
        platformCapability: "yodlee_fastlink_read",
        action: "read",
        approvalRequired: false,
        description:
          "Read one documented Yodlee 1.1 route with bounded input and output.",
        inputSchema: {
          type: "object",
          properties: {
            method: { type: "string", enum: ["GET", "POST"] },
            path: { type: "string", minLength: 1, maxLength: 2000 },
            query,
            json: { type: "object" },
          },
          required: ["path"],
          additionalProperties: false,
        },
      },
      {
        name: "yodleeFastlink.manage",
        functionName: "yodlee_fastlink_manage",
        aliases: ["yodlee-fastlink.manage"],
        capability: "full_api",
        platformCapability: "yodlee_fastlink_full_api",
        action: "write",
        approvalRequired: true,
        description:
          "Call one documented Yodlee 1.1 mutation under the selected install policy.",
        inputSchema: {
          type: "object",
          properties: {
            method: {
              type: "string",
              enum: ["POST", "PUT", "PATCH", "DELETE"],
            },
            path: { type: "string", minLength: 1, maxLength: 2000 },
            query,
            json: { type: "object" },
            approvalId: { type: "string", maxLength: 200 },
          },
          required: ["method", "path"],
          additionalProperties: false,
        },
      },
    ],
    approvalProfiles: [
      {
        id: "yodlee_fastlink_safe",
        label: "Safe",
        description:
          "Bounded reads run directly; every write, delete, consent change, refresh, or administrative operation requires approval.",
        defaultSelected: true,
        allowedActions: [read],
        approvalRequiredActions: [manage],
        blockedActions: guards,
      },
      {
        id: "dangerously_skip_permissions",
        label: "Dangerously skip permissions",
        description:
          "Every selected Yodlee operation runs without Relay per-action approval; partner authorization, user binding, provider limits, secret isolation, request bounds, and audits still apply.",
        defaultSelected: false,
        allowedActions: [read, manage],
        approvalRequiredActions: [],
        blockedActions: guards,
      },
    ],
    healthChecks: [
      {
        id: "accounts",
        label:
          "Issue a short-lived user token and read one bounded accounts page",
      },
    ],
  };
