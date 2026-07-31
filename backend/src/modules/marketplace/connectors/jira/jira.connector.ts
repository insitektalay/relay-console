import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const JIRA_REQUIRED_SCOPES = [
  "offline_access",
  "read:me",
  "read:jira-user",
  "read:jira-work",
  "write:jira-work",
  "manage:jira-project",
  "manage:jira-configuration",
  "manage:jira-webhook",
  "read:board-scope.admin:jira-software",
  "write:board-scope.admin:jira-software",
  "delete:board-scope.admin:jira-software",
  "read:board-scope:jira-software",
  "write:board-scope:jira-software",
  "read:epic:jira-software",
  "write:epic:jira-software",
  "read:issue:jira-software",
  "write:issue:jira-software",
  "read:sprint:jira-software",
  "write:sprint:jira-software",
  "delete:sprint:jira-software",
  "read:source-code:jira-software",
  "write:source-code:jira-software",
  "read:feature-flag:jira-software",
  "write:feature-flag:jira-software",
  "read:deployment:jira-software",
  "write:deployment:jira-software",
  "read:build:jira-software",
  "write:build:jira-software",
  "read:remote-link:jira-software",
  "write:remote-link:jira-software",
  "read:dev-info:jira",
  "write:dev-info:jira",
  "delete:dev-info:jira",
  "read:feature-flag-info:jira",
  "write:feature-flag-info:jira",
  "delete:feature-flag-info:jira",
  "read:deployment-info:jira",
  "write:deployment-info:jira",
  "delete:deployment-info:jira",
  "read:build-info:jira",
  "write:build-info:jira",
  "delete:build-info:jira",
  "read:remote-link-info:jira",
  "write:remote-link-info:jira",
  "delete:remote-link-info:jira",
] as const;

const read = action(
  "jira_read",
  "Read Jira work",
  "Read bounded Jira issues, projects, boards, backlogs, sprints, reports, development information, and Product Discovery ideas.",
);
const manage = action(
  "jira_manage",
  "Manage Jira work",
  "Create, update, transition, administer, or delete Jira resources authorized by the connected account.",
);
const guards = [
  action(
    "jira_secret_exposure",
    "Expose credentials",
    "OAuth credentials never enter agent-visible requests or results.",
  ),
  action(
    "jira_other_site",
    "Access another Jira site",
    "Every request remains pinned to the Jira Cloud site selected during sign-in.",
  ),
  action(
    "jira_unsupported_api",
    "Call an unsupported API",
    "Relay permits only documented Jira platform and Jira Software Cloud REST routes, including Product Discovery ideas exposed through the Jira platform API.",
  ),
  action(
    "jira_unbounded_transfer",
    "Run an unbounded transfer",
    "Relay bounds queries, uploads, request bodies, responses, redirects, and execution time.",
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
const files = {
  type: "array",
  maxItems: 5,
  items: {
    type: "object",
    properties: {
      fieldName: { type: "string", maxLength: 100 },
      filename: { type: "string", maxLength: 240 },
      mimeType: { type: "string", maxLength: 120 },
      dataBase64: { type: "string", maxLength: 14000000 },
    },
    required: ["fieldName", "filename", "mimeType", "dataBase64"],
    additionalProperties: false,
  },
};

export const JIRA_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "jira",
  name: "Jira",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://developer.atlassian.com/cloud/jira/platform/rest/v3/",
  providerWebsiteUrl: "https://www.atlassian.com/software/jira",
  capabilities: [
    {
      ...capability(
        "jira_read",
        "Read Jira work",
        "Read authorized issues, projects, boards, backlogs, sprints, reports, development activity, and Product Discovery ideas.",
        true,
      ),
      platformCapability: "jira_read",
    },
    {
      ...capability(
        "jira_manage",
        "Manage Jira work",
        "Create, update, transition, administer, and delete authorized Jira platform, Jira Software, and Product Discovery work.",
        true,
      ),
      platformCapability: "jira_manage",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://auth.atlassian.com/authorize",
      tokenUrl: "https://auth.atlassian.com/oauth/token",
      requiredScopes: [...JIRA_REQUIRED_SCOPES],
      optionalScopes: [],
      pkce: false,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "JIRA_CLIENT_ID",
        label: "Relay Atlassian OAuth client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
      },
      {
        name: "JIRA_CLIENT_SECRET",
        label: "Relay Atlassian OAuth client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
      },
    ],
  },
  tools: [
    {
      name: "jira.read",
      functionName: "jira_read",
      aliases: ["jira.read", "jira_read"],
      capability: "jira_read",
      platformCapability: "jira_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read one documented Jira Cloud REST resource from the connected site.",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string", minLength: 1, maxLength: 2000 },
          query,
        },
        required: ["path"],
        additionalProperties: false,
      },
    },
    {
      name: "jira.manage",
      functionName: "jira_manage",
      aliases: ["jira.manage", "jira_manage"],
      capability: "jira_manage",
      platformCapability: "jira_manage",
      action: "write",
      approvalRequired: true,
      description:
        "Call one documented Jira Cloud REST mutation on the connected site.",
      inputSchema: {
        type: "object",
        properties: {
          method: { type: "string", enum: ["POST", "PUT", "PATCH", "DELETE"] },
          path: { type: "string", minLength: 1, maxLength: 2000 },
          query,
          json: { type: "object" },
          form: { type: "object" },
          files,
          approvalId: { type: "string", maxLength: 200 },
        },
        required: ["method", "path"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "jira_safe",
      label: "Safe",
      description:
        "Reads run directly. Every create, update, transition, administration, upload, and delete request requires approval.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [manage],
      blockedActions: guards,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Every selected Jira action authorized by the connected account runs without Relay per-action approval. Site binding, credential protection, request bounds, audits, and Atlassian permissions still apply.",
      defaultSelected: false,
      allowedActions: [read, manage],
      approvalRequiredActions: [],
      blockedActions: guards,
    },
  ],
  healthChecks: [
    {
      id: "current_user",
      label: "Connected Jira site and signed-in user validation",
      requiredScopes: [...JIRA_REQUIRED_SCOPES],
    },
  ],
};
