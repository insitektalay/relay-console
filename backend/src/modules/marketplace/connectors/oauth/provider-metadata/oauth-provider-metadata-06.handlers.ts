import type {
  OAuthProviderMetadataHandler,
  OAuthProviderMetadataHandlerMap,
} from "./oauth-provider-metadata-handler";
import type { MarketplaceConnectorOAuthService } from "../../connector-oauth.service";
import { BadRequestException } from "@nestjs/common";

const oauthProviderMetadataHandler146: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const teamId = this.stringOrNull(profileObject.team_id);
  const botUserId = this.stringOrNull(profileObject.user_id);
  if (!teamId || !botUserId) {
    throw new BadRequestException("Slack workspace binding is invalid");
  }
  return {
    provider: "slack",
    connectorStandardVersion: "v1",
    oauthFlow: "confidential_oauth_v2_authorization_code",
    tokenStatus: "valid",
    clientId,
    teamId,
    workspaceName: this.stringOrNull(profileObject.team) ?? "Slack workspace",
    botUserId,
    botUserName: this.stringOrNull(profileObject.user),
    botId: this.stringOrNull(profileObject.bot_id),
    enterpriseId: this.stringOrNull(profileObject.enterprise_id),
    workspaceUrl: this.stringOrNull(profileObject.url),
    displayName: this.stringOrNull(profileObject.team) ?? "Slack workspace",
    grantedScopes,
    railwayCallbackOnly: true,
    stateVerified: true,
    workspaceBound: true,
    publicChannelsOnly: true,
    approvalGatedWrites: true,
    channelWideMentionsBlocked: true,
    automaticPagination: false,
    automaticRetry: false,
    rawToolsEnabled: false,
    maxChannels: 50,
    maxMessages: 50,
    maxMessageCharacters: 4000,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler147: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const githubUserId =
    typeof profileObject.id === "number"
      ? String(profileObject.id)
      : this.stringOrNull(profileObject.id);
  const login = this.stringOrNull(profileObject.login);
  const githubInstallationId = this.stringOrNull(
    profileObject.githubInstallationId,
  );
  if (!githubUserId || !login || !githubInstallationId) {
    throw new BadRequestException("GitHub connected-user binding is invalid");
  }
  return {
    provider: "github",
    connectorStandardVersion: "v1",
    oauthFlow: "github_app_user_authorization_pkce",
    tokenStatus: "valid",
    clientId,
    githubUserId,
    githubInstallationId,
    githubInstallationAccount: this.stringOrNull(
      profileObject.githubInstallationAccount,
    ),
    githubInstallationTargetType: this.stringOrNull(
      profileObject.githubInstallationTargetType,
    ),
    githubRepositorySelection: this.stringOrNull(
      profileObject.githubRepositorySelection,
    ),
    githubInstallationPermissions:
      profileObject.githubInstallationPermissions ?? {},
    login,
    displayName: this.stringOrNull(profileObject.name) ?? login,
    avatarUrl: this.stringOrNull(profileObject.avatar_url),
    grantedScopes,
    railwayCallbackOnly: true,
    stateVerified: true,
    pkceVerified: true,
    userBound: true,
    installationVerified: true,
    fixedEndpointsOnly: true,
    automaticPagination: false,
    rawToolsEnabled: false,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler148: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const gitlabUserId =
    typeof profileObject.id === "number"
      ? String(profileObject.id)
      : this.stringOrNull(profileObject.id);
  const username = this.stringOrNull(profileObject.username);
  if (!gitlabUserId || !username) {
    throw new BadRequestException("GitLab connected-user binding is invalid");
  }
  return {
    provider: "gitlab",
    connectorStandardVersion: "v1",
    oauthFlow: "authorization_code_pkce",
    tokenStatus: "valid",
    clientId,
    gitlabUserId,
    username,
    displayName: this.stringOrNull(profileObject.name) ?? username,
    avatarUrl: this.stringOrNull(profileObject.avatar_url),
    webUrl: this.stringOrNull(profileObject.web_url),
    grantedScopes,
    railwayCallbackOnly: true,
    stateVerified: true,
    pkceVerified: true,
    userBound: true,
    fixedEndpointsOnly: true,
    automaticPagination: false,
    rawToolsEnabled: false,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler149: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const bitbucketUserUuid = this.stringOrNull(profileObject.uuid);
  const displayName = this.stringOrNull(profileObject.display_name);
  if (!bitbucketUserUuid || !displayName) {
    throw new BadRequestException(
      "Bitbucket connected-user binding is invalid",
    );
  }
  const links =
    profileObject.links &&
    typeof profileObject.links === "object" &&
    !Array.isArray(profileObject.links)
      ? (profileObject.links as Record<string, unknown>)
      : {};
  const linkValue = (key: string) => {
    const value = links[key];
    return value && typeof value === "object" && !Array.isArray(value)
      ? this.stringOrNull((value as Record<string, unknown>).href)
      : null;
  };
  return {
    provider: "bitbucket",
    connectorStandardVersion: "v1",
    oauthFlow: "authorization_code_confidential_consumer",
    tokenStatus: "valid",
    clientId,
    bitbucketUserUuid,
    accountId: this.stringOrNull(profileObject.account_id),
    nickname: this.stringOrNull(profileObject.nickname),
    displayName,
    avatarUrl: linkValue("avatar"),
    webUrl: linkValue("html"),
    grantedScopes,
    railwayCallbackOnly: true,
    stateVerified: true,
    pkceVerified: false,
    userBound: true,
    refreshTokenRotates: true,
    fixedEndpointsOnly: true,
    automaticPagination: false,
    rawToolsEnabled: false,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler150: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const notionBotId = this.stringOrNull(profileObject.id);
  if (!notionBotId)
    throw new BadRequestException(
      "Notion connected-workspace binding is invalid",
    );
  return {
    provider: "notion",
    connectorStandardVersion: "v1",
    oauthFlow: "authorization_code_confidential_client",
    tokenStatus: "valid",
    clientId,
    notionBotId,
    displayName: this.stringOrNull(profileObject.name) ?? "Notion workspace",
    avatarUrl: this.stringOrNull(profileObject.avatar_url),
    grantedScopes,
    railwayCallbackOnly: true,
    stateVerified: true,
    pkceVerified: false,
    userBound: true,
    pageSelectionRequired: true,
    fixedEndpointsOnly: true,
    automaticPagination: false,
    rawToolsEnabled: false,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler151: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const viewer =
    profileObject.viewer &&
    typeof profileObject.viewer === "object" &&
    !Array.isArray(profileObject.viewer)
      ? (profileObject.viewer as Record<string, unknown>)
      : {};
  const organization =
    profileObject.organization &&
    typeof profileObject.organization === "object" &&
    !Array.isArray(profileObject.organization)
      ? (profileObject.organization as Record<string, unknown>)
      : {};
  const linearUserId = this.stringOrNull(viewer.id);
  const linearOrganizationId = this.stringOrNull(organization.id);
  if (!linearUserId || !linearOrganizationId)
    throw new BadRequestException(
      "Linear connected-workspace binding is invalid",
    );
  return {
    provider: "linear",
    connectorStandardVersion: "v1",
    oauthFlow: "authorization_code_pkce_confidential_client",
    tokenStatus: "valid",
    clientId,
    linearUserId,
    linearOrganizationId,
    organizationKey: this.stringOrNull(organization.urlKey),
    displayName: this.stringOrNull(organization.name) ?? "Linear workspace",
    connectedUserName: this.stringOrNull(viewer.name),
    connectedUserEmail: this.stringOrNull(viewer.email),
    grantedScopes,
    railwayCallbackOnly: true,
    stateVerified: true,
    pkceVerified: true,
    userBound: true,
    workspaceBound: true,
    refreshTokenRotates: true,
    fixedEndpointsOnly: true,
    automaticPagination: false,
    rawToolsEnabled: false,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler152: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const asanaUserGid = this.stringOrNull(profileObject.gid);
  if (!asanaUserGid)
    throw new BadRequestException("Asana connected-user binding is invalid");
  const asanaWorkspaces = Array.isArray(profileObject.workspaces)
    ? profileObject.workspaces
        .slice(0, 100)
        .map((value) =>
          value && typeof value === "object" && !Array.isArray(value)
            ? (value as Record<string, unknown>)
            : {},
        )
        .map((workspace) => ({
          gid: this.stringOrNull(workspace.gid),
          name: this.stringOrNull(workspace.name),
        }))
        .filter((workspace) => Boolean(workspace.gid))
    : [];
  return {
    provider: "asana",
    connectorStandardVersion: "v1",
    oauthFlow: "authorization_code_pkce_confidential_client",
    tokenStatus: "valid",
    clientId,
    asanaUserGid,
    asanaWorkspaces,
    displayName: this.stringOrNull(profileObject.name) ?? "Asana account",
    connectedUserEmail: this.stringOrNull(profileObject.email),
    grantedScopes,
    railwayCallbackOnly: true,
    stateVerified: true,
    pkceVerified: true,
    userBound: true,
    workspaceBound: asanaWorkspaces.length > 0,
    refreshTokenLongLived: true,
    fixedEndpointsOnly: true,
    automaticPagination: false,
    rawToolsEnabled: false,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler153: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const me =
    profileObject.me &&
    typeof profileObject.me === "object" &&
    !Array.isArray(profileObject.me)
      ? (profileObject.me as Record<string, unknown>)
      : {};
  const account =
    me.account && typeof me.account === "object" && !Array.isArray(me.account)
      ? (me.account as Record<string, unknown>)
      : {};
  const mondayUserId = this.stringOrNull(me.id);
  const mondayAccountId = this.stringOrNull(account.id);
  if (!mondayUserId || !mondayAccountId)
    throw new BadRequestException(
      "Monday.com connected-user or account binding is invalid",
    );
  return {
    provider: "monday-com",
    connectorStandardVersion: "v1",
    oauthFlow: "oauth2_1_authorization_code_pkce_confidential_client",
    tokenStatus: "valid",
    clientId,
    mondayUserId,
    mondayAccountId,
    mondayAccountSlug: this.stringOrNull(account.slug),
    displayName:
      this.stringOrNull(account.name) ??
      this.stringOrNull(me.name) ??
      "Monday.com account",
    connectedUserName: this.stringOrNull(me.name),
    connectedUserEmail: this.stringOrNull(me.email),
    grantedScopes,
    railwayCallbackOnly: true,
    stateVerified: true,
    pkceVerified: true,
    userBound: true,
    accountBound: true,
    refreshTokenRotating: true,
    maximumAuthorizationLifetimeMonths: 6,
    upstreamRevocationEndpointAvailable: true,
    fixedEndpointsOnly: true,
    apiVersion: "2026-04",
    automaticPagination: false,
    rawToolsEnabled: false,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler154: OAuthProviderMetadataHandler = function (
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
  const airtableUserId = this.stringOrNull(user.id);
  if (!airtableUserId)
    throw new BadRequestException("Airtable connected-user binding is invalid");
  const airtableBases = Array.isArray(profileObject.bases)
    ? profileObject.bases
        .slice(0, 25)
        .map((value) =>
          value && typeof value === "object" && !Array.isArray(value)
            ? (value as Record<string, unknown>)
            : {},
        )
        .map((base) => ({
          id: this.stringOrNull(base.id),
          name: this.stringOrNull(base.name),
          permissionLevel: this.stringOrNull(base.permissionLevel),
        }))
        .filter((base) => Boolean(base.id))
    : [];
  return {
    provider: "airtable",
    connectorStandardVersion: "v1",
    oauthFlow: "authorization_code_pkce_confidential_client_rotating_refresh",
    tokenStatus: "valid",
    clientId,
    airtableUserId,
    airtableBases,
    displayName: this.stringOrNull(user.email) ?? "Airtable account",
    connectedUserEmail: this.stringOrNull(user.email),
    grantedScopes,
    railwayCallbackOnly: true,
    stateVerified: true,
    pkceVerified: true,
    userBound: true,
    resourceGrantBound: true,
    refreshTokenRotating: true,
    refreshTokenInactivityDays: 60,
    upstreamRevocationEndpointAvailable: false,
    fixedEndpointsOnly: true,
    automaticPagination: false,
    rawToolsEnabled: false,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler155: OAuthProviderMetadataHandler = function (
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
  const clickUpUserId = this.stringOrNull(user.id);
  if (!clickUpUserId)
    throw new BadRequestException("ClickUp connected-user binding is invalid");
  const clickUpWorkspaces = Array.isArray(profileObject.teams)
    ? profileObject.teams
        .slice(0, 100)
        .map((value) =>
          value && typeof value === "object" && !Array.isArray(value)
            ? (value as Record<string, unknown>)
            : {},
        )
        .map((workspace) => ({
          id: this.stringOrNull(workspace.id),
          name: this.stringOrNull(workspace.name),
        }))
        .filter((workspace) => Boolean(workspace.id))
    : [];
  if (!clickUpWorkspaces.length)
    throw new BadRequestException(
      "ClickUp authorization did not include a Workspace",
    );
  return {
    provider: "clickup",
    connectorStandardVersion: "v1",
    oauthFlow: "authorization_code_confidential_client",
    tokenStatus: "valid",
    clientId,
    clickUpUserId,
    clickUpWorkspaces,
    displayName: this.stringOrNull(user.username) ?? "ClickUp account",
    connectedUserEmail: this.stringOrNull(user.email),
    grantedScopes,
    railwayCallbackOnly: true,
    stateVerified: true,
    pkceVerified: false,
    userBound: true,
    workspaceBound: true,
    workspaceSelectionRequired: true,
    accessTokenCurrentlyNonExpiring: true,
    upstreamRevocationEndpointAvailable: false,
    fixedEndpointsOnly: true,
    automaticPagination: false,
    rawToolsEnabled: false,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler156: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const memberId =
    this.stringOrNull(profileObject.sub) ?? this.stringOrNull(profileObject.id);
  if (!memberId)
    throw new BadRequestException(
      "LinkedIn connected member subject is missing",
    );
  return {
    provider: "linkedin",
    connectorStandardVersion: "v1",
    oauthFlow: "authorization_code",
    tokenStatus: "valid",
    clientId,
    memberId,
    memberUrn: memberId ? `urn:li:person:${memberId}` : null,
    displayName:
      this.stringOrNull(profileObject.name) ??
      ([
        this.stringOrNull(profileObject.given_name),
        this.stringOrNull(profileObject.family_name),
      ]
        .filter(Boolean)
        .join(" ") ||
        null),
    grantedScopes,
    railwayCallbackOnly: true,
    stateVerified: true,
    memberVerified: Boolean(memberId),
    refreshTokenAssumed: false,
    emailScopeEnabled: false,
    memberSocialReadEnabled: false,
    commentsLikesEnabled: false,
    mediaOrganizationEnabled: false,
    searchScrapingEnabled: false,
    automaticRetry: false,
    automaticPagination: false,
    rawToolsEnabled: false,
    maxPostCharacters: 3000,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler157: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const selectedProfileId =
    this.stringOrNull(profileObject.secure_profile_id) ??
    this.stringOrNull(profileObject.id);
  const selectedProfileType = (
    this.stringOrNull(profileObject.type) ??
    this.stringOrNull(profileObject.profile_type) ??
    ""
  ).toLowerCase();
  if (
    !selectedProfileId ||
    !["neighbor", "business"].includes(selectedProfileType) ||
    profileObject.verified !== true
  ) {
    throw new BadRequestException(
      "Nextdoor selected profile binding is invalid",
    );
  }
  return {
    provider: "nextdoor",
    connectorStandardVersion: "v1",
    oauthFlow: "confidential_authorization_code_refresh",
    tokenStatus: "valid",
    clientId,
    displayName:
      this.stringOrNull(profileObject.name) ??
      this.stringOrNull(profileObject.business_name) ??
      this.stringOrNull(profileObject.neighborhood_name) ??
      "Nextdoor profile",
    selectedProfileId,
    selectedProfileType,
    profileVerified: true,
    neighborhoodName: this.stringOrNull(profileObject.neighborhood_name),
    cityName: this.stringOrNull(profileObject.city_name),
    grantedScopes,
    railwayCallbackOnly: true,
    stateVerified: true,
    selectedProfileIdBound: true,
    ownPostsOnly: true,
    textOnlyCreate: true,
    automaticRetry: false,
    automaticPagination: false,
    rawToolsEnabled: false,
    maxOwnPosts: 10,
    maxPostBytes: 8192,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler158: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  _grantedScopes,
  profileObject,
  _authority,
) {
  const meetupMemberId =
    this.stringOrNull(profileObject.id) ??
    (typeof profileObject.id === "number" &&
    Number.isSafeInteger(profileObject.id)
      ? String(profileObject.id)
      : null);
  const displayName = this.stringOrNull(profileObject.name)?.slice(0, 200);
  if (
    !meetupMemberId ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(meetupMemberId) ||
    !displayName
  ) {
    throw new BadRequestException("Meetup connected member binding is invalid");
  }
  return {
    provider: "meetup",
    connectorStandardVersion: "v1",
    oauthFlow: "confidential_authorization_code_single_use_refresh",
    tokenStatus: "valid",
    clientId,
    meetupMemberId,
    displayName,
    grantedScopes: [],
    railwayCallbackOnly: true,
    stateVerified: true,
    memberVerified: true,
    memberBindingVerified: true,
    fixedQueriesOnly: true,
    automaticRetry: false,
    automaticPagination: false,
    rawToolsEnabled: false,
    maxProviderRequestsPerAction: 1,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler159: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  _grantedScopes,
  profileObject,
  _authority,
) {
  const eventbriteUserId =
    this.stringOrNull(profileObject.id) ??
    (typeof profileObject.id === "number" &&
    Number.isSafeInteger(profileObject.id)
      ? String(profileObject.id)
      : null);
  const displayName = this.stringOrNull(profileObject.name)?.slice(0, 200);
  if (
    !eventbriteUserId ||
    !/^[0-9]{1,64}$/.test(eventbriteUserId) ||
    !displayName
  ) {
    throw new BadRequestException(
      "Eventbrite connected user binding is invalid",
    );
  }
  return {
    provider: "eventbrite",
    connectorStandardVersion: "v1",
    oauthFlow: "confidential_authorization_code_no_refresh",
    tokenStatus: "valid",
    clientId,
    eventbriteUserId,
    displayName,
    grantedScopes: [],
    railwayCallbackOnly: true,
    stateVerified: true,
    userVerified: true,
    userBindingVerified: true,
    fixedEndpointsOnly: true,
    organizationMembershipRequired: true,
    automaticRetry: false,
    automaticPagination: false,
    rawToolsEnabled: false,
    maxEvents: 10,
    maxProviderRequestsPerAction: 2,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler160: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const webexPersonId = this.stringOrNull(profileObject.id);
  const displayName = this.stringOrNull(profileObject.displayName);
  const emails = Array.isArray(profileObject.emails)
    ? profileObject.emails.filter(
        (value): value is string =>
          typeof value === "string" && Boolean(value.trim()),
      )
    : [];
  if (!webexPersonId || !displayName) {
    throw new BadRequestException("Webex connected Person binding is invalid");
  }
  return {
    provider: "webex",
    connectorStandardVersion: "v1",
    oauthFlow: "confidential_authorization_code_pkce_refresh",
    tokenStatus: "valid",
    clientId,
    webexPersonId,
    displayName,
    primaryEmail: emails[0] ?? null,
    grantedScopes,
    railwayCallbackOnly: true,
    stateVerified: true,
    pkceS256: true,
    personVerified: true,
    fixedEndpointsOnly: true,
    automaticRetry: false,
    automaticPagination: false,
    rawToolsEnabled: false,
    maxMeetings: 10,
    maxProviderRequestsPerAction: 1,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler161: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  _grantedScopes,
  profileObject,
  _authority,
) {
  const gotoOrganizerKey = this.stringOrNull(profileObject.id);
  const userName = this.stringOrNull(profileObject.userName);
  const name =
    profileObject.name &&
    typeof profileObject.name === "object" &&
    !Array.isArray(profileObject.name)
      ? (profileObject.name as Record<string, unknown>)
      : {};
  const givenName = this.stringOrNull(name.givenName);
  const familyName = this.stringOrNull(name.familyName);
  const displayName = [givenName, familyName].filter(Boolean).join(" ");
  if (
    !gotoOrganizerKey ||
    !/^[0-9]+$/.test(gotoOrganizerKey) ||
    !userName ||
    !displayName
  ) {
    throw new BadRequestException(
      "GoTo connected organizer binding is invalid",
    );
  }
  return {
    provider: "goto-meeting",
    connectorStandardVersion: "v1",
    oauthFlow: "confidential_authorization_code_basic_refresh",
    tokenStatus: "valid",
    clientId,
    gotoOrganizerKey,
    userName,
    displayName,
    grantedScopes: [],
    railwayCallbackOnly: true,
    stateVerified: true,
    identityVerified: true,
    organizerBound: true,
    gotoMeetingClientOnly: true,
    fixedEndpointsOnly: true,
    automaticRetry: false,
    automaticPagination: false,
    rawToolsEnabled: false,
    maxMeetings: 10,
    maxProviderRequestsPerAction: 2,
    maxResponseBytes: 512 * 1024,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler162: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const ringCentralExtensionId = this.stringOrNull(profileObject.id);
  const account =
    profileObject.account &&
    typeof profileObject.account === "object" &&
    !Array.isArray(profileObject.account)
      ? (profileObject.account as Record<string, unknown>)
      : {};
  const ringCentralAccountId = this.stringOrNull(account.id);
  const displayName = this.stringOrNull(profileObject.name);
  if (!ringCentralExtensionId || !ringCentralAccountId || !displayName) {
    throw new BadRequestException(
      "RingCentral connected extension binding is invalid",
    );
  }
  return {
    provider: "ringcentral",
    connectorStandardVersion: "v1",
    oauthFlow: "authorization_code_pkce_refresh",
    tokenStatus: "valid",
    clientId,
    ringCentralExtensionId,
    ringCentralAccountId,
    displayName,
    grantedScopes,
    railwayCallbackOnly: true,
    stateVerified: true,
    pkceS256: true,
    extensionVerified: true,
    selfExtensionOnly: true,
    canonicalPlatformOnly: true,
    privacyMasked: true,
    fixedEndpointsOnly: true,
    automaticRetry: false,
    automaticPagination: false,
    rawToolsEnabled: false,
    maxCallLogRecords: 10,
    maxProviderRequestsPerAction: 2,
    maxResponseBytes: 512 * 1024,
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler163: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const dialpadUserId =
    this.stringOrNull(profileObject.id) ??
    (typeof profileObject.id === "number" &&
    Number.isSafeInteger(profileObject.id)
      ? String(profileObject.id)
      : null);
  const displayName = this.stringOrNull(profileObject.display_name)?.slice(
    0,
    100,
  );
  if (!dialpadUserId || !/^[0-9]+$/.test(dialpadUserId) || !displayName) {
    throw new BadRequestException("Dialpad connected user binding is invalid");
  }
  return {
    provider: "dialpad",
    connectorStandardVersion: "v1",
    oauthFlow: "confidential_authorization_code_pkce_refresh",
    tokenStatus: "valid",
    clientId,
    dialpadUserId,
    displayName,
    grantedScopes,
    railwayCallbackOnly: true,
    stateVerified: true,
    pkceS256: true,
    userVerified: true,
    selfUserOnly: true,
    canonicalDialpadOnly: true,
    privacyMasked: true,
    fixedEndpointsOnly: true,
    automaticRetry: false,
    automaticPagination: false,
    rawToolsEnabled: false,
    maxCallerIds: 10,
    maxProviderRequestsPerAction: 1,
    maxResponseBytes: 512 * 1024,
    forwardingNumbers: "blocked",
    lastHealthCheck: null,
  };
};

const oauthProviderMetadataHandler164: OAuthProviderMetadataHandler = function (
  this: MarketplaceConnectorOAuthService,
  _appSlug,
  clientId,
  grantedScopes,
  profileObject,
  _authority,
) {
  const lineUserId = this.stringOrNull(profileObject.userId);
  const displayName = this.stringOrNull(profileObject.displayName);
  if (!lineUserId || !displayName)
    throw new BadRequestException("LINE connected profile binding is invalid");
  return {
    provider: "line",
    connectorStandardVersion: "v1",
    oauthFlow: "confidential_oidc_authorization_code_pkce_refresh",
    tokenStatus: "valid",
    clientId,
    lineUserId,
    displayName,
    pictureUrl: this.stringOrNull(profileObject.pictureUrl),
    statusMessage: this.stringOrNull(profileObject.statusMessage),
    grantedScopes,
    railwayCallbackOnly: true,
    stateVerified: true,
    nonceVerified: true,
    pkceS256: true,
    idTokenVerified: true,
    subjectBound: true,
    lineLoginOnly: true,
    messagingAuthority: false,
    fixedEndpointsOnly: true,
    automaticRetry: false,
    automaticPagination: false,
    rawToolsEnabled: false,
    maxProviderRequestsPerAction: 1,
    lastHealthCheck: null,
  };
};

export const OAuthProviderMetadataHandlers06: OAuthProviderMetadataHandlerMap =
  Object.freeze({
    slack: oauthProviderMetadataHandler146,
    github: oauthProviderMetadataHandler147,
    gitlab: oauthProviderMetadataHandler148,
    bitbucket: oauthProviderMetadataHandler149,
    notion: oauthProviderMetadataHandler150,
    linear: oauthProviderMetadataHandler151,
    asana: oauthProviderMetadataHandler152,
    "monday-com": oauthProviderMetadataHandler153,
    airtable: oauthProviderMetadataHandler154,
    clickup: oauthProviderMetadataHandler155,
    linkedin: oauthProviderMetadataHandler156,
    nextdoor: oauthProviderMetadataHandler157,
    meetup: oauthProviderMetadataHandler158,
    eventbrite: oauthProviderMetadataHandler159,
    webex: oauthProviderMetadataHandler160,
    "goto-meeting": oauthProviderMetadataHandler161,
    ringcentral: oauthProviderMetadataHandler162,
    dialpad: oauthProviderMetadataHandler163,
    line: oauthProviderMetadataHandler164,
  });
