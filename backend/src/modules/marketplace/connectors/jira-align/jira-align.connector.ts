import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const read = action(
  "jira_align_read",
  "Read Jira Align data",
  "Run one bounded GET request against a documented Jira Align REST API 2.0 resource.",
);
const manage = action(
  "jira_align_manage",
  "Change Jira Align data",
  "Create or update one supported Jira Align resource; Safe mode requires approval.",
);
const guards = [
  action(
    "jira_align_secret_exposure",
    "Expose credentials",
    "Atlassian API tokens and authorization headers never enter agent-visible results.",
  ),
  action(
    "jira_align_untrusted_route",
    "Call an untrusted route",
    "Requests remain pinned to the validated Jira Align tenant and documented API 2.0 resources.",
  ),
  action(
    "jira_align_unbounded_transfer",
    "Transfer unbounded data",
    "Relay bounds query fields, request bodies, responses, and refuses redirects.",
  ),
];

const requestProperties = {
  path: { type: "string", minLength: 1, maxLength: 500, pattern: "^/" },
  query: { type: "object" },
};

export const JIRA_ALIGN_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "jira-align",
  name: "Jira Align",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://help.jiraalign.com/hc/en-us/articles/360045371954-Getting-started-with-the-REST-API-2-0",
  providerWebsiteUrl: "https://www.atlassian.com/software/jira/align",
  capabilities: [
    {
      ...capability(
        "enterprise_planning_read",
        "Browse Jira Align",
        "Read authorized strategy, portfolio, program, team, work, time, customer, location, and idea resources.",
        true,
      ),
      platformCapability: "jira_align_enterprise_planning_read",
    },
    {
      ...capability(
        "enterprise_planning_manage",
        "Manage Jira Align",
        "Create or update resources supported by Jira Align REST API 2.0 and the connected user's role.",
        true,
      ),
      platformCapability: "jira_align_enterprise_planning_manage",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "JIRA_ALIGN_SITE_URL",
        label: "Jira Align site URL",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Enter the HTTPS origin for your Jira Align tenant, such as https://example.jiraalign.com.",
      },
      {
        name: "JIRA_ALIGN_EMAIL",
        label: "Atlassian account email",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Use the account email that owns the scoped Atlassian API token.",
      },
      {
        name: "JIRA_ALIGN_API_TOKEN",
        label: "Scoped Atlassian API token",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Create an expiring Atlassian API token with Jira Align read scope; add write scope only when enabling management.",
      },
    ],
  },
  tools: [
    {
      name: "jira-align.read",
      functionName: "jira_align_read",
      aliases: ["jira-align.read", "jira_align_read"],
      capability: "enterprise_planning_read",
      platformCapability: "jira_align_enterprise_planning_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read one documented Jira Align API 2.0 collection or item with bounded query parameters.",
      inputSchema: {
        type: "object",
        properties: requestProperties,
        required: ["path"],
        additionalProperties: false,
      },
    },
    {
      name: "jira-align.manage",
      functionName: "jira_align_manage",
      aliases: ["jira-align.manage", "jira_align_manage"],
      capability: "enterprise_planning_manage",
      platformCapability: "jira_align_enterprise_planning_manage",
      action: "write",
      approvalRequired: true,
      description:
        "Create or update one documented Jira Align API 2.0 resource.",
      inputSchema: {
        type: "object",
        properties: {
          ...requestProperties,
          method: { type: "string", enum: ["POST", "PUT", "PATCH"] },
          json: { type: "object" },
          approvalId: { type: "string", maxLength: 200 },
        },
        required: ["method", "path", "json"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "jira_align_safe",
      label: "Safe",
      description:
        "Bounded reads run directly; every supported Jira Align create or update requires approval.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [manage],
      blockedActions: guards,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Selected token-authorized creates and updates run without Relay per-action approval; provider roles, tenant pinning, route bounds, redaction, audits, and limits still apply.",
      defaultSelected: false,
      allowedActions: [read, manage],
      approvalRequiredActions: [],
      blockedActions: guards,
    },
  ],
  healthChecks: [
    { id: "epics", label: "Jira Align tenant, token, and API 2.0 check" },
  ],
};
