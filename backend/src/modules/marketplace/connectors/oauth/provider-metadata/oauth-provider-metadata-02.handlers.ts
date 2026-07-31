import type {
  OAuthProviderMetadataHandler,
  OAuthProviderMetadataHandlerMap,
} from "./oauth-provider-metadata-handler";
import type { MarketplaceConnectorOAuthService } from "../../connector-oauth.service";
import { BadRequestException } from "@nestjs/common";

const oauthProviderMetadataHandler030: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const userId = this.stringOrNull(profileObject.docusignUserId);
  const accountId = this.stringOrNull(profileObject.docusignAccountId);
  const baseUri = this.stringOrNull(profileObject.docusignBaseUri);
  const requiredScopes = ["signature", "extended"];
  let validBaseUri = false;
  try {
    const url = new URL(baseUri ?? "");
    const labels = url.hostname.toLowerCase().split(".");
    validBaseUri =
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      (url.pathname === "/" || url.pathname === "") &&
      !url.search &&
      !url.hash &&
      labels.length === 3 &&
      labels[1] === "docusign" &&
      labels[2] === "net" &&
      /^[a-z0-9-]+$/.test(labels[0]);
  } catch {
    validBaseUri = false;
  }
  if (
    !userId ||
    !/^[A-Za-z0-9_-]{1,100}$/.test(userId) ||
    !accountId ||
    !/^[0-9A-Fa-f-]{1,64}$/.test(accountId) ||
    !baseUri ||
    !validBaseUri ||
    grantedScopes.length !== requiredScopes.length ||
    requiredScopes.some((scope) => !grantedScopes.includes(scope))
  )
    throw new BadRequestException(
      "Docusign user, selected account, regional base URI, or exact scope binding is invalid",
    );
  const userName = this.stringOrNull(profileObject.docusignUserName);
  const accountName = this.stringOrNull(profileObject.docusignAccountName);
  return {
    provider: "docusign",
    connectorStandardVersion: "v1",
    oauthFlow:
      "relay_owned_reviewed_authorization_code_pkce_extended_refresh_token",
    tokenStatus: "valid",
    clientId,
    docusignUserId: userId,
    docusignUserName: userName,
    docusignAccountId: accountId,
    docusignAccountName: accountName,
    docusignBaseUri: new URL(baseUri).origin,
    docusignAccountIsDefault: profileObject.docusignAccountIsDefault === true,
    displayName: accountName ?? userName ?? "Docusign account",
    grantedScopes,
    relayOwnedOAuthApp: true,
    publicAppReviewRequired: true,
    stateVerified: true,
    pkceS256: true,
    exactAuthorizingUserBound: true,
    exactSelectedAccountBound: true,
    accessTokenExpiresInSeconds: 28_800,
    refreshSupported: true,
    extendedRefreshToken: true,
    upstreamRevocationDocumented: true,
    disconnectDeletesRelayGrant: true,
    providerReturnedApiOrigin: new URL(baseUri).origin,
    fixedEndpointsOnly: true,
    exactEnvelopePollingIntervalSeconds: 900,
    automaticPagination: false,
    rawApiEnabled: false,
  };
};

const oauthProviderMetadataHandler031: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const accountId = this.stringOrNull(profileObject.dropboxSignAccountId);
  const apiOrigin = "https://api.hellosign.com/v3";
  const requiredScopes = ["account_access", "signature_request_access"];
  if (
    !accountId ||
    !/^[0-9A-Fa-f]{24,64}$/.test(accountId) ||
    this.stringOrNull(profileObject.dropboxSignApiOrigin) !== apiOrigin ||
    grantedScopes.length !== requiredScopes.length ||
    requiredScopes.some((scope) => !grantedScopes.includes(scope))
  )
    throw new BadRequestException(
      "Dropbox Sign exact account or scope binding is invalid",
    );
  const accountLabel =
    this.stringOrNull(profileObject.dropboxSignAccountLabel) ??
    `Dropbox Sign account …${accountId.slice(-8)}`;
  const locale = this.stringOrNull(profileObject.dropboxSignLocale);
  return {
    provider: "dropbox-sign",
    connectorStandardVersion: "v1",
    oauthFlow:
      "relay_owned_user_charged_confidential_authorization_code_provider_expiry_refresh_pair",
    tokenStatus: "valid",
    clientId,
    dropboxSignAccountId: accountId.toLowerCase(),
    dropboxSignAccountLabel: accountLabel,
    dropboxSignLocale: locale,
    dropboxSignLocked: profileObject.dropboxSignLocked === true,
    dropboxSignPaid: profileObject.dropboxSignPaid === true,
    dropboxSignApiOrigin: apiOrigin,
    displayName: accountLabel,
    grantedScopes,
    relayOwnedOAuthApp: true,
    userChargedBillingModel: true,
    publicAppReviewRequired: true,
    stateVerified: true,
    pkceS256: false,
    exactTokenReturnedAccountBound: true,
    providerExpiresInAuthoritative: true,
    documentedTypicalAccessTokenLifetimeSeconds: 3_600,
    refreshSupported: true,
    refreshTokenRotationRequired: false,
    completeTokenPairReplacementRequired: true,
    upstreamRevocationDocumented: false,
    disconnectDeletesRelayGrant: true,
    fixedApiOrigin: apiOrigin,
    apiAppCreatedRequestsOnly: true,
    fixedFirstPageSize: 25,
    automaticPagination: false,
    arbitraryQueryEnabled: false,
    rawApiEnabled: false,
  };
};

const oauthProviderMetadataHandler032: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const membershipId = this.stringOrNull(profileObject.pandaDocMembershipId);
  const workspaceId = this.stringOrNull(profileObject.pandaDocWorkspaceId);
  const apiOrigin = "https://api.pandadoc.com/public/v1";
  if (
    !membershipId ||
    !workspaceId ||
    !/^[A-Za-z0-9_-]{1,64}$/.test(membershipId) ||
    !/^[A-Za-z0-9_-]{1,64}$/.test(workspaceId) ||
    this.stringOrNull(profileObject.pandaDocApiOrigin) !== apiOrigin ||
    grantedScopes.length !== 1 ||
    grantedScopes[0] !== "read"
  )
    throw new BadRequestException(
      "PandaDoc exact membership, workspace, or read-only scope binding is invalid",
    );
  const membershipLabel = this.stringOrNull(
    profileObject.pandaDocMembershipLabel,
  );
  const workspaceName = this.stringOrNull(profileObject.pandaDocWorkspaceName);
  return {
    provider: "pandadoc",
    connectorStandardVersion: "v1",
    oauthFlow:
      "relay_owned_confidential_authorization_code_provider_expiry_refresh_pair",
    tokenStatus: "valid",
    clientId,
    pandaDocMembershipId: membershipId,
    pandaDocMembershipLabel: membershipLabel,
    pandaDocWorkspaceId: workspaceId,
    pandaDocWorkspaceName: workspaceName,
    pandaDocApiOrigin: apiOrigin,
    displayName: workspaceName ?? membershipLabel ?? "PandaDoc workspace",
    grantedScopes,
    relayOwnedOAuthApp: true,
    stateVerified: true,
    pkceS256: false,
    exactMembershipBound: true,
    exactTokenBoundWorkspace: true,
    accessTokenExpiresInSeconds: 31_535_999,
    refreshSupported: true,
    refreshTokenRotationRequired: false,
    completeTokenPairReplacementRequired: true,
    upstreamRevocationDocumented: false,
    disconnectDeletesRelayGrant: true,
    fixedApiOrigin: apiOrigin,
    sensitiveDetailsEndpointBlocked: true,
    fixedFirstPageSize: 25,
    automaticPagination: false,
    arbitraryFiltersEnabled: false,
    rawApiEnabled: false,
  };
};

const oauthProviderMetadataHandler033: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const accountId = this.stringOrNull(profileObject.typeformAccountId);
  const workspaceId = this.stringOrNull(profileObject.typeformWorkspaceId);
  const apiOrigin = this.stringOrNull(profileObject.typeformApiOrigin);
  const requiredScopes = [
    "accounts:read",
    "workspaces:read",
    "forms:read",
    "responses:read",
    "offline",
  ];
  if (
    !accountId ||
    !workspaceId ||
    !/^[A-Za-z0-9_-]{1,64}$/.test(accountId) ||
    !/^[A-Za-z0-9_-]{1,64}$/.test(workspaceId) ||
    ![
      "https://api.typeform.com",
      "https://api.eu.typeform.com",
      "https://api.typeform.eu",
    ].includes(apiOrigin ?? "") ||
    grantedScopes.length !== requiredScopes.length ||
    !requiredScopes.every((scope) => grantedScopes.includes(scope))
  )
    throw new BadRequestException(
      "Typeform exact account, workspace, API-region, or read-only scope binding is invalid",
    );
  const accountLabel = this.stringOrNull(profileObject.typeformAccountLabel);
  const workspaceName = this.stringOrNull(profileObject.typeformWorkspaceName);
  return {
    provider: "typeform",
    connectorStandardVersion: "v1",
    oauthFlow:
      "relay_owned_confidential_authorization_code_provider_expiry_rotating_refresh",
    tokenStatus: "valid",
    clientId,
    typeformAccountId: accountId,
    typeformAccountLabel: accountLabel,
    typeformWorkspaceId: workspaceId,
    typeformWorkspaceName: workspaceName,
    typeformApiOrigin: apiOrigin,
    displayName: workspaceName ?? accountLabel ?? "Typeform workspace",
    grantedScopes,
    relayOwnedOAuthApp: true,
    stateVerified: true,
    pkceS256: false,
    exactAccountBound: true,
    selectedWorkspaceBound: true,
    apiRegionBound: true,
    providerExpiresInAuthoritative: true,
    documentedTypicalAccessTokenLifetimeSeconds: 604_800,
    refreshSupported: true,
    refreshTokenRotationRequired: true,
    refreshTokenSingleUse: true,
    completeTokenPairReplacementRequired: true,
    upstreamRevocationDocumented: false,
    disconnectDeletesRelayGrant: true,
    fixedFirstPageSize: 25,
    recentResponseWindowDays: 14,
    providerFreshnessCaveatMinutes: 30,
    rateLimitRequestsPerSecond: 2,
    automaticPagination: false,
    arbitraryFiltersEnabled: false,
    rawApiEnabled: false,
  };
};

const oauthProviderMetadataHandler034: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const accountId = this.stringOrNull(profileObject.bufferAccountId);
  const apiOrigin = "https://api.buffer.com";
  const requiredScopes = ["account:read", "offline_access"];
  if (
    !accountId ||
    !/^[A-Za-z0-9_-]{1,100}$/.test(accountId) ||
    this.stringOrNull(profileObject.bufferApiOrigin) !== apiOrigin ||
    requiredScopes.some((scope) => !grantedScopes.includes(scope)) ||
    grantedScopes.some(
      (scope) => ![...requiredScopes, "openid"].includes(scope),
    )
  )
    throw new BadRequestException(
      "Buffer exact account, API-origin, or least-privilege scope binding is invalid",
    );
  return {
    provider: "buffer",
    connectorStandardVersion: "v1",
    oauthFlow:
      "relay_owned_confidential_authorization_code_pkce_s256_single_use_rotating_refresh",
    tokenStatus: "valid",
    clientId,
    bufferAccountId: accountId,
    bufferApiOrigin: apiOrigin,
    displayName: `Buffer account …${accountId.slice(-8)}`,
    grantedScopes,
    relayOwnedOAuthApp: true,
    stateVerified: true,
    pkceS256: true,
    exactAccountBound: true,
    documentedAccessTokenLifetimeSeconds: 3_600,
    refreshSupported: true,
    refreshTokenRotationRequired: true,
    refreshTokenSingleUse: true,
    completeTokenPairReplacementRequired: true,
    upstreamRevocationDocumented: false,
    disconnectDeletesRelayGrant: true,
    fixedApiOrigin: apiOrigin,
    staticGraphqlDocumentsOnly: true,
    maximumReturnedItems: 25,
    rateLimitRequestsPerFifteenMinutes: 100,
    automaticPagination: false,
    identityExcluded: true,
    contentExcluded: true,
    arbitraryQueriesEnabled: false,
    rawApiEnabled: false,
  };
};

const oauthProviderMetadataHandler035: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const accountId = this.stringOrNull(profileObject.sendFoxAccountId);
  const apiOrigin = "https://api.sendfox.com";
  if (
    !accountId ||
    !/^[1-9][0-9]{0,18}$/.test(accountId) ||
    this.stringOrNull(profileObject.sendFoxApiOrigin) !== apiOrigin ||
    grantedScopes.length !== 0
  )
    throw new BadRequestException(
      "SendFox exact account, API-origin, or unscoped OAuth binding is invalid",
    );
  const accountLabel = this.stringOrNull(profileObject.sendFoxAccountLabel);
  return {
    provider: "sendfox",
    connectorStandardVersion: "v1",
    oauthFlow:
      "relay_owned_confidential_authorization_code_provider_managed_token_validity",
    tokenStatus: "valid",
    clientId,
    sendFoxAccountId: accountId,
    sendFoxAccountLabel: accountLabel,
    sendFoxApiOrigin: apiOrigin,
    displayName: accountLabel ?? "SendFox account",
    grantedScopes,
    relayOwnedOAuthApp: true,
    stateVerified: true,
    pkceS256: false,
    exactAccountBound: true,
    providerScopesDocumented: false,
    refreshSupported: false,
    providerManagedTokenValidity: true,
    reconnectOnExpiryOrRevocation: true,
    upstreamRevocationDocumented: false,
    disconnectDeletesRelayGrant: true,
    paidProviderPlanRequired: true,
    fixedApiOrigin: apiOrigin,
    fixedFirstProviderPage: true,
    maximumReturnedItems: 25,
    rateLimitRequestsPerMinute: 60,
    automaticPagination: false,
    contactIdentityExcluded: true,
    campaignContentExcluded: true,
    arbitraryFiltersEnabled: false,
    rawApiEnabled: false,
  };
};

const oauthProviderMetadataHandler036: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const organizationId = this.stringOrNull(profileObject.beehiivOrganizationId);
  const apiOrigin = "https://api.beehiiv.com";
  const requiredScopes = ["identify:read", "publications:read", "posts:read"];
  if (
    !organizationId ||
    !/^org_[0-9a-fA-F-]{1,64}$/.test(organizationId) ||
    this.stringOrNull(profileObject.beehiivApiOrigin) !== apiOrigin ||
    requiredScopes.some((scope) => !grantedScopes.includes(scope))
  )
    throw new BadRequestException(
      "beehiiv organization, API-origin, or least-privilege scope binding is invalid",
    );
  const accountLabel = this.stringOrNull(profileObject.beehiivAccountLabel);
  return {
    provider: "beehiiv",
    connectorStandardVersion: "v1",
    oauthFlow: "relay_owned_confidential_authorization_code_with_refresh",
    tokenStatus: "valid",
    clientId,
    beehiivOrganizationId: organizationId,
    beehiivAccountLabel: accountLabel,
    beehiivApiOrigin: apiOrigin,
    displayName: accountLabel ?? "beehiiv organization",
    grantedScopes,
    relayOwnedOAuthApp: true,
    stateVerified: true,
    pkceS256: false,
    exactOrganizationBound: true,
    refreshSupported: true,
    upstreamRevocationDocumented: true,
    tokenIntrospectionDocumented: true,
    disconnectDeletesRelayGrant: true,
    fixedApiOrigin: apiOrigin,
    fixedOAuthOrigin: "https://app.beehiiv.com",
    fixedFirstProviderPage: true,
    maximumReturnedItems: 25,
    rateLimitRequestsPerMinute: 180,
    automaticPagination: false,
    subscriberIdentityExcluded: true,
    publicationContentExcluded: true,
    postContentExcluded: true,
    arbitraryFiltersEnabled: false,
    rawApiEnabled: false,
  };
};

const oauthProviderMetadataHandler037: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const installationId = this.positiveNumericId(
    profileObject.teamworkInstallationId,
  );
  const userId = this.positiveNumericId(profileObject.teamworkUserId);
  const apiOrigin = this.normalizeTeamworkApiOrigin(
    this.stringOrNull(profileObject.teamworkApiOrigin) ?? "",
  );
  if (!installationId || !userId)
    throw new BadRequestException(
      "Teamwork installation or user binding is invalid",
    );
  const installationName = this.stringOrNull(
    profileObject.teamworkInstallationName,
  );
  return {
    provider: "teamwork",
    connectorStandardVersion: "v1",
    oauthFlow: "relay_owned_app_login_permanent_access_token",
    tokenStatus: "valid",
    clientId,
    teamworkInstallationId: installationId,
    teamworkInstallationName: installationName,
    teamworkCompanyId: this.positiveNumericId(profileObject.teamworkCompanyId),
    teamworkCompanyName: this.stringOrNull(profileObject.teamworkCompanyName),
    teamworkRegion: this.stringOrNull(profileObject.teamworkRegion),
    teamworkApiOrigin: apiOrigin,
    teamworkUserId: userId,
    displayName: installationName ?? "Teamwork installation",
    grantedScopes,
    relayOwnedOAuthApp: true,
    publicAppReviewRequired: true,
    stateVerified: true,
    exactInstallationBound: true,
    exactAuthorizingUserBound: true,
    permanentAccessToken: true,
    refreshSupported: false,
    providerRevocationRequired: false,
    fixedApiOrigin: apiOrigin,
    automaticPagination: false,
    rawApiEnabled: true,
  };
};

const oauthProviderMetadataHandler038: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const accountId = this.positiveNumericId(profileObject.basecampAccountId);
  const identityId = this.positiveNumericId(profileObject.basecampIdentityId);
  const accountOrigin = this.normalizeBasecampAccountOrigin(
    this.stringOrNull(profileObject.basecampAccountOrigin) ?? "",
  );
  if (!accountId || !identityId)
    throw new BadRequestException(
      "Basecamp account or identity binding is invalid",
    );
  const accountName = this.stringOrNull(profileObject.basecampAccountName);
  return {
    provider: "basecamp",
    connectorStandardVersion: "v1",
    oauthFlow: "relay_owned_oauth_authorization_code_refresh_token",
    tokenStatus: "valid",
    clientId,
    basecampIdentityId: identityId,
    basecampIdentityName: this.stringOrNull(profileObject.basecampIdentityName),
    basecampAccountId: accountId,
    basecampAccountName: accountName,
    basecampAccountOrigin: accountOrigin,
    basecampProduct: "bc3",
    displayName: accountName ?? "Basecamp account",
    grantedScopes,
    relayOwnedOAuthApp: true,
    stateVerified: true,
    exactBc3AccountBound: true,
    exactAuthorizingIdentityBound: true,
    accessTokenExpiresInSeconds: 1209600,
    refreshSupported: true,
    refreshTokenRotationRequired: true,
    providerRevocationRequired: false,
    fixedApiOrigin: accountOrigin,
    automaticPagination: false,
    rawApiEnabled: true,
  };
};

const oauthProviderMetadataHandler039: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const accountId = this.wrikeOpaqueId(profileObject.wrikeAccountId, "account");
  const userId = this.wrikeOpaqueId(profileObject.wrikeUserId, "user");
  const host = this.normalizeWrikeHost(
    this.stringOrNull(profileObject.wrikeProviderHost) ?? "",
  );
  const apiOrigin = `https://${host}/api/v4`;
  if (this.stringOrNull(profileObject.wrikeApiOrigin) !== apiOrigin)
    throw new BadRequestException("Wrike regional API binding is invalid");
  const accountName = this.stringOrNull(profileObject.wrikeAccountName);
  return {
    provider: "wrike",
    connectorStandardVersion: "v1",
    oauthFlow: "relay_owned_oauth_authorization_code_rotating_refresh",
    tokenStatus: "valid",
    clientId,
    wrikeAccountId: accountId,
    wrikeAccountName: accountName,
    wrikeUserId: userId,
    wrikeUserName: this.stringOrNull(profileObject.wrikeUserName),
    wrikeUserEmail: this.stringOrNull(profileObject.wrikeUserEmail),
    wrikeProviderHost: host,
    wrikeApiOrigin: apiOrigin,
    displayName: accountName ?? "Wrike account",
    grantedScopes,
    relayOwnedOAuthApp: true,
    stateVerified: true,
    exactAccountBound: true,
    exactAuthorizingUserBound: true,
    regionalHostBound: true,
    accessTokenExpiresInSeconds: 3600,
    refreshSupported: true,
    refreshTokenRotationRequired: true,
    providerRevocationRequired: true,
    fixedApiOrigin: apiOrigin,
    automaticPagination: false,
    rawApiEnabled: true,
  };
};

const oauthProviderMetadataHandler040: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const companyId = this.stringOrNull(profileObject.frontCompanyId);
  if (!companyId || !/^cmp_[A-Za-z0-9_-]{1,190}$/.test(companyId))
    throw new BadRequestException("Front company binding is invalid");
  const companyName = this.stringOrNull(profileObject.frontCompanyName);
  return {
    provider: "front",
    connectorStandardVersion: "v1",
    oauthFlow:
      "relay_owned_public_app_authorization_code_expiring_access_and_refresh",
    tokenStatus: "valid",
    clientId,
    frontCompanyId: companyId,
    frontCompanyName: companyName,
    displayName: companyName ?? "Front company",
    grantedScopes,
    relayOwnedOAuthApp: true,
    publicAppReviewRequired: true,
    stateVerified: true,
    exactCompanyBound: true,
    accessTokenExpiresInSeconds: 3600,
    refreshTokenExpiresInSeconds: 15_552_000,
    refreshSupported: true,
    refreshTokenRotationRequired: false,
    providerRevocationRequired: false,
    fixedApiOrigin: "https://api2.frontapp.com",
    automaticPagination: false,
    rawApiEnabled: true,
  };
};

const oauthProviderMetadataHandler041: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const workspaceId = this.stringOrNull(profileObject.intercomWorkspaceId);
  const workspaceName = this.stringOrNull(profileObject.intercomWorkspaceName);
  const adminId = this.stringOrNull(profileObject.intercomAdminId);
  const region = this.stringOrNull(profileObject.intercomRegion)?.toUpperCase();
  const apiOrigin = this.stringOrNull(profileObject.intercomApiOrigin);
  if (
    !workspaceId ||
    !adminId ||
    !region ||
    !/^[A-Za-z0-9_-]{1,200}$/.test(workspaceId) ||
    !/^[A-Za-z0-9_-]{1,200}$/.test(adminId) ||
    apiOrigin !== this.intercomApiOrigin(region) ||
    profileObject.intercomEmailVerified !== true
  )
    throw new BadRequestException(
      "Intercom workspace, region, or verified-admin binding is invalid",
    );
  return {
    provider: "intercom",
    connectorStandardVersion: "v1",
    oauthFlow:
      "relay_owned_public_app_authorization_code_non_expiring_access_token",
    tokenStatus: "valid",
    clientId,
    intercomWorkspaceId: workspaceId,
    intercomWorkspaceName: workspaceName,
    intercomAdminId: adminId,
    intercomAdminName: this.stringOrNull(profileObject.intercomAdminName),
    intercomRegion: region,
    intercomApiOrigin: apiOrigin,
    intercomEmailVerified: true,
    displayName: workspaceName ?? "Intercom workspace",
    grantedScopes,
    apiVersion: "2.15",
    relayOwnedOAuthApp: true,
    publicAppReviewRequired: true,
    stateVerified: true,
    exactWorkspaceAuthorityBound: true,
    exactRegionAuthorityBound: true,
    exactVerifiedAuthorizingAdminBound: true,
    relayReadOnlyBoundary: true,
    refreshSupported: false,
    providerRevocationRequired: true,
    fixedEndpointsOnly: true,
    automaticPagination: false,
    rawApiEnabled: false,
  };
};

const oauthProviderMetadataHandler042: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const accountId = this.positiveNumericId(profileObject.copperAccountId);
  const userId = this.positiveNumericId(profileObject.copperUserId);
  if (!accountId || !userId)
    throw new BadRequestException(
      "Copper account or authorizing-user binding is invalid",
    );
  const accountName = this.stringOrNull(profileObject.copperAccountName);
  return {
    provider: "copper",
    connectorStandardVersion: "v1",
    oauthFlow:
      "relay_owned_partner_authorization_code_https_form_post_non_expiring_token",
    tokenStatus: "valid",
    clientId,
    copperAccountId: accountId,
    copperAccountName: accountName,
    copperPrimaryTimezone: this.stringOrNull(
      profileObject.copperPrimaryTimezone,
    ),
    copperUserId: userId,
    copperUserName: this.stringOrNull(profileObject.copperUserName),
    displayName: accountName ?? `Copper account ${accountId}`,
    grantedScopes,
    apiVersion: "developer_api/v1",
    relayOwnedOAuthApp: true,
    httpsFormPostCallback: true,
    stateVerified: true,
    exactAccountAuthorityBound: true,
    exactAuthorizingUserBound: true,
    authorizingUserPermissionsInherited: true,
    providerScopeIsBroadReadWrite: true,
    relayReadOnlyBoundary: true,
    providerTokenDoesNotExpire: true,
    refreshSupported: false,
    providerManagedRevocation: true,
    fixedEndpointsOnly: true,
    automaticPagination: false,
    rawApiEnabled: false,
  };
};

const oauthProviderMetadataHandler043: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  appSlug,
  clientId,
  _grantedScopes,
  profileObject,
  _authority,
) {
  const dataCenter = this.stringOrNull(
    profileObject.mailchimpDataCenter,
  )?.toLowerCase();
  const apiOrigin = this.stringOrNull(
    profileObject.mailchimpApiOrigin,
  )?.replace(/\/$/, "");
  const accountId = this.stringOrNull(profileObject.mailchimpAccountId);
  if (
    !dataCenter ||
    !/^[a-z0-9-]{1,20}$/.test(dataCenter) ||
    apiOrigin !== `https://${dataCenter}.api.mailchimp.com` ||
    !accountId ||
    !/^[a-f0-9]{32}$/i.test(accountId)
  )
    throw new BadRequestException(
      "Mailchimp account or metadata data-center binding is invalid",
    );
  const accountName = this.stringOrNull(profileObject.mailchimpAccountName);
  return {
    provider: appSlug,
    connectorStandardVersion: "v1",
    oauthFlow:
      "relay_owned_authorization_code_non_expiring_metadata_data_center_token",
    tokenStatus: "valid",
    clientId,
    mailchimpDataCenter: dataCenter,
    mailchimpApiOrigin: apiOrigin,
    mailchimpAccountId: accountId,
    mailchimpAccountName: accountName,
    mailchimpAuthorizingUserRole: this.stringOrNull(
      profileObject.mailchimpAuthorizingUserRole,
    ),
    mailchimpMemberSince: this.stringOrNull(profileObject.mailchimpMemberSince),
    displayName:
      accountName ??
      `${appSlug === "mailchimp-surveys" ? "Mailchimp Surveys" : "Mailchimp"} account ${accountId}`,
    grantedScopes: [],
    apiVersion: "3.0",
    relayOwnedOAuthApp: true,
    stateVerified: true,
    exactMetadataDataCenterBound: true,
    exactAccountAuthorityBound: true,
    authorizingUserRoleInherited: true,
    providerDocumentsNoGranularScopes: true,
    providerScopeIsBroadReadWrite: true,
    relayMetadataOnlyBoundary: true,
    providerTokenDoesNotExpire: true,
    refreshSupported: false,
    providerManagedRevocation: true,
    fixedEndpointsOnly: true,
    automaticPagination: false,
    rawApiEnabled: false,
  };
};

const oauthProviderMetadataHandler044: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const accountId = this.stringOrNull(profileObject.constantContactAccountId);
  const requiredScopes = ["account_read", "campaign_data", "offline_access"];
  const requiredPrivileges = [
    "account:read",
    "campaign:read",
    "ui:campaign:metrics",
  ];
  const privileges = this.stringArray(profileObject.constantContactPrivileges);
  if (
    !accountId ||
    !/^[A-Za-z0-9_-]{6,128}$/.test(accountId) ||
    grantedScopes.length !== requiredScopes.length ||
    !requiredScopes.every((scope) => grantedScopes.includes(scope)) ||
    !requiredPrivileges.every((privilege) => privileges.includes(privilege))
  )
    throw new BadRequestException(
      "Constant Contact Account, scope, or privilege binding is invalid",
    );
  const organizationName = this.stringOrNull(
    profileObject.constantContactOrganizationName,
  );
  return {
    provider: "constant-contact",
    connectorStandardVersion: "v1",
    oauthFlow: "relay_owned_confidential_authorization_code_rotating_pair",
    tokenStatus: "valid",
    clientId,
    constantContactAccountId: accountId,
    constantContactOrganizationName: organizationName,
    constantContactPrivileges: requiredPrivileges,
    displayName: organizationName ?? `Constant Contact Account ${accountId}`,
    grantedScopes: requiredScopes,
    apiOrigin: "https://api.cc.email",
    apiVersion: "v3",
    relayOwnedOAuthApp: true,
    stateVerified: true,
    exactAccountAuthorityBound: true,
    exactScopesRequired: true,
    requiredPrivilegesVerified: true,
    contactDataScopeRequested: false,
    accountUpdateScopeRequested: false,
    relayMetadataOnlyBoundary: true,
    accessTokenLifetimeSeconds: 86_400,
    refreshTokenUnusedMaximumAgeDays: 180,
    refreshOnlyNearExpiry: true,
    refreshSupported: true,
    refreshSerializedPerConnection: true,
    completeTokenPairReplacement: true,
    providerManagedRevocation: true,
    localDisconnectRequired: true,
    fixedEndpointsOnly: true,
    automaticPagination: false,
    rawApiEnabled: false,
  };
};

const oauthProviderMetadataHandler045: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const selectedClientId = this.stringOrNull(
    profileObject.campaignMonitorClientId,
  )?.toLowerCase();
  if (
    !selectedClientId ||
    !/^[a-f0-9]{32}$/.test(selectedClientId) ||
    grantedScopes.length !== 1 ||
    grantedScopes[0] !== "ViewReports"
  )
    throw new BadRequestException(
      "Campaign Monitor Client or ViewReports binding is invalid",
    );
  const selectedClientName = this.stringOrNull(
    profileObject.campaignMonitorClientName,
  );
  return {
    provider: "campaign-monitor",
    connectorStandardVersion: "v1",
    oauthFlow: "relay_owned_web_server_authorization_code_rotating_pair",
    tokenStatus: "valid",
    clientId,
    campaignMonitorClientId: selectedClientId,
    campaignMonitorClientName: selectedClientName,
    campaignMonitorVisibleClientCount:
      typeof profileObject.campaignMonitorVisibleClientCount === "number"
        ? profileObject.campaignMonitorVisibleClientCount
        : 1,
    displayName:
      selectedClientName ?? `Campaign Monitor Client ${selectedClientId}`,
    grantedScopes: ["ViewReports"],
    apiOrigin: "https://api.createsend.com",
    apiVersion: "v3.3",
    relayOwnedOAuthApp: true,
    stateVerified: true,
    exactVisibleClientBound: true,
    leastPermissionBound: true,
    relayMetadataOnlyBoundary: true,
    accessTokenLifetimeSeconds: 1_209_600,
    refreshSupported: true,
    refreshSerializedPerConnection: true,
    completeTokenPairReplacement: true,
    providerManagedRevocation: true,
    localDisconnectRequired: true,
    fixedEndpointsOnly: true,
    automaticPagination: false,
    rawApiEnabled: false,
  };
};

const oauthProviderMetadataHandler046: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const accountId = this.stringOrNull(profileObject.convertKitAccountId);
  if (
    !accountId ||
    !/^[A-Za-z0-9_-]{1,64}$/.test(accountId) ||
    grantedScopes.length !== 1 ||
    grantedScopes[0] !== "public"
  )
    throw new BadRequestException(
      "Kit account or public-scope binding is invalid",
    );
  const accountName = this.stringOrNull(profileObject.convertKitAccountName);
  return {
    provider: "convertkit",
    connectorStandardVersion: "v1",
    oauthFlow: "relay_owned_confidential_authorization_code_rotating_pair",
    tokenStatus: "valid",
    clientId,
    convertKitAccountId: accountId,
    convertKitAccountName: accountName,
    convertKitPlanType: this.stringOrNull(profileObject.convertKitPlanType),
    convertKitCreatedAt: this.stringOrNull(profileObject.convertKitCreatedAt),
    convertKitTimezoneName: this.stringOrNull(
      profileObject.convertKitTimezoneName,
    ),
    displayName: accountName ?? `Kit account ${accountId}`,
    grantedScopes: ["public"],
    apiOrigin: "https://api.kit.com",
    apiVersion: "v4",
    relayOwnedOAuthApp: true,
    stateVerified: true,
    exactAccountAuthorityBound: true,
    providerCurrentPublicScopeRequired: true,
    providerDocumentsFineGrainedScopesPending: true,
    relayMetadataOnlyBoundary: true,
    accessTokenExpiryProviderDriven: true,
    refreshSupported: true,
    refreshSerializedPerConnection: true,
    completeTokenPairReplacement: true,
    oauthRateLimitPerRollingMinute: 600,
    localDisconnectRequired: true,
    providerAppUninstallSupported: true,
    fixedEndpointsOnly: true,
    automaticPagination: false,
    rawApiEnabled: false,
  };
};

const oauthProviderMetadataHandler047: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const requiredScopes =
    appSlug === "klaviyo-sms"
      ? ["accounts:read", "sender-config:read", "sender-config:write"]
      : ["accounts:read", "lists:read", "campaigns:read"];
  const accountId = this.stringOrNull(profileObject.klaviyoAccountId);
  if (
    !accountId ||
    !/^[A-Za-z0-9_-]{1,64}$/.test(accountId) ||
    grantedScopes.length !== requiredScopes.length ||
    !requiredScopes.every((scope) => grantedScopes.includes(scope))
  )
    throw new BadRequestException(
      "Klaviyo Account or least-scope binding is invalid",
    );
  const accountName = this.stringOrNull(profileObject.klaviyoAccountName);
  return {
    provider: appSlug,
    connectorStandardVersion: "v1",
    oauthFlow: "relay_owned_confidential_authorization_code_pkce_rotating_pair",
    tokenStatus: "valid",
    clientId,
    klaviyoAccountId: accountId,
    klaviyoAccountName: accountName,
    klaviyoAccountTimezone: this.stringOrNull(
      profileObject.klaviyoAccountTimezone,
    ),
    klaviyoAccountCurrency: this.stringOrNull(
      profileObject.klaviyoAccountCurrency,
    ),
    displayName:
      accountName ??
      `${appSlug === "klaviyo-sms" ? "Klaviyo SMS" : "Klaviyo"} Account ${accountId}`,
    grantedScopes: requiredScopes,
    apiOrigin: "https://a.klaviyo.com",
    apiRevision: appSlug === "klaviyo-sms" ? "2026-07-15.pre" : "2026-04-15",
    relayOwnedOAuthApp: true,
    stateVerified: true,
    pkceS256Required: true,
    exactAccountAuthorityBound: true,
    leastScopesRequired: true,
    relayMetadataOnlyBoundary: true,
    accessTokenExpiryProviderDriven: true,
    refreshSupported: true,
    refreshSerializedPerConnection: true,
    completeTokenPairReplacement: true,
    refreshTokenIdleExpiryDays: 90,
    refreshRateLimitPerMinute: 10,
    providerRevocationRequired: true,
    fixedEndpointsOnly: true,
    automaticPagination: false,
    rawApiEnabled: false,
  };
};

const oauthProviderMetadataHandler048: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const accessUrl = this.stringOrNull(
    profileObject.surveyMonkeyAccessUrl,
  )?.replace(/\/$/, "");
  const userId = this.positiveNumericId(profileObject.surveyMonkeyUserId);
  if (
    !userId ||
    !accessUrl ||
    ![
      "https://api.surveymonkey.com",
      "https://api.eu.surveymonkey.com",
      "https://api.surveymonkey.ca",
    ].includes(accessUrl)
  )
    throw new BadRequestException(
      "SurveyMonkey user or regional access-URL binding is invalid",
    );
  const userName = this.stringOrNull(profileObject.surveyMonkeyUserName);
  return {
    provider: "surveymonkey",
    connectorStandardVersion: "v1",
    oauthFlow:
      "relay_owned_public_app_authorization_code_non_expiring_regional_token",
    tokenStatus: "valid",
    clientId,
    surveyMonkeyAccessUrl: accessUrl,
    surveyMonkeyUserId: userId,
    surveyMonkeyUserName: userName,
    displayName: userName ?? `SurveyMonkey user ${userId}`,
    grantedScopes,
    apiVersion: "v3",
    relayOwnedOAuthApp: true,
    publicAppReviewRequired: true,
    stateVerified: true,
    exactAuthorizingUserBound: true,
    exactRegionalApiOriginBound: true,
    leastScopesRequired: true,
    responseDetailsScopeRequested: false,
    relayMetadataOnlyBoundary: true,
    providerTokenDoesNotExpire: true,
    refreshSupported: false,
    providerManagedRevocation: true,
    fixedEndpointsOnly: true,
    automaticPagination: false,
    rawApiEnabled: false,
  };
};

const oauthProviderMetadataHandler049: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  _grantedScopes,
  profileObject,
  _authority,
) {
  const baseUrl = this.stringOrNull(profileObject.filloutBaseUrl)?.replace(
    /\/$/,
    "",
  );
  if (
    !baseUrl ||
    !["https://api.fillout.com", "https://eu-api.fillout.com"].includes(baseUrl)
  )
    throw new BadRequestException(
      "Fillout provider-returned API base URL binding is invalid",
    );
  return {
    provider: "fillout",
    connectorStandardVersion: "v1",
    oauthFlow:
      "relay_owned_third_party_authorization_code_non_refreshable_regional_token",
    tokenStatus: "valid",
    clientId,
    filloutBaseUrl: baseUrl,
    filloutVisibleFormCount:
      typeof profileObject.filloutVisibleFormCount === "number"
        ? profileObject.filloutVisibleFormCount
        : 0,
    displayName: "Fillout connection",
    grantedScopes: [],
    apiVersion: "v1",
    relayOwnedOAuthApp: true,
    publicAppReviewRequired: true,
    stateVerified: true,
    exactProviderReturnedApiOriginBound: true,
    tokenVisibleAuthorityBound: true,
    providerDocumentsNoScopes: true,
    providerDocumentsNoRefreshOrExpiry: true,
    relayMetadataOnlyBoundary: true,
    refreshSupported: false,
    providerInvalidationRequired: true,
    selfHostedOriginsEnabled: false,
    fixedEndpointsOnly: true,
    automaticPagination: false,
    rawApiEnabled: false,
  };
};

const oauthProviderMetadataHandler050: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  authority,
) {
  const organizationId = this.positiveNumericId(
    profileObject.zohoDeskOrganizationId,
  );
  const accountsOrigin =
    this.stringOrNull(authority?.zohoAccountsOrigin) ??
    this.stringOrNull(profileObject.zohoAccountsOrigin);
  if (!organizationId || !accountsOrigin)
    throw new BadRequestException(
      "Zoho Desk organization or Accounts binding is invalid",
    );
  const deskAuthority = this.zohoDeskAuthority(accountsOrigin);
  const apiOrigin =
    this.stringOrNull(authority?.zohoDeskApiOrigin) ??
    this.stringOrNull(profileObject.zohoDeskApiOrigin);
  if (deskAuthority.apiOrigin !== apiOrigin)
    throw new BadRequestException(
      "Zoho Desk Accounts and API data centers do not match",
    );
  const organizationName = this.stringOrNull(
    profileObject.zohoDeskOrganizationName,
  );
  return {
    provider: "zoho-desk",
    connectorStandardVersion: "v1",
    oauthFlow:
      "relay_owned_server_app_authorization_code_offline_refresh_multi_dc_organization_bound",
    tokenStatus: "valid",
    clientId,
    zohoDeskOrganizationId: organizationId,
    zohoDeskOrganizationName: organizationName,
    zohoDeskPortalName: this.stringOrNull(profileObject.zohoDeskPortalName),
    zohoDeskEdition: this.stringOrNull(profileObject.zohoDeskEdition),
    zohoDeskSandbox: profileObject.zohoDeskSandbox === true,
    displayName: organizationName ?? `Zoho Desk organization ${organizationId}`,
    grantedScopes,
    zohoRegion: deskAuthority.region,
    zohoAccountsOrigin: deskAuthority.accountsOrigin,
    zohoDeskApiOrigin: deskAuthority.apiOrigin,
    relayOwnedOAuthApp: true,
    railwayCallbackOnly: true,
    stateVerified: true,
    consentBoundOrganizationVerified: true,
    regionalAuthorityBound: true,
    fixedEndpointsOnly: true,
    readOnlyTools: true,
    automaticPagination: false,
    rawToolsEnabled: false,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler051: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  authority,
) {
  const portalId = this.positiveNumericId(profileObject.zohoProjectsPortalId);
  const accountsOrigin =
    this.stringOrNull(authority?.zohoAccountsOrigin) ??
    this.stringOrNull(profileObject.zohoAccountsOrigin);
  if (!portalId || !accountsOrigin)
    throw new BadRequestException(
      "Zoho Projects portal or Accounts binding is invalid",
    );
  const projectsAuthority = this.zohoCrmAuthority(accountsOrigin);
  const apiOrigin =
    this.stringOrNull(authority?.zohoProjectsApiOrigin) ??
    this.stringOrNull(profileObject.zohoProjectsApiOrigin);
  if (projectsAuthority.apiOrigin !== apiOrigin)
    throw new BadRequestException(
      "Zoho Projects Accounts and API data centers do not match",
    );
  const portalName = this.stringOrNull(profileObject.zohoProjectsPortalName);
  return {
    provider: "zoho-projects",
    connectorStandardVersion: "v1",
    oauthFlow:
      "relay_owned_server_app_authorization_code_offline_refresh_multi_dc_portal_bound",
    tokenStatus: "valid",
    clientId,
    zohoProjectsPortalId: portalId,
    zohoProjectsPortalName: portalName,
    zohoProjectsTimeZone: this.stringOrNull(profileObject.zohoProjectsTimeZone),
    displayName: portalName ?? `Zoho Projects portal ${portalId}`,
    grantedScopes,
    zohoRegion: projectsAuthority.region,
    zohoAccountsOrigin: projectsAuthority.accountsOrigin,
    zohoProjectsApiOrigin: projectsAuthority.apiOrigin,
    relayOwnedOAuthApp: true,
    railwayCallbackOnly: true,
    stateVerified: true,
    exactPortalBound: true,
    regionalAuthorityBound: true,
    fixedEndpointsOnly: true,
    readOnlyTools: true,
    automaticPagination: false,
    rawToolsEnabled: false,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler052: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  authority,
) {
  const organizationId = this.positiveNumericId(
    profileObject.zohoExpenseOrganizationId,
  );
  const accountsOrigin =
    this.stringOrNull(authority?.zohoAccountsOrigin) ??
    this.stringOrNull(profileObject.zohoAccountsOrigin);
  if (!organizationId || !accountsOrigin)
    throw new BadRequestException(
      "Zoho Expense organization or Accounts binding is invalid",
    );
  const expenseAuthority = this.zohoCrmAuthority(accountsOrigin);
  const apiOrigin =
    this.stringOrNull(authority?.zohoExpenseApiOrigin) ??
    this.stringOrNull(profileObject.zohoExpenseApiOrigin);
  if (expenseAuthority.apiOrigin !== apiOrigin)
    throw new BadRequestException(
      "Zoho Expense Accounts and API data centers do not match",
    );
  const organizationName = this.stringOrNull(
    profileObject.zohoExpenseOrganizationName,
  );
  return {
    provider: "zoho-expense",
    connectorStandardVersion: "v1",
    oauthFlow:
      "customer_owned_server_app_authorization_code_offline_refresh_multi_dc",
    tokenStatus: "valid",
    clientId,
    zohoExpenseOrganizationId: organizationId,
    zohoExpenseOrganizationName: organizationName,
    zohoExpenseCurrencyCode: this.stringOrNull(
      profileObject.zohoExpenseCurrencyCode,
    ),
    zohoExpenseTimeZone: this.stringOrNull(profileObject.zohoExpenseTimeZone),
    displayName:
      organizationName ?? `Zoho Expense organization ${organizationId}`,
    grantedScopes,
    zohoRegion: expenseAuthority.region,
    zohoAccountsOrigin: expenseAuthority.accountsOrigin,
    zohoExpenseApiOrigin: expenseAuthority.apiOrigin,
    railwayCallbackOnly: true,
    stateVerified: true,
    organizationVerified: true,
    regionalAuthorityBound: true,
    fixedEndpointsOnly: true,
    readOnlyTools: true,
    automaticPagination: false,
    rawToolsEnabled: false,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler053: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  authority,
) {
  const organizationId = this.positiveNumericId(
    profileObject.zohoInvoiceOrganizationId,
  );
  const accountsOrigin =
    this.stringOrNull(authority?.zohoAccountsOrigin) ??
    this.stringOrNull(profileObject.zohoAccountsOrigin);
  if (!organizationId || !accountsOrigin)
    throw new BadRequestException(
      "Zoho Invoice organization or Accounts binding is invalid",
    );
  const invoiceAuthority = this.zohoCrmAuthority(accountsOrigin);
  const apiOrigin =
    this.stringOrNull(authority?.zohoInvoiceApiOrigin) ??
    this.stringOrNull(profileObject.zohoInvoiceApiOrigin);
  if (invoiceAuthority.apiOrigin !== apiOrigin)
    throw new BadRequestException(
      "Zoho Invoice Accounts and API data centers do not match",
    );
  const organizationName = this.stringOrNull(
    profileObject.zohoInvoiceOrganizationName,
  );
  return {
    provider: "zoho-invoice",
    connectorStandardVersion: "v1",
    oauthFlow:
      "customer_owned_server_app_authorization_code_offline_refresh_multi_dc",
    tokenStatus: "valid",
    clientId,
    zohoInvoiceOrganizationId: organizationId,
    zohoInvoiceOrganizationName: organizationName,
    zohoInvoiceCurrencyCode: this.stringOrNull(
      profileObject.zohoInvoiceCurrencyCode,
    ),
    zohoInvoiceTimeZone: this.stringOrNull(profileObject.zohoInvoiceTimeZone),
    displayName:
      organizationName ?? `Zoho Invoice organization ${organizationId}`,
    grantedScopes,
    zohoRegion: invoiceAuthority.region,
    zohoAccountsOrigin: invoiceAuthority.accountsOrigin,
    zohoInvoiceApiOrigin: invoiceAuthority.apiOrigin,
    railwayCallbackOnly: true,
    stateVerified: true,
    organizationVerified: true,
    regionalAuthorityBound: true,
    fixedEndpointsOnly: true,
    readOnlyTools: true,
    automaticPagination: false,
    rawToolsEnabled: false,
    lastHealthCheck: null,
  };
};

export const OAuthProviderMetadataHandlers02: OAuthProviderMetadataHandlerMap =
  Object.freeze({
    docusign: oauthProviderMetadataHandler030,
    "dropbox-sign": oauthProviderMetadataHandler031,
    pandadoc: oauthProviderMetadataHandler032,
    typeform: oauthProviderMetadataHandler033,
    buffer: oauthProviderMetadataHandler034,
    sendfox: oauthProviderMetadataHandler035,
    beehiiv: oauthProviderMetadataHandler036,
    teamwork: oauthProviderMetadataHandler037,
    basecamp: oauthProviderMetadataHandler038,
    wrike: oauthProviderMetadataHandler039,
    front: oauthProviderMetadataHandler040,
    intercom: oauthProviderMetadataHandler041,
    copper: oauthProviderMetadataHandler042,
    mailchimp: oauthProviderMetadataHandler043,
    "mailchimp-surveys": oauthProviderMetadataHandler043,
    "constant-contact": oauthProviderMetadataHandler044,
    "campaign-monitor": oauthProviderMetadataHandler045,
    convertkit: oauthProviderMetadataHandler046,
    klaviyo: oauthProviderMetadataHandler047,
    "klaviyo-sms": oauthProviderMetadataHandler047,
    surveymonkey: oauthProviderMetadataHandler048,
    fillout: oauthProviderMetadataHandler049,
    "zoho-desk": oauthProviderMetadataHandler050,
    "zoho-projects": oauthProviderMetadataHandler051,
    "zoho-expense": oauthProviderMetadataHandler052,
    "zoho-invoice": oauthProviderMetadataHandler053,
  });
