import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const read = action(
  "shortcut_api_read",
  "Read Shortcut",
  "Run one bounded GET request against the current Shortcut REST API.",
);
const write = action(
  "shortcut_api_write",
  "Manage Shortcut",
  "Run one bounded POST, PUT, or DELETE request; Safe mode requires approval.",
);

const requestProperties = {
  path: { type: "string", pattern: "^/api/v3(?:/|$)", maxLength: 2000 },
  query: { type: "object" },
  json: { type: "object" },
  approvalId: { type: "string" },
};

export const SHORTCUT_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "shortcut",
  name: "Shortcut",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developer.shortcut.com/api/rest/v3",
  providerWebsiteUrl: "https://www.shortcut.com/",
  capabilities: [
    {
      ...capability(
        "workspace_read",
        "Read product and engineering work",
        "Read the token-authorized workspace, members, teams, workflows, objectives, key results, milestones, epics, iterations, stories, tasks, documents, labels, repositories, files, and history.",
        true,
      ),
      platformCapability: "shortcut_workspace_read",
    },
    {
      ...capability(
        "workspace_manage",
        "Manage product and engineering work",
        "Create, update, and delete resources through every JSON operation supported by the current Shortcut REST API and token.",
        true,
      ),
      platformCapability: "shortcut_workspace_manage",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "SHORTCUT_API_TOKEN",
        label: "Shortcut API token",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Create a dedicated token under Settings > Your Account > API Tokens. Shortcut gives the token the same complete workspace access as its member.",
      },
    ],
  },
  tools: [
    {
      name: "shortcut.read",
      functionName: "shortcut_api_read",
      aliases: ["shortcut.read", "shortcut_api_read"],
      capability: "workspace_read",
      platformCapability: "shortcut_workspace_read",
      action: "read",
      approvalRequired: false,
      description:
        "Call any documented Shortcut REST API v3 GET endpoint through a bounded fixed-origin wrapper.",
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
      name: "shortcut.write",
      functionName: "shortcut_api_write",
      aliases: ["shortcut.write", "shortcut_api_write"],
      capability: "workspace_manage",
      platformCapability: "shortcut_workspace_manage",
      action: "write",
      approvalRequired: true,
      description:
        "Call any documented Shortcut REST API v3 POST, PUT, or DELETE JSON endpoint; Safe mode requires approval.",
      inputSchema: {
        type: "object",
        properties: {
          method: { type: "string", enum: ["POST", "PUT", "DELETE"] },
          ...requestProperties,
        },
        required: ["method", "path"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "shortcut_safe",
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
        "Every selected token-authorized Shortcut operation runs without Relay per-action approval; ownership, provider authority, fixed origin, bounds, audits, redaction, and provider limits still apply.",
      defaultSelected: false,
      allowedActions: [read, write],
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    { id: "member", label: "Shortcut API-token and member validation" },
  ],
};
