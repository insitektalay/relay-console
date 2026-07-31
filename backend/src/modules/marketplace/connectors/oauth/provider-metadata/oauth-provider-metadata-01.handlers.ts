import type {
  OAuthProviderMetadataHandler,
  OAuthProviderMetadataHandlerMap,
} from "./oauth-provider-metadata-handler";
import type { MarketplaceConnectorOAuthService } from "../../connector-oauth.service";
import { BadRequestException } from "@nestjs/common";
import { MastodonApiError } from "../../mastodon/mastodon-api.adapter";
import { relayGoogleProviderName } from "../oauth-google-provider-name";

const oauthProviderMetadataHandler001: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const userId = this.stringOrNull(profileObject.signNowUserId);
  if (!userId || !/^[A-Za-z0-9_-]{1,256}$/.test(userId))
    throw new BadRequestException("SignNow connected-user binding is missing");
  return {
    provider: appSlug,
    connectorStandardVersion: "v1",
    oauthFlow: "relay_owned_confidential_authorization_code_refresh",
    tokenStatus: "valid",
    clientId,
    displayName: "SignNow account",
    grantedScopes,
    exactScopes: grantedScopes,
    providerScopeIsBroad: true,
    relayOwnedOAuthApp: true,
    railwayCallbackOnly: true,
    stateVerified: true,
    pkceS256: false,
    signNowUserId: userId,
    readOnlyV1: true,
    maxResults: 25,
    participantIdentityReturned: false,
    documentContentReturned: false,
    signingSurfacesReturned: false,
    auditTrailReturned: false,
    writesEnabled: false,
    broaderAuthorityEnabled: false,
    rawToolsEnabled: false,
    automaticPagination: false,
    automaticRetries: false,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler002: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const apiOrigin = this.adobeAcrobatSignAuthority(
    this.stringOrNull(profileObject.adobeAcrobatSignApiOrigin) ?? "",
  ).apiOrigin;
  return {
    provider: appSlug,
    connectorStandardVersion: "v1",
    oauthFlow: "relay_owned_confidential_authorization_code_refresh",
    tokenStatus: "valid",
    clientId,
    displayName: "Adobe Acrobat Sign account",
    grantedScopes,
    relayOwnedOAuthApp: true,
    railwayCallbackOnly: true,
    stateVerified: true,
    pkceS256: false,
    adobeAcrobatSignApiOrigin: apiOrigin,
    adobeAcrobatSignShard: new URL(apiOrigin).hostname,
    exactScopes: grantedScopes,
    selfScopeOnly: true,
    readOnlyV1: true,
    maxResults: 25,
    participantIdentityReturned: false,
    documentsReturned: false,
    signingUrlsReturned: false,
    auditTrailReturned: false,
    writesEnabled: false,
    broaderAuthorityEnabled: false,
    rawToolsEnabled: false,
    automaticPagination: false,
    automaticRetries: false,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler003: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  authority,
) {
  let instanceOrigin: string;
  try {
    instanceOrigin = this.mastodonApi.normalizeInstanceOrigin(
      authority?.mastodonInstanceOrigin ?? profileObject.mastodonInstanceOrigin,
    );
  } catch (error) {
    if (error instanceof MastodonApiError)
      throw new BadRequestException(error.message);
    throw error;
  }
  const instanceDomain =
    this.stringOrNull(authority?.mastodonInstanceDomain) ??
    this.stringOrNull(profileObject.mastodonInstanceDomain);
  const instanceVersion =
    this.stringOrNull(authority?.mastodonInstanceVersion) ??
    this.stringOrNull(profileObject.mastodonInstanceVersion);
  const accountId = this.stringOrNull(profileObject.mastodonAccountId);
  const username = this.stringOrNull(profileObject.mastodonUsername);
  const acct = this.stringOrNull(profileObject.mastodonAcct);
  const accountUrl = this.stringOrNull(profileObject.mastodonAccountUrl);
  const maxCharacters = Number(
    authority?.mastodonMaxCharacters ??
      profileObject.mastodonMaxCharacters ??
      500,
  );
  if (
    !instanceDomain ||
    instanceDomain !== new URL(instanceOrigin).hostname ||
    !instanceVersion ||
    !accountId ||
    !/^[A-Za-z0-9_:-]{1,256}$/.test(accountId) ||
    !username ||
    !acct ||
    !accountUrl ||
    new URL(accountUrl).origin !== instanceOrigin ||
    !Number.isInteger(maxCharacters) ||
    maxCharacters < 1 ||
    maxCharacters > 500
  )
    throw new BadRequestException(
      "Mastodon instance or account binding is invalid",
    );
  return {
    provider: "mastodon",
    connectorStandardVersion: "v1",
    oauthFlow:
      "relay_owned_dynamic_per_instance_confidential_authorization_code_pkce",
    tokenStatus: "valid",
    clientId,
    mastodonInstanceOrigin: instanceOrigin,
    mastodonInstanceDomain: instanceDomain,
    mastodonInstanceVersion: instanceVersion,
    mastodonMaxCharacters: maxCharacters,
    mastodonAccountId: accountId,
    mastodonUsername: username,
    mastodonAcct: acct,
    mastodonDisplayName:
      this.stringOrNull(profileObject.mastodonDisplayName) ?? acct,
    mastodonAccountUrl: accountUrl,
    mastodonLocked: profileObject.mastodonLocked === true,
    mastodonBot: profileObject.mastodonBot === true,
    displayName: this.stringOrNull(profileObject.mastodonDisplayName) ?? acct,
    grantedScopes,
    relayOwnedDynamicOAuthApp: true,
    railwayCallbackOnly: true,
    stateVerified: true,
    exactInstanceAuthorityBound: true,
    exactAccountAuthorityBound: true,
    publicAndUnlistedTextPublishOnly: true,
    ownStatusesOnly: true,
    fixedEndpointsOnly: true,
    ssrfProtectedDynamicOrigin: true,
    redirectsAllowed: false,
    automaticRetry: false,
    automaticPagination: false,
    rawApiEnabled: false,
    maxOwnStatuses: 10,
  };
};

const oauthProviderMetadataHandler004: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const profileId = this.stringOrNull(profileObject.threadsProfileId);
  const username = this.stringOrNull(profileObject.threadsUsername);
  if (!profileId || !/^[A-Za-z0-9_-]{1,128}$/.test(profileId) || !username)
    throw new BadRequestException("Threads profile binding is invalid");
  return {
    provider: "threads",
    connectorStandardVersion: "v1",
    oauthFlow: "relay_owned_confidential_authorization_code_long_lived_refresh",
    tokenStatus: "valid",
    clientId,
    threadsProfileId: profileId,
    threadsUsername: username,
    displayName: this.stringOrNull(profileObject.threadsName) ?? `@${username}`,
    threadsVerified: profileObject.threadsVerified === true,
    grantedScopes,
    relayOwnedOAuthApp: true,
    railwayCallbackOnly: true,
    stateVerified: true,
    exactProfileAuthorityBound: true,
    ownPostsOnly: true,
    plainTextPublishOnly: true,
    fixedEndpointsOnly: true,
    automaticRetry: false,
    automaticPagination: false,
    rawApiEnabled: false,
    maxOwnPosts: 10,
    maxPostCharacters: 500,
  };
};

const oauthProviderMetadataHandler005: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const accountId = this.stringOrNull(profileObject.pinterestUserAccountId);
  const username = this.stringOrNull(profileObject.pinterestUsername);
  if (
    !accountId ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(accountId) ||
    !username ||
    !/^[A-Za-z0-9_.-]{1,64}$/.test(username)
  )
    throw new BadRequestException("Pinterest user-account binding is invalid");
  return {
    provider: "pinterest",
    connectorStandardVersion: "v1",
    oauthFlow: "relay_owned_confidential_authorization_code_continuous_refresh",
    tokenStatus: "valid",
    clientId,
    pinterestUserAccountId: accountId,
    pinterestUsername: username,
    pinterestAccountType:
      this.stringOrNull(profileObject.pinterestAccountType) ?? null,
    displayName:
      this.stringOrNull(profileObject.pinterestDisplayName) ?? username,
    grantedScopes,
    relayOwnedOAuthApp: true,
    railwayCallbackOnly: true,
    stateVerified: true,
    exactUserAccountAuthorityBound: true,
    publicAccountReadsOnly: true,
    dataPersistedByConnector: false,
    fixedApiOrigin: "https://api.pinterest.com/v5",
    fixedEndpointsOnly: true,
    automaticRetry: false,
    automaticPagination: false,
    rawApiEnabled: false,
    maxPageSize: 10,
  };
};

const oauthProviderMetadataHandler006: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const accountName = this.stringOrNull(profileObject.tumblrAccountName);
  const blogUuid = this.stringOrNull(profileObject.tumblrSelectedBlogUuid);
  const blogName = this.stringOrNull(profileObject.tumblrSelectedBlogName);
  if (
    !accountName ||
    !blogUuid ||
    !/^t:[A-Za-z0-9_-]{1,128}$/.test(blogUuid) ||
    !blogName
  )
    throw new BadRequestException(
      "Tumblr account and selected-blog binding is invalid",
    );
  return {
    provider: "tumblr",
    connectorStandardVersion: "v1",
    oauthFlow: "relay_owned_authorization_code_offline_refresh",
    tokenStatus: "valid",
    clientId,
    tumblrAccountName: accountName,
    tumblrSelectedBlogUuid: blogUuid,
    tumblrSelectedBlogName: blogName,
    tumblrSelectedBlogTitle:
      this.stringOrNull(profileObject.tumblrSelectedBlogTitle) ?? null,
    tumblrSelectedBlogUrl:
      this.stringOrNull(profileObject.tumblrSelectedBlogUrl) ?? null,
    tumblrSelectedBlogPrimary: profileObject.tumblrSelectedBlogPrimary === true,
    tumblrSelectedBlogType:
      this.stringOrNull(profileObject.tumblrSelectedBlogType) ?? null,
    displayName:
      this.stringOrNull(profileObject.tumblrSelectedBlogTitle) ?? blogName,
    grantedScopes,
    relayOwnedOAuthApp: true,
    railwayCallbackOnly: true,
    stateVerified: true,
    exactAccountAuthorityBound: true,
    exactOwnedBlogAuthorityBound: true,
    publishedPostsOnly: true,
    npfPreferred: true,
    dataPersistedByConnector: false,
    fixedApiOrigin: "https://api.tumblr.com",
    fixedEndpointsOnly: true,
    automaticRetry: false,
    automaticPagination: false,
    rawApiEnabled: false,
    maxPageSize: 10,
  };
};

const oauthProviderMetadataHandler007: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const object = (value: unknown): Record<string, unknown> =>
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const integrationEnvelope = object(profileObject.aircallIntegration);
  const integration = object(integrationEnvelope.integration);
  const companyEnvelope = object(profileObject.aircallCompany);
  const company = object(companyEnvelope.company);
  const id = (value: unknown) =>
    typeof value === "number" && Number.isSafeInteger(value) && value > 0
      ? String(value)
      : this.stringOrNull(value);
  const aircallIntegrationId = id(integration.id);
  const aircallCompanyId = id(integration.company_id);
  const aircallCompanyName = this.stringOrNull(company.name)?.slice(0, 100);
  const active = integration.active === true || integration.status === "active";
  if (
    !aircallIntegrationId ||
    !/^[1-9][0-9]*$/.test(aircallIntegrationId) ||
    !aircallCompanyId ||
    !/^[1-9][0-9]*$/.test(aircallCompanyId) ||
    !aircallCompanyName ||
    !active
  )
    throw new BadRequestException(
      "Aircall connected company binding is invalid",
    );
  const count = (value: unknown) =>
    typeof value === "number" && Number.isSafeInteger(value) && value >= 0
      ? value
      : null;
  return {
    provider: "aircall",
    connectorStandardVersion: "v1",
    oauthFlow: "confidential_authorization_code_non_expiring_access_token",
    tokenStatus: "valid",
    clientId,
    aircallIntegrationId,
    aircallCompanyId,
    aircallCompanyName,
    aircallUsersCount: count(company.users_count),
    aircallNumbersCount: count(company.numbers_count),
    grantedScopes,
    railwayCallbackOnly: true,
    stateVerified: true,
    pkceS256: false,
    companyBindingVerified: true,
    integrationActive: true,
    canonicalAircallOnly: true,
    privacyMasked: true,
    fixedEndpointsOnly: true,
    automaticRetry: false,
    automaticPagination: false,
    rawToolsEnabled: false,
    maxNumbers: 10,
    maxProviderRequestsPerAction: 3,
    maxResponseBytes: 512 * 1024,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler008: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  if (profileObject.signRequestReadScopeVerified !== true)
    throw new BadRequestException("SignRequest read-scope binding is missing");
  return {
    provider: appSlug,
    connectorStandardVersion: "v1",
    oauthFlow: "relay_owned_confidential_authorization_code_refresh",
    tokenStatus: "valid",
    clientId,
    displayName: "SignRequest account",
    grantedScopes,
    exactScopes: grantedScopes,
    relayOwnedOAuthApp: true,
    railwayCallbackOnly: true,
    stateVerified: true,
    pkceS256: false,
    signRequestReadScopeVerified: true,
    readOnlyV1: true,
    maxResults: 25,
    peopleReturned: false,
    teamDataReturned: false,
    documentContentReturned: false,
    signingDataReturned: false,
    auditTrailReturned: false,
    writesEnabled: false,
    broaderAuthorityEnabled: false,
    rawToolsEnabled: false,
    automaticPagination: false,
    automaticRetries: false,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler009: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  if (profileObject.signeasyEnvelopeReadVerified !== true)
    throw new BadRequestException("Signeasy envelope-read binding is missing");
  return {
    provider: appSlug,
    connectorStandardVersion: "v1",
    oauthFlow: "relay_owned_confidential_authorization_code_rotating_refresh",
    tokenStatus: "valid",
    clientId,
    displayName: "Signeasy account",
    grantedScopes,
    exactScopes: grantedScopes,
    relayOwnedOAuthApp: true,
    railwayCallbackOnly: true,
    stateVerified: true,
    pkceS256: false,
    oauthAudience: "https://api-ext.signeasy.com/",
    signeasyEnvelopeReadVerified: true,
    readOnlyV1: true,
    maxResults: 25,
    peopleReturned: false,
    filesReturned: false,
    signingUrlsReturned: false,
    auditTrailReturned: false,
    writesEnabled: false,
    broaderAuthorityEnabled: false,
    rawToolsEnabled: false,
    automaticPagination: false,
    automaticRetries: false,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler010: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  if (profileObject.rightSignatureDocumentReadVerified !== true)
    throw new BadRequestException(
      "RightSignature read-scope binding is missing",
    );
  return {
    provider: appSlug,
    connectorStandardVersion: "v1",
    oauthFlow: "relay_owned_confidential_authorization_code_refresh",
    tokenStatus: "valid",
    clientId,
    displayName: "RightSignature account",
    grantedScopes,
    exactScopes: grantedScopes,
    relayOwnedOAuthApp: true,
    railwayCallbackOnly: true,
    stateVerified: true,
    pkceS256: false,
    rightSignatureDocumentReadVerified: true,
    readOnlyV1: true,
    maxResults: 25,
    peopleReturned: false,
    filenamesReturned: false,
    documentsReturned: false,
    signingUrlsReturned: false,
    certificatesReturned: false,
    formFieldsReturned: false,
    writesEnabled: false,
    broaderAuthorityEnabled: false,
    rawToolsEnabled: false,
    automaticPagination: false,
    automaticRetries: false,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler011: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  if (profileObject.googleClassroomCourseAccessVerified !== true)
    throw new BadRequestException(
      "Classroom requesting-user profile is invalid",
    );
  const accountLabel =
    this.stringOrNull(profileObject.googleClassroomAccountLabel) ??
    "Connected Classroom user";
  return {
    provider: appSlug,
    connectorStandardVersion: "v1",
    oauthFlow: "relay_owned_confidential_authorization_code_pkce_refresh",
    tokenStatus: "valid",
    clientId,
    displayName: accountLabel,
    accountLabel,
    grantedScopes,
    relayOwnedOAuthApp: true,
    railwayCallbackOnly: true,
    stateVerified: true,
    pkceS256: true,
    exactScopes: grantedScopes,
    requestingUserOnly: true,
    readOnlyV1: true,
    maxResults: 25,
    rostersEnabled: false,
    profilesEnabled: false,
    studentSubmissionsGradesEnabled: false,
    guardiansInvitationsEnabled: false,
    writesEnabled: false,
    domainDelegationEnabled: false,
    adminImpersonationEnabled: false,
    previewEnabled: false,
    automaticPagination: false,
    rawToolsEnabled: false,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler012: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const channelId = this.stringOrNull(profileObject.youtubeChannelId);
  if (!channelId || !/^UC[A-Za-z0-9_-]{1,62}$/.test(channelId))
    throw new BadRequestException(
      "YouTube connected-channel profile is invalid",
    );
  const channelTitle =
    this.stringOrNull(profileObject.youtubeChannelTitle) ?? channelId;
  return {
    provider: appSlug,
    connectorStandardVersion: "v1",
    oauthFlow: "relay_owned_confidential_authorization_code_pkce_refresh",
    tokenStatus: "valid",
    clientId,
    displayName: channelTitle,
    accountLabel: channelTitle,
    selectedChannelId: channelId,
    channelId,
    channelTitle,
    uploadsPlaylistId:
      this.stringOrNull(profileObject.youtubeUploadsPlaylistId) ?? null,
    grantedScopes,
    relayOwnedOAuthApp: true,
    railwayCallbackOnly: true,
    stateVerified: true,
    pkceS256: true,
    exactScope: "youtube.readonly",
    dataApiV3Only: true,
    readOnlyV1: true,
    connectedChannelOnly: true,
    youtubeAttributionRequired: true,
    maxResults: 25,
    writesEnabled: false,
    searchEnabled: false,
    historyEnabled: false,
    watchLaterEnabled: false,
    analyticsEnabled: false,
    partnerEnabled: false,
    automaticPagination: false,
    serviceAccountEnabled: false,
    rawToolsEnabled: false,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler013: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  appSlug,
  clientId,
  grantedScopes,
  profileObject,
  authority,
) {
  const accountName = this.googleMerchantCenterAccountName(
    profileObject.googleMerchantCenterAccountName ?? authority?.accountName,
  );
  return {
    provider: appSlug,
    connectorStandardVersion: "v1",
    oauthFlow: "relay_owned_confidential_authorization_code_pkce_refresh",
    tokenStatus: "valid",
    clientId,
    displayName:
      this.stringOrNull(profileObject.googleMerchantCenterAccountDisplayName) ??
      accountName,
    accountLabel:
      this.stringOrNull(profileObject.googleMerchantCenterAccountDisplayName) ??
      accountName,
    selectedAccountName: accountName,
    grantedScopes,
    relayOwnedOAuthApp: true,
    railwayCallbackOnly: true,
    stateVerified: true,
    pkceS256: true,
    exactScope: "content",
    stableV1Only: true,
    readOnlyV1: true,
    explicitAccountOnly: true,
    providerScopeCanWrite: true,
    writesEnabled: false,
    fixedReportsOnly: true,
    maxRows: 50,
    automaticPagination: false,
    serviceAccountEnabled: false,
    v1BetaEnabled: false,
    contentApiEnabled: false,
    rawToolsEnabled: false,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler014: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  appSlug,
  clientId,
  grantedScopes,
  profileObject,
  authority,
) {
  const accountName = this.googleBusinessProfileAccountName(
    profileObject.googleBusinessProfileAccountName ?? authority?.accountName,
  );
  const locationName = this.googleBusinessProfileLocationName(
    profileObject.googleBusinessProfileLocationName ?? authority?.locationName,
  );
  return {
    provider: appSlug,
    connectorStandardVersion: "v1",
    oauthFlow: "relay_owned_confidential_authorization_code_pkce_refresh",
    tokenStatus: "valid",
    clientId,
    displayName:
      this.stringOrNull(profileObject.googleBusinessProfileLocationTitle) ??
      locationName,
    accountLabel:
      this.stringOrNull(
        profileObject.googleBusinessProfileAccountDisplayName,
      ) ?? accountName,
    selectedAccountName: accountName,
    selectedLocationName: locationName,
    grantedScopes,
    relayOwnedOAuthApp: true,
    railwayCallbackOnly: true,
    stateVerified: true,
    pkceS256: true,
    exactScope: "business.manage",
    readOnlyV1: true,
    providerScopeCanWrite: true,
    writesEnabled: false,
    accountDiscoveryEnabled: false,
    locationDiscoveryEnabled: false,
    fixedReportsOnly: true,
    automaticPagination: false,
    serviceAccountsEnabled: false,
    delegationEnabled: false,
    rawToolsEnabled: false,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler015: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  appSlug,
  clientId,
  grantedScopes,
  profileObject,
  authority,
) {
  const siteUrl = this.googleSearchConsoleSiteUrl(
    profileObject.googleSearchConsoleSiteUrl ?? authority?.siteUrl,
  );
  return {
    provider: appSlug,
    connectorStandardVersion: "v1",
    oauthFlow: "relay_owned_confidential_authorization_code_pkce_refresh",
    tokenStatus: "valid",
    clientId,
    displayName: siteUrl,
    accountLabel: siteUrl,
    selectedSiteUrl: siteUrl,
    selectedPropertyType: siteUrl.startsWith("sc-domain:")
      ? "domain"
      : "url-prefix",
    permissionLevel: this.stringOrNull(
      profileObject.googleSearchConsolePermissionLevel,
    ),
    grantedScopes,
    relayOwnedOAuthApp: true,
    railwayCallbackOnly: true,
    stateVerified: true,
    pkceS256: true,
    exactScope: "webmasters.readonly",
    readOnlyV1: true,
    writesEnabled: false,
    automaticPagination: false,
    serviceAccountsEnabled: false,
    delegationEnabled: false,
    rawToolsEnabled: false,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler016: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  appSlug,
  clientId,
  grantedScopes,
  profileObject,
  authority,
) {
  const propertyId = this.googleAnalyticsPropertyId(
    profileObject.googleAnalyticsPropertyId ?? authority?.propertyId,
  );
  return {
    provider: appSlug,
    connectorStandardVersion: "v1",
    oauthFlow: "relay_owned_confidential_authorization_code_pkce_refresh",
    tokenStatus: "valid",
    clientId,
    displayName:
      this.stringOrNull(profileObject.googleAnalyticsPropertyDisplayName) ??
      `GA4 property ${propertyId}`,
    selectedPropertyId: propertyId,
    selectedPropertyName: `properties/${propertyId}`,
    grantedScopes,
    relayOwnedOAuthApp: true,
    railwayCallbackOnly: true,
    stateVerified: true,
    pkceS256: true,
    exactScope: "analytics.readonly",
    explicitPropertyOnly: true,
    propertyDiscoveryEnabled: false,
    arbitraryReportsEnabled: false,
    realtimeReportsEnabled: false,
    audienceExportsEnabled: false,
    mutationsEnabled: false,
    measurementProtocolEnabled: false,
    automaticPagination: false,
    rawToolsEnabled: false,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler017: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  appSlug,
  clientId,
  grantedScopes,
  profileObject,
  authority,
) {
  const customerId = this.googleAdsCustomerId(
    profileObject.googleAdsCustomerId ?? authority?.customerId,
    true,
  )!;
  const loginCustomerId = this.googleAdsCustomerId(
    profileObject.googleAdsLoginCustomerId ?? authority?.loginCustomerId,
    false,
  );
  return {
    provider: appSlug,
    connectorStandardVersion: "v1",
    oauthFlow: "relay_owned_confidential_authorization_code_pkce_refresh",
    tokenStatus: "valid",
    clientId,
    displayName:
      this.stringOrNull(profileObject.googleAdsCustomerName) ??
      `Google Ads customer ${customerId}`,
    customerId,
    loginCustomerId,
    grantedScopes,
    relayOwnedOAuthApp: true,
    relayOwnedDeveloperToken: true,
    railwayCallbackOnly: true,
    stateVerified: true,
    pkceS256: true,
    explicitCustomerOnly: true,
    fixedQueriesOnly: true,
    reportingOnly: true,
    automaticPagination: false,
    searchStreamEnabled: false,
    accountDiscoveryEnabled: false,
    rawToolsEnabled: false,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler018: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const userId = this.stringOrNull(profileObject.sub);
  const email = this.stringOrNull(profileObject.email);
  if (!userId || !email)
    throw new BadRequestException(
      `${relayGoogleProviderName(appSlug)} connected-account binding is invalid`,
    );
  return {
    provider: appSlug,
    connectorStandardVersion: "v1",
    oauthFlow: "relay_owned_confidential_authorization_code_pkce_refresh",
    tokenStatus: "valid",
    clientId,
    googleUserId: userId,
    displayName: this.stringOrNull(profileObject.name) ?? email,
    email,
    emailVerified: profileObject.email_verified === true,
    grantedScopes,
    relayOwnedOAuthApp: true,
    railwayCallbackOnly: true,
    stateVerified: true,
    pkceS256: true,
    exactGoogleAccountBound: true,
    appVisibleDriveCorpusOnly: true,
    fixedEndpointsOnly: true,
    automaticPagination: false,
    rawToolsEnabled: false,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler019: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const accountEmail = this.stringOrNull(
    profileObject.googleCalendarAccountEmail,
  );
  const defaultCalendarId = this.stringOrNull(
    profileObject.googleCalendarDefaultCalendarId,
  );
  if (
    !accountEmail ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(accountEmail) ||
    !defaultCalendarId ||
    defaultCalendarId.length > 320
  )
    throw new BadRequestException(
      "Google Calendar account or default Calendar binding is invalid",
    );
  return {
    provider: "google-calendar",
    connectorStandardVersion: "v1",
    oauthFlow: "relay_owned_verified_google_authorization_code_offline_refresh",
    tokenStatus: "valid",
    clientId,
    googleCalendarAccountEmail: accountEmail,
    googleCalendarDefaultCalendarId: defaultCalendarId,
    googleCalendarDefaultCalendarSummary: this.stringOrNull(
      profileObject.googleCalendarDefaultCalendarSummary,
    ),
    googleCalendarDefaultTimeZone: this.stringOrNull(
      profileObject.googleCalendarDefaultTimeZone,
    ),
    displayName:
      this.stringOrNull(profileObject.googleCalendarDefaultCalendarSummary) ??
      accountEmail,
    email: accountEmail,
    grantedScopes,
    railwayCallbackOnly: true,
    stateVerified: true,
    accountVerified: true,
    defaultCalendarVerified: true,
    exactScopesOnly: true,
    sensitiveScopeVerificationRequired: true,
    fixedEndpointsOnly: true,
    automaticPagination: false,
    guestNotificationsEnabled: false,
    rawToolsEnabled: false,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler020: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const workspaceId = this.stringOrNull(profileObject.attioWorkspaceId);
  const memberId = this.stringOrNull(
    profileObject.attioAuthorizedByWorkspaceMemberId,
  );
  const introspectedScopes = this.stringArray(profileObject.attioGrantedScopes);
  if (
    !workspaceId ||
    !memberId ||
    !/^[0-9a-fA-F-]{36}$/.test(workspaceId) ||
    !/^[0-9a-fA-F-]{36}$/.test(memberId) ||
    grantedScopes.some((scope) => !introspectedScopes.includes(scope))
  )
    throw new BadRequestException(
      "Attio workspace, authorizing-member, or scope binding is invalid",
    );
  const workspaceName = this.stringOrNull(profileObject.attioWorkspaceName);
  return {
    provider: "attio",
    connectorStandardVersion: "v1",
    oauthFlow: "relay_owned_authorization_code_public_app_review",
    tokenStatus: "valid",
    clientId,
    attioWorkspaceId: workspaceId,
    attioWorkspaceName: workspaceName,
    attioWorkspaceSlug: this.stringOrNull(profileObject.attioWorkspaceSlug),
    attioAuthorizedByWorkspaceMemberId: memberId,
    displayName: workspaceName ?? "Attio workspace",
    grantedScopes: introspectedScopes,
    apiVersion: "v2",
    relayOwnedOAuthApp: true,
    publicAppReviewRequired: true,
    stateVerified: true,
    exactWorkspaceAuthorityBound: true,
    exactAuthorizingMemberBound: true,
    refreshSupported: false,
    providerRevocationEndpointDocumented: false,
    fixedEndpointsOnly: true,
    automaticPagination: false,
    rawApiEnabled: false,
  };
};

const oauthProviderMetadataHandler021: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const organizationId = this.stringOrNull(profileObject.closeOrganizationId);
  const userId = this.stringOrNull(profileObject.closeUserId);
  if (
    !organizationId ||
    !userId ||
    !/^orga_[A-Za-z0-9]{1,200}$/.test(organizationId) ||
    !/^user_[A-Za-z0-9]{1,200}$/.test(userId)
  )
    throw new BadRequestException(
      "Close organization or authorizing-user binding is invalid",
    );
  const organizationName = this.stringOrNull(
    profileObject.closeOrganizationName,
  );
  return {
    provider: "close",
    connectorStandardVersion: "v1",
    oauthFlow:
      "relay_owned_authorization_code_rotating_refresh_public_app_review",
    tokenStatus: "valid",
    clientId,
    closeOrganizationId: organizationId,
    closeOrganizationName: organizationName,
    closeUserId: userId,
    closeUserName: this.stringOrNull(profileObject.closeUserName),
    displayName: organizationName ?? "Close organization",
    grantedScopes,
    apiVersion: "v1",
    relayOwnedOAuthApp: true,
    publicAppReviewRequired: true,
    stateVerified: true,
    exactOrganizationAuthorityBound: true,
    exactAuthorizingUserBound: true,
    providerScopeIsApiKeyEquivalent: true,
    relayReadOnlyBoundary: true,
    accessTokenExpiresInSeconds: 3600,
    refreshSupported: true,
    refreshTokenRotationRequired: true,
    providerRevocationRequired: true,
    fixedEndpointsOnly: true,
    automaticPagination: false,
    rawApiEnabled: false,
  };
};

const oauthProviderMetadataHandler022: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  authority,
) {
  const instanceOrigin = this.normalizeZendeskInstance(
    authority?.zendeskInstanceOrigin ?? "",
  );
  const userId = this.positiveNumericId(profileObject.zendeskUserId);
  if (!userId)
    throw new BadRequestException(
      "Zendesk authorizing-user binding is invalid",
    );
  const userName = this.stringOrNull(profileObject.zendeskUserName);
  return {
    provider: "zendesk",
    connectorStandardVersion: "v1",
    oauthFlow:
      "relay_owned_global_authorization_code_expiring_rotating_refresh_public_app_review",
    tokenStatus: "valid",
    clientId,
    zendeskInstanceOrigin: instanceOrigin,
    zendeskSubdomain: new URL(instanceOrigin).hostname.replace(
      /\.zendesk\.com$/,
      "",
    ),
    zendeskUserId: userId,
    zendeskUserName: userName,
    zendeskUserRole: this.stringOrNull(profileObject.zendeskUserRole),
    displayName: userName ?? "Zendesk Support",
    grantedScopes,
    relayOwnedOAuthApp: true,
    globalOAuthClientRequired: true,
    publicAppReviewRequired: true,
    stateVerified: true,
    exactInstanceAuthorityBound: true,
    exactAuthorizingUserBound: true,
    relayReadOnlyBoundary: true,
    accessTokenExpiresInSeconds: 1800,
    refreshSupported: true,
    refreshTokenRotationRequired: true,
    providerRevocationRequired: true,
    fixedEndpointsOnly: true,
    automaticPagination: false,
    rawApiEnabled: false,
  };
};

const oauthProviderMetadataHandler023: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const userId = this.positiveNumericId(profileObject.helpScoutUserId);
  if (!userId || profileObject.helpScoutUserActive !== true)
    throw new BadRequestException(
      "Help Scout authorizing-user binding is invalid",
    );
  const userName = this.stringOrNull(profileObject.helpScoutUserName);
  return {
    provider: "help-scout",
    connectorStandardVersion: "v1",
    oauthFlow:
      "relay_owned_public_app_authorization_code_expiring_rotating_refresh",
    tokenStatus: "valid",
    clientId,
    helpScoutUserId: userId,
    helpScoutUserName: userName,
    helpScoutUserRole: this.stringOrNull(profileObject.helpScoutUserRole),
    helpScoutUserActive: true,
    displayName: userName ?? "Help Scout account",
    grantedScopes,
    apiVersion: "v2",
    relayOwnedOAuthApp: true,
    stateVerified: true,
    exactAuthorizingUserBound: true,
    accessTokenExpiresInSeconds: 172800,
    refreshSupported: true,
    refreshTokenRotationRequired: true,
    providerRevocationRequired: false,
    fixedApiOrigin: "https://api.helpscout.net",
    automaticPagination: false,
    rawApiEnabled: true,
  };
};

const oauthProviderMetadataHandler024: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const accountId = this.smartsheetNumericId(
    profileObject.smartsheetAccountId,
    "account",
  );
  const userId = this.smartsheetNumericId(
    profileObject.smartsheetUserId,
    "user",
  );
  const apiOrigin = "https://api.smartsheet.com/2.0";
  if (this.stringOrNull(profileObject.smartsheetApiOrigin) !== apiOrigin)
    throw new BadRequestException("Smartsheet API binding is invalid");
  const accountName = this.stringOrNull(profileObject.smartsheetAccountName);
  return {
    provider: "smartsheet",
    connectorStandardVersion: "v1",
    oauthFlow: "relay_owned_oauth_authorization_code_refresh_token_pair",
    tokenStatus: "valid",
    clientId,
    smartsheetAccountId: accountId,
    smartsheetAccountName: accountName,
    smartsheetUserId: userId,
    smartsheetUserName: this.stringOrNull(profileObject.smartsheetUserName),
    smartsheetUserEmail: this.stringOrNull(profileObject.smartsheetUserEmail),
    smartsheetApiOrigin: apiOrigin,
    displayName: accountName ?? "Smartsheet account",
    grantedScopes,
    relayOwnedOAuthApp: true,
    stateVerified: true,
    exactAccountBound: true,
    exactAuthorizingUserBound: true,
    accessTokenExpiresInSeconds: 604799,
    refreshSupported: true,
    refreshTokenRotationRequired: true,
    providerRevocationRequired: true,
    fixedApiOrigin: apiOrigin,
    automaticPagination: false,
    rawApiEnabled: true,
  };
};

const oauthProviderMetadataHandler025: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const userId = this.todoistOpaqueId(profileObject.todoistUserId);
  const apiOrigin = "https://api.todoist.com/api/v1";
  if (this.stringOrNull(profileObject.todoistApiOrigin) !== apiOrigin)
    throw new BadRequestException("Todoist API binding is invalid");
  const userName = this.stringOrNull(profileObject.todoistUserName);
  return {
    provider: "todoist",
    connectorStandardVersion: "v1",
    oauthFlow: "relay_owned_authorization_code_rotating_refresh_token",
    tokenStatus: "valid",
    clientId,
    todoistUserId: userId,
    todoistUserName: userName,
    todoistUserEmail: this.stringOrNull(profileObject.todoistUserEmail),
    todoistApiOrigin: apiOrigin,
    displayName: userName ?? "Todoist account",
    grantedScopes,
    relayOwnedOAuthApp: true,
    stateVerified: true,
    exactAuthorizingUserBound: true,
    accessTokenExpiresInSeconds: 3600,
    refreshSupported: true,
    refreshTokenRotationRequired: true,
    refreshTokenRetryGraceSeconds: 60,
    providerRevocationRequired: true,
    fixedApiOrigin: apiOrigin,
    automaticPagination: false,
    rawApiEnabled: true,
  };
};

const oauthProviderMetadataHandler026: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const apiOrigin = "https://api.ticktick.com/open/v1";
  if (
    profileObject.ticktickGrantVerified !== true ||
    this.stringOrNull(profileObject.ticktickApiOrigin) !== apiOrigin
  )
    throw new BadRequestException("TickTick access-grant binding is invalid");
  return {
    provider: "ticktick",
    connectorStandardVersion: "v1",
    oauthFlow: "relay_owned_authorization_code_access_token_only",
    tokenStatus: "valid",
    clientId,
    ticktickGrantVerified: true,
    ticktickApiOrigin: apiOrigin,
    ticktickVisibleProjectCount:
      typeof profileObject.ticktickVisibleProjectCount === "number"
        ? profileObject.ticktickVisibleProjectCount
        : null,
    displayName: "TickTick connection",
    grantedScopes,
    relayOwnedOAuthApp: true,
    stateVerified: true,
    tokenBoundGrantVerified: true,
    exactAuthorizingUserBound: false,
    refreshSupported: false,
    upstreamRevocationDocumented: false,
    disconnectDeletesRelayGrant: true,
    fixedApiOrigin: apiOrigin,
    automaticPagination: false,
    rawApiEnabled: true,
  };
};

const oauthProviderMetadataHandler027: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const accountId = this.positiveNumericId(profileObject.harvestAccountId);
  const harvestIdUserId = this.positiveNumericId(profileObject.harvestIdUserId);
  const apiUserId = this.positiveNumericId(profileObject.harvestApiUserId);
  const apiOrigin = "https://api.harvestapp.com/v2";
  if (
    !accountId ||
    !harvestIdUserId ||
    !apiUserId ||
    this.stringOrNull(profileObject.harvestApiOrigin) !== apiOrigin
  )
    throw new BadRequestException("Harvest account binding is invalid");
  const expectedScope = `harvest:${accountId}`;
  if (grantedScopes.length !== 1 || grantedScopes[0] !== expectedScope)
    throw new BadRequestException(
      "Harvest OAuth must return the exact single-account grant",
    );
  const accountName = this.stringOrNull(profileObject.harvestAccountName);
  return {
    provider: "harvest",
    connectorStandardVersion: "v1",
    oauthFlow: "relay_owned_single_account_authorization_code_refresh_token",
    tokenStatus: "valid",
    clientId,
    harvestAccountId: String(accountId),
    harvestAccountName: accountName,
    harvestIdUserId: String(harvestIdUserId),
    harvestIdUserName: this.stringOrNull(profileObject.harvestIdUserName),
    harvestApiUserId: String(apiUserId),
    harvestApiUserName: this.stringOrNull(profileObject.harvestApiUserName),
    harvestApiUserEmail: this.stringOrNull(profileObject.harvestApiUserEmail),
    harvestApiOrigin: apiOrigin,
    displayName: accountName ?? "Harvest account",
    grantedScopes,
    relayOwnedOAuthApp: true,
    stateVerified: true,
    exactAccountBound: true,
    exactAuthorizingUserBound: true,
    accessTokenExpiresInSeconds: 1_209_600,
    refreshSupported: true,
    refreshTokenRotationRequired: false,
    upstreamRevocationDocumented: false,
    disconnectDeletesRelayGrant: true,
    fixedApiOrigin: apiOrigin,
    automaticPagination: false,
    rawApiEnabled: true,
  };
};

const oauthProviderMetadataHandler028: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const userUri = this.stringOrNull(profileObject.calendlyUserUri);
  const organizationUri = this.stringOrNull(
    profileObject.calendlyOrganizationUri,
  );
  const apiOrigin = "https://api.calendly.com";
  const requiredScopes = [
    "users:read",
    "event_types:read",
    "scheduled_events:read",
  ];
  if (
    !userUri ||
    !organizationUri ||
    !/^https:\/\/api\.calendly\.com\/users\/[A-Za-z0-9_-]{1,64}$/.test(
      userUri,
    ) ||
    !/^https:\/\/api\.calendly\.com\/organizations\/[A-Za-z0-9_-]{1,64}$/.test(
      organizationUri,
    ) ||
    this.stringOrNull(profileObject.calendlyApiOrigin) !== apiOrigin ||
    grantedScopes.length !== requiredScopes.length ||
    requiredScopes.some((scope) => !grantedScopes.includes(scope))
  )
    throw new BadRequestException(
      "Calendly user, current organization, or exact scope binding is invalid",
    );
  const userName = this.stringOrNull(profileObject.calendlyUserName);
  return {
    provider: "calendly",
    connectorStandardVersion: "v1",
    oauthFlow:
      "relay_owned_confidential_authorization_code_pkce_single_use_rotating_refresh",
    tokenStatus: "valid",
    clientId,
    calendlyUserUri: userUri,
    calendlyOrganizationUri: organizationUri,
    calendlyUserName: userName,
    calendlyApiOrigin: apiOrigin,
    displayName: userName ?? "Calendly account",
    grantedScopes,
    relayOwnedOAuthApp: true,
    stateVerified: true,
    pkceS256: true,
    exactAuthorizingUserBound: true,
    exactCurrentOrganizationBound: true,
    refreshSupported: true,
    refreshTokenRotationRequired: true,
    refreshTokenSingleUse: true,
    upstreamRevocationDocumented: false,
    disconnectDeletesRelayGrant: true,
    fixedApiOrigin: apiOrigin,
    fixedEndpointsOnly: true,
    automaticPagination: false,
    rawApiEnabled: false,
  };
};

const oauthProviderMetadataHandler029: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const userId = this.positiveNumericId(profileObject.calComUserId);
  const username = this.stringOrNull(profileObject.calComUsername);
  const apiOrigin = "https://api.cal.com/v2";
  const requiredScopes = ["PROFILE_READ", "EVENT_TYPE_READ", "BOOKING_READ"];
  if (
    !userId ||
    !username ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(username) ||
    this.stringOrNull(profileObject.calComApiOrigin) !== apiOrigin ||
    grantedScopes.length !== requiredScopes.length ||
    requiredScopes.some((scope) => !grantedScopes.includes(scope))
  )
    throw new BadRequestException(
      "Cal.com user or exact scope binding is invalid",
    );
  const userName = this.stringOrNull(profileObject.calComUserName);
  return {
    provider: "cal-com",
    connectorStandardVersion: "v1",
    oauthFlow:
      "relay_owned_reviewed_confidential_authorization_code_refresh_token",
    tokenStatus: "valid",
    clientId,
    calComUserId: String(userId),
    calComUsername: username,
    calComUserName: userName,
    calComApiOrigin: apiOrigin,
    displayName: userName ?? username,
    grantedScopes,
    relayOwnedOAuthApp: true,
    publicAppReviewRequired: true,
    stateVerified: true,
    exactAuthorizingUserBound: true,
    accessTokenExpiresInSeconds: 1_800,
    refreshSupported: true,
    refreshTokenReplacementPairRequired: true,
    upstreamRevocationDocumented: false,
    disconnectDeletesRelayGrant: true,
    fixedApiOrigin: apiOrigin,
    fixedEndpointsOnly: true,
    automaticPagination: false,
    rawApiEnabled: false,
  };
};

export const OAuthProviderMetadataHandlers01: OAuthProviderMetadataHandlerMap =
  Object.freeze({
    signnow: oauthProviderMetadataHandler001,
    "adobe-acrobat-sign": oauthProviderMetadataHandler002,
    mastodon: oauthProviderMetadataHandler003,
    threads: oauthProviderMetadataHandler004,
    pinterest: oauthProviderMetadataHandler005,
    tumblr: oauthProviderMetadataHandler006,
    aircall: oauthProviderMetadataHandler007,
    signrequest: oauthProviderMetadataHandler008,
    signeasy: oauthProviderMetadataHandler009,
    rightsignature: oauthProviderMetadataHandler010,
    "google-classroom": oauthProviderMetadataHandler011,
    youtube: oauthProviderMetadataHandler012,
    "google-merchant-center": oauthProviderMetadataHandler013,
    "google-business-profile": oauthProviderMetadataHandler014,
    "google-search-console": oauthProviderMetadataHandler015,
    "google-analytics": oauthProviderMetadataHandler016,
    "google-ads": oauthProviderMetadataHandler017,
    "google-vault": oauthProviderMetadataHandler018,
    "google-drive": oauthProviderMetadataHandler018,
    "google-docs": oauthProviderMetadataHandler018,
    "google-sheets": oauthProviderMetadataHandler018,
    "google-slides": oauthProviderMetadataHandler018,
    "google-forms": oauthProviderMetadataHandler018,
    "google-tasks": oauthProviderMetadataHandler018,
    "google-contacts": oauthProviderMetadataHandler018,
    "google-photos": oauthProviderMetadataHandler018,
    "google-meet": oauthProviderMetadataHandler018,
    "google-chat": oauthProviderMetadataHandler018,
    "google-calendar": oauthProviderMetadataHandler019,
    attio: oauthProviderMetadataHandler020,
    close: oauthProviderMetadataHandler021,
    zendesk: oauthProviderMetadataHandler022,
    "help-scout": oauthProviderMetadataHandler023,
    smartsheet: oauthProviderMetadataHandler024,
    todoist: oauthProviderMetadataHandler025,
    ticktick: oauthProviderMetadataHandler026,
    harvest: oauthProviderMetadataHandler027,
    calendly: oauthProviderMetadataHandler028,
    "cal-com": oauthProviderMetadataHandler029,
  });
