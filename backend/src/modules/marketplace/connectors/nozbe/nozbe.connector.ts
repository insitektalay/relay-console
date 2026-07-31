import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const read = action(
  "nozbe_api_read",
  "Read Nozbe",
  "Read bounded authorized teams, projects, tasks, events, comments, reminders, recurrences, sections, tags, groups, memberships, users, businesses, and attachments.",
);
const manage = action(
  "nozbe_api_manage",
  "Manage Nozbe",
  "Create, update, upload, organize, assign, or delete authorized Nozbe work through documented routes.",
);
const guards = [
  action(
    "nozbe_secret_exposure",
    "Expose credentials",
    "The API token never enters agent-visible requests or results.",
  ),
  action(
    "nozbe_unofficial_origin",
    "Use another API origin",
    "Every request stays on Nozbe's documented HTTPS API origin.",
  ),
  action(
    "nozbe_unsupported_api",
    "Call an unsupported API family",
    "Relay permits only documented Nozbe resource families under /v1/api.",
  ),
  action(
    "nozbe_unbounded_transfer",
    "Run an unbounded transfer",
    "Relay bounds queries, files, request bodies, responses, redirects, and execution time.",
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

export const NOZBE_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "nozbe",
  name: "Nozbe",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://nozbe.help/advancedfeatures/api/",
  providerWebsiteUrl: "https://nozbe.com/",
  capabilities: [
    {
      ...capability(
        "work_read",
        "Read Nozbe work",
        "Read authorized teams, projects, tasks, task events, comments, reminders, recurrences, project access, sections, tags, groups, assignments, members, users, businesses, and attachments.",
        true,
      ),
      platformCapability: "nozbe_api_read",
    },
    {
      ...capability(
        "work_manage",
        "Manage Nozbe work",
        "Create, update, upload, organize, assign, and delete authorized work through documented routes.",
        true,
      ),
      platformCapability: "nozbe_api_manage",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "NOZBE_API_TOKEN",
        label: "Nozbe API token",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "In Nozbe, open Settings > API tokens and create a dedicated space or global token.",
      },
    ],
  },
  tools: [
    {
      name: "nozbe.read",
      functionName: "nozbe_api_read",
      aliases: ["nozbe.read", "nozbe_api_read"],
      capability: "work_read",
      platformCapability: "nozbe_api_read",
      action: "read",
      approvalRequired: false,
      description: "Read one documented Nozbe API resource.",
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
      name: "nozbe.manage",
      functionName: "nozbe_api_manage",
      aliases: ["nozbe.manage", "nozbe_api_manage"],
      capability: "work_manage",
      platformCapability: "nozbe_api_manage",
      action: "write",
      approvalRequired: true,
      description:
        "Call one documented Nozbe POST, PUT, or DELETE route with bounded JSON or file data.",
      inputSchema: {
        type: "object",
        properties: {
          method: { type: "string", enum: ["POST", "PUT", "DELETE"] },
          path: { type: "string", minLength: 1, maxLength: 2000 },
          query: querySchema,
          contentType: { type: "string", enum: ["json", "form"] },
          json: { type: "object" },
          form: { type: "object" },
          files: {
            type: "array",
            maxItems: 5,
            items: {
              type: "object",
              properties: {
                fieldName: { type: "string", minLength: 1, maxLength: 100 },
                name: { type: "string", minLength: 1, maxLength: 255 },
                mimeType: { type: "string", minLength: 1, maxLength: 100 },
                base64: { type: "string", minLength: 1, maxLength: 5600000 },
              },
              required: ["fieldName", "name", "mimeType", "base64"],
              additionalProperties: false,
            },
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
      id: "nozbe_safe",
      label: "Safe",
      description:
        "Reads run directly. Every provider mutation requires approval.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [manage],
      blockedActions: guards,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Every selected action authorized by the connected Nozbe account runs without Relay per-action approval. Provider authority, fixed origin, request bounds, credential protection, and audits still apply.",
      defaultSelected: false,
      allowedActions: [read, manage],
      approvalRequiredActions: [],
      blockedActions: guards,
    },
  ],
  healthChecks: [
    {
      id: "current_person",
      label: "Nozbe API-token validation",
    },
  ],
};
