import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const read = action(
  "hive_api_read",
  "Read Hive",
  "Run one bounded GET request against Hive's documented REST API.",
);
const write = action(
  "hive_api_write",
  "Manage Hive",
  "Run one bounded POST, PUT, PATCH, or DELETE request; Safe mode requires approval.",
);

const requestProperties = {
  path: { type: "string", pattern: "^/api/v[12](?:/|$)", maxLength: 2000 },
  query: { type: "object" },
  json: { type: "object" },
  approvalId: { type: "string" },
};

export const HIVE_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "hive",
  name: "Hive",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developers.hive.com/reference",
  providerWebsiteUrl: "https://hive.com/",
  capabilities: [
    {
      ...capability(
        "workspace_read",
        "Read projects and work",
        "Read the connected user's workspaces, projects, actions, comments, attachments, groups, users, labels, custom fields, workflows, dashboards, sprints, resources, and other documented Hive data.",
        true,
      ),
      platformCapability: "hive_workspace_read",
    },
    {
      ...capability(
        "workspace_manage",
        "Manage projects and work",
        "Create, update, and delete resources through every JSON operation supported by Hive's documented REST API and the connected user's authority.",
        true,
      ),
      platformCapability: "hive_workspace_manage",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "HIVE_API_KEY",
        label: "Hive API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "In Hive, open My profile > API info and generate an API key.",
      },
      {
        name: "HIVE_USER_ID",
        label: "Hive user ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Copy the user ID shown beside the API key in Hive's API info tab.",
      },
    ],
  },
  tools: [
    {
      name: "hive.read",
      functionName: "hive_api_read",
      aliases: ["hive.read", "hive_api_read"],
      capability: "workspace_read",
      platformCapability: "hive_workspace_read",
      action: "read",
      approvalRequired: false,
      description:
        "Call any documented Hive REST API v1 or v2 GET endpoint through a bounded fixed-origin wrapper.",
      inputSchema: {
        type: "object",
        properties: {
          path: requestProperties.path,
          query: requestProperties.query,
        },
        required: ["path"],
        additionalProperties: false,
      },
    },
    {
      name: "hive.write",
      functionName: "hive_api_write",
      aliases: ["hive.write", "hive_api_write"],
      capability: "workspace_manage",
      platformCapability: "hive_workspace_manage",
      action: "write",
      approvalRequired: true,
      description:
        "Call any documented Hive REST API v1 or v2 POST, PUT, PATCH, or DELETE JSON endpoint; Safe mode requires approval.",
      inputSchema: {
        type: "object",
        properties: {
          method: { type: "string", enum: ["POST", "PUT", "PATCH", "DELETE"] },
          ...requestProperties,
        },
        required: ["method", "path"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "hive_safe",
      label: "Safe",
      description:
        "Bounded reads run directly; every write or administrative operation requires approval.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [write],
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Every selected key-authorized Hive operation runs without Relay per-action approval; ownership, provider authority, fixed origin, bounds, audits, redaction, and provider limits still apply.",
      defaultSelected: false,
      allowedActions: [read, write],
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    { id: "credentials", label: "Hive API-key and user validation" },
  ],
};
