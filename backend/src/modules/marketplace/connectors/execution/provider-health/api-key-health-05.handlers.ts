import type {
  ApiKeyHealthHandler,
  ApiKeyHealthHandlerMap,
} from "./api-key-health-handler";

const apiKeyHealthHandler134: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const discourseCredentials = this.discourseCredentials(
    stored,
    connection.metadata,
  );
  const profile = await this.discourseApi.health(discourseCredentials);
  connection.metadata = {
    ...(connection.metadata ?? {}),
    discourseSiteOrigin: new URL(discourseCredentials.baseUrl).origin,
    discourseActorId: profile.actor.id,
    discourseActorUsername: profile.actor.username,
    accountLabel: profile.site.title ?? "Discourse site",
  };
};

const apiKeyHealthHandler135: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const vanillaCredentials = this.vanillaForumsCredentials(
    stored,
    connection.metadata,
  );
  const profile = await this.vanillaForumsApi.health(vanillaCredentials);
  connection.metadata = {
    ...(connection.metadata ?? {}),
    vanillaForumsSiteOrigin: new URL(vanillaCredentials.baseUrl).origin,
    vanillaForumsActorId: profile.actor.id,
    accountLabel: profile.actor.name ?? "Vanilla community",
  };
};

const apiKeyHealthHandler136: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const profile = await this.bettermodeApi.health(
    this.bettermodeCredentials(stored, connection.metadata),
  );
  connection.metadata = {
    ...(connection.metadata ?? {}),
    bettermodeNetworkId: profile.network.id,
    bettermodeMemberId: profile.actor.id,
    accountLabel: profile.network.name ?? "Bettermode Network",
  };
};

const apiKeyHealthHandler137: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const credentials = this.higherLogicCredentials(stored, connection.metadata);
  const profile = await this.higherLogicApi.health(credentials);
  connection.metadata = {
    ...(connection.metadata ?? {}),
    higherLogicContactKey: profile.actor.id,
    accountLabel: profile.actor.displayName ?? "Higher Logic contact",
  };
};

const apiKeyHealthHandler138: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const credentials = this.hivebriteCredentials(stored, connection.metadata);
  const profile = await this.hivebriteApi.health(credentials);
  connection.metadata = {
    ...(connection.metadata ?? {}),
    hivebriteAdminId: profile.admin.id,
    hivebriteTenantOrigin: new URL(credentials.baseUrl).origin,
    accountLabel: profile.admin.name ?? "Hivebrite administrator",
  };
};

const apiKeyHealthHandler139: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  _stored,
) {
  const token = await this.oauth.refreshIfNeeded(connection);
  await this.stripeApi.health(
    this.stripeCredentials(connection, token.accessToken),
  );
};

const apiKeyHealthHandler140: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  _stored,
) {
  const token = await this.oauth.refreshIfNeeded(connection);
  await this.xeroApi.health(
    this.xeroCredentials(connection, token.accessToken),
  );
};

const apiKeyHealthHandler141: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  _stored,
) {
  const token = await this.oauth.refreshIfNeeded(connection);
  await this.quickBooksApi.health(
    this.quickBooksCredentials(connection, token.accessToken),
  );
};

const apiKeyHealthHandler142: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  _stored,
) {
  const token = await this.oauth.refreshIfNeeded(connection);
  await this.freshBooksApi.health(
    this.freshBooksCredentials(connection, token.accessToken),
  );
};

const apiKeyHealthHandler143: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  _stored,
) {
  const token = await this.oauth.refreshIfNeeded(connection);
  await this.waveApi.health(
    this.waveCredentials(connection, token.accessToken),
  );
};

const apiKeyHealthHandler144: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  _stored,
) {
  const token = await this.oauth.refreshIfNeeded(connection);
  await this.freeAgentApi.health(
    this.freeAgentCredentials(connection, token.accessToken),
  );
};

const apiKeyHealthHandler145: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  _stored,
) {
  const token = await this.oauth.refreshIfNeeded(connection);
  await this.salesforceApi.health(
    this.salesforceCredentials(connection, token.accessToken),
  );
};

const apiKeyHealthHandler146: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  _stored,
) {
  const token = await this.oauth.refreshIfNeeded(connection);
  await this.hubSpotApi.health(
    this.hubSpotCredentials(connection, token.accessToken),
  );
};

const apiKeyHealthHandler147: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  _stored,
) {
  const token = await this.oauth.refreshIfNeeded(connection);
  await this.pipedriveApi.health(
    this.pipedriveCredentials(connection, token.accessToken),
  );
};

const apiKeyHealthHandler148: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  _stored,
) {
  const token = await this.oauth.refreshIfNeeded(connection);
  await this.teamleaderApi.health({ accessToken: token.accessToken });
};

const apiKeyHealthHandler149: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  _stored,
) {
  const token = await this.oauth.refreshIfNeeded(connection);
  await this.zohoApi.health(
    this.zohoCredentials(connection, token.accessToken),
  );
};

const apiKeyHealthHandler150: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  _stored,
) {
  const token = await this.oauth.refreshIfNeeded(connection);
  const identity = await this.zohoPeopleApi.health(
    this.zohoPeopleCredentials(connection, token.accessToken),
  );
  connection.metadata = {
    ...(connection.metadata ?? {}),
    zohoPeopleUserId: identity.userId,
    zohoPeopleDisplayName: identity.displayName,
    zohoPeopleEmail: identity.email,
    zohoPeopleApiOrigin: identity.apiOrigin,
    zohoAccountsOrigin: identity.accountsOrigin,
    accountLabel: identity.displayName ?? identity.email ?? "Zoho People user",
  };
};

const apiKeyHealthHandler151: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  _stored,
) {
  const token = await this.oauth.refreshIfNeeded(connection);
  const identity = await this.zohoCampaignsApi.health(
    this.zohoCampaignsCredentials(connection, token.accessToken),
  );
  connection.metadata = {
    ...(connection.metadata ?? {}),
    zohoCampaignsUserId: identity.userId,
    zohoCampaignsDisplayName: identity.displayName,
    zohoCampaignsEmail: identity.email,
    zohoCampaignsApiOrigin: identity.apiOrigin,
    zohoAccountsOrigin: identity.accountsOrigin,
    accountLabel:
      identity.displayName ?? identity.email ?? "Zoho Campaigns user",
  };
};

const apiKeyHealthHandler152: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  _stored,
) {
  const token = await this.oauth.refreshIfNeeded(connection);
  const identity = await this.zohoAnalyticsApi.health(
    this.zohoAnalyticsCredentials(connection, token.accessToken),
  );
  connection.metadata = {
    ...(connection.metadata ?? {}),
    zohoAnalyticsUserId: identity.userId,
    zohoAnalyticsDisplayName: identity.displayName,
    zohoAnalyticsEmail: identity.email,
    zohoAnalyticsApiOrigin: identity.apiOrigin,
    zohoAccountsOrigin: identity.accountsOrigin,
    accountLabel:
      identity.displayName ?? identity.email ?? "Zoho Analytics user",
  };
};

const apiKeyHealthHandler153: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  _stored,
) {
  const token = await this.oauth.refreshIfNeeded(connection);
  await this.copperApi.health(
    this.copperCredentials(connection, token.accessToken),
  );
};

const apiKeyHealthHandler154: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  _stored,
) {
  const token = await this.oauth.refreshIfNeeded(connection);
  await this.closeApi.health(
    this.closeCredentials(connection, token.accessToken),
  );
};

const apiKeyHealthHandler155: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  _stored,
) {
  const token = await this.oauth.refreshIfNeeded(connection);
  await this.zendeskApi.health(
    this.zendeskCredentials(connection, token.accessToken),
  );
};

const apiKeyHealthHandler156: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  _stored,
) {
  const token = await this.oauth.refreshIfNeeded(connection);
  await this.intercomApi.health(
    this.intercomCredentials(connection, token.accessToken),
  );
};

const apiKeyHealthHandler157: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  _stored,
) {
  const token = await this.oauth.refreshIfNeeded(connection);
  await this.datadogApi.health(
    this.datadogCredentials(connection, token.accessToken),
  );
};

const apiKeyHealthHandler158: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  _stored,
) {
  const token = await this.oauth.refreshIfNeeded(connection);
  await this.pagerDutyApi.health(
    this.pagerDutyCredentials(connection, token.accessToken),
  );
};

const apiKeyHealthHandler159: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.ghostApi.getSite(this.ghostCredentials(stored));
};

const apiKeyHealthHandler160: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.codaApi.health(this.codaCredentials(stored));
};

const apiKeyHealthHandler161: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.craftApi.health(this.craftCredentials(stored));
};

const apiKeyHealthHandler162: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const identity = await this.telegramPersonalBotsApi.health(
    this.telegramPersonalBotsCredentials(stored),
  );
  connection.metadata = {
    ...(connection.metadata ?? {}),
    telegramBotId: identity.id,
    telegramBotUsername: identity.username,
    telegramAllowedChatCount: identity.allowedChatCount,
    accountLabel: identity.username
      ? `@${identity.username}`
      : (identity.firstName ?? "Telegram bot"),
  };
};

const apiKeyHealthHandler163: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const health = await this.matomoSelfHostedApi.health(
    this.matomoSelfHostedCredentials(stored),
  );
  connection.metadata = {
    ...(connection.metadata ?? {}),
    matomoSiteId: health.siteId,
    accountLabel: `Matomo site ${health.siteId}`,
  };
};

const apiKeyHealthHandler164: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const health = await this.plausibleSelfHostedApi.health(
    this.plausibleSelfHostedCredentials(stored),
  );
  connection.metadata = {
    ...(connection.metadata ?? {}),
    plausibleSiteId: health.siteId,
    accountLabel: `Plausible ${health.siteId}`,
  };
};

const apiKeyHealthHandler165: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const health = await this.umamiSelfHostedApi.health(
    this.umamiSelfHostedCredentials(stored),
  );
  connection.metadata = {
    ...(connection.metadata ?? {}),
    umamiWebsiteId: health.websiteId,
    accountLabel: `Umami website ${health.websiteId}`,
  };
};

const apiKeyHealthHandler166: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const health = await this.ghostSelfHostedApi.health(
    this.ghostSelfHostedCredentials(stored),
  );
  connection.metadata = {
    ...(connection.metadata ?? {}),
    ghostHost: health.host,
    accountLabel: `Ghost ${health.host}`,
  };
};

const apiKeyHealthHandler167: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const health = await this.xrayTestManagementApi.health(
    this.xrayTestManagementCredentials(stored),
  );
  connection.metadata = {
    ...(connection.metadata ?? {}),
    xrayProjectId: health.projectId,
    accountLabel: `Xray project ${health.projectId}`,
  };
};

const apiKeyHealthHandler168: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const health = await this.structureForJiraApi.health(
    this.structureForJiraCredentials(stored),
  );
  connection.metadata = {
    ...(connection.metadata ?? {}),
    structureRegion: health.region,
    accountLabel: `Structure Cloud ${health.region}`,
  };
};

const apiKeyHealthHandler169: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const health = await this.productPlanApi.health(
    this.productPlanCredentials(stored),
  );
  connection.metadata = {
    ...(connection.metadata ?? {}),
    accessibleRoadmaps: health.accessibleRoadmaps,
    accountLabel: "ProductPlan API user",
  };
};

const apiKeyHealthHandler170: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const health = await this.craftIoApi.health(this.craftIoCredentials(stored));
  connection.metadata = {
    ...(connection.metadata ?? {}),
    craftIoRegion: health.region,
    accessibleWorkspaces: health.workspaceCount,
    accountLabel: `Craft.io ${health.region.toUpperCase()} account`,
  };
};

const apiKeyHealthHandler171: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const health = await this.airfocusApi.health(
    this.airfocusCredentials(stored),
  );
  connection.metadata = {
    ...(connection.metadata ?? {}),
    airfocusRegion: health.region,
    accessibleWorkspaces: health.workspaceCount,
    accountLabel: `Airfocus ${health.region.toUpperCase()} user`,
  };
};

const apiKeyHealthHandler172: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const health = await this.favroApi.health(this.favroCredentials(stored));
  connection.metadata = {
    ...(connection.metadata ?? {}),
    accessibleOrganizations: health.organizationCount,
    accountLabel: "Favro API user",
  };
};

const apiKeyHealthHandler173: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const health = await this.planviewAgilePlaceApi.health(
    this.planviewAgilePlaceCredentials(stored),
  );
  connection.metadata = {
    ...(connection.metadata ?? {}),
    planviewAgilePlaceHostname: health.accountHostname,
    accessibleBoards: health.boardCount,
    accountLabel: "Planview AgilePlace API user",
  };
};

export const ApiKeyHealthHandlers05 = {
  discourse: apiKeyHealthHandler134,
  "vanilla-forums": apiKeyHealthHandler135,
  bettermode: apiKeyHealthHandler136,
  "higher-logic": apiKeyHealthHandler137,
  hivebrite: apiKeyHealthHandler138,
  stripe: apiKeyHealthHandler139,
  xero: apiKeyHealthHandler140,
  quickbooks: apiKeyHealthHandler141,
  freshbooks: apiKeyHealthHandler142,
  wave: apiKeyHealthHandler143,
  freeagent: apiKeyHealthHandler144,
  salesforce: apiKeyHealthHandler145,
  hubspot: apiKeyHealthHandler146,
  pipedrive: apiKeyHealthHandler147,
  teamleader: apiKeyHealthHandler148,
  zoho: apiKeyHealthHandler149,
  "zoho-people": apiKeyHealthHandler150,
  "zoho-campaigns": apiKeyHealthHandler151,
  "zoho-analytics": apiKeyHealthHandler152,
  copper: apiKeyHealthHandler153,
  close: apiKeyHealthHandler154,
  zendesk: apiKeyHealthHandler155,
  intercom: apiKeyHealthHandler156,
  datadog: apiKeyHealthHandler157,
  pagerduty: apiKeyHealthHandler158,
  ghost: apiKeyHealthHandler159,
  coda: apiKeyHealthHandler160,
  craft: apiKeyHealthHandler161,
  "telegram-personal-bots": apiKeyHealthHandler162,
  "matomo-self-hosted": apiKeyHealthHandler163,
  "plausible-self-hosted": apiKeyHealthHandler164,
  "umami-self-hosted": apiKeyHealthHandler165,
  "ghost-self-hosted": apiKeyHealthHandler166,
  "xray-test-management": apiKeyHealthHandler167,
  "structure-for-jira": apiKeyHealthHandler168,
  productplan: apiKeyHealthHandler169,
  "craft-io": apiKeyHealthHandler170,
  airfocus: apiKeyHealthHandler171,
  favro: apiKeyHealthHandler172,
  "planview-agileplace": apiKeyHealthHandler173,
} satisfies ApiKeyHealthHandlerMap;
