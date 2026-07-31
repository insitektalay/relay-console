import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "agorapulse_profile_list",
    "List Agorapulse profiles",
    "List at most twenty-five identity-redacted profile references in one exact connected workspace.",
  ),
  action(
    "agorapulse_audience_report_get",
    "Read audience analytics",
    "Read aggregate audience metrics for one exact profile and an explicit window of at most thirty-one days.",
  ),
  action(
    "agorapulse_community_report_get",
    "Read community analytics",
    "Read aggregate community-management metrics for one exact profile and an explicit window of at most thirty-one days.",
  ),
  action(
    "agorapulse_content_report_get",
    "Read content analytics",
    "Read content-performance metrics with identity and post content removed for one exact profile and an explicit window of at most thirty-one days.",
  ),
];

const reportInput = {
  type: "object",
  properties: {
    profileUid: {
      type: "string",
      pattern: "^[A-Za-z0-9_-]{1,128}$",
      maxLength: 128,
    },
    since: { type: "string", format: "date-time" },
    until: { type: "string", format: "date-time" },
  },
  required: ["profileUid", "since", "until"],
  additionalProperties: false,
};

export const AGORAPULSE_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "agorapulse",
  name: "Agorapulse",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://api.agorapulse.com/docs",
  providerWebsiteUrl: "https://www.agorapulse.com/",
  capabilities: [
    {
      ...capability(
        "social_analytics_read",
        "Read social analytics",
        "Read bounded profile references and aggregate audience, community-management, and content-performance metrics from one exact Agorapulse workspace.",
        true,
      ),
      platformCapability: "agorapulse_social_analytics_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "AGORAPULSE_API_KEY",
        label: "Agorapulse API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Generate a dedicated key in Agorapulse Personal settings > API Keys. Relay encrypts it and sends it only as a bearer credential to https://api.agorapulse.com.",
      },
      {
        name: "AGORAPULSE_ORGANIZATION_ID",
        label: "Agorapulse organization ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Paste the exact organization ID returned by Get manager organizations in the official API documentation.",
      },
      {
        name: "AGORAPULSE_WORKSPACE_ID",
        label: "Agorapulse workspace ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Paste one exact workspace ID returned by Get organization workspaces for the selected organization.",
      },
    ],
  },
  tools: [
    {
      name: "agorapulse.listProfiles",
      functionName: "agorapulse_profile_list",
      aliases: ["agorapulse.listProfiles", "agorapulse_profile_list"],
      capability: "social_analytics_read",
      platformCapability: "agorapulse_social_analytics_read",
      action: "read",
      approvalRequired: true,
      description:
        "List at most twenty-five profile UIDs and provider types without names, handles, avatars, biographies, or connected-account identity.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "agorapulse.getAudienceReport",
      functionName: "agorapulse_audience_report_get",
      aliases: [
        "agorapulse.getAudienceReport",
        "agorapulse_audience_report_get",
      ],
      capability: "social_analytics_read",
      platformCapability: "agorapulse_social_analytics_read",
      action: "read",
      approvalRequired: true,
      description:
        "Read redacted aggregate audience metrics for one exact profile over at most thirty-one days.",
      inputSchema: reportInput,
    },
    {
      name: "agorapulse.getCommunityReport",
      functionName: "agorapulse_community_report_get",
      aliases: [
        "agorapulse.getCommunityReport",
        "agorapulse_community_report_get",
      ],
      capability: "social_analytics_read",
      platformCapability: "agorapulse_social_analytics_read",
      action: "read",
      approvalRequired: true,
      description:
        "Read redacted aggregate community-management metrics for one exact profile over at most thirty-one days.",
      inputSchema: reportInput,
    },
    {
      name: "agorapulse.getContentReport",
      functionName: "agorapulse_content_report_get",
      aliases: ["agorapulse.getContentReport", "agorapulse_content_report_get"],
      capability: "social_analytics_read",
      platformCapability: "agorapulse_social_analytics_read",
      action: "read",
      approvalRequired: true,
      description:
        "Read redacted content-performance metrics for one exact profile over at most thirty-one days without post text or identity.",
      inputSchema: reportInput,
    },
  ],
  approvalProfiles: [
    {
      id: "agorapulse_safe",
      label: "Safe",
      description:
        "All four bounded reads require approval; names, handles, messages, post text, URLs, media, listening, custom and ROI reports, publishing, inbox operations, writes, raw APIs, pagination, bulk, and export remain blocked.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: reads,
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The same four bounded reads run directly; exact organization/workspace binding, fixed paths, metric redaction, time bounds, response caps, audits, and provider limits remain mandatory.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    {
      id: "workspace",
      label: "Agorapulse API key and exact organization/workspace validation",
    },
  ],
};
