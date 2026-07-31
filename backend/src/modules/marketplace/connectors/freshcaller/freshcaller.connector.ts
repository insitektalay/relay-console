import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const metricReads = [
  action(
    "freshcaller_call_metric_list",
    "List call metrics",
    "List one fixed first page of bounded Freshcaller call-performance metrics.",
  ),
  action(
    "freshcaller_call_metric_get",
    "Read call metrics",
    "Read bounded performance metrics for one exact Freshcaller call.",
  ),
];
const fullApi = [
  action(
    "freshcaller_full_api",
    "Use Freshcaller API v1",
    "Use a documented Freshcaller API v1 operation authorized by the connected user API key; Safe mode requires approval.",
  ),
];

export const FRESHCALLER_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "freshcaller",
  name: "Freshcaller",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developers.freshcaller.com/api/",
  providerWebsiteUrl: "https://www.freshworks.com/freshcaller-cloud-pbx/",
  capabilities: [
    {
      ...capability(
        "call_metric_read",
        "Read call metrics",
        "Read bounded call-performance metrics without phone numbers, participants, recordings, agents, teams, tags, lifecycle traces, integrated resources, or exports.",
        true,
      ),
      platformCapability: "freshcaller_call_metric_read",
    },
    {
      ...capability(
        "full_api",
        "Freshcaller API v1",
        "Use documented API v1 operations allowed by the connected Freshcaller user API key.",
        true,
      ),
      platformCapability: "freshcaller_full_api",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "FRESHCALLER_DOMAIN",
        label: "Freshcaller domain",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["api_key"],
        helpText: "Enter the account name before .freshcaller.com.",
      },
      {
        name: "FRESHCALLER_API_KEY",
        label: "Freshcaller API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Copy your API key from Freshcaller Profile Settings. Its access follows your account role.",
      },
    ],
  },
  tools: [
    {
      name: "freshcaller.listCallMetrics",
      functionName: "freshcaller_call_metric_list",
      aliases: ["freshcaller.listCallMetrics", "freshcaller_call_metric_list"],
      capability: "call_metric_read",
      platformCapability: "freshcaller_call_metric_read",
      action: "read",
      approvalRequired: true,
      description:
        "List at most twenty-five page-one duration, cost, and timestamp summaries without lifecycle, tags, phone numbers, participants, recordings, users, or teams.",
      inputSchema: {
        type: "object",
        properties: { limit: { type: "integer", minimum: 1, maximum: 25 } },
        additionalProperties: false,
      },
    },
    {
      name: "freshcaller.getCallMetrics",
      functionName: "freshcaller_call_metric_get",
      aliases: ["freshcaller.getCallMetrics", "freshcaller_call_metric_get"],
      capability: "call_metric_read",
      platformCapability: "freshcaller_call_metric_read",
      action: "read",
      approvalRequired: true,
      description:
        "Read the same bounded performance projection for one exact numeric call ID.",
      inputSchema: {
        type: "object",
        properties: { callId: { type: "integer", minimum: 1 } },
        required: ["callId"],
        additionalProperties: false,
      },
    },
    {
      name: "freshcaller.request",
      functionName: "freshcaller_request",
      aliases: [
        "freshcaller.request",
        "freshcaller_request",
        "freshcaller_full_api",
      ],
      capability: "full_api",
      platformCapability: "freshcaller_full_api",
      action: "admin",
      approvalRequired: true,
      description:
        "Call a documented Freshcaller API v1 method and relative path on the fixed account origin. Absolute URLs and credential-bearing fields are rejected.",
      inputSchema: {
        type: "object",
        properties: {
          method: { type: "string", enum: ["GET", "POST", "PUT", "DELETE"] },
          path: { type: "string", pattern: "^/api/v1/" },
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
      id: "freshcaller_safe",
      label: "Safe",
      description:
        "Bounded call-metric reads and every broader API operation require approval; tenant binding, secret isolation, provider roles, and limits remain enforced.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: [...metricReads, ...fullApi],
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Selected API-key-authorized operations run without Relay per-action approval; exact tenant binding, secret isolation, bounds, audits, provider roles, and Freshcaller limits still apply.",
      defaultSelected: false,
      allowedActions: [...metricReads, ...fullApi],
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    {
      id: "call_metrics",
      label:
        "Freshcaller domain, API key, role, and bounded call-metrics check",
    },
  ],
};
