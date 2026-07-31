import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { FIREBASE_SCOPES } from "./firebase-api.adapter";

const reads = [
  action(
    "firebase_project_list",
    "List Firebase Projects",
    "List at most twenty-five active Firebase Projects from the first page accessible to the OAuth grant.",
  ),
  action(
    "firebase_project_get",
    "Read selected Project",
    "Read one exact selected Firebase Project and verify its resource binding.",
  ),
  action(
    "firebase_app_list",
    "List selected-Project Apps",
    "List at most twenty-five active Apps from the selected Project's first search page without API-key identifiers or app configs.",
  ),
];

const blockedActions = [
  blocked(
    "firebase_write",
    "Change Firebase",
    "Project and App creation, update, provisioning, deletion, undelete, and every product mutation are outside V1.",
  ),
  blocked(
    "firebase_sensitive_read",
    "Read sensitive Firebase data",
    "API-key identifiers and values, SDK/app configs, credentials, service accounts, user data, databases, storage, logs, analytics, messaging, and product-specific data are outside V1.",
  ),
  blocked(
    "firebase_admin",
    "Administer Firebase",
    "IAM, users, billing, OAuth clients, service accounts, extensions, App Check, security rules, and administration are outside V1.",
  ),
  blocked(
    "firebase_raw_api",
    "Use raw Firebase or Google APIs",
    "Arbitrary REST, paths, queries, page tokens, pagination, Cloud Platform scopes, product APIs, Admin SDK, CLI tokens, and raw responses are outside V1.",
  ),
];

const approvalId = { type: "string", minLength: 1, maxLength: 200 };

export const FIREBASE_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "firebase",
  name: "Firebase",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://firebase.google.com/docs/reference/firebase-management/rest",
  providerWebsiteUrl: "https://firebase.google.com/",
  capabilities: [
    {
      ...capability(
        "project_read",
        "Read Firebase Projects",
        "List a bounded page of accessible Projects and inspect one exact selected Project.",
        true,
      ),
      platformCapability: "firebase_project_read",
    },
    {
      ...capability(
        "app_read",
        "Read selected-Project Apps",
        "List a bounded App summary without API-key identifiers or configuration.",
        true,
      ),
      platformCapability: "firebase_app_read",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      revocationUrl: "https://oauth2.googleapis.com/revoke",
      requiredScopes: FIREBASE_SCOPES,
      optionalScopes: [],
      pkce: false,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "FIREBASE_CLIENT_ID",
        label: "Firebase Google OAuth client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Relay-owned confidential Google OAuth client ID configured only on Railway.",
      },
      {
        name: "FIREBASE_CLIENT_SECRET",
        label: "Firebase Google OAuth client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Relay-owned confidential Google OAuth client secret configured only on Railway.",
      },
      {
        name: "FIREBASE_PROJECT_ID",
        label: "Selected Firebase Project ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["oauth2"],
        helpText:
          "Bind the connection to one exact 6-30 character Firebase Project ID before authorization.",
      },
    ],
  },
  tools: [
    {
      name: "firebase.listProjects",
      functionName: "firebase_project_list",
      aliases: ["firebase.listProjects", "firebase_project_list"],
      capability: "project_read",
      platformCapability: "firebase_project_read",
      action: "read",
      approvalRequired: true,
      description: "List a bounded first page of active Firebase Projects.",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "integer", minimum: 1, maximum: 25 },
          approvalId,
        },
        additionalProperties: false,
      },
    },
    {
      name: "firebase.getProject",
      functionName: "firebase_project_get",
      aliases: ["firebase.getProject", "firebase_project_get"],
      capability: "project_read",
      platformCapability: "firebase_project_read",
      action: "read",
      approvalRequired: true,
      description: "Read the exact selected Firebase Project.",
      inputSchema: {
        type: "object",
        properties: { approvalId },
        additionalProperties: false,
      },
    },
    {
      name: "firebase.listApps",
      functionName: "firebase_app_list",
      aliases: ["firebase.listApps", "firebase_app_list"],
      capability: "app_read",
      platformCapability: "firebase_app_read",
      action: "read",
      approvalRequired: true,
      description:
        "List a bounded first search page of Apps in the selected Project without API-key identifiers or configs.",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "integer", minimum: 1, maximum: 25 },
          approvalId,
        },
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "firebase_safe",
      label: "Safe",
      description:
        "All three bounded Firebase reads require matching approval.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: reads,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "All three selected read-only tools run without Relay per-action approval while exact Project binding, fixed requests, bounds, redaction, audit, refresh, and provider limits remain enforced.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "selected-project",
      label:
        "Firebase exact firebase.readonly scope, offline refresh token, and selected-Project binding",
      requiredScopes: FIREBASE_SCOPES,
    },
  ],
};
