import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const read = action(
  "habitica_api_read",
  "Read Habitica",
  "Read bounded authorized tasks, tags, user progress, parties, groups, challenges, quests, messages, notifications, shops, content, and world state.",
);
const manage = action(
  "habitica_api_manage",
  "Manage Habitica",
  "Create, score, update, organize, join, leave, purchase, message, configure, or delete authorized Habitica data through documented V3 routes.",
);
const guards = [
  action(
    "habitica_secret_exposure",
    "Expose credentials",
    "The User ID and API token never enter agent-visible requests or results.",
  ),
  action(
    "habitica_unofficial_origin",
    "Use another API origin",
    "Every request stays on Habitica's documented HTTPS API origin.",
  ),
  action(
    "habitica_unsupported_api",
    "Call an internal API family",
    "Relay excludes authentication, administration, debugging, and official-client payment routes from the third-party connector.",
  ),
  action(
    "habitica_unbounded_transfer",
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

export const HABITICA_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "habitica",
  name: "Habitica",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://habitica.com/apidoc/",
  providerWebsiteUrl: "https://habitica.com/",
  capabilities: [
    {
      ...capability(
        "productivity_read",
        "Read Habitica progress",
        "Read authorized habits, dailies, to-dos, rewards, tags, user progress, parties, groups, challenges, quests, chat, notifications, shops, content, and world state.",
        true,
      ),
      platformCapability: "habitica_productivity_read",
    },
    {
      ...capability(
        "productivity_manage",
        "Manage Habitica progress",
        "Create and score tasks, manage tags and account preferences, participate in parties, challenges, quests, chat and shops, and use every documented third-party V3 mutation permitted by the account.",
        true,
      ),
      platformCapability: "habitica_productivity_manage",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "HABITICA_USER_ID",
        label: "Habitica User ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["api_key"],
        helpText: "In Habitica, open Settings > API and copy your User ID.",
      },
      {
        name: "HABITICA_API_TOKEN",
        label: "Habitica API token",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "In Habitica, open Settings > API and copy your API token. Treat it like a password.",
      },
    ],
  },
  tools: [
    {
      name: "habitica.read",
      functionName: "habitica_api_read",
      aliases: ["habitica.read", "habitica_api_read"],
      capability: "productivity_read",
      platformCapability: "habitica_productivity_read",
      action: "read",
      approvalRequired: false,
      description: "Read one documented Habitica V3 resource.",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string", minLength: 1, maxLength: 2000 },
          query: querySchema,
        },
        required: ["path"],
        additionalProperties: false,
      },
    },
    {
      name: "habitica.manage",
      functionName: "habitica_api_manage",
      aliases: ["habitica.manage", "habitica_api_manage"],
      capability: "productivity_manage",
      platformCapability: "habitica_productivity_manage",
      action: "write",
      approvalRequired: true,
      description:
        "Call one documented Habitica V3 POST, PUT, or DELETE route with bounded JSON; Safe mode requires approval.",
      inputSchema: {
        type: "object",
        properties: {
          method: { type: "string", enum: ["POST", "PUT", "DELETE"] },
          path: { type: "string", minLength: 1, maxLength: 2000 },
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
      id: "habitica_safe",
      label: "Safe",
      description:
        "Reads run directly. Every task score, creation, update, purchase, message, membership, account change, or deletion requires approval.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [manage],
      blockedActions: guards,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Every selected operation authorized by the connected Habitica account runs without Relay per-action approval. Provider authority, fixed origin, request bounds, credential protection, and audits still apply.",
      defaultSelected: false,
      allowedActions: [read, manage],
      approvalRequiredActions: [],
      blockedActions: guards,
    },
  ],
  healthChecks: [
    {
      id: "current_user",
      label: "Habitica User ID and API-token validation",
    },
  ],
};
