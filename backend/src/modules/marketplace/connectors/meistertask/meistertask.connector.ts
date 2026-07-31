import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const MEISTERTASK_SCOPES = [
  "userinfo.profile",
  "userinfo.email",
  "meistertask",
] as const;

const read = action(
  "meistertask_api_read",
  "Read MeisterTask",
  "Read bounded authorized projects, sections, tasks, people, checklists, comments, files, labels, timelines, settings, memberships, and time records.",
);
const manage = action(
  "meistertask_api_manage",
  "Manage MeisterTask",
  "Create, update, upload, organize, share, subscribe, track time, or delete authorized MeisterTask work through documented routes.",
);
const guards = [
  action(
    "meistertask_secret_exposure",
    "Expose credentials",
    "OAuth credentials never enter agent-visible requests or results.",
  ),
  action(
    "meistertask_unofficial_origin",
    "Use another API origin",
    "Every request stays on MeisterTask's documented HTTPS API origin.",
  ),
  action(
    "meistertask_unsupported_api",
    "Call an unsupported API family",
    "Relay permits only documented MeisterTask resource families under /api.",
  ),
  action(
    "meistertask_unbounded_transfer",
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

export const MEISTERTASK_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "meistertask",
  name: "MeisterTask",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developers.meistertask.com/",
  providerWebsiteUrl: "https://www.meistertask.com/",
  capabilities: [
    {
      ...capability(
        "work_management_read",
        "Read MeisterTask work",
        "Read authorized projects, sections, tasks, people, checklists, comments, attachments, labels, custom fields, memberships, settings, timelines, and time records.",
        true,
      ),
      platformCapability: "meistertask_api_read",
    },
    {
      ...capability(
        "work_management_manage",
        "Manage MeisterTask work",
        "Create, update, upload, organize, share, subscribe, track time, and delete authorized work through documented routes.",
        true,
      ),
      platformCapability: "meistertask_api_manage",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://www.mindmeister.com/oauth2/authorize",
      tokenUrl: "https://www.mindmeister.com/oauth2/token",
      revocationUrl: "https://www.mindmeister.com/oauth2/revoke",
      userInfoUrl: "https://www.meistertask.com/api/persons/me",
      requiredScopes: [...MEISTERTASK_SCOPES],
      optionalScopes: [],
      pkce: false,
      supportsRefresh: false,
    },
    credentialSchema: [
      {
        name: "MEISTERTASK_CLIENT_ID",
        label: "MeisterTask OAuth client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Relay-owned Meister application client ID configured on Railway.",
      },
      {
        name: "MEISTERTASK_CLIENT_SECRET",
        label: "MeisterTask OAuth client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Relay-owned Meister application secret stored only in Railway secret variables.",
      },
    ],
  },
  tools: [
    {
      name: "meistertask.read",
      functionName: "meistertask_api_read",
      aliases: ["meistertask.read", "meistertask_api_read"],
      capability: "work_management_read",
      platformCapability: "meistertask_api_read",
      action: "read",
      approvalRequired: false,
      description: "Read one documented MeisterTask API resource.",
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
      name: "meistertask.manage",
      functionName: "meistertask_api_manage",
      aliases: ["meistertask.manage", "meistertask_api_manage"],
      capability: "work_management_manage",
      platformCapability: "meistertask_api_manage",
      action: "write",
      approvalRequired: true,
      description:
        "Call one documented MeisterTask POST, PUT, or DELETE route with bounded JSON or file data.",
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
      id: "meistertask_safe",
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
        "Every selected action authorized by the connected MeisterTask account runs without Relay per-action approval. Provider authority, fixed origin, request bounds, credential protection, and audits still apply.",
      defaultSelected: false,
      allowedActions: [read, manage],
      approvalRequiredActions: [],
      blockedActions: guards,
    },
  ],
  healthChecks: [
    {
      id: "current_person",
      label: "OAuth token and connected MeisterTask person validation",
      requiredScopes: ["userinfo.profile", "meistertask"],
    },
  ],
};
