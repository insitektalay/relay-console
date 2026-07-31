import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "hootsuite_account_get",
    "Read Hootsuite account status",
    "Read the authenticated member ID, active state, timezone, language, and lifecycle dates without identity fields.",
  ),
  action(
    "hootsuite_social_profile_id_list",
    "List accessible social profile IDs",
    "List at most twenty-five profile IDs accessible to the authenticated member.",
  ),
  action(
    "hootsuite_social_profile_get",
    "Read social profile status",
    "Read one exact profile ID, network type, ownership category, and reauthorization state without usernames or network identifiers.",
  ),
];

export const HOOTSUITE_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "hootsuite",
  name: "Hootsuite",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://apidocs.hootsuite.com/docs/api/index.html",
  providerWebsiteUrl: "https://www.hootsuite.com/",
  capabilities: [
    {
      ...capability(
        "social_account_metadata_read",
        "Read social account metadata",
        "Read bounded, identity-redacted Hootsuite member and social-profile status metadata.",
        true,
      ),
      platformCapability: "hootsuite_social_account_metadata_read",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://platform.hootsuite.com/oauth2/auth",
      tokenUrl: "https://platform.hootsuite.com/oauth2/token",
      userInfoUrl: "https://platform.hootsuite.com/v1/me",
      requiredScopes: ["offline"],
      optionalScopes: [],
      pkce: false,
      supportsRefresh: true,
    },
    credentialSchema: [],
  },
  tools: [
    {
      name: "hootsuite.getAccountStatus",
      functionName: "hootsuite_account_get",
      aliases: ["hootsuite.getAccountStatus", "hootsuite_account_get"],
      capability: "social_account_metadata_read",
      platformCapability: "hootsuite_social_account_metadata_read",
      action: "read",
      approvalRequired: true,
      description: "Read the identity-redacted authenticated-member status.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "hootsuite.listSocialProfileIds",
      functionName: "hootsuite_social_profile_id_list",
      aliases: [
        "hootsuite.listSocialProfileIds",
        "hootsuite_social_profile_id_list",
      ],
      capability: "social_account_metadata_read",
      platformCapability: "hootsuite_social_account_metadata_read",
      action: "read",
      approvalRequired: true,
      description: "List at most twenty-five accessible social profile IDs.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "hootsuite.getSocialProfileStatus",
      functionName: "hootsuite_social_profile_get",
      aliases: [
        "hootsuite.getSocialProfileStatus",
        "hootsuite_social_profile_get",
      ],
      capability: "social_account_metadata_read",
      platformCapability: "hootsuite_social_account_metadata_read",
      action: "read",
      approvalRequired: true,
      description: "Read one exact social profile's redacted status.",
      inputSchema: {
        type: "object",
        required: ["socialProfileId"],
        properties: {
          socialProfileId: {
            type: "string",
            pattern: "^[1-9][0-9]{0,31}$",
            maxLength: 32,
          },
        },
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "hootsuite_safe",
      label: "Safe",
      description:
        "All three bounded metadata reads require approval; identity, content, publishing, organizations, teams, Inbox, SCIM, analytics, ads, messages, writes, and raw access remain blocked.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: reads,
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The same three metadata reads run without per-action approval; fixed origin, exact identifiers, redaction, bounds, audits, and provider rate-limit responses still apply.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    {
      id: "member",
      label: "Hootsuite authenticated-member OAuth validation",
      requiredScopes: ["offline"],
    },
  ],
};
