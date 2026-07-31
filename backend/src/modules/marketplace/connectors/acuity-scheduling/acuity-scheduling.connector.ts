import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const read = action(
  "acuity_scheduling_api_read",
  "Read Acuity Scheduling",
  "Read bounded appointments, availability, clients, calendars, forms, products, orders, and account data.",
);
const manage = action(
  "acuity_scheduling_api_manage",
  "Manage Acuity Scheduling",
  "Book, update, reschedule, cancel, or mark appointments as no-shows; manage blocks, clients, and webhooks.",
);
const guards = [
  action(
    "acuity_scheduling_secret_exposure",
    "Expose credentials",
    "OAuth credentials never enter agent-visible requests or results.",
  ),
  action(
    "acuity_scheduling_unofficial_origin",
    "Use another API origin",
    "Every request stays on Acuity Scheduling's documented API origin.",
  ),
  action(
    "acuity_scheduling_unsupported_endpoint",
    "Call another endpoint",
    "Relay permits only Acuity Scheduling's documented public API routes.",
  ),
  action(
    "acuity_scheduling_unbounded_transfer",
    "Run an unbounded transfer",
    "Relay bounds queries, request bodies, responses, redirects, nesting, and execution time.",
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

export const ACUITY_SCHEDULING_CONNECTOR_MANIFEST: MarketplaceConnectorManifest =
  {
    slug: "acuity-scheduling",
    name: "Acuity Scheduling",
    connectorType: "native_clawchat",
    providerDocsUrl: "https://developers.acuityscheduling.com/",
    providerWebsiteUrl: "https://acuityscheduling.com/",
    capabilities: [
      {
        ...capability(
          "schedule_read",
          "Read scheduling data",
          "Read appointments, availability, clients, calendars, appointment types, forms, products, orders, webhooks, and account metadata.",
          true,
        ),
        platformCapability: "acuity_scheduling_schedule_read",
      },
      {
        ...capability(
          "schedule_manage",
          "Manage scheduling",
          "Book, update, reschedule, cancel, or mark appointments as no-shows; create or remove blocked time; update clients; and manage webhooks.",
          true,
        ),
        platformCapability: "acuity_scheduling_schedule_manage",
      },
    ],
    auth: {
      type: "oauth2_authorization_code",
      oauth: {
        authorizationUrl: "https://acuityscheduling.com/oauth2/authorize",
        tokenUrl: "https://acuityscheduling.com/oauth2/token",
        userInfoUrl: "https://acuityscheduling.com/api/v1/me",
        requiredScopes: ["api-v1"],
        optionalScopes: [],
        pkce: false,
        supportsRefresh: false,
      },
      credentialSchema: [
        {
          name: "ACUITY_SCHEDULING_CLIENT_ID",
          label: "Acuity Scheduling OAuth client ID",
          required: true,
          secret: false,
          storedIn: "metadata",
        },
        {
          name: "ACUITY_SCHEDULING_CLIENT_SECRET",
          label: "Acuity Scheduling OAuth client secret",
          required: true,
          secret: true,
          storedIn: "encrypted_secret",
        },
      ],
    },
    tools: [
      {
        name: "acuity-scheduling.read",
        functionName: "acuity_scheduling_api_read",
        aliases: ["acuity-scheduling.read", "acuity_scheduling_api_read"],
        capability: "schedule_read",
        platformCapability: "acuity_scheduling_schedule_read",
        action: "read",
        approvalRequired: false,
        description: "Read one exact documented Acuity Scheduling endpoint.",
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
        name: "acuity-scheduling.manage",
        functionName: "acuity_scheduling_api_manage",
        aliases: ["acuity-scheduling.manage", "acuity_scheduling_api_manage"],
        capability: "schedule_manage",
        platformCapability: "acuity_scheduling_schedule_manage",
        action: "write",
        approvalRequired: true,
        description:
          "Call one exact documented Acuity Scheduling mutation with bounded JSON; Safe mode requires approval.",
        inputSchema: {
          type: "object",
          properties: {
            method: { type: "string", enum: ["POST", "PUT", "DELETE"] },
            path: { type: "string", minLength: 1, maxLength: 500 },
            query: querySchema,
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
        id: "acuity_scheduling_safe",
        label: "Safe",
        description:
          "Reads run directly. Every appointment, blocked-time, client, or webhook change requires approval.",
        defaultSelected: true,
        allowedActions: [read],
        approvalRequiredActions: [manage],
        blockedActions: guards,
      },
      {
        id: "dangerously_skip_permissions",
        label: "Dangerously skip permissions",
        description:
          "Every selected operation authorized by the connected Acuity Scheduling account runs without Relay per-action approval. Provider authority, exact routes, bounds, credential protection, and audits still apply.",
        defaultSelected: false,
        allowedActions: [read, manage],
        approvalRequiredActions: [],
        blockedActions: guards,
      },
    ],
    healthChecks: [
      {
        id: "account",
        label: "OAuth token and Acuity Scheduling account validation",
      },
    ],
  };
