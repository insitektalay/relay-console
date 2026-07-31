import type {
  OAuthProviderMetadataHandler,
  OAuthProviderMetadataHandlerMap,
} from "./oauth-provider-metadata-handler";
import type { MarketplaceConnectorOAuthService } from "../../connector-oauth.service";
import { BadRequestException } from "@nestjs/common";

const oauthProviderMetadataHandler054: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  authority,
) {
  const organizationId = this.positiveNumericId(
    profileObject.zohoBooksOrganizationId,
  );
  const accountsOrigin =
    this.stringOrNull(authority?.zohoAccountsOrigin) ??
    this.stringOrNull(profileObject.zohoAccountsOrigin);
  if (!organizationId || !accountsOrigin)
    throw new BadRequestException(
      "Zoho Books organization or Accounts binding is invalid",
    );
  const booksAuthority = this.zohoCrmAuthority(accountsOrigin);
  const apiOrigin =
    this.stringOrNull(authority?.zohoBooksApiOrigin) ??
    this.stringOrNull(profileObject.zohoBooksApiOrigin);
  if (booksAuthority.apiOrigin !== apiOrigin)
    throw new BadRequestException(
      "Zoho Books Accounts and API data centers do not match",
    );
  const organizationName = this.stringOrNull(
    profileObject.zohoBooksOrganizationName,
  );
  return {
    provider: "zoho-books",
    connectorStandardVersion: "v1",
    oauthFlow:
      "customer_owned_server_app_authorization_code_offline_refresh_multi_dc",
    tokenStatus: "valid",
    clientId,
    zohoBooksOrganizationId: organizationId,
    zohoBooksOrganizationName: organizationName,
    zohoBooksCurrencyCode: this.stringOrNull(
      profileObject.zohoBooksCurrencyCode,
    ),
    zohoBooksTimeZone: this.stringOrNull(profileObject.zohoBooksTimeZone),
    displayName:
      organizationName ?? `Zoho Books organization ${organizationId}`,
    grantedScopes,
    zohoRegion: booksAuthority.region,
    zohoAccountsOrigin: booksAuthority.accountsOrigin,
    zohoBooksApiOrigin: booksAuthority.apiOrigin,
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

const oauthProviderMetadataHandler055: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  authority,
) {
  const userId = this.positiveNumericId(profileObject.zohoPeopleUserId);
  const accountsOrigin =
    this.stringOrNull(authority?.zohoAccountsOrigin) ??
    this.stringOrNull(profileObject.zohoAccountsOrigin);
  if (!userId || !accountsOrigin) {
    throw new BadRequestException(
      "Zoho People user or Accounts binding is invalid",
    );
  }
  const peopleAuthority = this.zohoPeopleAuthority(accountsOrigin);
  const apiOrigin =
    this.stringOrNull(authority?.zohoPeopleApiOrigin) ??
    this.stringOrNull(profileObject.zohoPeopleApiOrigin);
  if (peopleAuthority.apiOrigin !== apiOrigin) {
    throw new BadRequestException(
      "Zoho People Accounts and API data centers do not match",
    );
  }
  const displayName = this.stringOrNull(profileObject.zohoPeopleDisplayName);
  const email = this.normalizeEmail(profileObject.zohoPeopleEmail);
  return {
    provider: "zoho-people",
    connectorStandardVersion: "v1",
    oauthFlow:
      "relay_owned_server_app_authorization_code_offline_refresh_multi_dc_organization_specific",
    tokenStatus: "valid",
    clientId,
    zohoPeopleUserId: userId,
    zohoPeopleDisplayName: displayName,
    zohoPeopleEmail: email,
    displayName: displayName ?? email ?? `Zoho People user ${userId}`,
    grantedScopes,
    zohoRegion: peopleAuthority.region,
    zohoAccountsOrigin: peopleAuthority.accountsOrigin,
    zohoPeopleApiOrigin: peopleAuthority.apiOrigin,
    railwayCallbackOnly: true,
    stateVerified: true,
    organizationSpecificGrant: true,
    currentUserVerified: true,
    regionalAuthorityBound: true,
    fixedEndpointsOnly: true,
    structureMetadataOnly: true,
    automaticPagination: false,
    rawToolsEnabled: false,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler056: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  authority,
) {
  const userId = this.positiveNumericId(profileObject.zohoCampaignsUserId);
  const accountsOrigin =
    this.stringOrNull(authority?.zohoAccountsOrigin) ??
    this.stringOrNull(profileObject.zohoAccountsOrigin);
  if (!userId || !accountsOrigin) {
    throw new BadRequestException(
      "Zoho Campaigns user or Accounts binding is invalid",
    );
  }
  const campaignsAuthority = this.zohoCampaignsAuthority(accountsOrigin);
  const apiOrigin =
    this.stringOrNull(authority?.zohoCampaignsApiOrigin) ??
    this.stringOrNull(profileObject.zohoCampaignsApiOrigin);
  if (campaignsAuthority.apiOrigin !== apiOrigin) {
    throw new BadRequestException(
      "Zoho Campaigns Accounts and API data centers do not match",
    );
  }
  const displayName = this.stringOrNull(profileObject.zohoCampaignsDisplayName);
  const email = this.normalizeEmail(profileObject.zohoCampaignsEmail);
  return {
    provider: "zoho-campaigns",
    connectorStandardVersion: "v1",
    oauthFlow:
      "relay_owned_server_app_authorization_code_offline_refresh_multi_dc",
    tokenStatus: "valid",
    clientId,
    zohoCampaignsUserId: userId,
    zohoCampaignsDisplayName: displayName,
    zohoCampaignsEmail: email,
    displayName: displayName ?? email ?? `Zoho Campaigns user ${userId}`,
    grantedScopes,
    zohoRegion: campaignsAuthority.region,
    zohoAccountsOrigin: campaignsAuthority.accountsOrigin,
    zohoCampaignsApiOrigin: campaignsAuthority.apiOrigin,
    railwayCallbackOnly: true,
    stateVerified: true,
    currentUserVerified: true,
    regionalAuthorityBound: true,
    fixedEndpointsOnly: true,
    aggregateCampaignMetadataOnly: true,
    automaticPagination: false,
    rawToolsEnabled: false,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler057: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  authority,
) {
  const userId = this.positiveNumericId(profileObject.zohoAnalyticsUserId);
  const accountsOrigin =
    this.stringOrNull(authority?.zohoAccountsOrigin) ??
    this.stringOrNull(profileObject.zohoAccountsOrigin);
  if (!userId || !accountsOrigin) {
    throw new BadRequestException(
      "Zoho Analytics user or Accounts binding is invalid",
    );
  }
  const analyticsAuthority = this.zohoAnalyticsAuthority(accountsOrigin);
  const apiOrigin =
    this.stringOrNull(authority?.zohoAnalyticsApiOrigin) ??
    this.stringOrNull(profileObject.zohoAnalyticsApiOrigin);
  if (analyticsAuthority.apiOrigin !== apiOrigin) {
    throw new BadRequestException(
      "Zoho Analytics Accounts and API data centers do not match",
    );
  }
  const displayName = this.stringOrNull(profileObject.zohoAnalyticsDisplayName);
  const email = this.normalizeEmail(profileObject.zohoAnalyticsEmail);
  return {
    provider: "zoho-analytics",
    connectorStandardVersion: "v1",
    oauthFlow:
      "relay_owned_server_app_authorization_code_offline_refresh_multi_dc",
    tokenStatus: "valid",
    clientId,
    zohoAnalyticsUserId: userId,
    zohoAnalyticsDisplayName: displayName,
    zohoAnalyticsEmail: email,
    displayName: displayName ?? email ?? `Zoho Analytics user ${userId}`,
    grantedScopes,
    zohoRegion: analyticsAuthority.region,
    zohoAccountsOrigin: analyticsAuthority.accountsOrigin,
    zohoAnalyticsApiOrigin: analyticsAuthority.apiOrigin,
    railwayCallbackOnly: true,
    stateVerified: true,
    currentUserVerified: true,
    regionalAuthorityBound: true,
    fixedEndpointsOnly: true,
    analyticsMetadataOnly: true,
    automaticPagination: false,
    rawToolsEnabled: false,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler058: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  authority,
) {
  const organizationId = this.positiveNumericId(
    profileObject.zohoCrmOrganizationId,
  );
  const userId = this.positiveNumericId(profileObject.zohoCrmUserId);
  const accountsOrigin =
    this.stringOrNull(authority?.zohoAccountsOrigin) ??
    this.stringOrNull(profileObject.zohoAccountsOrigin);
  if (!organizationId || !userId || !accountsOrigin) {
    throw new BadRequestException(
      "Zoho CRM organization, user, or Accounts binding is invalid",
    );
  }
  const crmAuthority = this.zohoCrmAuthority(accountsOrigin);
  const apiOrigin =
    this.stringOrNull(authority?.zohoCrmApiOrigin) ??
    this.stringOrNull(profileObject.zohoCrmApiOrigin);
  if (crmAuthority.apiOrigin !== apiOrigin) {
    throw new BadRequestException(
      "Zoho CRM Accounts and API data centers do not match",
    );
  }
  const organizationName = this.stringOrNull(
    profileObject.zohoCrmOrganizationName,
  );
  return {
    provider: "zoho",
    connectorStandardVersion: "v1",
    oauthFlow:
      "relay_owned_server_app_authorization_code_offline_refresh_multi_dc",
    tokenStatus: "valid",
    clientId,
    zohoCrmOrganizationId: organizationId,
    zohoCrmOrganizationName: organizationName,
    zohoCrmEnvironment: this.stringOrNull(profileObject.zohoCrmEnvironment),
    zohoCrmUserId: userId,
    displayName: organizationName ?? `Zoho CRM organization ${organizationId}`,
    grantedScopes,
    zohoRegion: crmAuthority.region,
    zohoAccountsOrigin: crmAuthority.accountsOrigin,
    zohoCrmApiOrigin: crmAuthority.apiOrigin,
    railwayCallbackOnly: true,
    stateVerified: true,
    organizationVerified: true,
    currentUserVerified: true,
    regionalAuthorityBound: true,
    fixedEndpointsOnly: true,
    readOnlyTools: true,
    automaticPagination: false,
    rawToolsEnabled: false,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler059: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const userId = this.positiveNumericId(profileObject.pipedriveUserId);
  const companyId = this.positiveNumericId(profileObject.pipedriveCompanyId);
  const apiOrigin = this.pipedriveApiOrigin(
    this.stringOrNull(profileObject.pipedriveApiOrigin),
  );
  if (!userId || !companyId)
    throw new BadRequestException(
      "Pipedrive company or user binding is invalid",
    );
  return {
    provider: "pipedrive",
    connectorStandardVersion: "v1",
    oauthFlow: "relay_owned_public_app_authorization_code_refresh_rotation",
    tokenStatus: "valid",
    clientId,
    pipedriveUserId: userId,
    pipedriveCompanyId: companyId,
    pipedriveCompanyName: this.stringOrNull(profileObject.pipedriveCompanyName),
    pipedriveApiOrigin: apiOrigin,
    displayName:
      this.stringOrNull(profileObject.pipedriveCompanyName) ??
      `Company ${companyId}`,
    grantedScopes,
    apiVersion: "v2",
    relayOwnedOAuthApp: true,
    callbackOnly: true,
    stateVerified: true,
    exactCompanyAuthorityBound: true,
    exactAuthorizingUserBound: true,
    exactApiDomainBound: true,
    authorizingUserPermissionsInherited: true,
    refreshTokenRotationRequired: true,
    fixedEndpointsOnly: true,
    automaticPagination: false,
    rawApiEnabled: false,
  };
};

const oauthProviderMetadataHandler060: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const organizationId = this.stringOrNull(
    profileObject.salesforceOrganizationId,
  );
  const userId = this.stringOrNull(profileObject.salesforceUserId);
  const instanceOrigin = this.stringOrNull(
    profileObject.salesforceInstanceOrigin,
  );
  if (!organizationId || !userId || !instanceOrigin)
    throw new BadRequestException(
      "Salesforce organization, user, or instance binding is invalid",
    );
  return {
    provider: "salesforce",
    connectorStandardVersion: "v1",
    oauthFlow:
      "relay_owned_packaged_external_client_app_authorization_code_pkce_refresh_rotation",
    tokenStatus: "valid",
    clientId,
    salesforceOrganizationId: organizationId,
    salesforceUserId: userId,
    salesforceInstanceOrigin: instanceOrigin,
    salesforceOrganizationName: this.stringOrNull(
      profileObject.salesforceOrganizationName,
    ),
    displayName:
      this.stringOrNull(profileObject.salesforceOrganizationName) ??
      organizationId,
    grantedScopes,
    apiVersion: "v67.0",
    relayOwnedOAuthApp: true,
    packagedExternalClientApp: true,
    callbackOnly: true,
    stateVerified: true,
    tokenResponseSignatureVerified: true,
    exactOrganizationAuthorityBound: true,
    exactInstanceAuthorityBound: true,
    exactAuthorizingUserBound: true,
    authorizingUserPermissionsInherited: true,
    refreshTokenRotationRequired: true,
    arbitraryQueryEnabled: false,
    automaticPagination: false,
    rawApiEnabled: false,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler061: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const hubId = this.stringOrNull(profileObject.hubSpotHubId);
  const userId = this.stringOrNull(profileObject.hubSpotUserId);
  if (!hubId || !userId)
    throw new BadRequestException("HubSpot Hub or user binding is invalid");
  return {
    provider: "hubspot",
    connectorStandardVersion: "v1",
    oauthFlow: "relay_owned_public_app_authorization_code_refresh",
    tokenStatus: "valid",
    clientId,
    hubSpotHubId: hubId,
    hubSpotUserId: userId,
    hubSpotAppId: this.stringOrNull(profileObject.hubSpotAppId),
    hubSpotHubDomain: this.stringOrNull(profileObject.hubSpotHubDomain),
    displayName:
      this.stringOrNull(profileObject.hubSpotHubDomain) ?? `Hub ${hubId}`,
    grantedScopes,
    apiVersion: "2026-03",
    relayOwnedOAuthApp: true,
    callbackOnly: true,
    stateVerified: true,
    tokenIntrospectionVerified: true,
    exactHubAuthorityBound: true,
    exactAuthorizingUserBound: true,
    authorizingUserPermissionsInherited: true,
    refreshTokenRequired: true,
  };
};

const oauthProviderMetadataHandler062: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const businessId = this.stringOrNull(profileObject.sageAccountingBusinessId);
  if (!businessId || !/^[A-Za-z0-9_-]{1,200}$/.test(businessId))
    throw new BadRequestException(
      "Sage Accounting connected-business binding is invalid",
    );
  return {
    provider: "sage-accounting",
    connectorStandardVersion: "v1",
    oauthFlow:
      "customer_owned_confidential_authorization_code_rotating_refresh",
    tokenStatus: "valid",
    clientId,
    sageAccountingBusinessId: businessId,
    sageAccountingBusinessName: this.stringOrNull(
      profileObject.sageAccountingBusinessName,
    ),
    displayName:
      this.stringOrNull(profileObject.sageAccountingBusinessName) ?? businessId,
    grantedScopes,
    relayOwnedOAuthApp: false,
    railwayCallbackOnly: true,
    stateVerified: true,
    exactBusinessAuthorityBound: true,
    singleBusinessGrantRequired: true,
    refreshTokenRotationRequired: true,
    apimSubscriptionKeyRequired: true,
    fixedApiVersion: "v3.1",
    automaticPagination: false,
    rawApiEnabled: false,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler063: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const companyFileId = this.stringOrNull(profileObject.myobCompanyFileId);
  if (
    !companyFileId ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      companyFileId,
    )
  )
    throw new BadRequestException(
      "MYOB connected company-file binding is invalid",
    );
  return {
    provider: "myob",
    connectorStandardVersion: "v1",
    oauthFlow:
      "customer_owned_confidential_authorization_code_rotating_refresh",
    tokenStatus: "valid",
    clientId,
    myobCompanyFileId: companyFileId,
    myobCompanyFileName: this.stringOrNull(profileObject.myobCompanyFileName),
    myobProductVersion: this.stringOrNull(profileObject.myobProductVersion),
    myobProductLevel: this.stringOrNull(profileObject.myobProductLevel),
    myobCountry: this.stringOrNull(profileObject.myobCountry),
    displayName:
      this.stringOrNull(profileObject.myobCompanyFileName) ?? companyFileId,
    grantedScopes,
    relayOwnedOAuthApp: false,
    railwayCallbackOnly: true,
    stateVerified: true,
    exactCompanyFileAuthorityBound: true,
    refreshTokenRotationRequired: true,
    companyFileTokenRequired: true,
    fixedCloudOrigin: "https://api.myob.com",
    fixedApiVersion: "v2",
    automaticPagination: false,
    rawApiEnabled: false,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler064: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const companyId = this.stringOrNull(profileObject.freeAgentCompanyId);
  if (!companyId || !/^[1-9][0-9]{0,31}$/.test(companyId))
    throw new BadRequestException(
      "FreeAgent connected-company binding is invalid",
    );
  return {
    provider: "freeagent",
    connectorStandardVersion: "v1",
    oauthFlow: "relay_owned_authorization_code_refresh",
    tokenStatus: "valid",
    clientId,
    freeAgentCompanyId: companyId,
    freeAgentCompanyName: this.stringOrNull(profileObject.freeAgentCompanyName),
    freeAgentCompanyType: this.stringOrNull(profileObject.freeAgentCompanyType),
    freeAgentCurrency: this.stringOrNull(profileObject.freeAgentCurrency),
    displayName:
      this.stringOrNull(profileObject.freeAgentCompanyName) ?? companyId,
    grantedScopes,
    relayOwnedOAuthApp: true,
    callbackOnly: true,
    stateVerified: true,
    exactCompanyAuthorityBound: true,
    authorizingUserPermissionsInherited: true,
    providerRevocationAvailable: false,
    automaticPagination: false,
    rawApiEnabled: false,
    practiceApiEnabled: false,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler065: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const businessId = this.stringOrNull(profileObject.waveBusinessId);
  if (!businessId || !/^[A-Za-z0-9+/=_-]{1,256}$/.test(businessId))
    throw new BadRequestException("Wave connected-business binding is invalid");
  return {
    provider: "wave",
    connectorStandardVersion: "v1",
    oauthFlow: "relay_owned_authorization_code_refresh",
    tokenStatus: "valid",
    clientId,
    waveBusinessId: businessId,
    waveBusinessName: this.stringOrNull(profileObject.waveBusinessName),
    waveBusinessIsPersonal: profileObject.waveBusinessIsPersonal === true,
    displayName:
      this.stringOrNull(profileObject.waveBusinessName) ?? businessId,
    grantedScopes,
    relayOwnedOAuthApp: true,
    callbackOnly: true,
    stateVerified: true,
    exactBusinessAuthorityBound: true,
    subscriptionEligibilityRequired: true,
    automaticPagination: false,
    rawGraphqlEnabled: false,
    paymentWalletEnabled: false,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler066: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const businessId = this.stringOrNull(profileObject.freshbooksBusinessId);
  const accountId = this.stringOrNull(profileObject.freshbooksAccountId);
  const role = this.stringOrNull(profileObject.freshbooksRole);
  if (
    !businessId ||
    !/^[1-9][0-9]{0,31}$/.test(businessId) ||
    !accountId ||
    !/^[A-Za-z0-9_-]{1,64}$/.test(accountId) ||
    !role
  )
    throw new BadRequestException(
      "FreshBooks connected-business binding is invalid",
    );
  return {
    provider: "freshbooks",
    connectorStandardVersion: "v1",
    oauthFlow: "relay_owned_authorization_code_single_use_refresh",
    tokenStatus: "valid",
    clientId,
    freshbooksBusinessId: businessId,
    freshbooksAccountId: accountId,
    freshbooksBusinessName: this.stringOrNull(
      profileObject.freshbooksBusinessName,
    ),
    freshbooksRole: role,
    displayName:
      this.stringOrNull(profileObject.freshbooksBusinessName) ?? accountId,
    grantedScopes,
    relayOwnedOAuthApp: true,
    callbackOnly: true,
    stateVerified: true,
    exactBusinessAuthorityBound: true,
    rollingSingleUseRefreshTokens: true,
    automaticPagination: false,
    rawApiEnabled: false,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler067: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const realmId = this.stringOrNull(profileObject.quickbooksRealmId);
  const environment = this.stringOrNull(profileObject.quickbooksEnvironment);
  if (
    !realmId ||
    !/^[1-9][0-9]{0,31}$/.test(realmId) ||
    !environment ||
    !["sandbox", "production"].includes(environment)
  )
    throw new BadRequestException(
      "QuickBooks connected-company binding is invalid",
    );
  return {
    provider: "quickbooks",
    connectorStandardVersion: "v1",
    oauthFlow: "relay_owned_authorization_code_rolling_refresh",
    tokenStatus: "valid",
    clientId,
    quickbooksRealmId: realmId,
    quickbooksEnvironment: environment,
    quickbooksCompanyName: this.stringOrNull(
      profileObject.quickbooksCompanyName,
    ),
    quickbooksLegalName: this.stringOrNull(profileObject.quickbooksLegalName),
    displayName:
      this.stringOrNull(profileObject.quickbooksCompanyName) ?? realmId,
    grantedScopes,
    relayOwnedOAuthApp: true,
    callbackOnly: true,
    stateVerified: true,
    exactCompanyAuthorityBound: true,
    rollingRefreshTokens: true,
    automaticPagination: false,
    rawApiEnabled: false,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler068: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const connectionId = this.stringOrNull(profileObject.xeroConnectionId);
  const tenantId = this.stringOrNull(profileObject.xeroTenantId);
  const authEventId = this.stringOrNull(profileObject.xeroAuthEventId);
  if (
    !connectionId ||
    !tenantId ||
    !authEventId ||
    !this.isUuid(connectionId) ||
    !this.isUuid(tenantId) ||
    !this.isUuid(authEventId) ||
    profileObject.xeroTenantType !== "ORGANISATION"
  )
    throw new BadRequestException(
      "Xero connected-organisation binding is invalid",
    );
  return {
    provider: "xero",
    connectorStandardVersion: "v1",
    oauthFlow: "customer_owned_authorization_code_rotating_refresh",
    tokenStatus: "valid",
    clientId,
    xeroConnectionId: connectionId,
    xeroTenantId: tenantId,
    xeroTenantName: this.stringOrNull(profileObject.xeroTenantName),
    xeroTenantType: "ORGANISATION",
    xeroAuthEventId: authEventId,
    displayName: this.stringOrNull(profileObject.xeroTenantName) ?? tenantId,
    grantedScopes,
    customerOwnedOAuthApp: true,
    callbackOnly: true,
    stateVerified: true,
    exactTenantAuthorityBound: true,
    rotatingRefreshTokens: true,
    automaticPagination: false,
    rawApiEnabled: false,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler069: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const stripeAccountId = this.stringOrNull(profileObject.stripeAccountId);
  const stripeLivemode = profileObject.stripeLivemode;
  if (
    !stripeAccountId ||
    !/^acct_[A-Za-z0-9]{1,125}$/.test(stripeAccountId) ||
    typeof stripeLivemode !== "boolean"
  ) {
    throw new BadRequestException(
      "Stripe connected-account binding is invalid",
    );
  }
  return {
    provider: "stripe",
    connectorStandardVersion: "v1",
    oauthFlow: "stripe_apps_authorization_code_rotating_refresh",
    tokenStatus: "valid",
    clientId,
    stripeAccountId,
    stripeLivemode,
    displayName:
      this.stringOrNull(profileObject.displayName) ?? stripeAccountId,
    grantedScopes,
    callbackOnly: true,
    stateVerified: true,
    accountAuthorityBound: true,
    modeAuthorityBound: true,
    rotatingRefreshTokens: true,
    fixedApiVersion: "2026-06-24.dahlia",
    automaticPagination: false,
    rawApiEnabled: false,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler070: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  authority,
) {
  const shopDomain = this.normalizeShopifyDomain(
    authority?.shopDomain ?? this.stringOrNull(profileObject.shopDomain) ?? "",
  );
  const shopifyShopId = this.stringOrNull(profileObject.shopifyShopId);
  if (!shopifyShopId) {
    throw new BadRequestException("Shopify connected-shop binding is invalid");
  }
  return {
    provider: "shopify",
    connectorStandardVersion: "v1",
    oauthFlow: "authorization_code_expiring_offline_rotating_refresh",
    tokenStatus: "valid",
    clientId,
    shopDomain,
    shopifyShopId,
    shopifyShopName: this.stringOrNull(profileObject.shopifyShopName),
    shopifyCurrencyCode: this.stringOrNull(profileObject.shopifyCurrencyCode),
    shopifyPrimaryDomain: profileObject.shopifyPrimaryDomain ?? null,
    displayName: this.stringOrNull(profileObject.shopifyShopName) ?? shopDomain,
    grantedScopes,
    callbackOnly: true,
    stateVerified: true,
    callbackHmacVerified: true,
    shopAuthorityBound: true,
    expiringOfflineAccessToken: true,
    rotatingRefreshTokens: true,
    fixedAdminGraphqlVersion: "2026-07",
    automaticPagination: false,
    rawGraphqlEnabled: false,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler071: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const userId = this.stringOrNull(profileObject.contentfulUserId);
  const cmaOrigin = this.stringOrNull(profileObject.contentfulCmaOrigin);
  if (
    !userId ||
    !["https://api.contentful.com", "https://api.eu.contentful.com"].includes(
      cmaOrigin ?? "",
    )
  ) {
    throw new BadRequestException(
      "Contentful connected-user binding is invalid",
    );
  }
  const firstName = this.stringOrNull(profileObject.firstName);
  const lastName = this.stringOrNull(profileObject.lastName);
  const fullName = [firstName, lastName].filter(Boolean).join(" ");
  return {
    provider: "contentful",
    connectorStandardVersion: "v1",
    oauthFlow: "public_implicit_bearer_fragment_bridge",
    tokenStatus: "valid_non_refreshable",
    clientId,
    contentfulUserId: userId,
    contentfulCmaOrigin: cmaOrigin,
    displayName: fullName || this.stringOrNull(profileObject.email) || userId,
    email: this.stringOrNull(profileObject.email),
    grantedScopes,
    railwayCallbackOnly: true,
    stateVerified: true,
    fragmentScrubbed: true,
    userVerified: true,
    refreshSupported: false,
    reauthorizationReplacesToken: true,
    fixedCmaHostsOnly: true,
    draftFirst: true,
    staleVersionChecks: true,
    automaticPagination: false,
    rawToolsEnabled: false,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler072: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const blogId = this.stringOrNull(profileObject.wordpressComBlogId);
  const userId = this.stringOrNull(profileObject.wordpressComUserId);
  const tokenScopes = this.stringArray(profileObject.wordpressComScopes);
  if (
    !blogId ||
    !userId ||
    !["sites", "posts"].every((scope) => tokenScopes.includes(scope))
  ) {
    throw new BadRequestException(
      "WordPress.com OAuth response did not bind one site and user",
    );
  }
  return {
    provider: "wordpress-com",
    connectorStandardVersion: "v1",
    oauthFlow: "authorization_code_specific_blog_non_refreshable",
    tokenStatus: "valid_non_refreshable",
    clientId,
    wordpressComBlogId: blogId,
    wordpressComUserId: userId,
    wordpressComSiteName: this.stringOrNull(profileObject.wordpressComSiteName),
    wordpressComSiteUrl: this.stringOrNull(profileObject.wordpressComSiteUrl),
    wordpressComIsJetpack: profileObject.wordpressComIsJetpack === true,
    wordpressComIsPrivate: profileObject.wordpressComIsPrivate === true,
    displayName:
      this.stringOrNull(profileObject.wordpressComSiteName) ??
      `WordPress.com site ${blogId}`,
    grantedScopes,
    railwayCallbackOnly: true,
    stateVerified: true,
    tokenInfoVerified: true,
    specificBlogOnly: true,
    refreshSupported: false,
    reauthorizationReplacesToken: true,
    draftFirst: true,
    staleModifiedChecks: true,
    publicizeDisabled: true,
    automaticPagination: false,
    globalScopeEnabled: false,
    rawToolsEnabled: false,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler073: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const webflowAuthorizationId = this.stringOrNull(
    profileObject.webflowAuthorizationId,
  );
  const webflowSiteIds = this.stringArray(profileObject.webflowSiteIds);
  const webflowWorkspaceIds = this.stringArray(
    profileObject.webflowWorkspaceIds,
  );
  if (
    !webflowAuthorizationId ||
    (!webflowSiteIds.length && !webflowWorkspaceIds.length)
  ) {
    throw new BadRequestException(
      "Webflow OAuth response did not bind authorized sites or workspaces",
    );
  }
  return {
    provider: "webflow",
    connectorStandardVersion: "v1",
    oauthFlow: "authorization_code_non_refreshable_access_token",
    tokenStatus: "valid_non_refreshable",
    clientId,
    webflowAuthorizationId,
    webflowSiteIds,
    webflowWorkspaceIds,
    webflowUserIds: this.stringArray(profileObject.webflowUserIds),
    webflowApplicationId: this.stringOrNull(profileObject.webflowApplicationId),
    displayName:
      this.stringOrNull(profileObject.webflowApplicationName) ??
      `Webflow authorization ${webflowAuthorizationId}`,
    grantedScopes,
    railwayCallbackOnly: true,
    stateVerified: true,
    authorizationVerified: true,
    refreshSupported: false,
    reauthorizationReplacesToken: true,
    fixedDataApiV2: true,
    automaticPagination: false,
    fullSitePublishingEnabled: false,
    rawToolsEnabled: false,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler074: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const canvaUserId = this.stringOrNull(profileObject.canvaUserId);
  const canvaTeamId = this.stringOrNull(profileObject.canvaTeamId);
  if (!canvaUserId || !canvaTeamId) {
    throw new BadRequestException(
      "Canva OAuth response did not bind the connected user and team",
    );
  }
  return {
    provider: "canva",
    connectorStandardVersion: "v1",
    oauthFlow: "authorization_code_pkce_single_use_refresh",
    tokenStatus: "valid",
    clientId,
    canvaUserId,
    canvaTeamId,
    displayName: `Canva team ${canvaTeamId}`,
    grantedScopes,
    railwayCallbackOnly: true,
    stateVerified: true,
    userVerified: true,
    pkceS256: true,
    rotatingRefreshTokens: true,
    singleUseRefreshTokens: true,
    fixedRestV1: true,
    automaticPagination: false,
    temporaryUrlsPersisted: false,
    previewApisEnabled: false,
    rawToolsEnabled: false,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler075: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const miroUserId = this.stringOrNull(profileObject.miroUserId);
  const miroTeamId = this.stringOrNull(profileObject.miroTeamId);
  if (!miroUserId || !miroTeamId) {
    throw new BadRequestException(
      "Miro OAuth response did not bind the connected user and team",
    );
  }
  return {
    provider: "miro",
    connectorStandardVersion: "v1",
    oauthFlow: "authorization_code_rotating_refresh",
    tokenStatus: "valid",
    clientId,
    miroUserId,
    miroTeamId,
    displayName: `Miro team ${miroTeamId}`,
    grantedScopes,
    railwayCallbackOnly: true,
    stateVerified: true,
    userVerified: true,
    rotatingRefreshTokens: true,
    fixedRestV2: true,
    automaticPagination: false,
    rawToolsEnabled: false,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler076: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const companyGuid = this.stringOrNull(profileObject.sevenShiftsCompanyGuid);
  const companyId = this.stringOrNull(profileObject.sevenShiftsCompanyId);
  if (!companyGuid || !companyId) {
    throw new BadRequestException("7shifts company binding is invalid");
  }
  return {
    provider: "7shifts",
    connectorStandardVersion: "v1",
    oauthFlow: "company_admin_grant_client_credentials",
    tokenStatus: "valid_rotating_one_hour",
    clientId,
    grantedScopes,
    sevenShiftsCompanyGuid: companyGuid,
    sevenShiftsCompanyId: companyId,
  };
};

const oauthProviderMetadataHandler077: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const user =
    profileObject.user &&
    typeof profileObject.user === "object" &&
    !Array.isArray(profileObject.user)
      ? (profileObject.user as Record<string, unknown>)
      : profileObject;
  const accounts = Array.isArray(profileObject.accounts)
    ? profileObject.accounts
        .filter(
          (item): item is Record<string, unknown> =>
            !!item && typeof item === "object" && !Array.isArray(item),
        )
        .slice(0, 100)
    : [];
  const userId =
    (typeof user.id === "number" ? String(user.id) : null) ??
    this.stringOrNull(user.id) ??
    this.stringOrNull(user.user_id) ??
    this.stringOrNull(user.email);
  const accountUrlIds = accounts
    .map(
      (account) =>
        this.stringOrNull(account.url_id) ??
        this.stringOrNull(account.slug) ??
        this.stringOrNull(account.id),
    )
    .filter((value): value is string => !!value);
  if (!userId && accountUrlIds.length === 0) {
    throw new BadRequestException(
      "Resource Guru connected-user binding is invalid",
    );
  }
  return {
    provider: "resource-guru",
    connectorStandardVersion: "v1",
    oauthFlow: "authorization_code_rotating_refresh",
    tokenStatus: "valid",
    clientId,
    resourceGuruUserId: userId,
    resourceGuruAccountUrlIds: accountUrlIds,
    displayName:
      this.stringOrNull(user.name) ??
      this.stringOrNull(user.full_name) ??
      ([this.stringOrNull(user.first_name), this.stringOrNull(user.last_name)]
        .filter((value): value is string => !!value)
        .join(" ") ||
        null) ??
      this.stringOrNull(user.email) ??
      "Resource Guru account",
    email: this.stringOrNull(user.email),
    grantedScopes,
    railwayCallbackOnly: true,
    stateVerified: true,
    userVerified: true,
    fixedEndpointsOnly: true,
    pinnedOperationCount: 112,
    readOperationCount: 60,
    mutationOperationCount: 52,
    maxRequestBytes: 2_000_000,
    maxResponseBytes: 2_500_000,
    providerRateLimitPerMinute: 200,
    automaticPagination: false,
    rawToolsEnabled: false,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler078: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const accounts = Array.isArray(profileObject.accounts)
    ? profileObject.accounts
        .filter(
          (item): item is Record<string, unknown> =>
            !!item && typeof item === "object" && !Array.isArray(item),
        )
        .slice(0, 100)
    : [];
  const user =
    profileObject.user &&
    typeof profileObject.user === "object" &&
    !Array.isArray(profileObject.user)
      ? (profileObject.user as Record<string, unknown>)
      : {};
  const accountIds = accounts
    .map((account) =>
      typeof account.id === "number"
        ? String(account.id)
        : this.stringOrNull(account.id),
    )
    .filter((value): value is string => !!value);
  const userId =
    (typeof user.id === "number" ? String(user.id) : null) ??
    this.stringOrNull(user.id) ??
    this.stringOrNull(user.email);
  if (!accountIds.length || !userId) {
    throw new BadRequestException("Timely connected-user binding is invalid");
  }
  return {
    provider: "timely-time-tracking",
    connectorStandardVersion: "v1",
    oauthFlow: "authorization_code_refresh_manage_scope",
    tokenStatus: "valid",
    clientId,
    timelyUserId: userId,
    timelyAccountIds: accountIds,
    displayName:
      this.stringOrNull(user.name) ??
      this.stringOrNull(user.email) ??
      "Timely account",
    email: this.stringOrNull(user.email),
    grantedScopes,
    railwayCallbackOnly: true,
    stateVerified: true,
    userVerified: true,
    accountAuthorityBound: true,
    fixedEndpointsOnly: true,
    pinnedOperationCount: 70,
    readOperationCount: 32,
    mutationOperationCount: 38,
    maxRequestBytes: 2_000_000,
    maxResponseBytes: 2_500_000,
    automaticPagination: false,
    rawToolsEnabled: false,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler079: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const user =
    profileObject.user &&
    typeof profileObject.user === "object" &&
    !Array.isArray(profileObject.user)
      ? (profileObject.user as Record<string, unknown>)
      : {};
  const userId =
    (typeof user.id === "number" ? String(user.id) : null) ??
    this.stringOrNull(user.id) ??
    this.stringOrNull(user.email);
  if (!userId) {
    throw new BadRequestException(
      "RescueTime connected-user binding is invalid",
    );
  }
  return {
    provider: "rescuetime",
    connectorStandardVersion: "v1",
    oauthFlow: "provider_approved_confidential_authorization_code",
    tokenStatus: "valid_non_refreshing",
    clientId,
    rescueTimeUserId: userId,
    displayName:
      this.stringOrNull(user.display_name) ??
      this.stringOrNull(user.name) ??
      this.stringOrNull(user.email) ??
      "RescueTime account",
    email: this.stringOrNull(user.email),
    grantedScopes,
    railwayCallbackOnly: true,
    stateVerified: true,
    userVerified: true,
    userAuthorityBound: true,
    fixedEndpointsOnly: true,
    pinnedOperationCount: 146,
    readOperationCount: 66,
    mutationOperationCount: 80,
    maxRequestBytes: 2_000_000,
    maxResponseBytes: 2_500_000,
    providerRateLimitPerMinute: 60,
    providerRateLimitPerHour: 1000,
    automaticPagination: false,
    rawToolsEnabled: false,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler080: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const user =
    profileObject.user &&
    typeof profileObject.user === "object" &&
    !Array.isArray(profileObject.user)
      ? (profileObject.user as Record<string, unknown>)
      : {};
  const userId =
    typeof user.id === "number"
      ? String(user.id)
      : (this.stringOrNull(user.id) ?? this.stringOrNull(user.email));
  if (!userId)
    throw new BadRequestException("Hubstaff connected-user binding is invalid");
  return {
    provider: "hubstaff",
    connectorStandardVersion: "v1",
    oauthFlow: "oidc_authorization_code_pkce_rotating_refresh",
    tokenStatus: "valid",
    clientId,
    hubstaffUserId: userId,
    displayName:
      this.stringOrNull(user.name) ??
      this.stringOrNull(user.email) ??
      "Hubstaff account",
    email: this.stringOrNull(user.email),
    grantedScopes,
    railwayCallbackOnly: true,
    stateVerified: true,
    nonceVerified: true,
    pkceVerified: true,
    userVerified: true,
    userAndRoleAuthorityBound: true,
    fixedEndpointsOnly: true,
    pinnedOperationCount: 160,
    excludedWebhookPlumbingOperationCount: 6,
    readOperationCount: 96,
    mutationOperationCount: 64,
    maxRequestBytes: 2_000_000,
    maxResponseBytes: 2_500_000,
    providerRateLimitPerHour: 1000,
    automaticPagination: false,
    rawToolsEnabled: false,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler081: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  authority,
) {
  const userId =
    authority?.pCloudUserId ??
    this.stringOrNull(profileObject.pCloudUserId) ??
    this.stringOrNull(profileObject.userid) ??
    this.stringOrNull(profileObject.email);
  const apiOrigin = this.pCloudAuthority(
    authority?.pCloudApiOrigin ??
      this.stringOrNull(profileObject.pCloudApiOrigin) ??
      "",
  ).apiOrigin;
  const locationId =
    authority?.pCloudLocationId ??
    Number(
      profileObject.pCloudLocationId ?? (apiOrigin.includes("eapi") ? 2 : 1),
    );
  if (!userId || ![1, 2].includes(locationId)) {
    throw new BadRequestException("pCloud connected-user binding is invalid");
  }
  return {
    provider: "pcloud",
    connectorStandardVersion: "v1",
    oauthFlow: "authorization_code_regional_authority",
    tokenStatus: "valid_non_expiring",
    clientId,
    pCloudUserId: userId,
    pCloudApiOrigin: apiOrigin,
    pCloudLocationId: locationId,
    displayName:
      this.stringOrNull(profileObject.email) ??
      this.stringOrNull(profileObject.username) ??
      userId,
    email: this.stringOrNull(profileObject.email),
    grantedScopes,
    railwayCallbackOnly: true,
    stateVerified: true,
    userVerified: true,
    regionalAuthorityBound: true,
    fixedEndpointsOnly: true,
    pinnedOperationCount: 94,
    readOperationCount: 47,
    mutationOperationCount: 47,
    maxRequestBytes: 2_000_000,
    maxResponseBytes: 2_500_000,
    automaticPagination: false,
    rawToolsEnabled: false,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler082: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  if (profileObject.toolsVerified !== true) {
    throw new BadRequestException("Any.do hosted MCP binding is invalid");
  }
  return {
    provider: "any-do",
    connectorStandardVersion: "v1",
    oauthFlow: "dynamic_confidential_authorization_code_pkce_refresh",
    tokenStatus: "valid",
    clientId,
    displayName: "Any.do account",
    grantedScopes,
    railwayCallbackOnly: true,
    stateVerified: true,
    pkceS256: true,
    providerPermissionsEnforced: true,
    mcpVerified: true,
    discoveredToolCount:
      typeof profileObject.toolCount === "number"
        ? profileObject.toolCount
        : null,
    mcpResource: "https://mcp.any.do/sse",
    rawToolsEnabled: false,
    lastHealthCheck: null,
  };
};

export const OAuthProviderMetadataHandlers03: OAuthProviderMetadataHandlerMap =
  Object.freeze({
    "zoho-books": oauthProviderMetadataHandler054,
    "zoho-people": oauthProviderMetadataHandler055,
    "zoho-campaigns": oauthProviderMetadataHandler056,
    "zoho-analytics": oauthProviderMetadataHandler057,
    zoho: oauthProviderMetadataHandler058,
    pipedrive: oauthProviderMetadataHandler059,
    salesforce: oauthProviderMetadataHandler060,
    hubspot: oauthProviderMetadataHandler061,
    "sage-accounting": oauthProviderMetadataHandler062,
    myob: oauthProviderMetadataHandler063,
    freeagent: oauthProviderMetadataHandler064,
    wave: oauthProviderMetadataHandler065,
    freshbooks: oauthProviderMetadataHandler066,
    quickbooks: oauthProviderMetadataHandler067,
    xero: oauthProviderMetadataHandler068,
    stripe: oauthProviderMetadataHandler069,
    shopify: oauthProviderMetadataHandler070,
    contentful: oauthProviderMetadataHandler071,
    "wordpress-com": oauthProviderMetadataHandler072,
    webflow: oauthProviderMetadataHandler073,
    canva: oauthProviderMetadataHandler074,
    miro: oauthProviderMetadataHandler075,
    "7shifts": oauthProviderMetadataHandler076,
    "resource-guru": oauthProviderMetadataHandler077,
    "timely-time-tracking": oauthProviderMetadataHandler078,
    rescuetime: oauthProviderMetadataHandler079,
    hubstaff: oauthProviderMetadataHandler080,
    pcloud: oauthProviderMetadataHandler081,
    "any-do": oauthProviderMetadataHandler082,
  });
