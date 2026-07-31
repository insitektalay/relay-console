import type {
  ApiKeyHealthHandler,
  ApiKeyHealthHandlerMap,
} from "./api-key-health-handler";

const apiKeyHealthHandler063: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const identity = await this.meltwaterApi.health(
    this.meltwaterCredentials(stored),
  );
  connection.metadata = {
    ...(connection.metadata ?? {}),
    meltwaterApiOrigin: identity.apiOrigin,
    accountLabel: "Meltwater API package",
  };
};

const apiKeyHealthHandler064: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const identity = await this.sprinklrApi.health(
    this.sprinklrCredentials(stored),
  );
  connection.metadata = {
    ...(connection.metadata ?? {}),
    sprinklrApiOrigin: identity.apiOrigin,
    sprinklrEnvironment: identity.environment,
    sprinklrWorkspaceId: identity.workspaceId,
    accountLabel: `Sprinklr ${identity.environment} workspace …${identity.workspaceId.slice(-8)}`,
  };
};

const apiKeyHealthHandler065: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const identity = await this.khorosApi.health(this.khorosCredentials(stored));
  connection.metadata = {
    ...(connection.metadata ?? {}),
    khorosApiOrigin: identity.apiOrigin,
    khorosCompanyId: identity.companyId,
    accountLabel: `Khoros Marketing company …${identity.companyId.slice(-8)}`,
  };
};

const apiKeyHealthHandler066: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const identity = await this.freshserviceApi.health(
    this.freshserviceCredentials(stored),
  );
  connection.metadata = {
    ...(connection.metadata ?? {}),
    freshserviceDomain: identity.domain,
    accountLabel: `${identity.domain}.freshservice.com`,
  };
};

const apiKeyHealthHandler067: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const identity = await this.freshchatApi.health(
    this.freshchatCredentials(stored),
  );
  connection.metadata = {
    ...(connection.metadata ?? {}),
    freshchatAccountUrl: identity.accountUrl,
    freshchatAccountId: identity.accountId,
    accountLabel: identity.accountDomain ?? identity.accountUrl,
  };
};

const apiKeyHealthHandler068: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const identity = await this.freshmarketerApi.health(
    this.freshmarketerCredentials(stored),
  );
  connection.metadata = {
    ...(connection.metadata ?? {}),
    freshmarketerBundleUrl: identity.bundleUrl,
    accountLabel: identity.bundleUrl,
  };
};

const apiKeyHealthHandler069: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const identity = await this.freshcallerApi.health(
    this.freshcallerCredentials(stored),
  );
  connection.metadata = {
    ...(connection.metadata ?? {}),
    freshcallerDomain: identity.domain,
    accountLabel: `${identity.domain}.freshcaller.com`,
  };
};

const apiKeyHealthHandler070: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const identity = await this.liveChatApi.health(
    this.liveChatCredentials(stored),
  );
  connection.metadata = {
    ...(connection.metadata ?? {}),
    liveChatApiOrigin: identity.apiOrigin,
    liveChatApiVersion: identity.apiVersion,
    accountLabel: "LiveChat Agent Chat API",
  };
};

const apiKeyHealthHandler071: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const identity = await this.liveAgentApi.health(
    this.liveAgentCredentials(stored),
  );
  connection.metadata = {
    ...(connection.metadata ?? {}),
    liveAgentDomain: identity.domain,
    liveAgentApiVersion: identity.apiVersion,
    accountLabel: identity.domain,
  };
};

const apiKeyHealthHandler072: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const identity = await this.crispApi.health(this.crispCredentials(stored));
  connection.metadata = {
    ...(connection.metadata ?? {}),
    crispApiOrigin: identity.apiOrigin,
    crispApiVersion: identity.apiVersion,
    crispWebsiteIdHash: this.hash(identity.websiteId),
    accountLabel: `Crisp website ${identity.websiteId.slice(0, 8)}`,
  };
};

const apiKeyHealthHandler073: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const identity = await this.tidioApi.health(this.tidioCredentials(stored));
  connection.metadata = {
    ...(connection.metadata ?? {}),
    tidioApiOrigin: identity.apiOrigin,
    tidioApiVersion: identity.apiVersion,
    accountLabel: "Tidio OpenAPI project",
  };
};

const apiKeyHealthHandler074: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const identity = this.olarkWebhook.health(this.olarkCredentials(stored));
  connection.metadata = {
    ...(connection.metadata ?? {}),
    olarkIntegration: identity.integration,
    olarkApiSurface: identity.apiSurface,
    accountLabel: "Olark transcript webhook",
  };
};

const apiKeyHealthHandler075: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const identity = await this.userlikeApi.health(
    this.userlikeCredentials(stored),
  );
  connection.metadata = {
    ...(connection.metadata ?? {}),
    userlikeApiOrigin: identity.apiOrigin,
    userlikeApiVersion: identity.apiVersion,
    accountLabel: "Userlike organization",
  };
};

const apiKeyHealthHandler076: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const identity = await this.gladlyApi.health(this.gladlyCredentials(stored));
  connection.metadata = {
    ...(connection.metadata ?? {}),
    gladlyApiOrigin: identity.apiOrigin,
    gladlyApiVersion: identity.apiVersion,
    accountLabel: "Gladly organization",
  };
};

const apiKeyHealthHandler077: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const identity = await this.kustomerApi.health(
    this.kustomerCredentials(stored),
  );
  connection.metadata = {
    ...(connection.metadata ?? {}),
    kustomerApiOrigin: identity.apiOrigin,
    kustomerApiVersion: identity.apiVersion,
    accountLabel: "Kustomer organization",
  };
};

const apiKeyHealthHandler078: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const identity = await this.gorgiasApi.health(
    this.gorgiasCredentials(stored),
  );
  connection.metadata = {
    ...(connection.metadata ?? {}),
    gorgiasApiOrigin: identity.apiOrigin,
    gorgiasApiVersion: identity.apiVersion,
    accountLabel: "Gorgias account",
  };
};

const apiKeyHealthHandler079: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const identity = await this.reAmazeApi.health(
    this.reAmazeCredentials(stored),
  );
  connection.metadata = {
    ...(connection.metadata ?? {}),
    reamazeApiOrigin: identity.apiOrigin,
    reamazeApiVersion: identity.apiVersion,
    accountLabel: "Re:amaze brand",
  };
};

const apiKeyHealthHandler080: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const identity = await this.edeskApi.health(this.edeskCredentials(stored));
  connection.metadata = {
    ...(connection.metadata ?? {}),
    edeskApiOrigin: identity.apiOrigin,
    edeskApiVersion: identity.apiVersion,
    accountLabel: "eDesk account",
  };
};

const apiKeyHealthHandler081: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const identity = await this.kayakoApi.health(this.kayakoCredentials(stored));
  connection.metadata = {
    ...(connection.metadata ?? {}),
    kayakoApiOrigin: identity.apiOrigin,
    kayakoApiVersion: identity.apiVersion,
    accountLabel: "Kayako tenant",
  };
};

const apiKeyHealthHandler082: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const identity = await this.acquireApi.health(
    this.acquireCredentials(stored),
  );
  connection.metadata = {
    ...(connection.metadata ?? {}),
    acquireApiOrigin: identity.apiOrigin,
    acquireApiVersion: identity.apiVersion,
    accountLabel: "Acquire account",
  };
};

const apiKeyHealthHandler083: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const identity = await this.airmeetApi.health(
    this.airmeetCredentials(stored),
  );
  connection.metadata = {
    ...(connection.metadata ?? {}),
    airmeetApiOrigin: identity.apiOrigin,
    airmeetRegion: identity.region,
    accountLabel: `Airmeet ${identity.region} community`,
  };
};

const apiKeyHealthHandler084: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const identity = await this.splashApi.health(this.splashCredentials(stored));
  connection.metadata = {
    ...(connection.metadata ?? {}),
    splashApiOrigin: identity.apiOrigin,
    accountLabel: identity.username,
  };
};

const apiKeyHealthHandler085: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const identity = await this.cventApi.health(this.cventCredentials(stored));
  connection.metadata = {
    ...(connection.metadata ?? {}),
    cventApiOrigin: identity.apiOrigin,
    cventRegion: identity.region,
    accountLabel: `Cvent ${identity.region.toUpperCase()} account`,
  };
};

const apiKeyHealthHandler086: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const identity = await this.bizzaboApi.health(
    this.eventPlatformCredentials(stored, "BIZZABO_API_KEY"),
  );
  connection.metadata = {
    ...(connection.metadata ?? {}),
    bizzaboApiOrigin: identity.apiOrigin,
    accountLabel: "Bizzabo account",
  };
};

const apiKeyHealthHandler087: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const identity = await this.goldcastApi.health(
    this.eventPlatformCredentials(stored, "GOLDCAST_API_TOKEN"),
  );
  connection.metadata = {
    ...(connection.metadata ?? {}),
    goldcastApiOrigin: identity.apiOrigin,
    accountLabel: "Goldcast organization",
  };
};

const apiKeyHealthHandler088: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const identity = await this.eventzillaApi.health(
    this.eventPlatformCredentials(stored, "EVENTZILLA_API_KEY"),
  );
  connection.metadata = {
    ...(connection.metadata ?? {}),
    eventzillaApiOrigin: identity.apiOrigin,
    accountLabel: "Eventzilla account",
  };
};

const apiKeyHealthHandler089: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const identity = await this.ticketTailorApi.health(
    this.eventPlatformCredentials(stored, "TICKET_TAILOR_API_KEY"),
  );
  connection.metadata = {
    ...(connection.metadata ?? {}),
    ticketTailorApiOrigin: identity.apiOrigin,
    accountLabel: "Ticket Tailor box office",
  };
};

const apiKeyHealthHandler090: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const identity = await this.humanitixApi.health(
    this.eventPlatformCredentials(stored, "HUMANITIX_API_KEY"),
  );
  connection.metadata = {
    ...(connection.metadata ?? {}),
    humanitixApiOrigin: identity.apiOrigin,
    accountLabel: "Humanitix account",
  };
};

const apiKeyHealthHandler091: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const identity = await this.buildiumApi.health(
    this.buildiumCredentials(stored),
  );
  connection.metadata = {
    ...(connection.metadata ?? {}),
    buildiumApiOrigin: identity.apiOrigin,
    accountLabel: "Buildium property-management account",
  };
};

const apiKeyHealthHandler092: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const identity = await this.sessionizeApi.health(
    this.sessionizeCredentials(stored),
  );
  connection.metadata = {
    ...(connection.metadata ?? {}),
    sessionizeApiOrigin: identity.apiOrigin,
    accountLabel: "Sessionize event endpoint",
  };
};

const apiKeyHealthHandler093: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const identity = await this.pretixApi.health(this.pretixCredentials(stored));
  connection.metadata = {
    ...(connection.metadata ?? {}),
    pretixApiOrigin: identity.apiOrigin,
    pretixOrganizer: identity.organizer,
    accountLabel: `pretix ${identity.organizer}`,
  };
};

const apiKeyHealthHandler094: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const identity = await this.donorboxApi.health(
    this.donorboxCredentials(stored),
  );
  connection.metadata = {
    ...(connection.metadata ?? {}),
    donorboxApiOrigin: identity.apiOrigin,
    accountLabel: "Donorbox organization",
  };
};

const apiKeyHealthHandler095: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const identity = await this.cleverTapApi.health(
    this.cleverTapCredentials(stored),
  );
  connection.metadata = {
    ...(connection.metadata ?? {}),
    cleverTapApiOrigin: identity.apiOrigin,
    cleverTapRegion: identity.region,
    accountLabel: `CleverTap ${identity.region} project …${identity.accountIdSuffix}`,
  };
};

export const ApiKeyHealthHandlers03 = {
  meltwater: apiKeyHealthHandler063,
  sprinklr: apiKeyHealthHandler064,
  khoros: apiKeyHealthHandler065,
  freshservice: apiKeyHealthHandler066,
  freshchat: apiKeyHealthHandler067,
  freshmarketer: apiKeyHealthHandler068,
  freshcaller: apiKeyHealthHandler069,
  livechat: apiKeyHealthHandler070,
  liveagent: apiKeyHealthHandler071,
  crisp: apiKeyHealthHandler072,
  tidio: apiKeyHealthHandler073,
  olark: apiKeyHealthHandler074,
  userlike: apiKeyHealthHandler075,
  gladly: apiKeyHealthHandler076,
  kustomer: apiKeyHealthHandler077,
  gorgias: apiKeyHealthHandler078,
  "re-amaze": apiKeyHealthHandler079,
  edesk: apiKeyHealthHandler080,
  kayako: apiKeyHealthHandler081,
  acquire: apiKeyHealthHandler082,
  airmeet: apiKeyHealthHandler083,
  splash: apiKeyHealthHandler084,
  cvent: apiKeyHealthHandler085,
  bizzabo: apiKeyHealthHandler086,
  goldcast: apiKeyHealthHandler087,
  eventzilla: apiKeyHealthHandler088,
  "ticket-tailor": apiKeyHealthHandler089,
  humanitix: apiKeyHealthHandler090,
  buildium: apiKeyHealthHandler091,
  sessionize: apiKeyHealthHandler092,
  pretix: apiKeyHealthHandler093,
  donorbox: apiKeyHealthHandler094,
  clevertap: apiKeyHealthHandler095,
} satisfies ApiKeyHealthHandlerMap;
