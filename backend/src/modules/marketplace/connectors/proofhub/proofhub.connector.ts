import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const read = action(
  "proofhub_api_read",
  "Read ProofHub",
  "Run one bounded GET request against ProofHub's documented API v3.",
);
const manage = action(
  "proofhub_api_manage",
  "Manage ProofHub",
  "Run one bounded POST, PUT, or DELETE request, including documented uploads; Safe mode requires approval.",
);
const properties = {
  path: {
    type: "string",
    pattern: "^/(?:api/v3(?:/|$)|files/upload\\.php$)",
    maxLength: 2000,
  },
  query: { type: "object" },
  json: { type: "object" },
  form: { type: "object" },
  files: {
    type: "array",
    maxItems: 5,
    items: {
      type: "object",
      properties: {
        fieldName: { type: "string", maxLength: 80 },
        fileName: { type: "string", maxLength: 240 },
        contentType: { type: "string", maxLength: 120 },
        base64: { type: "string", maxLength: 5500000 },
      },
      required: ["fieldName", "fileName", "base64"],
      additionalProperties: false,
    },
  },
  approvalId: { type: "string" },
};

export const PROOFHUB_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "proofhub",
  name: "ProofHub",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://github.com/ProofHub/api_v3",
  providerWebsiteUrl: "https://www.proofhub.com/",
  capabilities: [
    {
      ...capability(
        "work_read",
        "Read projects and collaboration",
        "Read authorized projects, categories, groups, people, roles, discussions, comments, task lists, tasks, files, events, milestones, notebooks, notes, folders, time, forms, announcements, labels, and related ProofHub data.",
        true,
      ),
      platformCapability: "proofhub_work_read",
    },
    {
      ...capability(
        "work_manage",
        "Manage projects and collaboration",
        "Create, update, move, copy, upload, attach, complete, reopen, and delete resources through ProofHub's documented API, subject to the connected user's authority.",
        true,
      ),
      platformCapability: "proofhub_work_manage",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "PROOFHUB_ACCOUNT",
        label: "ProofHub account name",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Enter the first part of your ProofHub URL, such as acme for acme.proofhub.com.",
      },
      {
        name: "PROOFHUB_API_KEY",
        label: "ProofHub API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "In ProofHub, open your profile menu > API access and copy or reset the key.",
      },
    ],
  },
  tools: [
    {
      name: "proofhub.read",
      functionName: "proofhub_api_read",
      aliases: ["proofhub.read", "proofhub_api_read"],
      capability: "work_read",
      platformCapability: "proofhub_work_read",
      action: "read",
      approvalRequired: false,
      description:
        "Call any documented ProofHub API v3 GET endpoint through a bounded account-pinned wrapper.",
      inputSchema: {
        type: "object",
        properties: { path: properties.path, query: properties.query },
        required: ["path"],
        additionalProperties: false,
      },
    },
    {
      name: "proofhub.manage",
      functionName: "proofhub_api_manage",
      aliases: ["proofhub.manage", "proofhub_api_manage"],
      capability: "work_manage",
      platformCapability: "proofhub_work_manage",
      action: "write",
      approvalRequired: true,
      description:
        "Call any documented ProofHub POST, PUT, or DELETE endpoint with bounded JSON or upload data; Safe mode requires approval.",
      inputSchema: {
        type: "object",
        properties: {
          method: { type: "string", enum: ["POST", "PUT", "DELETE"] },
          ...properties,
        },
        required: ["method", "path"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "proofhub_safe",
      label: "Safe",
      description:
        "Bounded reads run directly; every write, upload, invitation, deletion, or administrative operation requires approval.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [manage],
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Every selected key-authorized ProofHub operation runs without Relay per-action approval; ownership, provider authority, fixed account routing, bounds, audits, redaction, and provider limits still apply.",
      defaultSelected: false,
      allowedActions: [read, manage],
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    { id: "credentials", label: "ProofHub account and API-key validation" },
  ],
};
