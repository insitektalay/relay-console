import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { KINDFUL_OPERATIONS } from "./kindful-operation-registry";

const read = action(
  "kindful_read",
  "Read Kindful fundraising data",
  "Read organization metadata and query authorized contacts and transactions through Kindful's documented API.",
);

export const KINDFUL_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "kindful",
  name: "Kindful",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developer.kindful.com/partner/",
  providerWebsiteUrl: "https://kindful.com/",
  capabilities: [
    {
      ...capability(
        "kindful_read",
        "Read nonprofit CRM data",
        "Read account, campaign, fund, group and custom-field metadata and query contacts and transactions.",
        true,
      ),
      platformCapability: "kindful_read",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://app.kindful.com/admin/oauth2/authorize",
      tokenUrl: "https://app.kindful.com/admin/oauth2/token",
      requiredScopes: ["basic", "data_query"],
      optionalScopes: [],
      pkce: false,
      supportsRefresh: false,
    },
    credentialSchema: [
      {
        name: "KINDFUL_CLIENT_ID",
        label: "Kindful OAuth client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Railway-held Relay Console client ID issued through Kindful's Partner Dashboard after provider review.",
      },
      {
        name: "KINDFUL_CLIENT_SECRET",
        label: "Kindful OAuth client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Railway-held Relay Console client secret; never sent to agents or clients.",
      },
    ],
  },
  tools: [
    {
      name: "kindful.read",
      functionName: "kindful_read",
      aliases: ["kindful.read", "kindful_read"],
      capability: "kindful_read",
      platformCapability: "kindful_read",
      action: "read",
      approvalRequired: false,
      description:
        "Run one pinned Kindful metadata or data-query operation under the exact connected organization grant.",
      inputSchema: {
        type: "object",
        properties: {
          operation: {
            type: "string",
            enum: KINDFUL_OPERATIONS.map((item) => item.id),
          },
          query: { type: "object", maxProperties: 50 },
          json: {},
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "kindful_safe",
      label: "Safe",
      description:
        "All nine selected Kindful operations are semantic reads under basic and data_query; imports, links and integration-status writes are outside V1.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [],
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The same read-only surface runs without per-action approval; OAuth scopes, fixed routes, payload bounds, audits and provider limits still apply.",
      defaultSelected: false,
      allowedActions: [read],
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    {
      id: "oauth_and_organization",
      label: "Kindful OAuth grant and organization-details validation",
      requiredScopes: ["basic", "data_query"],
    },
  ],
};
