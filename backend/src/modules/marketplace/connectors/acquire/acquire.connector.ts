import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "acquire_case_list",
    "List case metadata",
    "List one bounded first response of content-free Acquire case summaries.",
  ),
  action(
    "acquire_case_get",
    "Read case metadata",
    "Read one exact Acquire case through Relay's content-free projection.",
  ),
];
const full = [
  action(
    "acquire_full_api",
    "Use Acquire API v1",
    "Use a documented Acquire API v1 operation authorized by the configured API key; Safe mode requires approval.",
  ),
];

export const ACQUIRE_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "acquire",
  name: "Acquire",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developer.acquire.io/rest-apis/authorization",
  providerWebsiteUrl: "https://acquire.io/",
  capabilities: [
    {
      ...capability(
        "case_metadata_read",
        "Read case operations",
        "List and inspect bounded case operational metadata without titles, descriptions, contacts, users, messages, fields, tags, feedback, timeline, visit data, device data, metadata, or raw records.",
        true,
      ),
      platformCapability: "acquire_case_metadata_read",
    },
    {
      ...capability(
        "full_api",
        "Acquire API v1",
        "Use documented account-bound API v1 paths and methods allowed by the key's custom permissions.",
        true,
      ),
      platformCapability: "acquire_full_api",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "ACQUIRE_ACCOUNT_ID",
        label: "Acquire account ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["api_key"],
        helpText: "Enter the workspace hostname label before .acquire.io.",
      },
      {
        name: "ACQUIRE_API_KEY",
        label: "Acquire API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Create a dedicated revocable API key with custom least-privilege permissions.",
      },
    ],
  },
  tools: [
    {
      name: "acquire.listCases",
      functionName: "acquire_case_list",
      aliases: ["acquire.listCases", "acquire_case_list"],
      capability: "case_metadata_read",
      platformCapability: "acquire_case_metadata_read",
      action: "read",
      approvalRequired: true,
      description:
        "List at most twenty-five case summaries without titles, descriptions, contacts, users, messages, fields, tags, feedback, timeline, visits, device data, metadata, or raw records.",
      inputSchema: {
        type: "object",
        properties: { limit: { type: "integer", minimum: 1, maximum: 25 } },
        additionalProperties: false,
      },
    },
    {
      name: "acquire.getCase",
      functionName: "acquire_case_get",
      aliases: ["acquire.getCase", "acquire_case_get"],
      capability: "case_metadata_read",
      platformCapability: "acquire_case_metadata_read",
      action: "read",
      approvalRequired: true,
      description:
        "Read one exact case's numeric IDs, channel/status/closing state, wait time, and lifecycle timestamps through the same content-free projection.",
      inputSchema: {
        type: "object",
        properties: { caseId: { type: "integer", minimum: 1 } },
        required: ["caseId"],
        additionalProperties: false,
      },
    },
    {
      name: "acquire.request",
      functionName: "acquire_request",
      aliases: ["acquire.request", "acquire_request", "acquire_full_api"],
      capability: "full_api",
      platformCapability: "acquire_full_api",
      action: "admin",
      approvalRequired: true,
      description:
        "Call one documented API v1 operation on the connected account's fixed Acquire origin. Absolute URLs, credentials, redirects, and version overrides are rejected.",
      inputSchema: {
        type: "object",
        properties: {
          method: { type: "string", enum: ["GET", "POST", "PUT", "DELETE"] },
          path: {
            type: "string",
            pattern: "^/api/v1/[A-Za-z0-9][A-Za-z0-9_./{}:-]{0,299}$",
          },
          query: { type: "object" },
          json: { type: "object" },
          approvalId: { type: "string" },
        },
        required: ["method", "path"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "acquire_safe",
      label: "Safe",
      description:
        "Content-free case reads and every broader API operation require approval; account/version binding, Bearer-key isolation, custom-permission context, bounds, and provider limits remain enforced.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: [...reads, ...full],
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Selected key-authorized operations run without Relay per-action approval; account/version binding, Bearer-key isolation, bounds, audits, custom permissions, and Acquire limits still apply.",
      defaultSelected: false,
      allowedActions: [...reads, ...full],
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    {
      id: "list_cases",
      label:
        "Acquire account, Bearer key, custom permission, and bounded case-list check",
    },
  ],
};
