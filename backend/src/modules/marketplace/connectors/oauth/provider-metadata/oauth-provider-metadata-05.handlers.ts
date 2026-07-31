import type {
  OAuthProviderMetadataHandler,
  OAuthProviderMetadataHandlerMap,
} from "./oauth-provider-metadata-handler";
import type { MarketplaceConnectorOAuthService } from "../../connector-oauth.service";
import { BadRequestException } from "@nestjs/common";

const oauthProviderMetadataHandler113: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const cloudId = this.stringOrNull(profileObject.id);
  const siteUrl = this.stringOrNull(profileObject.url);
  if (!cloudId || !/^[A-Za-z0-9-]{1,100}$/.test(cloudId) || !siteUrl)
    throw new BadRequestException("Confluence site binding is invalid");
  return {
    provider: "confluence",
    connectorStandardVersion: "v1",
    oauthFlow: "confidential_authorization_code_refresh",
    tokenStatus: "valid",
    clientId,
    cloudId,
    siteUrl,
    siteName: this.stringOrNull(profileObject.name),
    displayName: this.stringOrNull(profileObject.name) ?? siteUrl,
    grantedScopes,
    railwayCallbackOnly: true,
    stateVerified: true,
    siteVerified: true,
    siteBound: true,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler114: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const site =
    profileObject.jiraSite &&
    typeof profileObject.jiraSite === "object" &&
    !Array.isArray(profileObject.jiraSite)
      ? (profileObject.jiraSite as Record<string, unknown>)
      : {};
  const user =
    profileObject.jiraUser &&
    typeof profileObject.jiraUser === "object" &&
    !Array.isArray(profileObject.jiraUser)
      ? (profileObject.jiraUser as Record<string, unknown>)
      : {};
  const cloudId = this.stringOrNull(site.id);
  const siteUrl = this.stringOrNull(site.url);
  const accountId =
    this.stringOrNull(user.account_id) ?? this.stringOrNull(user.accountId);
  if (
    !cloudId ||
    !/^[A-Za-z0-9-]{1,100}$/.test(cloudId) ||
    !siteUrl ||
    !accountId
  )
    throw new BadRequestException(
      `${appSlug === "jira" ? "Jira" : appSlug === "atlassian-compass" ? "Atlassian Compass" : "Jira Service Management"} site or user binding is invalid`,
    );
  return {
    provider: appSlug,
    connectorStandardVersion: "v1",
    oauthFlow:
      appSlug === "jira"
        ? "relay_owned_atlassian_resource_level_authorization_code_rotating_refresh"
        : appSlug === "atlassian-compass"
          ? "relay_owned_atlassian_compass_authorization_code_rotating_refresh"
          : "relay_owned_atlassian_jsm_resource_level_authorization_code_rotating_refresh",
    tokenStatus: "valid",
    clientId,
    cloudId,
    siteUrl,
    siteName: this.stringOrNull(site.name),
    accountId,
    displayName:
      this.stringOrNull(user.name) ?? this.stringOrNull(site.name) ?? siteUrl,
    email: this.stringOrNull(user.email),
    grantedScopes,
    railwayCallbackOnly: true,
    stateVerified: true,
    userVerified: true,
    siteVerified: true,
    siteBound: true,
    fixedEndpointsOnly: true,
    maxRequestBytes: 10_000_000,
    maxResponseBytes: 10_000_000,
    maximumRows: 100,
    automaticPagination: false,
    rawToolsEnabled: false,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler115: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const space =
    profileObject.space &&
    typeof profileObject.space === "object" &&
    !Array.isArray(profileObject.space)
      ? (profileObject.space as Record<string, unknown>)
      : {};
  const owner =
    profileObject.resource_owner &&
    typeof profileObject.resource_owner === "object" &&
    !Array.isArray(profileObject.resource_owner)
      ? (profileObject.resource_owner as Record<string, unknown>)
      : {};
  const application =
    profileObject.application &&
    typeof profileObject.application === "object" &&
    !Array.isArray(profileObject.application)
      ? (profileObject.application as Record<string, unknown>)
      : {};
  const workspaceId = this.stringOrNull(space.domain);
  const workspaceName = this.stringOrNull(space.name);
  const email = this.stringOrNull(owner.email);
  if (!workspaceId || !workspaceName || !email)
    throw new BadRequestException(
      "Productboard workspace or user binding is invalid",
    );
  return {
    provider: "productboard",
    connectorStandardVersion: "v1",
    oauthFlow:
      "relay_owned_confidential_authorization_code_pkce_rotating_refresh",
    tokenStatus: "valid",
    clientId,
    productboardApplicationId: this.stringOrNull(application.uid),
    productboardWorkspaceId: workspaceId,
    productboardWorkspaceName: workspaceName,
    displayName: `${workspaceName} · Productboard`,
    email,
    connectedUserName: this.stringOrNull(owner.name),
    grantedScopes,
    railwayCallbackOnly: true,
    stateVerified: true,
    pkceS256: true,
    userVerified: true,
    workspaceVerified: true,
    workspaceBound: true,
    fixedEndpointsOnly: true,
    maxRequestBytes: 2_000_000,
    maxResponseBytes: 10_000_000,
    maximumRows: 100,
    automaticPagination: false,
    rawToolsEnabled: false,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler116: OAuthProviderMetadataHandler = function (
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
  const userId =
    this.stringOrNull(user.id) ??
    this.stringOrNull(user.user_id) ??
    this.stringOrNull(user.email);
  if (!userId) throw new BadRequestException("Nifty user binding is invalid");
  const displayName =
    this.stringOrNull(user.name) ??
    this.stringOrNull(user.full_name) ??
    this.stringOrNull(user.email) ??
    "Nifty workspace";
  return {
    provider: "nifty",
    connectorStandardVersion: "v1",
    oauthFlow: "relay_owned_confidential_authorization_code_refresh",
    tokenStatus: "valid",
    clientId,
    niftyUserId: userId,
    displayName,
    email: this.stringOrNull(user.email),
    grantedScopes,
    railwayCallbackOnly: true,
    stateVerified: true,
    pkceS256: false,
    userVerified: true,
    fixedEndpointsOnly: true,
    maxRequestBytes: 10_000_000,
    maxResponseBytes: 10_000_000,
    maximumRows: 100,
    automaticPagination: false,
    rawToolsEnabled: false,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler117: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const personId =
    typeof profileObject.id === "number"
      ? String(profileObject.id)
      : this.stringOrNull(profileObject.id);
  if (!personId) {
    throw new BadRequestException("MeisterTask person binding is invalid");
  }
  return {
    provider: "meistertask",
    connectorStandardVersion: "v1",
    oauthFlow: "relay_owned_confidential_authorization_code",
    tokenStatus: "valid_non_expiring_or_provider_managed",
    clientId,
    meisterTaskPersonId: personId,
    displayName:
      this.stringOrNull(profileObject.name) ??
      this.stringOrNull(profileObject.email) ??
      "MeisterTask account",
    email: this.stringOrNull(profileObject.email),
    grantedScopes,
    railwayCallbackOnly: true,
    stateVerified: true,
    pkceS256: false,
    userVerified: true,
    fixedEndpointsOnly: true,
    maxRequestBytes: 10_000_000,
    maxResponseBytes: 10_000_000,
    maximumRows: 100,
    automaticPagination: false,
    rawToolsEnabled: false,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler118: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  authority,
) {
  const accountSubdomain =
    authority?.ahaAccountSubdomain ??
    this.stringOrNull(profileObject.ahaAccountSubdomain);
  const accountAuthority = this.ahaAuthority(accountSubdomain ?? "");
  const user =
    profileObject.user &&
    typeof profileObject.user === "object" &&
    !Array.isArray(profileObject.user)
      ? (profileObject.user as Record<string, unknown>)
      : profileObject;
  const userId =
    this.stringOrNull(user.id) ??
    this.stringOrNull(user.email) ??
    this.stringOrNull(user.name);
  if (!userId)
    throw new BadRequestException("Aha! connected-user binding is invalid");
  return {
    provider: "aha",
    connectorStandardVersion: "v1",
    oauthFlow: "relay_owned_confidential_authorization_code_no_refresh",
    tokenStatus: "valid",
    clientId,
    ahaAccountSubdomain: accountAuthority.accountSubdomain,
    ahaApiOrigin: accountAuthority.apiOrigin,
    ahaUserId: userId,
    displayName:
      this.stringOrNull(user.name) ??
      `${accountAuthority.accountSubdomain}.aha.io`,
    email: this.stringOrNull(user.email),
    grantedScopes,
    railwayCallbackOnly: true,
    stateVerified: true,
    userVerified: true,
    accountVerified: true,
    accountBound: true,
    fixedEndpointsOnly: true,
    maxRequestBytes: 2_000_000,
    maxResponseBytes: 10_000_000,
    maximumRows: 100,
    automaticPagination: false,
    rawToolsEnabled: false,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler119: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const userId = this.stringOrNull(profileObject.id);
  const companyId = this.stringOrNull(profileObject.company_id);
  if (!userId || !companyId)
    throw new BadRequestException("Quip user/company binding is invalid");
  return {
    provider: "quip",
    connectorStandardVersion: "v1",
    oauthFlow: "customer_owned_confidential_authorization_code_refresh",
    tokenStatus: "valid",
    clientId,
    quipUserId: userId,
    quipCompanyId: companyId,
    displayName: this.stringOrNull(profileObject.name) ?? "Quip user",
    email: this.stringArray(profileObject.emails)[0] ?? null,
    companyUrl: this.stringOrNull(profileObject.url),
    grantedScopes,
    railwayCallbackOnly: true,
    stateVerified: true,
    userVerified: true,
    companyVerified: true,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler120: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const userId = this.stringOrNull(profileObject.id);
  if (!userId)
    throw new BadRequestException("Reflect connected-user binding is invalid");
  return {
    provider: "reflect",
    connectorStandardVersion: "v1",
    oauthFlow: "authorization_code_pkce",
    tokenStatus: "valid",
    clientId,
    reflectUserId: userId,
    displayName:
      this.stringOrNull(profileObject.name) ??
      this.stringOrNull(profileObject.email) ??
      "Reflect user",
    email: this.stringOrNull(profileObject.email),
    grantedScopes,
    railwayCallbackOnly: true,
    stateVerified: true,
    userVerified: true,
    cloudNotePlaintextReadable: false,
    localDesktopMcpSeparate: true,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler121: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  if (profileObject.documentedToolsVerified !== true) {
    throw new BadRequestException("XMind hosted MCP binding is invalid");
  }
  return {
    provider: "xmind",
    connectorStandardVersion: "v1",
    oauthFlow: "dynamic_public_authorization_code_pkce_refresh",
    tokenStatus: "valid",
    clientId,
    displayName: "XMind account",
    grantedScopes,
    railwayCallbackOnly: true,
    stateVerified: true,
    pkceS256: true,
    providerPermissionsEnforced: true,
    mcpVerified: true,
    documentedToolCount:
      typeof profileObject.toolCount === "number"
        ? profileObject.toolCount
        : null,
    readToolCount:
      typeof profileObject.readToolCount === "number"
        ? profileObject.readToolCount
        : null,
    writeToolCount:
      typeof profileObject.writeToolCount === "number"
        ? profileObject.writeToolCount
        : null,
    mcpResource: "https://app.xmind.com/api/mcp",
    rawToolsEnabled: false,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler122: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  if (profileObject.documentedReadToolsVerified !== true) {
    throw new BadRequestException(
      "Adobe Analytics hosted MCP binding is invalid",
    );
  }
  return {
    provider: "adobe-analytics",
    connectorStandardVersion: "v1",
    oauthFlow: "dynamic_public_authorization_code_pkce",
    tokenStatus: "valid",
    clientId,
    displayName: "Adobe Analytics account",
    grantedScopes,
    railwayCallbackOnly: true,
    stateVerified: true,
    pkceS256: true,
    providerPermissionsEnforced: true,
    mcpVerified: true,
    documentedToolCount:
      typeof profileObject.toolCount === "number"
        ? profileObject.toolCount
        : null,
    readToolCount:
      typeof profileObject.readToolCount === "number"
        ? profileObject.readToolCount
        : null,
    maximumReportRows: 100,
    mcpResource: "https://aa-mcp.adobe.io/mcp",
    rawToolsEnabled: false,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler123: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  if (profileObject.liveToolsVerified !== true) {
    throw new BadRequestException(
      "Cloudinary Asset Management MCP binding is invalid",
    );
  }
  return {
    provider: "cloudinary",
    connectorStandardVersion: "v1",
    oauthFlow: "dynamic_public_authorization_code_pkce_refresh",
    tokenStatus: "valid",
    clientId,
    displayName: "Cloudinary product environment",
    grantedScopes,
    railwayCallbackOnly: true,
    stateVerified: true,
    pkceS256: true,
    providerPermissionsEnforced: true,
    mcpVerified: true,
    toolCount:
      typeof profileObject.toolCount === "number"
        ? profileObject.toolCount
        : null,
    readToolCount:
      typeof profileObject.readToolCount === "number"
        ? profileObject.readToolCount
        : null,
    writeToolCount:
      typeof profileObject.writeToolCount === "number"
        ? profileObject.writeToolCount
        : null,
    mcpResource: "https://asset-management.mcp.cloudinary.com/mcp",
    independentlyAuthorizedMcpServers: [
      "environment-config",
      "structured-metadata",
      "analysis",
    ],
    rawToolsEnabled: false,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler124: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const userId =
    typeof profileObject._id === "number"
      ? String(profileObject._id)
      : this.stringOrNull(profileObject._id);
  if (!userId)
    throw new BadRequestException("Raindrop.io user binding is invalid");
  return {
    provider: "raindrop-io",
    connectorStandardVersion: "v1",
    oauthFlow: "authorization_code_refresh",
    tokenStatus: "valid",
    clientId,
    raindropUserId: userId,
    displayName:
      this.stringOrNull(profileObject.fullName) ?? "Raindrop.io user",
    email: this.stringOrNull(profileObject.email),
    grantedScopes,
    stateVerified: true,
    userVerified: true,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler125: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const uri = this.stringOrNull(profileObject.uri);
  const userId = uri?.match(/^\/users\/([0-9]+)$/)?.[1] ?? null;
  if (!userId)
    throw new BadRequestException("Vimeo connected-account binding is invalid");
  return {
    provider: "vimeo",
    connectorStandardVersion: "v1",
    oauthFlow: "confidential_authorization_code",
    tokenStatus: "valid",
    clientId,
    vimeoUserId: userId,
    displayName:
      this.stringOrNull(profileObject.name) ?? `Vimeo user ${userId}`,
    connectedHandle: this.stringOrNull(profileObject.link),
    grantedScopes,
    railwayCallbackOnly: true,
    stateVerified: true,
    userVerified: true,
    refreshTokensSupported: false,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler126: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const nested =
    profileObject.account &&
    typeof profileObject.account === "object" &&
    !Array.isArray(profileObject.account)
      ? (profileObject.account as Record<string, unknown>)
      : profileObject;
  const rawId = nested.id ?? nested.account_id ?? nested.hashed_id;
  const accountId =
    typeof rawId === "number" ? String(rawId) : this.stringOrNull(rawId);
  const accountUrl =
    this.stringOrNull(nested.url) ?? this.stringOrNull(nested.account_url);
  if (!accountId && !accountUrl)
    throw new BadRequestException(
      "Wistia connected-account binding is invalid",
    );
  return {
    provider: "wistia",
    connectorStandardVersion: "v1",
    oauthFlow: "confidential_authorization_code_refresh",
    tokenStatus: "valid",
    clientId,
    wistiaAccountId: accountId,
    displayName:
      this.stringOrNull(nested.name) ??
      this.stringOrNull(nested.account_name) ??
      accountUrl ??
      "Wistia account",
    connectedHandle: accountUrl,
    grantedScopes,
    railwayCallbackOnly: true,
    stateVerified: true,
    accountVerified: true,
    refreshTokensSupported: true,
    upstreamRevocation: "account-settings",
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler127: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const member =
    profileObject.value &&
    typeof profileObject.value === "object" &&
    !Array.isArray(profileObject.value)
      ? (profileObject.value as Record<string, unknown>)
      : profileObject;
  const memberId = this.stringOrNull(member.id);
  if (!memberId)
    throw new BadRequestException("Mural connected-member binding is invalid");
  const firstName = this.stringOrNull(member.firstName);
  const lastName = this.stringOrNull(member.lastName);
  return {
    provider: "mural",
    connectorStandardVersion: "v1",
    oauthFlow: "confidential_authorization_code_pkce_refresh",
    tokenStatus: "valid",
    clientId,
    muralMemberId: memberId,
    muralCompanyId: this.stringOrNull(member.companyId),
    muralLastActiveWorkspaceId: this.stringOrNull(member.lastActiveWorkspace),
    displayName:
      [firstName, lastName].filter(Boolean).join(" ") ||
      this.stringOrNull(member.email) ||
      "Mural member",
    email: this.stringOrNull(member.email),
    grantedScopes,
    railwayCallbackOnly: true,
    stateVerified: true,
    pkceS256: true,
    memberVerified: true,
    refreshTokensSupported: true,
    upstreamRevocation: "delete-app-or-provider-account-settings",
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler128: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const nested =
    profileObject.data &&
    typeof profileObject.data === "object" &&
    !Array.isArray(profileObject.data)
      ? (profileObject.data as Record<string, unknown>)
      : profileObject;
  const userId = this.stringOrNull(nested.id);
  const accountId = this.stringOrNull(nested.account_id);
  if (!userId)
    throw new BadRequestException("Frame.io connected-user binding is invalid");
  return {
    provider: "frame-io",
    connectorStandardVersion: "v1",
    oauthFlow: "adobe_ims_confidential_authorization_code_refresh",
    tokenStatus: "valid",
    clientId,
    frameIoUserId: userId,
    frameIoAccountId: accountId,
    displayName:
      this.stringOrNull(nested.name) ??
      this.stringOrNull(nested.email) ??
      "Frame.io user",
    email: this.stringOrNull(nested.email),
    grantedScopes,
    railwayCallbackOnly: true,
    stateVerified: true,
    userVerified: true,
    refreshTokensSupported: true,
    upstreamRevocation: "adobe-ims",
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler129: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const userId = this.stringOrNull(profileObject.userId);
  if (!userId)
    throw new BadRequestException("Inoreader user binding is invalid");
  return {
    provider: "inoreader",
    connectorStandardVersion: "v1",
    oauthFlow: "confidential_authorization_code_refresh",
    tokenStatus: "valid",
    clientId,
    inoreaderUserId: userId,
    displayName: this.stringOrNull(profileObject.userName) ?? "Inoreader user",
    email: this.stringOrNull(profileObject.userEmail),
    grantedScopes,
    railwayCallbackOnly: true,
    stateVerified: true,
    userVerified: true,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler130: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const userId = this.stringOrNull(profileObject.sub);
  const email = this.stringOrNull(profileObject.email);
  if (!userId || !email) {
    throw new BadRequestException("Slite connected-user binding is invalid");
  }
  return {
    provider: "slite",
    connectorStandardVersion: "v1",
    oauthFlow: "dynamic_public_authorization_code_pkce_refresh",
    tokenStatus: "valid",
    clientId,
    sliteUserId: userId,
    displayName: this.stringOrNull(profileObject.name) ?? email,
    email,
    emailVerified: profileObject.email_verified === true,
    grantedScopes,
    railwayCallbackOnly: true,
    stateVerified: true,
    nonceVerified: true,
    idTokenVerified: true,
    pkceS256: true,
    userVerified: true,
    mcpResource: "https://api.slite.com/mcp",
    rawToolsEnabled: false,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler131: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  if (profileObject.documentedToolsVerified !== true) {
    throw new BadRequestException("Nuclino hosted MCP binding is invalid");
  }
  return {
    provider: "nuclino",
    connectorStandardVersion: "v1",
    oauthFlow: "dynamic_public_authorization_code_pkce",
    tokenStatus: "valid",
    clientId,
    displayName: "Nuclino account",
    grantedScopes,
    railwayCallbackOnly: true,
    stateVerified: true,
    pkceS256: true,
    providerPermissionsEnforced: true,
    mcpVerified: true,
    documentedToolCount:
      typeof profileObject.toolCount === "number"
        ? profileObject.toolCount
        : null,
    mcpResource: "https://api.nuclino.com/mcp",
    rawToolsEnabled: false,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler132: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  if (profileObject.mcpToolsVerified !== true) {
    throw new BadRequestException("Scribe hosted MCP binding is invalid");
  }
  return {
    provider: "scribe",
    connectorStandardVersion: "v1",
    oauthFlow: "dynamic_confidential_authorization_code_pkce_refresh",
    tokenStatus: "valid",
    clientId,
    displayName: "Scribe workspace",
    grantedScopes,
    railwayCallbackOnly: true,
    stateVerified: true,
    pkceS256: true,
    providerPermissionsEnforced: true,
    mcpVerified: true,
    toolCount:
      typeof profileObject.toolCount === "number"
        ? profileObject.toolCount
        : null,
    readableToolCount:
      typeof profileObject.readableToolCount === "number"
        ? profileObject.readableToolCount
        : null,
    mcpResource: "https://mcp.scribe.com/mcp",
    rawToolsEnabled: false,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler133: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  if (profileObject.documentedToolsVerified !== true)
    throw new BadRequestException("Otter hosted MCP binding is invalid");
  return {
    provider: "otter-ai",
    connectorStandardVersion: "v1",
    oauthFlow: "dynamic_public_authorization_code_pkce_refresh",
    tokenStatus: "valid",
    clientId,
    displayName: "Otter.ai account",
    grantedScopes,
    railwayCallbackOnly: true,
    stateVerified: true,
    pkceS256: true,
    providerPermissionsEnforced: true,
    mcpVerified: true,
    documentedToolCount:
      typeof profileObject.toolCount === "number"
        ? profileObject.toolCount
        : null,
    mcpResource: "https://mcp.otter.ai/mcp",
    rawToolsEnabled: false,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler134: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  if (profileObject.documentedToolsVerified !== true)
    throw new BadRequestException("Fireflies hosted MCP binding is invalid");
  return {
    provider: "fireflies-ai",
    connectorStandardVersion: "v1",
    oauthFlow: "dynamic_public_authorization_code_pkce_refresh",
    tokenStatus: "valid",
    clientId,
    displayName: "Fireflies.ai account",
    grantedScopes,
    railwayCallbackOnly: true,
    stateVerified: true,
    pkceS256: true,
    providerPermissionsEnforced: true,
    mcpVerified: true,
    documentedToolCount:
      typeof profileObject.toolCount === "number"
        ? profileObject.toolCount
        : null,
    mcpResource: "https://api.fireflies.ai/mcp",
    rawToolsEnabled: false,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler135: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  if (profileObject.documentedToolsVerified !== true)
    throw new BadRequestException("Fathom hosted MCP binding is invalid");
  return {
    provider: "fathom",
    connectorStandardVersion: "v1",
    oauthFlow: "dynamic_public_authorization_code_pkce",
    tokenStatus: "valid",
    clientId,
    displayName: "Fathom account",
    grantedScopes,
    railwayCallbackOnly: true,
    stateVerified: true,
    pkceS256: true,
    providerPermissionsEnforced: true,
    mcpVerified: true,
    documentedToolCount:
      typeof profileObject.toolCount === "number"
        ? profileObject.toolCount
        : null,
    mcpResource: "https://api.fathom.ai/mcp",
    rawToolsEnabled: false,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler136: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  if (profileObject.documentedToolsVerified !== true)
    throw new BadRequestException("Bonsai hosted MCP binding is invalid");
  return {
    provider: "bonsai",
    connectorStandardVersion: "v1",
    oauthFlow: "dynamic_public_authorization_code_pkce_refresh",
    tokenStatus: "valid",
    clientId,
    displayName: "Bonsai account",
    grantedScopes,
    railwayCallbackOnly: true,
    stateVerified: true,
    pkceS256: true,
    providerPermissionsEnforced: true,
    mcpVerified: true,
    documentedToolCount:
      typeof profileObject.toolCount === "number"
        ? profileObject.toolCount
        : null,
    mcpResource: "https://mcp.hellobonsai.com/mcp",
    rawToolsEnabled: false,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler137: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  if (profileObject.documentedToolsVerified !== true)
    throw new BadRequestException("Grain hosted MCP binding is invalid");
  return {
    provider: "grain",
    connectorStandardVersion: "v1",
    oauthFlow: "dynamic_public_authorization_code_pkce_refresh",
    tokenStatus: "valid",
    clientId,
    displayName: "Grain account",
    grantedScopes,
    railwayCallbackOnly: true,
    stateVerified: true,
    pkceS256: true,
    providerPermissionsEnforced: true,
    mcpVerified: true,
    documentedToolCount:
      typeof profileObject.toolCount === "number"
        ? profileObject.toolCount
        : null,
    readToolCount:
      typeof profileObject.readToolCount === "number"
        ? profileObject.readToolCount
        : null,
    writeToolCount:
      typeof profileObject.writeToolCount === "number"
        ? profileObject.writeToolCount
        : null,
    mcpResource: "https://api.grain.com/_/mcp",
    rawToolsEnabled: false,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler138: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  if (profileObject.documentedToolsVerified !== true) {
    throw new BadRequestException("Whimsical hosted MCP binding is invalid");
  }
  return {
    provider: "whimsical",
    connectorStandardVersion: "v1",
    oauthFlow: "dynamic_public_authorization_code_pkce",
    tokenStatus: "valid",
    clientId,
    displayName: "Whimsical account",
    grantedScopes,
    railwayCallbackOnly: true,
    stateVerified: true,
    pkceS256: true,
    providerPermissionsEnforced: true,
    mcpVerified: true,
    documentedToolCount:
      typeof profileObject.toolCount === "number"
        ? profileObject.toolCount
        : null,
    readToolCount:
      typeof profileObject.readToolCount === "number"
        ? profileObject.readToolCount
        : null,
    writeToolCount:
      typeof profileObject.writeToolCount === "number"
        ? profileObject.writeToolCount
        : null,
    mcpResource: "https://mcp.whimsical.com/mcp",
    rawToolsEnabled: false,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler139: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  if (profileObject.documentedToolsVerified !== true) {
    throw new BadRequestException(
      "Cognito Forms hosted MCP binding is invalid",
    );
  }
  return {
    provider: "cognito-forms",
    connectorStandardVersion: "v1",
    oauthFlow: "provider_published_public_authorization_code_pkce",
    tokenStatus: "valid",
    clientId,
    displayName: "Cognito Forms organization",
    grantedScopes,
    railwayCallbackOnly: true,
    stateVerified: true,
    pkceS256: true,
    providerPermissionsEnforced: true,
    mcpVerified: true,
    documentedToolCount:
      typeof profileObject.toolCount === "number"
        ? profileObject.toolCount
        : null,
    readToolCount:
      typeof profileObject.readToolCount === "number"
        ? profileObject.readToolCount
        : null,
    writeToolCount:
      typeof profileObject.writeToolCount === "number"
        ? profileObject.writeToolCount
        : null,
    mcpResource: "https://mcp.cognitoforms.com/mcp",
    rawToolsEnabled: false,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler140: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const teams = Array.isArray(profileObject.teams) ? profileObject.teams : [];
  const normalizedTeams = teams.slice(0, 100).flatMap((item) => {
    const team =
      item && typeof item === "object" && !Array.isArray(item)
        ? (item as Record<string, unknown>)
        : {};
    const id = this.stringOrNull(team.id);
    return id
      ? [
          {
            id,
            name: this.stringOrNull(team.name),
            status: this.stringOrNull(team.status),
          },
        ]
      : [];
  });
  const userId = this.stringOrNull(profileObject.guruOAuthUserId);
  if (!normalizedTeams.length || !userId)
    throw new BadRequestException("Guru OAuth user or team binding is invalid");
  return {
    provider: "guru",
    connectorStandardVersion: "v1",
    oauthFlow: "confidential_authorization_code_refresh",
    tokenStatus: "valid",
    clientId,
    guruOAuthUserId: userId,
    guruTeamIds: normalizedTeams.map((team) => team.id),
    teams: normalizedTeams,
    displayName: normalizedTeams[0].name ?? userId,
    email: userId,
    grantedScopes,
    railwayCallbackOnly: true,
    stateVerified: true,
    userVerified: true,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler141: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  authority,
) {
  const userId = this.stringOrNull(profileObject.zohoWorkDriveUserId);
  const accountsOrigin = this.stringOrNull(authority?.zohoAccountsOrigin);
  if (!userId || !accountsOrigin) {
    throw new BadRequestException(
      "Zoho WorkDrive connected-user binding is invalid",
    );
  }
  const workDriveAuthority = this.zohoWorkDriveAuthority(accountsOrigin);
  if (
    workDriveAuthority.apiOrigin !==
      this.stringOrNull(authority?.zohoWorkDriveApiOrigin) ||
    workDriveAuthority.downloadOrigin !==
      this.stringOrNull(authority?.zohoWorkDriveDownloadOrigin) ||
    workDriveAuthority.uploadOrigin !==
      this.stringOrNull(authority?.zohoWorkDriveUploadOrigin)
  ) {
    throw new BadRequestException(
      "Zoho WorkDrive Accounts and API data centers do not match",
    );
  }
  return {
    provider: "zoho-workdrive",
    connectorStandardVersion: "v1",
    oauthFlow: "confidential_authorization_code_offline_refresh_multi_dc",
    tokenStatus: "valid",
    clientId,
    zohoWorkDriveUserId: userId,
    displayName:
      this.stringOrNull(profileObject.display_name) ??
      this.stringOrNull(profileObject.name) ??
      this.stringOrNull(profileObject.email_id) ??
      userId,
    email:
      this.stringOrNull(profileObject.email_id) ??
      this.stringOrNull(profileObject.email),
    grantedScopes,
    zohoRegion: workDriveAuthority.region,
    zohoAccountsOrigin: workDriveAuthority.accountsOrigin,
    zohoWorkDriveApiOrigin: workDriveAuthority.apiOrigin,
    zohoWorkDriveDownloadOrigin: workDriveAuthority.downloadOrigin,
    zohoWorkDriveUploadOrigin: workDriveAuthority.uploadOrigin,
    railwayCallbackOnly: true,
    stateVerified: true,
    accountVerified: true,
    regionalAuthorityBound: true,
    fixedEndpointsOnly: true,
    pinnedOperationCount: 229,
    readOperationCount: 90,
    mutationOperationCount: 139,
    maxUploadBytes: 2_000_000,
    maxResponseBytes: 2_500_000,
    automaticPagination: false,
    rawToolsEnabled: false,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler142: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  authority,
) {
  const accountId = this.stringOrNull(profileObject.accountId);
  const email = this.stringOrNull(profileObject.primaryEmailAddress);
  const accountsOrigin =
    this.stringOrNull(authority?.zohoAccountsOrigin) ??
    this.stringOrNull(profileObject.relayZohoAccountsOrigin);
  const mailOrigin = this.requireZohoMailOrigin(
    this.stringOrNull(authority?.zohoMailOrigin) ??
      profileObject.relayZohoMailOrigin,
  );
  if (!accountId || !/^[0-9]+$/.test(accountId) || !email || !accountsOrigin) {
    throw new BadRequestException(
      "Zoho Mail connected account binding is invalid",
    );
  }
  const zohoAuthority = this.zohoMailAuthority(accountsOrigin);
  if (zohoAuthority.mailOrigin !== mailOrigin) {
    throw new BadRequestException(
      "Zoho Mail Accounts and Mail data centers do not match",
    );
  }
  return {
    provider: "zoho-mail",
    connectorStandardVersion: "v1",
    oauthFlow: "confidential_authorization_code_offline_refresh",
    tokenStatus: "valid",
    clientId,
    zohoAccountId: accountId,
    displayName:
      this.stringOrNull(profileObject.displayName) ??
      this.stringOrNull(profileObject.accountName) ??
      email,
    email,
    grantedScopes,
    zohoRegion:
      this.stringOrNull(authority?.zohoRegion) ?? zohoAuthority.region,
    zohoAccountsOrigin: zohoAuthority.accountsOrigin,
    zohoMailOrigin: mailOrigin,
    railwayCallbackOnly: true,
    stateVerified: true,
    accountVerified: true,
    regionalAuthorityBound: true,
    readOnlyScopes: true,
    fixedEndpointsOnly: true,
    writesEnabled: false,
    attachmentDownloadsEnabled: false,
    automaticRetry: false,
    automaticPagination: false,
    rawToolsEnabled: false,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler143: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  authority,
) {
  const primaryMailboxAddress =
    this.stringOrNull(profileObject.mail) ??
    this.stringOrNull(profileObject.userPrincipalName);
  return {
    provider: "outlook",
    connectorStandardVersion: "v1",
    oauthFlow: "authorization_code_pkce",
    microsoftAuthorityMode: authority?.authorityMode ?? null,
    microsoftAuthorityTenantId: authority?.authorityTenantId ?? null,
    tokenStatus: "valid",
    clientId,
    tenantId: this.stringOrNull(profileObject.tenantId),
    microsoftUserId: this.stringOrNull(profileObject.id),
    primaryMailboxAddress,
    displayName: this.stringOrNull(profileObject.displayName),
    grantedScopes,
    senderIdentities: [],
    approvedSenderIdentities: [],
    delegatedOnly: true,
    selfMailboxOnly: true,
    sharedMailEnabled: false,
    applicationPermissionsEnabled: false,
    attachmentsEnabled: false,
    searchEnabled: false,
    writesEnabled: false,
    calendarContactsFilesDirectoryEnabled: false,
    automaticPagination: false,
    rawToolsEnabled: false,
    maxResults: 25,
    maxBodyCharacters: 8_000,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler144: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  authority,
) {
  const accountEmail =
    this.stringOrNull(profileObject.mail) ??
    this.stringOrNull(profileObject.userPrincipalName);
  return {
    provider: "microsoft-teams",
    connectorStandardVersion: "v1",
    oauthFlow: "authorization_code_pkce",
    microsoftAuthorityMode: authority?.authorityMode ?? null,
    microsoftAuthorityTenantId: authority?.authorityTenantId ?? null,
    tokenStatus: "valid",
    clientId,
    tenantId: this.stringOrNull(profileObject.tenantId),
    microsoftUserId: this.stringOrNull(profileObject.id),
    accountEmail,
    displayName: this.stringOrNull(profileObject.displayName),
    grantedScopes,
    delegatedOnly: true,
    workSchoolOnly: true,
    messageContentEnabled: false,
    chatsEnabled: false,
    membersDirectoryEnabled: false,
    filesMeetingsCallsEnabled: false,
    applicationPermissionsEnabled: false,
    adminConsentScopesEnabled: false,
    meteredAPIsEnabled: false,
    writesEnabled: false,
    automaticPagination: false,
    rawToolsEnabled: false,
    maxResults: 25,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler145: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const twistUserId =
    this.stringOrNull(profileObject.id) ??
    (typeof profileObject.id === "number" &&
    Number.isSafeInteger(profileObject.id)
      ? String(profileObject.id)
      : null);
  const displayName = this.stringOrNull(profileObject.name);
  if (!twistUserId || !/^[0-9]+$/.test(twistUserId) || !displayName) {
    throw new BadRequestException("Twist connected user binding is invalid");
  }
  return {
    provider: "twist",
    connectorStandardVersion: "v1",
    oauthFlow: "confidential_authorization_code_no_refresh",
    tokenStatus: "valid",
    clientId,
    twistUserId,
    displayName,
    email: this.stringOrNull(profileObject.email),
    grantedScopes,
    railwayCallbackOnly: true,
    stateVerified: true,
    userVerified: true,
    readOnlyScopes: true,
    fixedEndpointsOnly: true,
    automaticRetry: false,
    automaticPagination: false,
    rawToolsEnabled: false,
    maxWorkspaces: 20,
    maxChannels: 50,
    maxInboxThreads: 20,
    maxComments: 30,
    maxProviderRequestsPerAction: 2,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler146: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  if (profileObject.documentedToolsVerified !== true) {
    throw new BadRequestException("Jotform hosted MCP binding is invalid");
  }
  return {
    provider: "jotform",
    connectorStandardVersion: "v1",
    oauthFlow: "dynamic_public_authorization_code_pkce_refresh_revocation",
    tokenStatus: "valid",
    clientId,
    displayName: "Jotform account",
    grantedScopes,
    railwayCallbackOnly: true,
    stateVerified: true,
    pkceS256: true,
    providerPermissionsEnforced: true,
    mcpVerified: true,
    documentedToolsVerified: true,
    documentedToolCount:
      typeof profileObject.toolCount === "number"
        ? profileObject.toolCount
        : null,
    readToolCount:
      typeof profileObject.readToolCount === "number"
        ? profileObject.readToolCount
        : null,
    writeToolCount:
      typeof profileObject.writeToolCount === "number"
        ? profileObject.writeToolCount
        : null,
    mcpResource: "https://mcp.jotform.com/mcp",
    rawToolsEnabled: false,
    lastHealthCheck: null,
  };
};

export const OAuthProviderMetadataHandlers05: OAuthProviderMetadataHandlerMap =
  Object.freeze({
    confluence: oauthProviderMetadataHandler113,
    jira: oauthProviderMetadataHandler114,
    "jira-service-management": oauthProviderMetadataHandler114,
    "atlassian-compass": oauthProviderMetadataHandler114,
    productboard: oauthProviderMetadataHandler115,
    nifty: oauthProviderMetadataHandler116,
    meistertask: oauthProviderMetadataHandler117,
    aha: oauthProviderMetadataHandler118,
    quip: oauthProviderMetadataHandler119,
    reflect: oauthProviderMetadataHandler120,
    xmind: oauthProviderMetadataHandler121,
    "adobe-analytics": oauthProviderMetadataHandler122,
    cloudinary: oauthProviderMetadataHandler123,
    "raindrop-io": oauthProviderMetadataHandler124,
    vimeo: oauthProviderMetadataHandler125,
    wistia: oauthProviderMetadataHandler126,
    mural: oauthProviderMetadataHandler127,
    "frame-io": oauthProviderMetadataHandler128,
    inoreader: oauthProviderMetadataHandler129,
    slite: oauthProviderMetadataHandler130,
    nuclino: oauthProviderMetadataHandler131,
    scribe: oauthProviderMetadataHandler132,
    "otter-ai": oauthProviderMetadataHandler133,
    "fireflies-ai": oauthProviderMetadataHandler134,
    fathom: oauthProviderMetadataHandler135,
    bonsai: oauthProviderMetadataHandler136,
    grain: oauthProviderMetadataHandler137,
    whimsical: oauthProviderMetadataHandler138,
    "cognito-forms": oauthProviderMetadataHandler139,
    guru: oauthProviderMetadataHandler140,
    "zoho-workdrive": oauthProviderMetadataHandler141,
    "zoho-mail": oauthProviderMetadataHandler142,
    outlook: oauthProviderMetadataHandler143,
    "microsoft-teams": oauthProviderMetadataHandler144,
    twist: oauthProviderMetadataHandler145,
    jotform: oauthProviderMetadataHandler146,
  });
