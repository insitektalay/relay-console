import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "beehiiv_account_get",
    "Read OAuth account summary",
    "Read the exact beehiiv organization identifier and token lifetime without returning user identity.",
  ),
  action(
    "beehiiv_publication_list",
    "List publication lifecycle",
    "List at most twenty-five publication lifecycle summaries without names, organizations, URLs, or engagement statistics.",
  ),
  action(
    "beehiiv_post_list",
    "List post lifecycle",
    "List at most twenty-five post lifecycle summaries for one exact publication without content, titles, authors, URLs, or engagement.",
  ),
];

export const BEEHIIV_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "beehiiv",
  name: "beehiiv",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developers.beehiiv.com/",
  providerWebsiteUrl: "https://www.beehiiv.com/",
  capabilities: [
    {
      ...capability(
        "newsletter_metadata_read",
        "Read newsletter lifecycle metadata",
        "Read bounded, redacted organization, publication, and post lifecycle metadata.",
        true,
      ),
      platformCapability: "beehiiv_newsletter_metadata_read",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://app.beehiiv.com/oauth/authorize",
      tokenUrl: "https://app.beehiiv.com/oauth/token",
      revocationUrl: "https://app.beehiiv.com/oauth/revoke",
      userInfoUrl: "https://app.beehiiv.com/oauth/token/info",
      requiredScopes: ["identify:read", "publications:read", "posts:read"],
      optionalScopes: [],
      pkce: false,
      supportsRefresh: true,
    },
    credentialSchema: [],
  },
  tools: [
    {
      name: "beehiiv.getAccountSummary",
      functionName: "beehiiv_account_get",
      aliases: ["beehiiv.getAccountSummary", "beehiiv_account_get"],
      capability: "newsletter_metadata_read",
      platformCapability: "beehiiv_newsletter_metadata_read",
      action: "read",
      approvalRequired: true,
      description: "Read the redacted exact-organization OAuth summary.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "beehiiv.listPublications",
      functionName: "beehiiv_publication_list",
      aliases: ["beehiiv.listPublications", "beehiiv_publication_list"],
      capability: "newsletter_metadata_read",
      platformCapability: "beehiiv_newsletter_metadata_read",
      action: "read",
      approvalRequired: true,
      description:
        "List up to twenty-five content-free publication lifecycle summaries.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "beehiiv.listPosts",
      functionName: "beehiiv_post_list",
      aliases: ["beehiiv.listPosts", "beehiiv_post_list"],
      capability: "newsletter_metadata_read",
      platformCapability: "beehiiv_newsletter_metadata_read",
      action: "read",
      approvalRequired: true,
      description:
        "List up to twenty-five content-free post lifecycle summaries for one publication.",
      inputSchema: {
        type: "object",
        required: ["publicationId"],
        properties: {
          publicationId: {
            type: "string",
            pattern: "^pub_[0-9a-fA-F-]{1,64}$",
            maxLength: 68,
          },
        },
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "beehiiv_safe",
      label: "Safe",
      description:
        "Every bounded beehiiv metadata read requires approval; subscriber identity, content, engagement, automations, segments, polls, tiers, referrals, webhooks, writes, exports, and raw API access remain blocked.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: reads,
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The three bounded beehiiv metadata reads run without per-action approval; exact-organization binding, fixed origins, redaction, first-page bounds, audits, and rate limits still apply.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    {
      id: "organization",
      label: "beehiiv exact-organization OAuth validation",
    },
  ],
};
