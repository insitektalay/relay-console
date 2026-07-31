import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const authorityRead = action(
  "clio_grow_connection_authority_get",
  "Verify Clio Grow connection authority",
  "Verify that the US-region OAuth grant resolves to one Clio Grow user and account without returning identity, firm, lead, contact, matter, or note data.",
);

export const CLIO_GROW_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "clio-grow",
  name: "Clio Grow",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://docs.developers.clio.com/clio-grow/api-reference/",
  providerWebsiteUrl: "https://www.clio.com/grow/",
  capabilities: [
    {
      ...capability(
        "connection_authority_read",
        "Verify connection authority",
        "Verify one US-region Clio Grow OAuth grant without exposing user identity, firm identity, leads, contacts, matters, notes, sources, or custom actions.",
        true,
      ),
      platformCapability: "clio_grow_connection_authority_read",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://auth.api.clio.com/oauth/authorize",
      tokenUrl: "https://auth.api.clio.com/oauth/token",
      userInfoUrl: "https://api.clio.com/grow/users/who_am_i",
      refreshUrl: "https://auth.api.clio.com/oauth/token",
      revocationUrl: "https://auth.api.clio.com/oauth/revoke",
      requiredScopes: ["grow_user_read"],
      optionalScopes: [],
      pkce: true,
      supportsRefresh: true,
    },
    credentialSchema: [],
  },
  tools: [
    {
      name: "clioGrow.getConnectionAuthority",
      functionName: "clio_grow_connection_authority_get",
      aliases: [
        "clioGrow.getConnectionAuthority",
        "clio_grow_connection_authority_get",
      ],
      capability: "connection_authority_read",
      platformCapability: "clio_grow_connection_authority_read",
      action: "read",
      approvalRequired: true,
      description:
        "Verify the US connection and return only authorization state, fixed region, and API version.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "clio_grow_safe",
      label: "Safe",
      description:
        "The identity-free connection-authority check requires approval. All identity, firm, lead, contact, matter, note, source, custom-action, write, pagination, and arbitrary API access remains blocked.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: [authorityRead],
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The same identity-free authority check runs without per-action approval; US-region binding, exact grow_user_read scope, redaction, auditing, response bounds, and provider rate limits remain mandatory.",
      defaultSelected: false,
      allowedActions: [authorityRead],
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    {
      id: "connection_authority",
      label: "Clio Grow US OAuth authority validation",
      requiredScopes: ["grow_user_read"],
    },
  ],
};
