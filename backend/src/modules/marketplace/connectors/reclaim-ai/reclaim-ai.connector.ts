import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const read = action(
  "reclaim_ai_api_read",
  "Read Reclaim.ai",
  "Read bounded authorized users, calendar events, tasks, smart habits, time policies, and scheduling links.",
);
const manage = action(
  "reclaim_ai_api_manage",
  "Manage Reclaim.ai",
  "Create and update tasks, control task and habit sessions, snooze or complete work, interpret quick plans, and create one-off scheduling links.",
);
const guards = [
  action(
    "reclaim_ai_secret_exposure",
    "Expose the API key",
    "The API key remains encrypted and never enters agent-visible requests or results.",
  ),
  action(
    "reclaim_ai_unofficial_origin",
    "Use another API origin",
    "Every request stays on Reclaim's public API origin used by its supported Raycast integration.",
  ),
  action(
    "reclaim_ai_unsupported_endpoint",
    "Call another endpoint",
    "Relay permits only the exact routes currently exercised by Reclaim's supported Raycast integration.",
  ),
  action(
    "reclaim_ai_unbounded_transfer",
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

export const RECLAIM_AI_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "reclaim-ai",
  name: "Reclaim.ai",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://help.reclaim.ai/en/articles/8136585-overview-raycast-extension-for-reclaim-ai",
  providerWebsiteUrl: "https://reclaim.ai/",
  capabilities: [
    {
      ...capability(
        "schedule_read",
        "Read Reclaim schedules",
        "Read the authorized user, calendar events, tasks, smart habits, time policies, scheduling links, and scheduling-link groups.",
        true,
      ),
      platformCapability: "reclaim_ai_schedule_read",
    },
    {
      ...capability(
        "schedule_manage",
        "Manage Reclaim schedules",
        "Create and update tasks, start or stop task and habit sessions, add time, complete or reopen work, snooze tasks, interpret quick plans, and create one-off scheduling links.",
        true,
      ),
      platformCapability: "reclaim_ai_schedule_manage",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "RECLAIM_AI_API_KEY",
        label: "Reclaim.ai API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "In Reclaim, open Settings > Developer, generate an API key, and copy it when Reclaim shows it.",
      },
    ],
  },
  tools: [
    {
      name: "reclaim-ai.read",
      functionName: "reclaim_ai_api_read",
      aliases: ["reclaim-ai.read", "reclaim_ai_api_read"],
      capability: "schedule_read",
      platformCapability: "reclaim_ai_schedule_read",
      action: "read",
      approvalRequired: false,
      description: "Read one exact supported Reclaim API endpoint.",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string", minLength: 1, maxLength: 300 },
          query: querySchema,
        },
        required: ["path"],
        additionalProperties: false,
      },
    },
    {
      name: "reclaim-ai.manage",
      functionName: "reclaim_ai_api_manage",
      aliases: ["reclaim-ai.manage", "reclaim_ai_api_manage"],
      capability: "schedule_manage",
      platformCapability: "reclaim_ai_schedule_manage",
      action: "write",
      approvalRequired: true,
      description:
        "Call one exact supported Reclaim mutation with bounded JSON; Safe mode requires approval.",
      inputSchema: {
        type: "object",
        properties: {
          method: { type: "string", enum: ["POST", "PATCH"] },
          path: { type: "string", minLength: 1, maxLength: 300 },
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
      id: "reclaim_ai_safe",
      label: "Safe",
      description:
        "Reads run directly. Every task, habit, planner, interpreter, or one-off-link mutation requires approval.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [manage],
      blockedActions: guards,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Every selected key-authorized Reclaim operation runs without Relay per-action approval. Provider authority, exact endpoints, request bounds, credential protection, and audits still apply.",
      defaultSelected: false,
      allowedActions: [read, manage],
      approvalRequiredActions: [],
      blockedActions: guards,
    },
  ],
  healthChecks: [{ id: "api_key", label: "Reclaim.ai API key validation" }],
};
