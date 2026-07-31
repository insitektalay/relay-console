import type {
  ApiKeyHealthHandler,
  ApiKeyHealthHandlerMap,
} from "./api-key-health-handler";

const apiKeyHealthHandler096: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const identity = await this.oneSignalApi.health(
    this.oneSignalCredentials(stored),
  );
  connection.metadata = {
    ...(connection.metadata ?? {}),
    oneSignalApiOrigin: identity.apiOrigin,
    oneSignalAppId: identity.appId,
    accountLabel: `OneSignal app …${identity.appId.slice(-8)}`,
  };
};

const apiKeyHealthHandler097: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const identity = await this.airshipApi.health(
    this.airshipCredentials(stored),
  );
  connection.metadata = {
    ...(connection.metadata ?? {}),
    airshipApiOrigin: identity.apiOrigin,
    airshipCloudSite: identity.cloudSite,
    accountLabel: `Airship ${identity.cloudSite.toUpperCase()} project`,
  };
};

const apiKeyHealthHandler098: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const identity = await this.pushwooshApi.health(
    this.pushwooshCredentials(stored),
  );
  connection.metadata = {
    ...(connection.metadata ?? {}),
    pushwooshApiOrigin: identity.apiOrigin,
    pushwooshApplicationCode: identity.applicationCode,
    accountLabel: `Pushwoosh app ${identity.applicationCode}`,
  };
};

const apiKeyHealthHandler099: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const identity = this.pusherBeamsApi.health(
    this.pusherBeamsCredentials(stored),
  );
  connection.metadata = {
    ...(connection.metadata ?? {}),
    pusherBeamsApiOrigin: identity.apiOrigin,
    pusherBeamsInstanceId: identity.instanceId,
    pusherBeamsInterest: identity.interest,
    accountLabel: `Pusher Beams ${identity.instanceId.slice(-8)} / ${identity.interest}`,
  };
};

const apiKeyHealthHandler100: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const identity = this.firebaseCloudMessagingApi.health(
    this.firebaseCloudMessagingCredentials(stored),
  );
  connection.metadata = {
    ...(connection.metadata ?? {}),
    fcmApiOrigin: identity.apiOrigin,
    fcmProjectId: identity.projectId,
    fcmTopic: identity.topic,
    accountLabel: `FCM ${identity.projectId} / ${identity.topic}`,
  };
};

const apiKeyHealthHandler101: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const identity = await this.appsFlyerApi.health(
    this.appsFlyerCredentials(stored),
  );
  connection.metadata = {
    ...(connection.metadata ?? {}),
    appsFlyerApiOrigin: identity.apiOrigin,
    accountLabel: "AppsFlyer account",
  };
};

const apiKeyHealthHandler102: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const identity = await this.adjustApi.health(this.adjustCredentials(stored));
  connection.metadata = {
    ...(connection.metadata ?? {}),
    adjustApiOrigin: identity.apiOrigin,
    accountLabel: "Adjust account",
  };
};

const apiKeyHealthHandler103: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const identity = await this.branchApi.health(this.branchCredentials(stored));
  connection.metadata = {
    ...(connection.metadata ?? {}),
    branchApiOrigin: identity.apiOrigin,
    accountLabel: "Branch bound link",
  };
};

const apiKeyHealthHandler104: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const identity = await this.singularApi.health(
    this.singularCredentials(stored),
  );
  connection.metadata = {
    ...(connection.metadata ?? {}),
    singularApiOrigin: identity.apiOrigin,
    accountLabel: "Singular account",
  };
};

const apiKeyHealthHandler105: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const identity = await this.kochavaApi.health(
    this.kochavaCredentials(stored),
  );
  connection.metadata = {
    ...(connection.metadata ?? {}),
    kochavaApiOrigin: identity.apiOrigin,
    accountLabel: "Kochava account",
  };
};

const apiKeyHealthHandler106: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const identity = await this.segmentApi.health(
    this.segmentPersonasCredentials(stored),
  );
  connection.metadata = {
    ...(connection.metadata ?? {}),
    segmentApiOrigin: identity.apiOrigin,
    accountLabel: "Segment bound Space",
  };
};

const apiKeyHealthHandler107: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const identity = await this.mParticleApi.health(
    this.mParticleCredentials(stored),
  );
  connection.metadata = {
    ...(connection.metadata ?? {}),
    mParticleApiOrigin: identity.apiOrigin,
    accountLabel: "mParticle bound account/workspace",
  };
};

const apiKeyHealthHandler108: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const identity = await this.tealiumApi.health(
    this.tealiumCredentials(stored),
  );
  connection.metadata = {
    ...(connection.metadata ?? {}),
    tealiumApiOrigin: identity.apiOrigin,
    accountLabel: "Tealium bound account/profile",
  };
};

const apiKeyHealthHandler109: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const identity = await this.lyticsApi.health(this.lyticsCredentials(stored));
  connection.metadata = {
    ...(connection.metadata ?? {}),
    lyticsApiOrigin: identity.apiOrigin,
    accountLabel: "Lytics account",
  };
};

const apiKeyHealthHandler110: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const identity = await this.blueConicApi.health(
    this.blueConicCredentials(stored),
  );
  connection.metadata = {
    ...(connection.metadata ?? {}),
    blueConicApiOrigin: identity.apiOrigin,
    accountLabel: "BlueConic bound tenant",
  };
};

const apiKeyHealthHandler111: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const identity = await this.treasureDataApi.health(
    this.treasureDataCredentials(stored),
  );
  connection.metadata = {
    ...(connection.metadata ?? {}),
    treasureDataApiOrigin: identity.apiOrigin,
    accountLabel: "Treasure Data bound region",
  };
};

const apiKeyHealthHandler112: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const identity = await this.hightouchApi.health(
    this.hightouchCredentials(stored),
  );
  connection.metadata = {
    ...(connection.metadata ?? {}),
    hightouchApiOrigin: identity.apiOrigin,
    accountLabel: "Hightouch workspace",
  };
};

const apiKeyHealthHandler113: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const identity = await this.censusApi.health(this.censusCredentials(stored));
  connection.metadata = {
    ...(connection.metadata ?? {}),
    censusApiOrigin: identity.apiOrigin,
    accountLabel: "Census workspace",
  };
};

const apiKeyHealthHandler114: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  _stored,
) {
  const token = await this.oauth.refreshIfNeeded(connection);
  const identity = await this.clioManageApi.health({
    accessToken: token.accessToken,
  });
  connection.metadata = {
    ...(connection.metadata ?? {}),
    clioManageApiOrigin: identity.apiOrigin,
    clioManageApiRegion: identity.apiRegion,
    accountLabel: "Clio Manage US connection",
  };
};

const apiKeyHealthHandler115: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  _stored,
) {
  const token = await this.oauth.refreshIfNeeded(connection);
  const identity = await this.clioGrowApi.health({
    accessToken: token.accessToken,
  });
  connection.metadata = {
    ...(connection.metadata ?? {}),
    clioGrowApiOrigin: identity.apiOrigin,
    clioGrowApiRegion: identity.apiRegion,
    accountLabel: "Clio Grow US connection",
  };
};

const apiKeyHealthHandler116: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const identity = await this.myCaseApi.health(this.myCaseCredentials(stored));
  connection.metadata = {
    ...(connection.metadata ?? {}),
    myCaseApiOrigin: identity.apiOrigin,
    myCaseApiVersion: identity.apiVersion,
    accountLabel: "MyCase firm",
  };
};

const apiKeyHealthHandler117: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  _stored,
) {
  const token = await this.oauth.refreshIfNeeded(connection);
  const identity = await this.practicePantherApi.health({
    accessToken: token.accessToken,
  });
  connection.metadata = {
    ...(connection.metadata ?? {}),
    practicePantherApiOrigin: identity.apiOrigin,
    practicePantherApiVersion: identity.apiVersion,
    accountLabel: "PracticePanther connection",
  };
};

const apiKeyHealthHandler118: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const token = await this.oauth.refreshIfNeeded(connection);
  const identity = await this.smokeballApi.health({
    accessToken: token.accessToken,
    apiKey: this.stringOrNull(stored?.smokeballApiKey) ?? "",
  });
  connection.metadata = {
    ...(connection.metadata ?? {}),
    smokeballApiOrigin: identity.apiOrigin,
    smokeballApiRegion: identity.apiRegion,
    smokeballApiVersion: identity.apiVersion,
    accountLabel: "Smokeball US firm",
  };
};

const apiKeyHealthHandler119: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  _stored,
) {
  const token = await this.oauth.refreshIfNeeded(connection);
  await this.lawPayApi.health({ accessToken: token.accessToken });
};

const apiKeyHealthHandler120: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  _stored,
) {
  const token = await this.oauth.refreshIfNeeded(connection);
  await this.filevineApi.health({ accessToken: token.accessToken });
};

const apiKeyHealthHandler121: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.discoEdiscoveryApi.health(this.discoEdiscoveryCredentials(stored));
};

const apiKeyHealthHandler122: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  _stored,
) {
  const token = await this.oauth.refreshIfNeeded(connection);
  await this.microsoft365EdiscoveryGraph.health(token.accessToken);
};

const apiKeyHealthHandler123: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  _stored,
) {
  const token = await this.oauth.refreshIfNeeded(connection);
  await this.googleVaultApi.health(token.accessToken);
};

const apiKeyHealthHandler124: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.freshdeskApi.health(this.freshdeskCredentials(stored));
};

const apiKeyHealthHandler125: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const account = await this.grooveApi.health(
    this.grooveCredentials(stored, connection),
  );
  connection.metadata = {
    ...(connection.metadata ?? {}),
    grooveAccountId: account.id,
    grooveSubdomain: account.subdomain,
    accountLabel: account.subdomain
      ? `${account.subdomain}.groovehq.com`
      : "Groove account",
  };
};

const apiKeyHealthHandler126: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.sanityApi.listDocuments(this.sanityCredentials(stored), {
    limit: 1,
  });
};

const apiKeyHealthHandler127: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  const credentials = this.strapiCloudCredentials(stored);
  const first =
    this.strapiCloudApi.listConfiguredContentTypes(credentials).pluralApiIds[0];
  await this.strapiCloudApi.listDocuments(credentials, {
    pluralApiId: first,
    pageSize: 1,
  });
};

const apiKeyHealthHandler128: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  _stored,
) {
  const token = await this.oauth.refreshIfNeeded(connection);
  await this.shopifyApi.getShop(
    this.shopifyCredentials(connection, token.accessToken),
  );
};

const apiKeyHealthHandler129: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.wooCommerceApi.health(this.wooCommerceCredentials(stored));
};

const apiKeyHealthHandler130: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.paypalApi.health(this.paypalCredentials(stored));
};

const apiKeyHealthHandler131: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const profile = await this.kajabiCommunitiesApi.health(
    this.kajabiCommunitiesCredentials(stored),
  );
  connection.metadata = {
    ...(connection.metadata ?? {}),
    kajabiUserId: profile.user.id,
    accountLabel: profile.user.name ?? profile.user.email ?? "Kajabi account",
  };
};

const apiKeyHealthHandler132: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const profile = await this.circleApi.health(this.circleCredentials(stored));
  connection.metadata = {
    ...(connection.metadata ?? {}),
    circleCommunityId: profile.community.id,
    circleCommunitySlug: profile.community.slug,
    accountLabel: profile.community.name ?? "Circle community",
  };
};

const apiKeyHealthHandler133: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const profile = await this.mightyNetworksApi.health(
    this.mightyNetworksCredentials(stored, connection.metadata),
  );
  connection.metadata = {
    ...(connection.metadata ?? {}),
    mightyNetworkId: profile.network.id,
    mightyNetworkDomain: profile.network.domain ?? profile.network.subdomain,
    accountLabel: profile.network.name ?? "Mighty Network",
  };
};

export const ApiKeyHealthHandlers04 = {
  onesignal: apiKeyHealthHandler096,
  airship: apiKeyHealthHandler097,
  pushwoosh: apiKeyHealthHandler098,
  "pusher-beams": apiKeyHealthHandler099,
  "firebase-cloud-messaging": apiKeyHealthHandler100,
  appsflyer: apiKeyHealthHandler101,
  adjust: apiKeyHealthHandler102,
  branch: apiKeyHealthHandler103,
  singular: apiKeyHealthHandler104,
  kochava: apiKeyHealthHandler105,
  "segment-personas": apiKeyHealthHandler106,
  mparticle: apiKeyHealthHandler107,
  tealium: apiKeyHealthHandler108,
  lytics: apiKeyHealthHandler109,
  blueconic: apiKeyHealthHandler110,
  "treasure-data": apiKeyHealthHandler111,
  hightouch: apiKeyHealthHandler112,
  census: apiKeyHealthHandler113,
  "clio-manage": apiKeyHealthHandler114,
  "clio-grow": apiKeyHealthHandler115,
  mycase: apiKeyHealthHandler116,
  practicepanther: apiKeyHealthHandler117,
  smokeball: apiKeyHealthHandler118,
  lawpay: apiKeyHealthHandler119,
  filevine: apiKeyHealthHandler120,
  "disco-ediscovery": apiKeyHealthHandler121,
  "microsoft-365-ediscovery": apiKeyHealthHandler122,
  "google-vault": apiKeyHealthHandler123,
  freshdesk: apiKeyHealthHandler124,
  groove: apiKeyHealthHandler125,
  sanity: apiKeyHealthHandler126,
  "strapi-cloud": apiKeyHealthHandler127,
  shopify: apiKeyHealthHandler128,
  woocommerce: apiKeyHealthHandler129,
  paypal: apiKeyHealthHandler130,
  "kajabi-communities": apiKeyHealthHandler131,
  circle: apiKeyHealthHandler132,
  "mighty-networks": apiKeyHealthHandler133,
} satisfies ApiKeyHealthHandlerMap;
