import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const JIRA_SERVICE_MANAGEMENT_REQUIRED_SCOPES = [
  "offline_access",
  "read:me",
  "read:jira-work",
  "manage:jira-project",
  "read:servicedesk-request",
  "write:servicedesk-request",
  "manage:servicedesk-customer",
  "read:knowledgebase:jira-service-management",
  "read:request.attachment:jira-service-management",
  "read:request.comment:jira-service-management",
  "read:requesttype:jira-service-management",
  "write:requesttype:jira-service-management",
  "read:user:jira",
] as const;

const read = action(
  "jsm_read",
  "Read service work",
  "Read bounded service desks, requests, queues, approvals, SLAs, knowledge articles, customers, and organizations.",
);
const manage = action(
  "jsm_manage",
  "Manage service work",
  "Create, update, transition, approve, attach, administer, or delete authorized Jira Service Management resources.",
);
const guards = [
  action(
    "jsm_secret_exposure",
    "Expose credentials",
    "OAuth credentials never enter agent-visible requests or results.",
  ),
  action(
    "jsm_other_site",
    "Access another site",
    "Every request remains pinned to the Jira Cloud site selected during sign-in.",
  ),
  action(
    "jsm_other_product",
    "Call another Atlassian product API",
    "Relay permits only the documented Jira Service Management Cloud REST boundary.",
  ),
  action(
    "jsm_unbounded_transfer",
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

export const JIRA_SERVICE_MANAGEMENT_CONNECTOR_MANIFEST: MarketplaceConnectorManifest =
  {
    slug: "jira-service-management",
    name: "Jira Service Management",
    connectorType: "native_clawchat",
    providerDocsUrl:
      "https://developer.atlassian.com/cloud/jira/service-desk/rest/intro/",
    providerWebsiteUrl:
      "https://www.atlassian.com/software/jira/service-management",
    capabilities: [
      {
        ...capability(
          "service_management_read",
          "Read service work",
          "Read authorized service desks, requests, request types, queues, approvals, SLAs, knowledge articles, customers, and organizations.",
          true,
        ),
        platformCapability: "jsm_read",
      },
      {
        ...capability(
          "service_management_manage",
          "Manage service work",
          "Create and manage authorized requests, comments, attachments, approvals, transitions, participants, subscriptions, feedback, customers, organizations, and request types.",
          true,
        ),
        platformCapability: "jsm_manage",
      },
    ],
    auth: {
      type: "oauth2_authorization_code",
      oauth: {
        authorizationUrl: "https://auth.atlassian.com/authorize",
        tokenUrl: "https://auth.atlassian.com/oauth/token",
        requiredScopes: [...JIRA_SERVICE_MANAGEMENT_REQUIRED_SCOPES],
        optionalScopes: [],
        pkce: false,
        supportsRefresh: true,
      },
      credentialSchema: [
        {
          name: "JIRA_SERVICE_MANAGEMENT_CLIENT_ID",
          label: "Relay Atlassian OAuth client ID",
          required: true,
          secret: false,
          storedIn: "metadata",
        },
        {
          name: "JIRA_SERVICE_MANAGEMENT_CLIENT_SECRET",
          label: "Relay Atlassian OAuth client secret",
          required: true,
          secret: true,
          storedIn: "encrypted_secret",
        },
      ],
    },
    tools: [
      {
        name: "jsm.read",
        functionName: "jsm_read",
        aliases: ["jsm.read", "jira_service_management_read"],
        capability: "service_management_read",
        platformCapability: "jsm_read",
        action: "read",
        approvalRequired: false,
        description:
          "Read one documented Jira Service Management Cloud REST resource from the connected site.",
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
        name: "jsm.manage",
        functionName: "jsm_manage",
        aliases: ["jsm.manage", "jira_service_management_manage"],
        capability: "service_management_manage",
        platformCapability: "jsm_manage",
        action: "write",
        approvalRequired: true,
        description:
          "Call one documented Jira Service Management Cloud REST mutation on the connected site.",
        inputSchema: {
          type: "object",
          properties: {
            method: { type: "string", enum: ["POST", "PUT", "DELETE"] },
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
        id: "jira_service_management_safe",
        label: "Safe",
        description:
          "Reads run directly. Every request creation, update, transition, approval, upload, customer change, organization change, and delete requires approval.",
        defaultSelected: true,
        allowedActions: [read],
        approvalRequiredActions: [manage],
        blockedActions: guards,
      },
      {
        id: "dangerously_skip_permissions",
        label: "Dangerously skip permissions",
        description:
          "Every selected Jira Service Management action authorized by the connected account runs without Relay per-action approval. Site binding, credential protection, request bounds, audits, and Atlassian permissions still apply.",
        defaultSelected: false,
        allowedActions: [read, manage],
        approvalRequiredActions: [],
        blockedActions: guards,
      },
    ],
    healthChecks: [
      {
        id: "service_desks",
        label:
          "Connected Jira Service Management site and signed-in user validation",
        requiredScopes: [...JIRA_SERVICE_MANAGEMENT_REQUIRED_SCOPES],
      },
    ],
  };
