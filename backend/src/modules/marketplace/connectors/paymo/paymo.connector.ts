import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const read = action(
  "paymo_api_read",
  "Read Paymo",
  "Run one bounded GET request against Paymo's documented API.",
);
const manage = action(
  "paymo_api_manage",
  "Manage Paymo",
  "Run one bounded POST, PUT, or DELETE request; Safe mode requires approval.",
);

const requestProperties = {
  path: { type: "string", pattern: "^/api(?:/|$)", maxLength: 2000 },
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

export const PAYMO_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "paymo",
  name: "Paymo",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://github.com/paymoapp/api",
  providerWebsiteUrl: "https://www.paymoapp.com/",
  capabilities: [
    {
      ...capability(
        "work_read",
        "Read work and business data",
        "Read authorized projects, tasks, bookings, time entries, clients, users, files, discussions, comments, milestones, workflows, expenses, reports, estimates, invoices, payments, and related Paymo data.",
        true,
      ),
      platformCapability: "paymo_work_read",
    },
    {
      ...capability(
        "work_manage",
        "Manage work and business data",
        "Create, update, upload, attach, and delete resources through Paymo's documented API, subject to the connected account's plan and authority.",
        true,
      ),
      platformCapability: "paymo_work_manage",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "PAYMO_API_KEY",
        label: "Paymo API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "In Paymo, open My Settings > API Keys and generate a dedicated key.",
      },
    ],
  },
  tools: [
    {
      name: "paymo.read",
      functionName: "paymo_api_read",
      aliases: ["paymo.read", "paymo_api_read"],
      capability: "work_read",
      platformCapability: "paymo_work_read",
      action: "read",
      approvalRequired: false,
      description:
        "Call any documented Paymo GET endpoint through a bounded fixed-origin wrapper.",
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
      name: "paymo.manage",
      functionName: "paymo_api_manage",
      aliases: ["paymo.manage", "paymo_api_manage"],
      capability: "work_manage",
      platformCapability: "paymo_work_manage",
      action: "write",
      approvalRequired: true,
      description:
        "Call any documented Paymo POST, PUT, or DELETE endpoint with a bounded JSON, form, or multipart body; Safe mode requires approval.",
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
      id: "paymo_safe",
      label: "Safe",
      description:
        "Bounded reads run directly; every write, upload, deletion, financial change, or administrative operation requires approval.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [manage],
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Every selected key-authorized Paymo operation runs without Relay per-action approval; ownership, provider authority, fixed origin, bounds, audits, redaction, and provider limits still apply.",
      defaultSelected: false,
      allowedActions: [read, manage],
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [{ id: "credentials", label: "Paymo API-key validation" }],
};
