import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const authorityRead = action(
  "clio_manage_connection_authority_get",
  "Verify Clio Manage connection authority",
  "Verify that the US-region OAuth grant resolves to an enabled Clio Manage user without returning user identity or legal-practice data.",
);

export const CLIO_MANAGE_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "clio-manage",
  name: "Clio Manage",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://docs.developers.clio.com/api-docs/clio-manage/",
  providerWebsiteUrl: "https://www.clio.com/manage/",
  capabilities: [
    {
      ...capability(
        "connection_authority_read",
        "Verify connection authority",
        "Verify one US-region Clio Manage OAuth grant without exposing user identity, firm data, client data, matters, documents, communications, calendar entries, tasks, activities, billing, or payments.",
        true,
      ),
      platformCapability: "clio_manage_connection_authority_read",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://app.clio.com/oauth/authorize",
      tokenUrl: "https://app.clio.com/oauth/token",
      userInfoUrl:
        "https://app.clio.com/api/v4/users/who_am_i?fields=id,enabled",
      refreshUrl: "https://app.clio.com/oauth/token",
      revocationUrl: "https://app.clio.com/oauth/deauthorize",
      requiredScopes: [],
      optionalScopes: [],
      pkce: false,
      supportsRefresh: true,
    },
    credentialSchema: [],
  },
  tools: [
    {
      name: "clioManage.getConnectionAuthority",
      functionName: "clio_manage_connection_authority_get",
      aliases: [
        "clioManage.getConnectionAuthority",
        "clio_manage_connection_authority_get",
      ],
      capability: "connection_authority_read",
      platformCapability: "clio_manage_connection_authority_read",
      action: "read",
      approvalRequired: true,
      description:
        "Verify the connection and return only enabled status, fixed US region, and pinned API version.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "clio_manage_safe",
      label: "Safe",
      description:
        "The identity-free connection-authority check requires approval. All legal-practice records, identity, content, financial data, webhooks, writes, administration, arbitrary API access, and other regions remain blocked.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: [authorityRead],
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The same identity-free authority check runs without per-action approval; US-region binding, read-only Users permission, field minimization, redaction, auditing, response bounds, and provider rate limits remain mandatory.",
      defaultSelected: false,
      allowedActions: [authorityRead],
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    {
      id: "connection_authority",
      label: "Clio Manage US OAuth authority validation",
      requiredScopes: [],
    },
  ],
};
