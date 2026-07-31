import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const scheduleReads = [
  action(
    "gladly_business_hours_list",
    "List business-hours metadata",
    "List a bounded set of content-free Gladly business-hours configuration summaries.",
  ),
  action(
    "gladly_business_hours_get",
    "Read business-hours metadata",
    "Read one exact Gladly business-hours configuration through Relay's content-free projection.",
  ),
];
const fullApi = [
  action(
    "gladly_full_api",
    "Use Gladly REST API v1",
    "Use a documented Gladly REST API v1 operation authorized by the API user; Safe mode requires approval.",
  ),
];

export const GLADLY_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "gladly",
  name: "Gladly",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developer.gladly.com/rest/",
  providerWebsiteUrl: "https://www.gladly.com/",
  capabilities: [
    {
      ...capability(
        "business_hours_metadata_read",
        "Read business-hours operations",
        "List and inspect bounded schedule configuration metadata without names, schedule blocks, exceptions, agents, customers, conversations, messages, contacts, or raw records.",
        true,
      ),
      platformCapability: "gladly_business_hours_metadata_read",
    },
    {
      ...capability(
        "full_api",
        "Gladly REST API v1",
        "Use documented tenant-bound REST API v1 paths and methods allowed by the connected API user's permissions.",
        true,
      ),
      platformCapability: "gladly_full_api",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "GLADLY_ORGANIZATION",
        label: "Gladly organization",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Enter the organization name before .gladly.com; custom hosts and sandbox origins are not accepted.",
      },
      {
        name: "GLADLY_AGENT_EMAIL",
        label: "Gladly API-user agent email",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Use the email address of a dedicated Gladly agent with the API User permission.",
      },
      {
        name: "GLADLY_API_TOKEN",
        label: "Gladly API token",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Create a token for the dedicated API user. Gladly shows a new token only once.",
      },
    ],
  },
  tools: [
    {
      name: "gladly.listBusinessHours",
      functionName: "gladly_business_hours_list",
      aliases: ["gladly.listBusinessHours", "gladly_business_hours_list"],
      capability: "business_hours_metadata_read",
      platformCapability: "gladly_business_hours_metadata_read",
      action: "read",
      approvalRequired: true,
      description:
        "List at most twenty-five business-hours configuration summaries without names, schedule blocks, exception details, or raw records.",
      inputSchema: {
        type: "object",
        properties: { limit: { type: "integer", minimum: 1, maximum: 25 } },
        additionalProperties: false,
      },
    },
    {
      name: "gladly.getBusinessHours",
      functionName: "gladly_business_hours_get",
      aliases: ["gladly.getBusinessHours", "gladly_business_hours_get"],
      capability: "business_hours_metadata_read",
      platformCapability: "gladly_business_hours_metadata_read",
      action: "read",
      approvalRequired: true,
      description:
        "Read one exact business-hours configuration's ID, version, primary flag, timezone, counts, and timestamps through the same projection.",
      inputSchema: {
        type: "object",
        properties: {
          businessHoursId: {
            type: "string",
            pattern: "^[A-Za-z0-9_-]{1,128}$",
          },
        },
        required: ["businessHoursId"],
        additionalProperties: false,
      },
    },
    {
      name: "gladly.request",
      functionName: "gladly_request",
      aliases: ["gladly.request", "gladly_request", "gladly_full_api"],
      capability: "full_api",
      platformCapability: "gladly_full_api",
      action: "admin",
      approvalRequired: true,
      description:
        "Call one documented REST API v1 operation on the connected organization's fixed Gladly origin. Absolute URLs, credentials, redirects, and API-version overrides are rejected.",
      inputSchema: {
        type: "object",
        properties: {
          method: {
            type: "string",
            enum: ["GET", "POST", "PUT", "PATCH", "DELETE"],
          },
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
      id: "gladly_safe",
      label: "Safe",
      description:
        "Content-free schedule reads and every broader REST API operation require approval; tenant/version binding, Basic-auth secret isolation, API-user permissions, bounds, and limits remain enforced.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: [...scheduleReads, ...fullApi],
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Selected API-user-authorized operations run without Relay per-action approval; tenant/version binding, Basic-auth secret isolation, bounds, audits, and Gladly limits still apply.",
      defaultSelected: false,
      allowedActions: [...scheduleReads, ...fullApi],
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    {
      id: "list_business_hours",
      label:
        "Gladly organization, API-user Basic authentication, and bounded business-hours check",
    },
  ],
};
