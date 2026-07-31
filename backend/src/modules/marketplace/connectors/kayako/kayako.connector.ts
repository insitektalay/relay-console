import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "kayako_case_list",
    "List case metadata",
    "List one fixed first page of content-free Kayako case summaries.",
  ),
  action(
    "kayako_case_get",
    "Read case metadata",
    "Read one exact Kayako case through Relay's content-free projection.",
  ),
];
const full = [
  action(
    "kayako_full_api",
    "Use Kayako API v1",
    "Use a documented Kayako API v1 operation authorized by the supplied OAuth token; Safe mode requires approval.",
  ),
];

export const KAYAKO_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "kayako",
  name: "Kayako",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://developer.kayako.com/api/v1/reference/introduction/",
  providerWebsiteUrl: "https://kayako.com/",
  capabilities: [
    {
      ...capability(
        "case_metadata_read",
        "Read case operations",
        "List and inspect bounded case operational metadata without subjects, requester/creator identities, posts, messages, channels, teams, agents, tags, forms, custom fields, ratings, or raw records.",
        true,
      ),
      platformCapability: "kayako_case_metadata_read",
    },
    {
      ...capability(
        "full_api",
        "Kayako API v1",
        "Use documented tenant-bound API v1 paths and methods allowed by the token's scopes and user permissions.",
        true,
      ),
      platformCapability: "kayako_full_api",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "KAYAKO_DOMAIN",
        label: "Kayako domain",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["api_key"],
        helpText: "Enter the tenant hostname label before .kayako.com.",
      },
      {
        name: "KAYAKO_ACCESS_TOKEN",
        label: "Kayako OAuth access token",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Supply a customer-owned OAuth token with conversations:read and only explicitly needed write scopes.",
      },
    ],
  },
  tools: [
    {
      name: "kayako.listCases",
      functionName: "kayako_case_list",
      aliases: ["kayako.listCases", "kayako_case_list"],
      capability: "case_metadata_read",
      platformCapability: "kayako_case_metadata_read",
      action: "read",
      approvalRequired: true,
      description:
        "List at most twenty-five recently updated case summaries from offset zero without subjects, identities, posts, content, routing, custom fields, ratings, or raw records.",
      inputSchema: {
        type: "object",
        properties: { limit: { type: "integer", minimum: 1, maximum: 25 } },
        additionalProperties: false,
      },
    },
    {
      name: "kayako.getCase",
      functionName: "kayako_case_get",
      aliases: ["kayako.getCase", "kayako_case_get"],
      capability: "case_metadata_read",
      platformCapability: "kayako_case_metadata_read",
      action: "read",
      approvalRequired: true,
      description:
        "Read one exact case's numeric ID, state, operational IDs/counts/flags, and timestamps through the same content-free projection.",
      inputSchema: {
        type: "object",
        properties: { caseId: { type: "integer", minimum: 1 } },
        required: ["caseId"],
        additionalProperties: false,
      },
    },
    {
      name: "kayako.request",
      functionName: "kayako_request",
      aliases: ["kayako.request", "kayako_request", "kayako_full_api"],
      capability: "full_api",
      platformCapability: "kayako_full_api",
      action: "admin",
      approvalRequired: true,
      description:
        "Call one documented API v1 operation on the connected tenant's fixed Kayako origin. Absolute URLs, credentials, redirects, and version overrides are rejected.",
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
      id: "kayako_safe",
      label: "Safe",
      description:
        "Content-free case reads and every broader API operation require approval; tenant/version binding, OAuth-token isolation, scope/user context, bounds, and limits remain enforced.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: [...reads, ...full],
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Selected token-authorized operations run without Relay per-action approval; tenant/version binding, OAuth-token isolation, bounds, audits, scopes, user permissions, and Kayako limits still apply.",
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
        "Kayako tenant, OAuth token, conversations scope, and bounded case-list check",
    },
  ],
};
