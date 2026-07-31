import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { APOLLO_IO_READ_OPERATIONS } from "./apollo-io-api.adapter";

export const APOLLO_IO_SCOPES = [
  "contacts_search",
  "mixed_people_api_search",
] as const;
const read = action(
  "apollo_io_read",
  "Search Apollo",
  "Search bounded Apollo people and saved-contact results without enrichment, contact channels, or writes.",
);
const manage = blocked(
  "apollo_io_manage",
  "Change or enrich Apollo data",
  "Enrichment, credit use, records, lists, sequences, messages, mailboxes, tasks, ownership, and every mutation are outside Relay's V1 contract.",
);

export const APOLLO_IO_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "apollo-io",
  name: "Apollo.io",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://docs.apollo.io/docs/apollo-mcp",
  providerWebsiteUrl: "https://www.apollo.io/",
  capabilities: [
    {
      ...capability(
        "apollo_io_read",
        "Search people and saved contacts",
        "Use two pinned no-credit API v1 searches with a required keyword, pages capped at 25, and contact channels removed.",
        true,
      ),
      platformCapability: "apollo_io_read",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl:
        "https://mcp.apollo.io/mcp/oauth_metadata/redirect_to_authorize",
      tokenUrl: "https://mcp.apollo.io/api/v1/oauth/token",
      userInfoUrl: "https://mcp.apollo.io/mcp",
      requiredScopes: [...APOLLO_IO_SCOPES],
      optionalScopes: [],
      pkce: true,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "APOLLO_MCP_CLIENT_ID",
        label: "Apollo OAuth client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Relay's dynamically registered public PKCE client ID from Apollo's official MCP OAuth server.",
      },
    ],
  },
  tools: [
    {
      name: "apolloIo.search",
      functionName: "apollo_io_read",
      aliases: ["apolloIo.search", "apollo_io_read"],
      capability: "apollo_io_read",
      platformCapability: "apollo_io_read",
      action: "read",
      approvalRequired: false,
      description: "Run one pinned, bounded Apollo API v1 search.",
      inputSchema: {
        type: "object",
        properties: {
          operation: { type: "string", enum: [...APOLLO_IO_READ_OPERATIONS] },
          query: { type: "string", minLength: 2, maxLength: 160 },
          page: { type: "integer", minimum: 1, maximum: 500 },
          limit: { type: "integer", minimum: 1, maximum: 25 },
        },
        required: ["operation", "query"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "apollo_io_safe",
      label: "Safe",
      description:
        "Two bounded no-credit searches run directly. Enrichment, contact channels, mailboxes, messages, sequences, arbitrary filters, and every mutation remain blocked.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [],
      blockedActions: [manage],
    },
  ],
  healthChecks: [
    {
      id: "oauth_and_bounded_contact_search",
      label: "OAuth and bounded contact-search access check",
      requiredScopes: [...APOLLO_IO_SCOPES],
    },
  ],
};
