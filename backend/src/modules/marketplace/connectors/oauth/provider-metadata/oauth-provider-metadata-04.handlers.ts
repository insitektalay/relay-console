import type {
  OAuthProviderMetadataHandler,
  OAuthProviderMetadataHandlerMap,
} from "./oauth-provider-metadata-handler";
import type { MarketplaceConnectorOAuthService } from "../../connector-oauth.service";
import { BadRequestException } from "@nestjs/common";

const oauthProviderMetadataHandler083: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  if (profileObject.documentedToolsVerified !== true) {
    throw new BadRequestException("Akiflow hosted MCP binding is invalid");
  }
  return {
    provider: "akiflow",
    connectorStandardVersion: "v1",
    oauthFlow: "dynamic_public_authorization_code_pkce_refresh",
    tokenStatus: "valid",
    clientId,
    displayName: "Akiflow account",
    grantedScopes,
    railwayCallbackOnly: true,
    stateVerified: true,
    pkceS256: true,
    providerPermissionsEnforced: true,
    mcpVerified: true,
    documentedToolsVerified: true,
    discoveredToolCount:
      typeof profileObject.toolCount === "number"
        ? profileObject.toolCount
        : null,
    mcpResource: "https://mcp.akiflow.com/mcp",
    rawToolsEnabled: false,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler084: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  if (profileObject.documentedToolsVerified !== true) {
    throw new BadRequestException("Sunsama hosted MCP binding is invalid");
  }
  return {
    provider: "sunsama",
    connectorStandardVersion: "v1",
    oauthFlow:
      "dynamic_public_authorization_code_pkce_rotating_refresh_revocation",
    tokenStatus: "valid",
    clientId,
    displayName: "Sunsama account",
    grantedScopes,
    railwayCallbackOnly: true,
    stateVerified: true,
    pkceS256: true,
    providerPermissionsEnforced: true,
    mcpVerified: true,
    documentedToolsVerified: true,
    discoveredToolCount:
      typeof profileObject.toolCount === "number"
        ? profileObject.toolCount
        : null,
    dailyTaskResourceTemplate: "sunsama://tasks/{date}",
    mcpResource: "https://api.sunsama.com/mcp",
    rawToolsEnabled: false,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler085: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  if (profileObject.documentedToolsVerified !== true) {
    throw new BadRequestException(
      "Remember The Milk hosted MCP binding is invalid",
    );
  }
  return {
    provider: "remember-the-milk",
    connectorStandardVersion: "v1",
    oauthFlow: "dynamic_confidential_authorization_code_pkce_refresh",
    tokenStatus: "valid",
    clientId,
    displayName: "Remember The Milk account",
    grantedScopes,
    railwayCallbackOnly: true,
    stateVerified: true,
    pkceS256: true,
    providerPermissionsEnforced: true,
    mcpVerified: true,
    documentedToolsVerified: true,
    discoveredToolCount:
      typeof profileObject.toolCount === "number"
        ? profileObject.toolCount
        : null,
    readToolCount: 16,
    manageToolCount: 42,
    mcpResource: "https://www.rememberthemilk.com/mcp",
    proAccountRequired: true,
    rawToolsEnabled: false,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler086: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  authority,
) {
  const userId = this.stringOrNull(profileObject.shareFileUserId);
  const apiOrigin = this.shareFileAuthority(
    authority?.shareFileApiOrigin ??
      this.stringOrNull(profileObject.shareFileApiOrigin) ??
      "",
  ).apiOrigin;
  if (!userId) {
    throw new BadRequestException(
      "ShareFile connected-user binding is invalid",
    );
  }
  return {
    provider: "sharefile",
    connectorStandardVersion: "v1",
    oauthFlow: "authorization_code_signed_tenant_authority",
    tokenStatus: "valid",
    clientId,
    shareFileUserId: userId,
    shareFileApiOrigin: apiOrigin,
    displayName:
      this.stringOrNull(profileObject.FullName) ??
      this.stringOrNull(profileObject.Name) ??
      this.stringOrNull(profileObject.Email) ??
      userId,
    email:
      this.stringOrNull(profileObject.Email) ??
      this.stringOrNull(profileObject.email),
    grantedScopes,
    railwayCallbackOnly: true,
    stateVerified: true,
    callbackHmacVerified: true,
    userVerified: true,
    customerAuthorityBound: true,
    fixedEndpointsOnly: true,
    pinnedOperationCount: 309,
    readOperationCount: 141,
    mutationOperationCount: 168,
    maxRequestBytes: 2_000_000,
    maxResponseBytes: 2_500_000,
    automaticPagination: false,
    rawToolsEnabled: false,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler087: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  authority,
) {
  const userId = this.stringOrNull(profileObject.deputyUserId);
  const apiOrigin = this.deputyAuthority(
    authority?.deputyApiOrigin ??
      this.stringOrNull(profileObject.deputyApiOrigin) ??
      "",
  ).apiOrigin;
  if (!userId) {
    throw new BadRequestException("Deputy connected-user binding is invalid");
  }
  return {
    provider: "deputy",
    connectorStandardVersion: "v1",
    oauthFlow: "authorization_code_rotating_refresh_install_authority_binding",
    tokenStatus: "valid",
    clientId,
    deputyUserId: userId,
    deputyApiOrigin: apiOrigin,
    displayName:
      this.stringOrNull(profileObject.DisplayName) ??
      this.stringOrNull(profileObject.Name) ??
      this.stringOrNull(profileObject.Email) ??
      this.stringOrNull(profileObject.email) ??
      userId,
    email:
      this.stringOrNull(profileObject.Email) ??
      this.stringOrNull(profileObject.email),
    grantedScopes,
    railwayCallbackOnly: true,
    stateVerified: true,
    userVerified: true,
    customerInstallBound: true,
    rotatingRefreshRequired: true,
    fixedEndpointsOnly: true,
    maxRequestBytes: 2_000_000,
    maxResponseBytes: 2_500_000,
    providerMaximumRecords: 500,
    automaticPagination: false,
    privilegedHrOnboardingApiEnabled: false,
    provisioningApiEnabled: false,
    rawToolsEnabled: false,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler088: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  authority,
) {
  const userId = this.stringOrNull(profileObject.nationBuilderUserId);
  const nationSlug = this.normalizeNationBuilderNationSlug(
    authority?.nationBuilderNationSlug ??
      this.stringOrNull(profileObject.nationBuilderNationSlug) ??
      "",
  );
  if (!userId) {
    throw new BadRequestException(
      "NationBuilder connected-admin binding is invalid",
    );
  }
  return {
    provider: "nationbuilder",
    connectorStandardVersion: "v1",
    oauthFlow: "authorization_code_pkce_rotating_refresh_nation_bound",
    tokenStatus: "valid",
    clientId,
    nationBuilderUserId: userId,
    nationBuilderNationSlug: nationSlug,
    displayName: userId,
    grantedScopes,
    railwayCallbackOnly: true,
    stateVerified: true,
    userVerified: true,
    nationBound: true,
    rotatingRefreshRequired: true,
    fixedEndpointsOnly: true,
    pinnedOperationCount: 190,
    readOperationCount: 82,
    mutationOperationCount: 108,
    maxRequestBytes: 2_000_000,
    maxResponseBytes: 2_500_000,
    automaticPagination: false,
    rawToolsEnabled: false,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler089: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  authority,
) {
  const userId = this.stringOrNull(profileObject.egnyteUserId);
  const domain = this.normalizeEgnyteDomain(
    authority?.egnyteDomain ??
      this.stringOrNull(profileObject.egnyteDomain) ??
      "",
  );
  if (!userId) {
    throw new BadRequestException("Egnyte connected-user binding is invalid");
  }
  return {
    provider: "egnyte",
    connectorStandardVersion: "v1",
    oauthFlow: "public_customer_domain_implicit_bearer",
    tokenStatus: "valid",
    clientId,
    egnyteUserId: userId,
    egnyteDomain: domain,
    displayName:
      this.stringOrNull(profileObject.name) ??
      this.stringOrNull(profileObject.username) ??
      this.stringOrNull(profileObject.email) ??
      userId,
    email: this.stringOrNull(profileObject.email),
    grantedScopes,
    railwayCallbackOnly: true,
    stateVerified: true,
    userVerified: true,
    customerDomainBound: true,
    fixedEndpointsOnly: true,
    pinnedOperationCount: 168,
    readOperationCount: 71,
    mutationOperationCount: 97,
    maxUploadBytes: 2_000_000,
    maxResponseBytes: 2_500_000,
    automaticPagination: false,
    rawToolsEnabled: false,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler090: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  authority,
) {
  const userId = this.stringOrNull(profileObject.bynderUserId);
  const portalOrigin = this.normalizeBynderPortal(
    authority?.bynderPortalOrigin ??
      this.stringOrNull(profileObject.bynderPortalOrigin) ??
      "",
  );
  if (!userId) {
    throw new BadRequestException("Bynder connected-user binding is invalid");
  }
  return {
    provider: "bynder",
    connectorStandardVersion: "v1",
    oauthFlow: "customer_owned_confidential_authorization_code_refresh",
    tokenStatus: "valid",
    clientId,
    bynderUserId: userId,
    bynderPortalOrigin: portalOrigin,
    displayName:
      this.stringOrNull(profileObject.name) ??
      this.stringOrNull(profileObject.username) ??
      this.stringOrNull(profileObject.email) ??
      userId,
    email: this.stringOrNull(profileObject.email),
    grantedScopes,
    railwayCallbackOnly: true,
    stateVerified: true,
    userVerified: true,
    customerAuthorityBound: true,
    fixedEndpointsOnly: true,
    maxRequestBytes: 5_000_000,
    maxResponseBytes: 10_000_000,
    automaticPagination: false,
    rawToolsEnabled: false,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler091: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  authority,
) {
  const userId = this.stringOrNull(profileObject.cantoUserId);
  const accountOrigin = this.normalizeCantoAccount(
    authority?.cantoAccountOrigin ??
      this.stringOrNull(profileObject.cantoAccountOrigin) ??
      "",
  );
  if (!userId)
    throw new BadRequestException("Canto connected-user binding is invalid");
  return {
    provider: "canto",
    connectorStandardVersion: "v1",
    oauthFlow: "customer_owned_confidential_authorization_code_refresh",
    tokenStatus: "valid",
    clientId,
    cantoUserId: userId,
    cantoAccountOrigin: accountOrigin,
    displayName:
      this.stringOrNull(profileObject.name) ??
      this.stringOrNull(profileObject.username) ??
      this.stringOrNull(profileObject.email) ??
      userId,
    email: this.stringOrNull(profileObject.email),
    grantedScopes,
    railwayCallbackOnly: true,
    stateVerified: true,
    userVerified: true,
    customerAuthorityBound: true,
    fixedEndpointsOnly: true,
    maxRequestBytes: 5_000_000,
    maxResponseBytes: 10_000_000,
    automaticPagination: false,
    rawToolsEnabled: false,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler092: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  authority,
) {
  const userId = this.stringOrNull(profileObject.msProjectUserId);
  const environmentOrigin = this.normalizeMsProjectEnvironment(
    authority?.msProjectEnvironmentOrigin ??
      this.stringOrNull(profileObject.msProjectEnvironmentOrigin) ??
      "",
  );
  if (!userId)
    throw new BadRequestException(
      "Microsoft Project connected-user binding is invalid",
    );
  return {
    provider: "ms-project",
    connectorStandardVersion: "v1",
    oauthFlow:
      "relay_owned_microsoft_multi_tenant_pkce_environment_delegated_refresh",
    tokenStatus: "valid",
    clientId,
    msProjectUserId: userId,
    msProjectEnvironmentOrigin: environmentOrigin,
    displayName: `Microsoft Project · ${new URL(environmentOrigin).hostname}`,
    grantedScopes,
    railwayCallbackOnly: true,
    stateVerified: true,
    userVerified: true,
    environmentBound: true,
    fixedEntitiesOnly: true,
    fixedScheduleActionsOnly: true,
    maxRequestBytes: 1_000_000,
    maxResponseBytes: 10_000_000,
    maximumRows: 100,
    automaticPagination: false,
    rawToolsEnabled: false,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler093: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const userId = this.stringOrNull(profileObject.onedriveUserId);
  const driveId = this.stringOrNull(profileObject.onedriveDriveId);
  if (!userId || !driveId)
    throw new BadRequestException(
      "OneDrive signed-in user or own-drive binding is invalid",
    );
  return {
    provider: "onedrive",
    connectorStandardVersion: "v1",
    oauthFlow:
      "relay_owned_microsoft_multi_tenant_authorization_code_pkce_refresh",
    tokenStatus: "valid",
    clientId,
    onedriveUserId: userId,
    onedriveDriveId: driveId,
    onedriveDriveName: this.stringOrNull(profileObject.onedriveDriveName),
    onedriveDriveType: this.stringOrNull(profileObject.onedriveDriveType),
    displayName:
      this.stringOrNull(profileObject.displayName) ??
      this.stringOrNull(profileObject.userPrincipalName) ??
      "OneDrive account",
    email:
      this.stringOrNull(profileObject.mail) ??
      this.stringOrNull(profileObject.userPrincipalName),
    grantedScopes,
    railwayCallbackOnly: true,
    stateVerified: true,
    pkceS256: true,
    userVerified: true,
    signedInOwnDriveBound: true,
    metadataOnly: true,
    contentDownloadEnabled: false,
    sharedRemoteEnabled: false,
    writesEnabled: false,
    automaticPagination: false,
    rawToolsEnabled: false,
    maxResults: 25,
    maxResponseBytes: 1_000_000,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler094: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  authority,
) {
  const userId = this.stringOrNull(profileObject.dynamics365SalesUserId);
  const environmentOrigin =
    this.microsoftDynamics365SalesApi.normalizeEnvironment(
      authority?.dynamics365SalesEnvironmentOrigin ??
        this.stringOrNull(profileObject.dynamics365SalesEnvironmentOrigin) ??
        "",
    );
  if (!userId)
    throw new BadRequestException(
      "Microsoft Dynamics 365 Sales connected-user binding is invalid",
    );
  return {
    provider: "microsoft-dynamics-365-sales",
    connectorStandardVersion: "v1",
    oauthFlow:
      "relay_owned_microsoft_multi_tenant_pkce_environment_delegated_refresh",
    tokenStatus: "valid",
    clientId,
    dynamics365SalesUserId: userId,
    dynamics365SalesOrganizationId: this.stringOrNull(
      profileObject.dynamics365SalesOrganizationId,
    ),
    dynamics365SalesBusinessUnitId: this.stringOrNull(
      profileObject.dynamics365SalesBusinessUnitId,
    ),
    dynamics365SalesEnvironmentOrigin: environmentOrigin,
    displayName: `Dynamics 365 Sales · ${new URL(environmentOrigin).hostname}`,
    grantedScopes,
    railwayCallbackOnly: true,
    stateVerified: true,
    userVerified: true,
    environmentBound: true,
    fixedEndpointsOnly: true,
    identityOnly: true,
    maxResponseBytes: 100_000,
    automaticPagination: false,
    rawToolsEnabled: false,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler095: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  authority,
) {
  const userId = this.stringOrNull(
    profileObject.dynamics365CustomerServiceUserId,
  );
  const environmentOrigin =
    this.microsoftDynamics365CustomerServiceApi.normalizeEnvironment(
      authority?.dynamics365CustomerServiceEnvironmentOrigin ??
        this.stringOrNull(
          profileObject.dynamics365CustomerServiceEnvironmentOrigin,
        ) ??
        "",
    );
  if (!userId)
    throw new BadRequestException(
      "Microsoft Dynamics 365 Customer Service connected-user binding is invalid",
    );
  return {
    provider: "microsoft-dynamics-365-customer-service",
    connectorStandardVersion: "v1",
    oauthFlow:
      "relay_owned_microsoft_multi_tenant_pkce_environment_delegated_refresh",
    tokenStatus: "valid",
    clientId,
    dynamics365CustomerServiceUserId: userId,
    dynamics365CustomerServiceOrganizationId: this.stringOrNull(
      profileObject.dynamics365CustomerServiceOrganizationId,
    ),
    dynamics365CustomerServiceBusinessUnitId: this.stringOrNull(
      profileObject.dynamics365CustomerServiceBusinessUnitId,
    ),
    dynamics365CustomerServiceEnvironmentOrigin: environmentOrigin,
    displayName: `Dynamics 365 Customer Service · ${new URL(environmentOrigin).hostname}`,
    grantedScopes,
    railwayCallbackOnly: true,
    stateVerified: true,
    userVerified: true,
    environmentBound: true,
    fixedEndpointsOnly: true,
    identityOnly: true,
    maxResponseBytes: 100_000,
    automaticPagination: false,
    rawToolsEnabled: false,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler096: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  authority,
) {
  const environmentName =
    this.microsoftDynamics365BusinessCentralApi.normalizeEnvironmentName(
      authority?.businessCentralEnvironmentName ??
        this.stringOrNull(profileObject.businessCentralEnvironmentName) ??
        "",
    );
  const companyCount = Number(profileObject.businessCentralCompanyCount);
  if (!Number.isInteger(companyCount) || companyCount < 0)
    throw new BadRequestException(
      "Microsoft Dynamics 365 Business Central environment validation is invalid",
    );
  return {
    provider: "microsoft-dynamics-365-business-central",
    connectorStandardVersion: "v1",
    oauthFlow:
      "relay_owned_microsoft_multi_tenant_pkce_environment_delegated_refresh",
    tokenStatus: "valid",
    clientId,
    businessCentralEnvironmentName: environmentName,
    businessCentralCompanyCount: companyCount,
    displayName: `Business Central · ${environmentName}`,
    grantedScopes,
    railwayCallbackOnly: true,
    stateVerified: true,
    environmentBound: true,
    fixedEndpointsOnly: true,
    boundedCompanyDirectoryOnly: true,
    maxResponseBytes: 250_000,
    maximumRows: 50,
    automaticPagination: false,
    rawToolsEnabled: false,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler097: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const userId = this.stringOrNull(profileObject.microsoftEntraIdUserId);
  if (!userId)
    throw new BadRequestException(
      "Microsoft Entra ID connected-user binding is invalid",
    );
  return {
    provider: "microsoft-entra-id",
    connectorStandardVersion: "v1",
    oauthFlow: "relay_owned_microsoft_multi_tenant_pkce_delegated_refresh",
    tokenStatus: "valid",
    clientId,
    microsoftEntraIdUserId: userId,
    microsoftEntraIdDisplayName: this.stringOrNull(
      profileObject.microsoftEntraIdDisplayName,
    ),
    microsoftEntraIdUserPrincipalName: this.stringOrNull(
      profileObject.microsoftEntraIdUserPrincipalName,
    ),
    microsoftEntraIdUserType: this.stringOrNull(
      profileObject.microsoftEntraIdUserType,
    ),
    displayName:
      this.stringOrNull(profileObject.microsoftEntraIdDisplayName) ??
      "Microsoft Entra ID",
    grantedScopes,
    railwayCallbackOnly: true,
    stateVerified: true,
    userVerified: true,
    signedInIdentityOnly: true,
    fixedEndpointsOnly: true,
    maxResponseBytes: 100_000,
    automaticPagination: false,
    rawToolsEnabled: false,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler098: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const userId = this.stringOrNull(profileObject.yammerUserId);
  if (!userId)
    throw new BadRequestException("Yammer connected-user binding is invalid");
  return {
    provider: "yammer",
    connectorStandardVersion: "v1",
    oauthFlow: "relay_owned_microsoft_multi_tenant_pkce_delegated_refresh",
    tokenStatus: "valid",
    clientId,
    yammerUserId: userId,
    yammerFullName: this.stringOrNull(profileObject.yammerFullName),
    yammerEmail: this.stringOrNull(profileObject.yammerEmail),
    yammerNetworkId: this.stringOrNull(profileObject.yammerNetworkId),
    displayName:
      this.stringOrNull(profileObject.yammerFullName) ??
      this.stringOrNull(profileObject.yammerEmail) ??
      `Yammer user ${userId}`,
    grantedScopes,
    railwayCallbackOnly: true,
    stateVerified: true,
    userVerified: true,
    signedInIdentityOnly: true,
    fixedEndpointsOnly: true,
    maxResponseBytes: 100_000,
    automaticPagination: false,
    rawToolsEnabled: false,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler099: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const providerCount = Number(profileObject.vivaLearningProviderCount);
  if (
    !Number.isInteger(providerCount) ||
    providerCount < 0 ||
    providerCount > 50
  )
    throw new BadRequestException(
      "Viva Learning provider-directory validation is invalid",
    );
  return {
    provider: "viva-learning",
    connectorStandardVersion: "v1",
    oauthFlow: "relay_owned_microsoft_multi_tenant_pkce_delegated_refresh",
    tokenStatus: "valid",
    clientId,
    vivaLearningProviderCount: providerCount,
    vivaLearningProviderDirectoryTruncated:
      profileObject.vivaLearningProviderDirectoryTruncated === true,
    displayName: `Viva Learning · ${providerCount} provider${providerCount === 1 ? "" : "s"}`,
    grantedScopes,
    railwayCallbackOnly: true,
    stateVerified: true,
    tenantDirectoryVerified: true,
    fixedEndpointsOnly: true,
    boundedProviderDirectoryOnly: true,
    maximumRows: 50,
    maxResponseBytes: 250_000,
    automaticPagination: false,
    rawToolsEnabled: false,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler100: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const siteId = this.stringOrNull(profileObject.sharepointSelectedSiteId);
  const selected = this.normalizeSharePointSite(
    this.stringOrNull(profileObject.sharepointSiteWebUrl) ?? "",
  );
  if (
    !siteId ||
    !/^[a-z0-9.-]{1,253},[A-Za-z0-9-]{1,64},[A-Za-z0-9-]{1,64}$/.test(siteId) ||
    profileObject.sharepointSiteGrantVerified !== true
  )
    throw new BadRequestException(
      "SharePoint selected-site binding is invalid",
    );
  return {
    provider: "sharepoint",
    connectorStandardVersion: "v1",
    oauthFlow:
      "relay_owned_microsoft_organizations_authorization_code_pkce_refresh",
    tokenStatus: "valid",
    clientId,
    sharepointSelectedSiteId: siteId,
    sharepointSiteWebUrl: selected.webUrl,
    sharepointSiteHostname: selected.hostname,
    sharepointSiteRelativePath: selected.relativePath,
    sharepointSiteDisplayName:
      this.stringOrNull(profileObject.displayName) ?? selected.hostname,
    displayName:
      this.stringOrNull(profileObject.displayName) ?? selected.hostname,
    grantedScopes,
    railwayCallbackOnly: true,
    stateVerified: true,
    pkceS256: true,
    workSchoolOnly: true,
    delegatedOnly: true,
    selectedSiteOnly: true,
    siteGrantVerified: true,
    metadataOnly: true,
    tenantSearchEnabled: false,
    listItemsFieldsEnabled: false,
    contentEnabled: false,
    permissionsAdminEnabled: false,
    writesEnabled: false,
    automaticPagination: false,
    rawToolsEnabled: false,
    maxResults: 25,
    maxResponseBytes: 1_000_000,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler101: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  if (profileObject.microsoftPlannerValidated !== true)
    throw new BadRequestException(
      "Microsoft Planner work-account binding is invalid",
    );
  return {
    provider: "microsoft-planner",
    connectorStandardVersion: "v1",
    oauthFlow:
      "relay_owned_microsoft_organizations_authorization_code_pkce_refresh",
    tokenStatus: "valid",
    clientId,
    displayName: "Microsoft Planner work account",
    grantedScopes,
    railwayCallbackOnly: true,
    stateVerified: true,
    pkceS256: true,
    workSchoolOnly: true,
    delegatedOnly: true,
    plannerAuthorityValidated: true,
    assignmentIdentitiesEnabled: false,
    detailsEnabled: false,
    groupDirectoryEnabled: false,
    writesEnabled: false,
    applicationPermissionsEnabled: false,
    automaticPagination: false,
    rawToolsEnabled: false,
    maxResults: 25,
    maxResponseBytes: 1_000_000,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler102: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  if (profileObject.microsoftToDoValidated !== true)
    throw new BadRequestException(
      "Microsoft To Do signed-in account binding is invalid",
    );
  return {
    provider: "microsoft-to-do",
    connectorStandardVersion: "v1",
    oauthFlow: "relay_owned_microsoft_common_authorization_code_pkce_refresh",
    tokenStatus: "valid",
    clientId,
    displayName: "Microsoft To Do account",
    grantedScopes,
    railwayCallbackOnly: true,
    stateVerified: true,
    pkceS256: true,
    personalAccountsSupported: true,
    delegatedSelfOnly: true,
    todoAuthorityValidated: true,
    sharedTasksEnabled: false,
    taskBodyEnabled: false,
    relatedContentEnabled: false,
    deltaExtensionsEnabled: false,
    writesEnabled: false,
    applicationPermissionsEnabled: false,
    automaticPagination: false,
    rawToolsEnabled: false,
    maxResults: 25,
    maxResponseBytes: 1_000_000,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler103: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  if (profileObject.oneNoteValidated !== true)
    throw new BadRequestException(
      "OneNote signed-in account binding is invalid",
    );
  return {
    provider: "onenote",
    connectorStandardVersion: "v1",
    oauthFlow: "relay_owned_microsoft_common_authorization_code_pkce_refresh",
    tokenStatus: "valid",
    clientId,
    displayName: "OneNote account",
    grantedScopes,
    railwayCallbackOnly: true,
    stateVerified: true,
    pkceS256: true,
    personalAccountsSupported: true,
    delegatedSelfOnly: true,
    metadataOnly: true,
    oneNoteAuthorityValidated: true,
    pageContentEnabled: false,
    resourcesMediaOCREnabled: false,
    sharedGroupSiteEnabled: false,
    searchClassStaffEnabled: false,
    writesEnabled: false,
    permissionsWebhooksEnabled: false,
    applicationPermissionsEnabled: false,
    automaticPagination: false,
    rawToolsEnabled: false,
    maxResults: 25,
    maxResponseBytes: 1_000_000,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler104: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const businessId = this.stringOrNull(
    profileObject.microsoftBookingsSelectedBusinessId,
  );
  if (profileObject.microsoftBookingsValidated !== true || !businessId)
    throw new BadRequestException(
      "Microsoft Bookings selected-business binding is invalid",
    );
  return {
    provider: "microsoft-bookings",
    connectorStandardVersion: "v1",
    oauthFlow:
      "relay_owned_microsoft_organizations_authorization_code_pkce_refresh",
    tokenStatus: "valid",
    clientId,
    displayName:
      this.stringOrNull(
        profileObject.microsoftBookingsSelectedBusinessDisplayName,
      ) ?? "Selected Microsoft Bookings business",
    grantedScopes,
    railwayCallbackOnly: true,
    stateVerified: true,
    pkceS256: true,
    workSchoolOnly: true,
    selectedBusinessId: businessId,
    selectedBusinessDisplayName: this.stringOrNull(
      profileObject.microsoftBookingsSelectedBusinessDisplayName,
    ),
    selectedBusinessVerified: true,
    privacyScrubbed: true,
    customerPIIEnabled: false,
    staffIdentityEnabled: false,
    notesJoinURLsEnabled: false,
    writesEnabled: false,
    applicationPermissionsEnabled: false,
    automaticPagination: false,
    rawToolsEnabled: false,
    maxResults: 25,
    maxCalendarRangeDays: 7,
    maxResponseBytes: 1_000_000,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler105: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const workspaceId = this.stringOrNull(
    profileObject.microsoftPowerBISelectedWorkspaceId,
  );
  if (profileObject.microsoftPowerBIValidated !== true || !workspaceId)
    throw new BadRequestException(
      "Microsoft Power BI selected-workspace binding is invalid",
    );
  return {
    provider: "microsoft-power-bi",
    connectorStandardVersion: "v1",
    oauthFlow:
      "relay_owned_microsoft_organizations_authorization_code_pkce_refresh",
    tokenStatus: "valid",
    clientId,
    displayName:
      this.stringOrNull(profileObject.microsoftPowerBISelectedWorkspaceName) ??
      "Selected Power BI workspace",
    grantedScopes,
    railwayCallbackOnly: true,
    stateVerified: true,
    pkceS256: true,
    workSchoolOnly: true,
    selectedWorkspaceId: workspaceId,
    selectedWorkspaceName: this.stringOrNull(
      profileObject.microsoftPowerBISelectedWorkspaceName,
    ),
    selectedWorkspaceVerified: true,
    metadataOnly: true,
    reportContentEnabled: false,
    embedURLsTokensEnabled: false,
    datasetQueriesEnabled: false,
    identitiesEnabled: false,
    refreshGatewayAdminEnabled: false,
    exportsDownloadsEnabled: false,
    writesEnabled: false,
    applicationPermissionsEnabled: false,
    automaticPagination: false,
    rawToolsEnabled: false,
    maxResults: 25,
    maxResponseBytes: 1_000_000,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler106: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const environmentOrigin = this.stringOrNull(
    profileObject.microsoftDynamics365EnvironmentOrigin,
  );
  const organizationId = this.stringOrNull(
    profileObject.microsoftDynamics365OrganizationId,
  );
  if (
    profileObject.microsoftDynamics365Validated !== true ||
    profileObject.microsoftDynamics365StandardSalesTablesVerified !== true ||
    !environmentOrigin ||
    !organizationId
  )
    throw new BadRequestException(
      "Microsoft Dynamics 365 selected-environment binding is invalid",
    );
  const selected = this.normalizeMicrosoftDynamics365Binding({
    environmentOrigin,
    environmentDisplayName:
      profileObject.microsoftDynamics365EnvironmentDisplayName,
  });
  return {
    provider: "microsoft-dynamics-365",
    connectorStandardVersion: "v1",
    oauthFlow:
      "relay_owned_microsoft_organizations_authorization_code_pkce_environment_refresh",
    tokenStatus: "valid",
    clientId,
    displayName: selected.environmentDisplayName,
    grantedScopes,
    railwayCallbackOnly: true,
    stateVerified: true,
    pkceS256: true,
    workSchoolOnly: true,
    environmentOrigin: selected.environmentOrigin,
    apiRoot: `${selected.environmentOrigin}/api/data/v9.2`,
    environmentDisplayName: selected.environmentDisplayName,
    organizationId,
    selectedEnvironmentVerified: true,
    standardSalesTablesVerified: true,
    getOnly: true,
    fixedSelectOnly: true,
    customTablesEnabled: false,
    identitiesContactsEnabled: false,
    searchExpandFetchXMLEnabled: false,
    schemaActionsBatchEnabled: false,
    writesEnabled: false,
    applicationPermissionsEnabled: false,
    exportsEnabled: false,
    automaticPagination: false,
    rawToolsEnabled: false,
    maxResults: 25,
    maxResponseBytes: 1_000_000,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler107: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const networkId = this.stringOrNull(
    profileObject.microsoftVivaEngageNetworkId,
  );
  const currentUserId = this.stringOrNull(
    profileObject.microsoftVivaEngageCurrentUserId,
  );
  const communityId = this.stringOrNull(
    profileObject.microsoftVivaEngageSelectedCommunityId,
  );
  if (
    profileObject.microsoftVivaEngageValidated !== true ||
    profileObject.microsoftVivaEngageSelectedCommunityVerified !== true ||
    !networkId ||
    !currentUserId ||
    !communityId
  )
    throw new BadRequestException(
      "Microsoft Viva Engage selected-community binding is invalid",
    );
  const selected = this.normalizeMicrosoftVivaEngageBinding({
    communityId,
    communityName: profileObject.microsoftVivaEngageSelectedCommunityName,
  });
  return {
    provider: "microsoft-viva-engage",
    connectorStandardVersion: "v1",
    oauthFlow:
      "relay_owned_microsoft_organizations_authorization_code_pkce_viva_engage_refresh",
    tokenStatus: "valid",
    clientId,
    displayName: selected.communityName,
    grantedScopes,
    railwayCallbackOnly: true,
    stateVerified: true,
    pkceS256: true,
    workSchoolOnly: true,
    delegatedOnly: true,
    networkId,
    networkName: this.stringOrNull(
      profileObject.microsoftVivaEngageNetworkName,
    ),
    currentUserId,
    currentUserDisplayName: this.stringOrNull(
      profileObject.microsoftVivaEngageCurrentUserDisplayName,
    ),
    selectedCommunityId: selected.communityId,
    selectedCommunityName: selected.communityName,
    selectedCommunityVerified: true,
    getOnly: true,
    privateMessagesEnabled: false,
    globalFollowingFeedsEnabled: false,
    identitiesMembersEnabled: false,
    attachmentsFilesEnabled: false,
    searchTopicsExportsEnabled: false,
    writesEnabled: false,
    applicationPermissionsEnabled: false,
    automaticPagination: false,
    rawToolsEnabled: false,
    maxResults: 25,
    maxResponseBytes: 1_000_000,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler108: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  if (profileObject.zoomValidated !== true)
    throw new BadRequestException(
      "Zoom signed-in user meeting binding is invalid",
    );
  return {
    provider: "zoom",
    connectorStandardVersion: "v1",
    oauthFlow: "relay_owned_zoom_user_managed_authorization_code_refresh",
    tokenStatus: "valid",
    clientId,
    displayName: "Zoom user",
    grantedScopes,
    railwayCallbackOnly: true,
    stateVerified: true,
    userManagedOnly: true,
    selfUserOnly: true,
    metadataOnly: true,
    joinStartRegistrationCredentialsEnabled: false,
    peopleContentEnabled: false,
    recordingsTranscriptsChatEnabled: false,
    summariesAssetsPollsMediaEnabled: false,
    otherZoomProductsEnabled: false,
    adminEnabled: false,
    writesEnabled: false,
    webhooksEnabled: false,
    automaticPagination: false,
    rawToolsEnabled: false,
    maxResults: 25,
    maxResponseBytes: 1_000_000,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler109: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const siteId = this.stringOrNull(profileObject.microsoftListsSelectedSiteId);
  const listId = this.stringOrNull(profileObject.microsoftListsSelectedListId);
  const allowedFieldNames = Array.isArray(
    profileObject.microsoftListsAllowedFieldNames,
  )
    ? profileObject.microsoftListsAllowedFieldNames.filter(
        (value): value is string => typeof value === "string",
      )
    : [];
  if (
    profileObject.microsoftListsGrantVerified !== true ||
    !siteId ||
    !listId ||
    allowedFieldNames.length === 0
  )
    throw new BadRequestException(
      "Microsoft Lists selected-list binding is invalid",
    );
  return {
    provider: "microsoft-lists",
    connectorStandardVersion: "v1",
    oauthFlow:
      "relay_owned_microsoft_organizations_authorization_code_pkce_refresh",
    tokenStatus: "valid",
    clientId,
    displayName:
      this.stringOrNull(profileObject.microsoftListsSelectedListDisplayName) ??
      "Selected Microsoft List",
    grantedScopes,
    railwayCallbackOnly: true,
    stateVerified: true,
    pkceS256: true,
    delegatedOnly: true,
    workSchoolOnly: true,
    selectedListOnly: true,
    listGrantVerified: true,
    selectedSiteId: siteId,
    selectedListId: listId,
    selectedListWebUrl: this.stringOrNull(
      profileObject.microsoftListsSelectedListWebUrl,
    ),
    selectedListDisplayName: this.stringOrNull(
      profileObject.microsoftListsSelectedListDisplayName,
    ),
    allowedFieldNames,
    unapprovedFieldsEnabled: false,
    attachmentsDriveEnabled: false,
    identitiesPermissionsEnabled: false,
    writesEnabled: false,
    deltaSearchExportEnabled: false,
    applicationPermissionsEnabled: false,
    automaticPagination: false,
    rawToolsEnabled: false,
    maxResults: 25,
    maxResponseBytes: 1_000_000,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler110: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  authority,
) {
  const userId = this.stringOrNull(profileObject.frontifyUserId);
  const accountOrigin = this.normalizeFrontifyAccount(
    authority?.frontifyAccountOrigin ??
      this.stringOrNull(profileObject.frontifyAccountOrigin) ??
      "",
  );
  if (!userId)
    throw new BadRequestException("Frontify connected-user binding is invalid");
  return {
    provider: "frontify",
    connectorStandardVersion: "v1",
    oauthFlow: "customer_owned_confidential_pkce_authorization_code_refresh",
    tokenStatus: "valid",
    clientId,
    frontifyUserId: userId,
    frontifyAccountOrigin: accountOrigin,
    displayName:
      this.stringOrNull(profileObject.name) ??
      this.stringOrNull(profileObject.email) ??
      userId,
    email: this.stringOrNull(profileObject.email),
    grantedScopes,
    railwayCallbackOnly: true,
    stateVerified: true,
    userVerified: true,
    customerAuthorityBound: true,
    fixedEndpointsOnly: true,
    maxRequestBytes: 1_000_000,
    maxResponseBytes: 10_000_000,
    automaticPagination: false,
    rawToolsEnabled: false,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler111: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  authority,
) {
  const userId = this.stringOrNull(profileObject.assetBankUserId);
  const baseUrl = this.normalizeAssetBankSite(
    authority?.assetBankBaseUrl ??
      this.stringOrNull(profileObject.assetBankBaseUrl) ??
      "",
  );
  if (!userId)
    throw new BadRequestException(
      "Asset Bank connected-user binding is invalid",
    );
  return {
    provider: "asset-bank",
    connectorStandardVersion: "v1",
    oauthFlow: "customer_owned_confidential_authorization_code_refresh",
    tokenStatus: "valid",
    clientId,
    assetBankUserId: userId,
    assetBankBaseUrl: baseUrl,
    displayName:
      this.stringOrNull(profileObject.name) ??
      this.stringOrNull(profileObject.username) ??
      this.stringOrNull(profileObject.email) ??
      userId,
    email: this.stringOrNull(profileObject.email),
    grantedScopes,
    railwayCallbackOnly: true,
    stateVerified: true,
    userVerified: true,
    customerAuthorityBound: true,
    fixedEndpointsOnly: true,
    maxRequestBytes: 5_000_000,
    maxResponseBytes: 10_000_000,
    automaticPagination: false,
    rawToolsEnabled: false,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler112: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const userId =
    typeof profileObject.id === "number"
      ? String(profileObject.id)
      : this.stringOrNull(profileObject.id);
  if (!userId)
    throw new BadRequestException(
      "MindMeister connected-user binding is invalid",
    );
  return {
    provider: "mindmeister",
    connectorStandardVersion: "v1",
    oauthFlow: "confidential_authorization_code_no_refresh",
    tokenStatus: "valid",
    clientId,
    mindMeisterUserId: userId,
    displayName:
      this.stringOrNull(profileObject.name) ??
      this.stringOrNull(profileObject.full_name) ??
      "MindMeister user",
    email: this.stringOrNull(profileObject.email),
    grantedScopes,
    railwayCallbackOnly: true,
    stateVerified: true,
    userVerified: true,
    fixedEndpointsOnly: true,
    rawToolsEnabled: false,
    lastHealthCheck: null,
  };
};

export const OAuthProviderMetadataHandlers04: OAuthProviderMetadataHandlerMap =
  Object.freeze({
    akiflow: oauthProviderMetadataHandler083,
    sunsama: oauthProviderMetadataHandler084,
    "remember-the-milk": oauthProviderMetadataHandler085,
    sharefile: oauthProviderMetadataHandler086,
    deputy: oauthProviderMetadataHandler087,
    nationbuilder: oauthProviderMetadataHandler088,
    egnyte: oauthProviderMetadataHandler089,
    bynder: oauthProviderMetadataHandler090,
    canto: oauthProviderMetadataHandler091,
    "ms-project": oauthProviderMetadataHandler092,
    onedrive: oauthProviderMetadataHandler093,
    "microsoft-dynamics-365-sales": oauthProviderMetadataHandler094,
    "microsoft-dynamics-365-customer-service": oauthProviderMetadataHandler095,
    "microsoft-dynamics-365-business-central": oauthProviderMetadataHandler096,
    "microsoft-entra-id": oauthProviderMetadataHandler097,
    yammer: oauthProviderMetadataHandler098,
    "viva-learning": oauthProviderMetadataHandler099,
    sharepoint: oauthProviderMetadataHandler100,
    "microsoft-planner": oauthProviderMetadataHandler101,
    "microsoft-to-do": oauthProviderMetadataHandler102,
    onenote: oauthProviderMetadataHandler103,
    "microsoft-bookings": oauthProviderMetadataHandler104,
    "microsoft-power-bi": oauthProviderMetadataHandler105,
    "microsoft-dynamics-365": oauthProviderMetadataHandler106,
    "microsoft-viva-engage": oauthProviderMetadataHandler107,
    zoom: oauthProviderMetadataHandler108,
    "microsoft-lists": oauthProviderMetadataHandler109,
    frontify: oauthProviderMetadataHandler110,
    "asset-bank": oauthProviderMetadataHandler111,
    mindmeister: oauthProviderMetadataHandler112,
  });
