import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const read = action(
  "amazing_marvin_api_read",
  "Read Amazing Marvin",
  "Read bounded authorized tasks, projects, categories, labels, time data, rewards, reminders, goals, habits, profile data, and exact full-access documents.",
);
const manage = action(
  "amazing_marvin_api_manage",
  "Manage Amazing Marvin",
  "Create, complete, track, time, reward, remind, update, or irreversibly delete authorized Marvin data through exact documented endpoints.",
);
const guards = [
  action(
    "amazing_marvin_secret_exposure",
    "Expose credentials",
    "Both tokens remain encrypted and never enter agent-visible requests or results.",
  ),
  action(
    "amazing_marvin_unofficial_origin",
    "Use another API origin",
    "Every request stays on Marvin's documented public HTTPS API origin.",
  ),
  action(
    "amazing_marvin_unsupported_endpoint",
    "Call another endpoint",
    "Relay permits only endpoints listed in Marvin's official OpenAPI document.",
  ),
  action(
    "amazing_marvin_unbounded_transfer",
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

export const AMAZING_MARVIN_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "amazing-marvin",
  name: "Amazing Marvin",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://github.com/amazingmarvin/MarvinAPI/wiki/Marvin-API",
  providerWebsiteUrl: "https://amazingmarvin.com/",
  capabilities: [
    {
      ...capability(
        "productivity_read",
        "Read Marvin planning data",
        "Read authorized tasks, projects, categories, labels, schedules, time tracking, rewards, reminders, goals, habits, profile data, and exact database documents.",
        true,
      ),
      platformCapability: "amazing_marvin_productivity_read",
    },
    {
      ...capability(
        "productivity_manage",
        "Manage Marvin planning data",
        "Create tasks, projects and events; complete, track and time work; manage rewards, reminders and habits; and create, update, or delete exact database documents.",
        true,
      ),
      platformCapability: "amazing_marvin_productivity_manage",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "AMAZING_MARVIN_API_TOKEN",
        label: "Marvin API token",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "In Marvin, open Strategies > API > View Credentials and copy API_TOKEN.",
      },
      {
        name: "AMAZING_MARVIN_FULL_ACCESS_TOKEN",
        label: "Marvin full-access token",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "From the same credentials panel, copy FULL_ACCESS_TOKEN so agents can use read and manage tools you permit.",
      },
    ],
  },
  tools: [
    {
      name: "amazing-marvin.read",
      functionName: "amazing_marvin_api_read",
      aliases: ["amazing-marvin.read", "amazing_marvin_api_read"],
      capability: "productivity_read",
      platformCapability: "amazing_marvin_productivity_read",
      action: "read",
      approvalRequired: false,
      description: "Read one exact documented Amazing Marvin API endpoint.",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string", minLength: 1, maxLength: 100 },
          query: querySchema,
        },
        required: ["path"],
        additionalProperties: false,
      },
    },
    {
      name: "amazing-marvin.manage",
      functionName: "amazing_marvin_api_manage",
      aliases: ["amazing-marvin.manage", "amazing_marvin_api_manage"],
      capability: "productivity_manage",
      platformCapability: "amazing_marvin_productivity_manage",
      action: "write",
      approvalRequired: true,
      description:
        "Call one exact documented Marvin mutation with bounded JSON; Safe mode requires approval.",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string", minLength: 1, maxLength: 100 },
          query: querySchema,
          json: { type: "object" },
          autoComplete: { type: "boolean" },
          approvalId: { type: "string", maxLength: 200 },
        },
        required: ["path"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "amazing_marvin_safe",
      label: "Safe",
      description:
        "Reads run directly. Every creation, completion, tracking, time, reward, reminder, habit, document update, or irreversible deletion requires approval.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [manage],
      blockedActions: guards,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Every selected token-authorized Marvin operation runs without Relay per-action approval. Provider authority, exact endpoints, request bounds, credential protection, and audits still apply.",
      defaultSelected: false,
      allowedActions: [read, manage],
      approvalRequiredActions: [],
      blockedActions: guards,
    },
  ],
  healthChecks: [
    { id: "both_tokens", label: "Marvin API and full-access token validation" },
  ],
};
