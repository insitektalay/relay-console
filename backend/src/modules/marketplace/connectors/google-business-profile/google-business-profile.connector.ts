import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const GOOGLE_BUSINESS_PROFILE_SCOPES = [
  "https://www.googleapis.com/auth/business.manage",
];
const reads = [
  action(
    "google_business_profile_account_get",
    "Get Business Profile account",
    "Read safe metadata for the OAuth-bound Business Profile account.",
  ),
  action(
    "google_business_profile_location_get",
    "Get Business Profile location",
    "Read bounded public-facing metadata for the OAuth-bound location.",
  ),
  action(
    "google_business_profile_performance_summary",
    "Get Business Profile performance",
    "Read a fixed thirty-day daily performance summary for the bound location.",
  ),
  action(
    "google_business_profile_search_keywords_list",
    "List Business Profile search keywords",
    "Read the first twenty search keywords for the previous three complete months.",
  ),
];
const blockedActions = [
  blocked(
    "google_business_profile_account_location_admin",
    "Administer accounts or locations",
    "Account, user, invitation, location, verification, and transfer administration are blocked.",
  ),
  blocked(
    "google_business_profile_location_mutation",
    "Mutate location profile",
    "Profile, hours, categories, attributes, services, media, and food-menu mutations are blocked.",
  ),
  blocked(
    "google_business_profile_local_post_mutation",
    "Manage local posts",
    "Creating, updating, or deleting local posts is blocked.",
  ),
  blocked(
    "google_business_profile_review_mutation",
    "Manage reviews",
    "Replies and other review mutations are blocked.",
  ),
  blocked(
    "google_business_profile_broad_export",
    "Export Business Profile data",
    "Cross-account discovery, arbitrary metrics, broad exports, page tokens, and automatic pagination are blocked.",
  ),
];
const accountName = {
  type: "string",
  pattern: "^accounts/[0-9]+$",
  maxLength: 64,
};
const locationName = {
  type: "string",
  pattern: "^locations/[0-9]+$",
  maxLength: 64,
};

export const GOOGLE_BUSINESS_PROFILE_CONNECTOR_MANIFEST: MarketplaceConnectorManifest =
  {
    slug: "google-business-profile",
    name: "Google Business Profile",
    connectorType: "native_clawchat",
    providerDocsUrl: "https://developers.google.com/my-business",
    providerWebsiteUrl: "https://business.google.com/",
    capabilities: [
      {
        ...capability(
          "account_get",
          "Read bound account",
          "Read safe metadata for one OAuth-bound account.",
          true,
        ),
        platformCapability: "google_business_profile_account_get",
      },
      {
        ...capability(
          "location_get",
          "Read bound location",
          "Read bounded public-facing metadata for one bound location.",
          true,
        ),
        platformCapability: "google_business_profile_location_get",
      },
      {
        ...capability(
          "performance_summary",
          "Read fixed performance summary",
          "Read seven daily metrics for a fixed thirty-day range.",
          true,
        ),
        platformCapability: "google_business_profile_performance_summary",
      },
      {
        ...capability(
          "search_keywords_list",
          "Read search keywords",
          "Read the first twenty keywords for three complete months.",
          true,
        ),
        platformCapability: "google_business_profile_search_keywords_list",
      },
    ],
    auth: {
      type: "oauth2_authorization_code",
      oauth: {
        authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
        tokenUrl: "https://oauth2.googleapis.com/token",
        refreshUrl: "https://oauth2.googleapis.com/token",
        revocationUrl: "https://oauth2.googleapis.com/revoke",
        requiredScopes: GOOGLE_BUSINESS_PROFILE_SCOPES,
        optionalScopes: [],
        pkce: true,
        supportsRefresh: true,
      },
      credentialSchema: [
        {
          name: "GOOGLE_OAUTH_CLIENT_ID",
          label: "Google OAuth client ID",
          required: true,
          secret: false,
          storedIn: "metadata",
          helpText:
            "Railway-held Relay Console confidential web OAuth client ID.",
        },
        {
          name: "GOOGLE_OAUTH_CLIENT_SECRET",
          label: "Google OAuth client secret",
          required: true,
          secret: true,
          storedIn: "encrypted_secret",
          helpText:
            "Railway-held Google OAuth client secret; never sent to clients or agents.",
        },
      ],
    },
    tools: [
      {
        name: "googleBusinessProfile.getAccount",
        functionName: "google_business_profile_account_get",
        aliases: ["google_business_profile_account_get"],
        capability: "account_get",
        platformCapability: "google_business_profile_account_get",
        action: "read",
        approvalRequired: false,
        description:
          "Read safe metadata for the exact account bound during OAuth.",
        inputSchema: {
          type: "object",
          properties: { accountName },
          additionalProperties: false,
        },
      },
      {
        name: "googleBusinessProfile.getLocation",
        functionName: "google_business_profile_location_get",
        aliases: ["google_business_profile_location_get"],
        capability: "location_get",
        platformCapability: "google_business_profile_location_get",
        action: "read",
        approvalRequired: false,
        description:
          "Read bounded public-facing metadata for the exact location bound during OAuth.",
        inputSchema: {
          type: "object",
          properties: { accountName, locationName },
          additionalProperties: false,
        },
      },
      {
        name: "googleBusinessProfile.getPerformance",
        functionName: "google_business_profile_performance_summary",
        aliases: ["google_business_profile_performance_summary"],
        capability: "performance_summary",
        platformCapability: "google_business_profile_performance_summary",
        action: "read",
        approvalRequired: false,
        description:
          "Read Relay's fixed seven-metric daily summary for the last thirty complete days.",
        inputSchema: {
          type: "object",
          properties: { accountName, locationName },
          additionalProperties: false,
        },
      },
      {
        name: "googleBusinessProfile.listSearchKeywords",
        functionName: "google_business_profile_search_keywords_list",
        aliases: ["google_business_profile_search_keywords_list"],
        capability: "search_keywords_list",
        platformCapability: "google_business_profile_search_keywords_list",
        action: "read",
        approvalRequired: false,
        description:
          "Read the first twenty search keywords over the previous three complete months without pagination.",
        inputSchema: {
          type: "object",
          properties: { accountName, locationName },
          additionalProperties: false,
        },
      },
    ],
    approvalProfiles: [
      {
        id: "google_business_profile_safe",
        label: "Safe",
        description:
          "Four exact-account/location read wrappers run automatically; the broad provider scope is constrained against all writes, administration, arbitrary queries, exports, and pagination.",
        defaultSelected: true,
        allowedActions: reads,
        approvalRequiredActions: [],
        blockedActions,
      },
      {
        id: "dangerously_skip_permissions",
        label: "Dangerously skip permissions",
        description:
          "The same account/location binding, fixed reports, field masks, response caps, and no-write boundaries remain enforced.",
        defaultSelected: false,
        allowedActions: reads,
        approvalRequiredActions: [],
        blockedActions,
      },
    ],
    healthChecks: [
      {
        id: "bound-location-readonly",
        label: "Exact scope and bound account/location read-only boundary",
        requiredScopes: GOOGLE_BUSINESS_PROFILE_SCOPES,
      },
    ],
  };
