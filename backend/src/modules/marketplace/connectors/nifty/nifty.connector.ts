import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const NIFTY_REQUIRED_SCOPES = [
  "file",
  "label",
  "doc",
  "milestone",
  "message",
  "subtask",
  "project",
  "task_group",
  "task",
  "subteam",
  "member",
  "folder",
  "time_tracking",
] as const;

const read = action(
  "nifty_api_read",
  "Read Nifty",
  "Read bounded projects, tasks, milestones, messages, docs, files, folders, members, time records, and other authorized Nifty resources.",
);
const manage = action(
  "nifty_api_manage",
  "Manage Nifty",
  "Create, update, or delete authorized Nifty work through documented API routes.",
);
const guards = [
  action(
    "nifty_secret_exposure",
    "Expose credentials",
    "OAuth credentials never enter agent-visible requests or results.",
  ),
  action(
    "nifty_unofficial_origin",
    "Use another API origin",
    "Every provider request stays on Nifty's documented OpenAPI origin.",
  ),
  action(
    "nifty_unsupported_api",
    "Call an unsupported API",
    "Relay permits only documented Nifty API v1.0 and v2.0 routes.",
  ),
  action(
    "nifty_unbounded_transfer",
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

export const NIFTY_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "nifty",
  name: "Nifty",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developers.niftypm.com/",
  providerWebsiteUrl: "https://niftypm.com/",
  capabilities: [
    {
      ...capability(
        "work_management_read",
        "Read Nifty work",
        "Read authorized Nifty projects, tasks, milestones, discussions, documents, files, members, folders, labels, and time tracking.",
        true,
      ),
      platformCapability: "nifty_api_read",
    },
    {
      ...capability(
        "work_management_manage",
        "Manage Nifty work",
        "Create, update, and delete authorized Nifty work through its documented API.",
        true,
      ),
      platformCapability: "nifty_api_manage",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://niftypm.com/",
      tokenUrl: "https://openapi.niftypm.com/oauth/token",
      userInfoUrl: "https://openapi.niftypm.com/api/v1.0/users/me",
      requiredScopes: [...NIFTY_REQUIRED_SCOPES],
      optionalScopes: [],
      pkce: false,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "NIFTY_CLIENT_ID",
        label: "Nifty OAuth client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
      },
      {
        name: "NIFTY_CLIENT_SECRET",
        label: "Nifty OAuth client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
      },
      {
        name: "NIFTY_AUTHORIZATION_URL",
        label: "Nifty app authorization URL",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Copy the exact Authorize URL shown after creating the Relay Console app in Nifty.",
      },
    ],
  },
  tools: [
    {
      name: "nifty.read",
      functionName: "nifty_api_read",
      aliases: ["nifty.read"],
      capability: "work_management_read",
      platformCapability: "nifty_api_read",
      action: "read",
      approvalRequired: false,
      description: "Read one documented Nifty API v1.0 or v2.0 resource.",
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
      name: "nifty.manage",
      functionName: "nifty_api_manage",
      aliases: ["nifty.manage"],
      capability: "work_management_manage",
      platformCapability: "nifty_api_manage",
      action: "write",
      approvalRequired: true,
      description:
        "Call one documented Nifty API POST, PUT, or DELETE route; JSON and bounded multipart requests are supported.",
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
            maxItems: 10,
            items: {
              type: "object",
              properties: {
                fieldName: { type: "string", minLength: 1, maxLength: 100 },
                name: { type: "string", minLength: 1, maxLength: 255 },
                mimeType: { type: "string", minLength: 1, maxLength: 100 },
                base64: { type: "string", minLength: 1, maxLength: 14000000 },
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
      id: "nifty_safe",
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
        "Every selected action authorized by the connected Nifty workspace runs without Relay per-action approval. Provider authority, fixed origin, request bounds, credential protection, and audits still apply.",
      defaultSelected: false,
      allowedActions: [read, manage],
      approvalRequiredActions: [],
      blockedActions: guards,
    },
  ],
  healthChecks: [
    { id: "identity", label: "OAuth token and Nifty user validation" },
  ],
};
