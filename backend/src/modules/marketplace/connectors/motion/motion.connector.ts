import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const read = action(
  "motion_api_read",
  "Read Motion",
  "Read bounded authorized workspaces, users, schedules, statuses, projects, tasks, recurring tasks, comments, and custom fields.",
);
const manage = action(
  "motion_api_manage",
  "Manage Motion",
  "Create, update, move, unassign, or delete authorized Motion work through exact documented endpoints.",
);
const guards = [
  action(
    "motion_secret_exposure",
    "Expose the API key",
    "The API key remains encrypted and never enters agent-visible requests or results.",
  ),
  action(
    "motion_unofficial_origin",
    "Use another API origin",
    "Every request stays on Motion's documented public HTTPS API origin.",
  ),
  action(
    "motion_unsupported_endpoint",
    "Call another endpoint",
    "Relay permits only endpoints listed in Motion's current official API reference.",
  ),
  action(
    "motion_unbounded_transfer",
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

export const MOTION_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "motion",
  name: "Motion",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://docs.usemotion.com/api-reference/",
  providerWebsiteUrl: "https://www.usemotion.com/",
  capabilities: [
    {
      ...capability(
        "work_read",
        "Read Motion work",
        "Read authorized workspaces, users, schedules, statuses, projects, tasks, recurring tasks, comments, and custom fields.",
        true,
      ),
      platformCapability: "motion_work_read",
    },
    {
      ...capability(
        "work_manage",
        "Manage Motion work",
        "Create and update projects, tasks, recurring tasks, comments, and custom fields, move or unassign tasks, and delete supported records.",
        true,
      ),
      platformCapability: "motion_work_manage",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "MOTION_API_KEY",
        label: "Motion API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "In Motion, open Settings, create an API key, and copy it when Motion shows it.",
      },
    ],
  },
  tools: [
    {
      name: "motion.read",
      functionName: "motion_api_read",
      aliases: ["motion.read", "motion_api_read"],
      capability: "work_read",
      platformCapability: "motion_work_read",
      action: "read",
      approvalRequired: false,
      description: "Read one exact documented Motion API endpoint.",
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
      name: "motion.manage",
      functionName: "motion_api_manage",
      aliases: ["motion.manage", "motion_api_manage"],
      capability: "work_manage",
      platformCapability: "motion_work_manage",
      action: "write",
      approvalRequired: true,
      description:
        "Call one exact documented Motion mutation with bounded JSON; Safe mode requires approval.",
      inputSchema: {
        type: "object",
        properties: {
          method: { type: "string", enum: ["POST", "PATCH", "DELETE"] },
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
      id: "motion_safe",
      label: "Safe",
      description:
        "Reads run directly. Every creation, update, move, unassignment, custom-field change, or deletion requires approval.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [manage],
      blockedActions: guards,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Every selected key-authorized Motion operation runs without Relay per-action approval. Provider authority, exact endpoints, request bounds, credential protection, and audits still apply.",
      defaultSelected: false,
      allowedActions: [read, manage],
      approvalRequiredActions: [],
      blockedActions: guards,
    },
  ],
  healthChecks: [{ id: "api_key", label: "Motion API key validation" }],
};
