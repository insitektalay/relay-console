import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
const reads = [
  action(
    "buffer_account_get",
    "Read Buffer account status",
    "Read account ID, creation date, timezone, and bounded organization summaries without identity.",
  ),
  action(
    "buffer_organization_list",
    "List Buffer organizations",
    "List at most 25 organization IDs and channel counts without names, emails, members, or limits.",
  ),
  action(
    "buffer_channel_list",
    "List Buffer channel lifecycle",
    "List at most 25 identity-redacted channel lifecycle summaries for one exact organization.",
  ),
];
export const BUFFER_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "buffer",
  name: "Buffer",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developers.buffer.com/",
  providerWebsiteUrl: "https://buffer.com/",
  capabilities: [
    {
      ...capability(
        "social_structure_read",
        "Read social account structure",
        "Read bounded, identity-redacted account, organization, and channel lifecycle metadata.",
        true,
      ),
      platformCapability: "buffer_social_structure_read",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://auth.buffer.com/auth",
      tokenUrl: "https://auth.buffer.com/token",
      requiredScopes: ["account:read", "offline_access"],
      optionalScopes: [],
      pkce: true,
      supportsRefresh: true,
    },
    credentialSchema: [],
  },
  tools: [
    {
      name: "buffer.getAccountStatus",
      functionName: "buffer_account_get",
      aliases: ["buffer.getAccountStatus", "buffer_account_get"],
      capability: "social_structure_read",
      platformCapability: "buffer_social_structure_read",
      action: "read",
      approvalRequired: true,
      description: "Read identity-redacted account and organization status.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "buffer.listOrganizations",
      functionName: "buffer_organization_list",
      aliases: ["buffer.listOrganizations", "buffer_organization_list"],
      capability: "social_structure_read",
      platformCapability: "buffer_social_structure_read",
      action: "read",
      approvalRequired: true,
      description: "List at most 25 organization IDs and channel counts.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "buffer.listChannels",
      functionName: "buffer_channel_list",
      aliases: ["buffer.listChannels", "buffer_channel_list"],
      capability: "social_structure_read",
      platformCapability: "buffer_social_structure_read",
      action: "read",
      approvalRequired: true,
      description:
        "List at most 25 identity-redacted channels for one exact organization.",
      inputSchema: {
        type: "object",
        required: ["organizationId"],
        properties: {
          organizationId: {
            type: "string",
            pattern: "^[A-Za-z0-9_-]{1,100}$",
            maxLength: 100,
          },
        },
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "buffer_safe",
      label: "Safe",
      description:
        "All three metadata reads require approval; identity, post/idea content, analytics, writes, arbitrary GraphQL, pagination, and raw access remain blocked.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: reads,
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The same three bounded reads run directly; fixed origins, exact IDs, static queries, redaction, bounds, audits, and rate limits remain mandatory.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    {
      id: "account",
      label: "Buffer account OAuth validation",
      requiredScopes: ["account:read", "offline_access"],
    },
  ],
};
