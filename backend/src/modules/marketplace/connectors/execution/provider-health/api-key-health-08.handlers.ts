import type {
  ApiKeyHealthHandler,
  ApiKeyHealthHandlerMap,
} from "./api-key-health-handler";
import { ConnectorExecutionError } from "../connector-execution.error";

const apiKeyHealthHandler338: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.mixpanelCohortsApi.health(this.mixpanelCohortsCredentials(stored));
};

const apiKeyHealthHandler339: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.postHogFeatureFlagsApi.health(
    this.postHogFeatureFlagsCredentials(stored),
  );
};

const apiKeyHealthHandler340: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.statsigApi.health(this.statsigCredentials(stored));
};

const apiKeyHealthHandler341: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.launchDarklyApi.health(this.launchDarklyCredentials(stored));
};

const apiKeyHealthHandler342: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.splitIoApi.health(this.splitIoCredentials(stored));
};

const apiKeyHealthHandler343: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.flagsmithCloudApi.health(this.flagsmithCloudCredentials(stored));
};

const apiKeyHealthHandler344: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.configCatApi.health(this.configCatCredentials(stored));
};

const apiKeyHealthHandler345: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.growthBookCloudApi.health(this.growthBookCloudCredentials(stored));
};

const apiKeyHealthHandler346: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.unleashCloudApi.health(this.unleashCloudCredentials(stored));
};

const apiKeyHealthHandler347: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.optimizelyRolloutsApi.health(
    this.optimizelyRolloutsCredentials(stored),
  );
};

const apiKeyHealthHandler348: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.vwoTestingApi.health(this.vwoTestingCredentials(stored));
};

const apiKeyHealthHandler349: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.abTastyFeatureExperimentationApi.health(
    this.abTastyFeatureExperimentationCredentials(stored),
  );
};

const apiKeyHealthHandler350: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  _stored,
) {
  const token = await this.oauth.refreshIfNeeded(connection);
  await this.klaviyoApi.health(
    this.klaviyoCredentials(connection, token.accessToken),
  );
};

const apiKeyHealthHandler351: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  _stored,
) {
  const token = await this.oauth.refreshIfNeeded(connection);
  await this.convertKitApi.health(
    this.convertKitCredentials(connection, token.accessToken),
  );
};

const apiKeyHealthHandler352: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  _stored,
) {
  const token = await this.oauth.refreshIfNeeded(connection);
  await this.campaignMonitorApi.health(
    this.campaignMonitorCredentials(connection, token.accessToken),
  );
};

const apiKeyHealthHandler353: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  _stored,
) {
  const token = await this.oauth.refreshIfNeeded(connection);
  await this.constantContactApi.health(
    this.constantContactCredentials(connection, token.accessToken),
  );
};

const apiKeyHealthHandler354: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.activeCampaignApi.health(this.activeCampaignCredentials(stored));
};

const apiKeyHealthHandler355: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.customerIoApi.health(this.customerIoCredentials(stored));
};

const apiKeyHealthHandler356: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.brazeApi.health(this.brazeCredentials(stored));
};

const apiKeyHealthHandler357: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.segmentApi.health(this.segmentCredentials(stored));
};

const apiKeyHealthHandler358: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.mixpanelApi.health(this.mixpanelCredentials(stored));
};

const apiKeyHealthHandler359: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.amplitudeApi.health(this.amplitudeCredentials(stored));
};

const apiKeyHealthHandler360: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.pendoApi.health(this.pendoCredentials(stored));
};

const apiKeyHealthHandler361: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.wufooApi.health(this.wufooCredentials(stored));
};

const apiKeyHealthHandler362: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.roadmunkGraphql.health(this.roadmunkCredentials(stored));
};

const apiKeyHealthHandler363: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.shortcutApi.health(this.shortcutCredentials(stored));
};

const apiKeyHealthHandler364: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.hiveApi.health(this.hiveCredentials(stored));
};

const apiKeyHealthHandler365: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  _stored,
) {
  const token = await this.oauth.refreshIfNeeded(connection);
  await this.niftyApi.health(token.accessToken);
};

const apiKeyHealthHandler366: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.paymoApi.health(this.paymoCredentials(stored));
};

const apiKeyHealthHandler367: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.krakenApi.health(this.krakenCredentials(stored));
};

const apiKeyHealthHandler368: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.binanceApi.health(this.binanceCredentials(stored));
};

const apiKeyHealthHandler369: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.geminiApi.health(this.geminiCredentials(stored));
};

const apiKeyHealthHandler370: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.proofHubApi.health(this.proofHubCredentials(stored));
};

const apiKeyHealthHandler371: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.proofApi.health(this.proofCredentials(stored));
};

const apiKeyHealthHandler372: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.termlyApi.health(this.termlyCredentials(stored));
};

const apiKeyHealthHandler373: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.cookiebotApi.health(this.cookiebotCredentials(stored));
};

const apiKeyHealthHandler374: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.oneTrustApi.health(this.oneTrustCredentials(stored));
};

const apiKeyHealthHandler375: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.salesforceMarketingCloudApi.health(
    this.salesforceMarketingCloudCredentials(stored),
  );
};

const apiKeyHealthHandler376: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.salesforceCommerceCloudApi.health(
    this.salesforceCommerceCloudCredentials(stored),
  );
};

const apiKeyHealthHandler377: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.marketoApi.health(this.marketoCredentials(stored));
};

const apiKeyHealthHandler378: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.pardotApi.health(this.pardotCredentials(stored));
};

const apiKeyHealthHandler379: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.eloquaApi.health(this.eloquaCredentials(stored));
};

const apiKeyHealthHandler380: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const token = await this.oauth.refreshIfNeeded(connection);
  await this.dripApi.health(token.accessToken, this.dripBoundaries(stored));
};

const apiKeyHealthHandler381: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.mailerLiteApi.health(this.mailerLiteCredentials(stored));
};

const apiKeyHealthHandler382: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const token = await this.oauth.refreshIfNeeded(connection);
  await this.aweberApi.health(token.accessToken, this.aweberBoundaries(stored));
};

const apiKeyHealthHandler383: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const token = await this.oauth.refreshIfNeeded(connection);
  await this.getResponseApi.health(
    token.accessToken,
    this.getResponseBoundaries(stored),
  );
};

const apiKeyHealthHandler384: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.moosendApi.health(this.moosendCredentials(stored));
};

const apiKeyHealthHandler385: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const token = await this.oauth.refreshIfNeeded(connection);
  await this.omnisendApi.health(
    token.accessToken,
    this.omnisendBoundaries(stored),
  );
};

const apiKeyHealthHandler386: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.mailercloudApi.health(this.mailercloudCredentials(stored));
};

const apiKeyHealthHandler387: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.benchmarkEmailApi.health(this.benchmarkEmailCredentials(stored));
};

const apiKeyHealthHandler388: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.emmaApi.health(this.emmaCredentials(stored));
};

const apiKeyHealthHandler389: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.flodeskApi.health(this.flodeskCredentials(stored));
};

const apiKeyHealthHandler390: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  _stored,
) {
  const token = await this.oauth.refreshIfNeeded(connection);
  await this.meisterTaskApi.health(token.accessToken);
};

const apiKeyHealthHandler391: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.nozbeApi.health(this.nozbeCredentials(stored));
};

const apiKeyHealthHandler392: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.habiticaApi.health(this.habiticaCredentials(stored));
};

const apiKeyHealthHandler393: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.amazingMarvinApi.health(this.amazingMarvinCredentials(stored));
};

const apiKeyHealthHandler394: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  _stored,
) {
  const token = await this.oauth.refreshIfNeeded(connection);
  await this.akiflowMcp.health(token.accessToken);
};

const apiKeyHealthHandler395: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  _stored,
) {
  const token = await this.oauth.refreshIfNeeded(connection);
  await this.sunsamaMcp.health(token.accessToken);
};

const apiKeyHealthHandler396: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.motionApi.health(this.motionCredentials(stored));
};

const apiKeyHealthHandler397: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.reclaimAiApi.health(this.reclaimAiCredentials(stored));
};

const apiKeyHealthHandler398: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  _stored,
) {
  const token = await this.oauth.refreshIfNeeded(connection);
  await this.savvyCalApi.health(token.accessToken);
};

const apiKeyHealthHandler399: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.youCanBookMeApi.health(this.youCanBookMeCredentials(stored));
};

const apiKeyHealthHandler400: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  _stored,
) {
  const token = await this.oauth.refreshIfNeeded(connection);
  await this.acuitySchedulingApi.health(token.accessToken);
};

const apiKeyHealthHandler401: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.simplyBookMeApi.health(this.simplyBookMeCredentials(stored));
};

const apiKeyHealthHandler402: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.onceHubApi.health(this.onceHubCredentials(stored));
};

const apiKeyHealthHandler403: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.salesflareApi.health(this.salesflareCredentials(stored));
};

const apiKeyHealthHandler404: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  _stored,
) {
  const token = await this.oauth.refreshIfNeeded(connection);
  await this.zendeskSellApi.health(
    this.zendeskSellCredentials(token.accessToken),
  );
};

const apiKeyHealthHandler405: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  _stored,
) {
  const token = await this.oauth.refreshIfNeeded(connection);
  await this.keapMaxClassicApi.health(
    this.keapMaxClassicCredentials(token.accessToken),
  );
};

const apiKeyHealthHandler406: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.folkCrmApi.health(this.folkCrmCredentials(stored));
};

const apiKeyHealthHandler407: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.onePageCrmApi.health(this.onePageCrmCredentials(stored));
};

const apiKeyHealthHandler408: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.followUpBossApi.health(this.followUpBossCredentials(stored));
};

const apiKeyHealthHandler409: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.chimeCrmApi.health(this.chimeCrmCredentials(stored));
};

const apiKeyHealthHandler410: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.reallySimpleSystemsApi.health(
    this.reallySimpleSystemsCredentials(stored),
  );
};

const apiKeyHealthHandler411: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.vtigerCrmApi.health(this.vtigerCrmCredentials(stored));
};

const apiKeyHealthHandler412: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.suiteCrmCloudApi.health(this.suiteCrmCloudCredentials(stored));
};

const apiKeyHealthHandler413: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.sugarCrmApi.health(this.sugarCrmCredentials(stored));
};

const apiKeyHealthHandler414: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.creatioApi.health(this.creatioCredentials(stored));
};

const apiKeyHealthHandler415: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  _stored,
) {
  const token = await this.oauth.refreshIfNeeded(connection);
  await this.attioApi.health(
    this.attioCredentials(connection, token.accessToken),
  );
};

const apiKeyHealthHandler416: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.setmoreApi.health(this.setmoreCredentials(stored));
};

const apiKeyHealthHandler417: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.plutioApi.health(this.plutioCredentials(stored));
};

const apiKeyHealthHandler418: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.vagaroApi.health(this.vagaroCredentials(stored));
};

const apiKeyHealthHandler419: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.demioApi.health(this.demioCredentials(stored));
};

const apiKeyHealthHandler420: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.bigMarkerApi.health(this.bigMarkerCredentials(stored));
};

const apiKeyHealthHandler421: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.mindbodyApi.health(this.mindbodyCredentials(stored));
};

const apiKeyHealthHandler422: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  _stored,
) {
  const token = await this.oauth.refreshIfNeeded(connection);
  await this.janeAppApi.health(
    this.janeAppCredentials(token.credentials, connection.metadata),
  );
};

const apiKeyHealthHandler423: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.clinikoApi.health(this.clinikoCredentials(stored));
};

const apiKeyHealthHandler424: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.practiceBetterApi.health(this.practiceBetterCredentials(stored));
};

const apiKeyHealthHandler425: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  _stored,
) {
  const token = await this.oauth.refreshIfNeeded(connection);
  await this.anyDoMcp.health(token.accessToken);
};

const apiKeyHealthHandler426: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  _stored,
) {
  const token = await this.oauth.refreshIfNeeded(connection);
  await this.rememberTheMilkMcp.health(token.accessToken);
};

const apiKeyHealthHandler427: ApiKeyHealthHandler = async function (
  manifest,
  _connection,
  stored,
) {
  const apiKey = this.stringOrNull(stored?.EXA_API_KEY);
  if (!apiKey)
    throw new ConnectorExecutionError(
      "credential_missing",
      `${manifest.name} API key is missing.`,
    );
  await this.exaApi.health(apiKey);
};

export const ApiKeyHealthHandlers08 = {
  "mixpanel-cohorts": apiKeyHealthHandler338,
  "posthog-feature-flags": apiKeyHealthHandler339,
  statsig: apiKeyHealthHandler340,
  launchdarkly: apiKeyHealthHandler341,
  "split-io": apiKeyHealthHandler342,
  "flagsmith-cloud": apiKeyHealthHandler343,
  configcat: apiKeyHealthHandler344,
  "growthbook-cloud": apiKeyHealthHandler345,
  "unleash-cloud": apiKeyHealthHandler346,
  "optimizely-rollouts": apiKeyHealthHandler347,
  "vwo-testing": apiKeyHealthHandler348,
  "ab-tasty-feature-experimentation": apiKeyHealthHandler349,
  klaviyo: apiKeyHealthHandler350,
  convertkit: apiKeyHealthHandler351,
  "campaign-monitor": apiKeyHealthHandler352,
  "constant-contact": apiKeyHealthHandler353,
  activecampaign: apiKeyHealthHandler354,
  "customer-io": apiKeyHealthHandler355,
  braze: apiKeyHealthHandler356,
  segment: apiKeyHealthHandler357,
  mixpanel: apiKeyHealthHandler358,
  amplitude: apiKeyHealthHandler359,
  pendo: apiKeyHealthHandler360,
  wufoo: apiKeyHealthHandler361,
  roadmunk: apiKeyHealthHandler362,
  shortcut: apiKeyHealthHandler363,
  hive: apiKeyHealthHandler364,
  nifty: apiKeyHealthHandler365,
  paymo: apiKeyHealthHandler366,
  kraken: apiKeyHealthHandler367,
  binance: apiKeyHealthHandler368,
  gemini: apiKeyHealthHandler369,
  proofhub: apiKeyHealthHandler370,
  proof: apiKeyHealthHandler371,
  termly: apiKeyHealthHandler372,
  cookiebot: apiKeyHealthHandler373,
  onetrust: apiKeyHealthHandler374,
  "salesforce-marketing-cloud": apiKeyHealthHandler375,
  "salesforce-commerce-cloud": apiKeyHealthHandler376,
  marketo: apiKeyHealthHandler377,
  pardot: apiKeyHealthHandler378,
  eloqua: apiKeyHealthHandler379,
  drip: apiKeyHealthHandler380,
  mailerlite: apiKeyHealthHandler381,
  aweber: apiKeyHealthHandler382,
  getresponse: apiKeyHealthHandler383,
  moosend: apiKeyHealthHandler384,
  omnisend: apiKeyHealthHandler385,
  mailercloud: apiKeyHealthHandler386,
  "benchmark-email": apiKeyHealthHandler387,
  emma: apiKeyHealthHandler388,
  flodesk: apiKeyHealthHandler389,
  meistertask: apiKeyHealthHandler390,
  nozbe: apiKeyHealthHandler391,
  habitica: apiKeyHealthHandler392,
  "amazing-marvin": apiKeyHealthHandler393,
  akiflow: apiKeyHealthHandler394,
  sunsama: apiKeyHealthHandler395,
  motion: apiKeyHealthHandler396,
  "reclaim-ai": apiKeyHealthHandler397,
  savvycal: apiKeyHealthHandler398,
  youcanbookme: apiKeyHealthHandler399,
  "acuity-scheduling": apiKeyHealthHandler400,
  "simplybook-me": apiKeyHealthHandler401,
  oncehub: apiKeyHealthHandler402,
  salesflare: apiKeyHealthHandler403,
  "zendesk-sell": apiKeyHealthHandler404,
  "keap-max-classic": apiKeyHealthHandler405,
  "folk-crm": apiKeyHealthHandler406,
  onepagecrm: apiKeyHealthHandler407,
  "follow-up-boss": apiKeyHealthHandler408,
  "chime-crm": apiKeyHealthHandler409,
  "really-simple-systems": apiKeyHealthHandler410,
  "vtiger-crm": apiKeyHealthHandler411,
  "suitecrm-cloud": apiKeyHealthHandler412,
  sugarcrm: apiKeyHealthHandler413,
  creatio: apiKeyHealthHandler414,
  attio: apiKeyHealthHandler415,
  setmore: apiKeyHealthHandler416,
  plutio: apiKeyHealthHandler417,
  vagaro: apiKeyHealthHandler418,
  demio: apiKeyHealthHandler419,
  bigmarker: apiKeyHealthHandler420,
  mindbody: apiKeyHealthHandler421,
  "jane-app": apiKeyHealthHandler422,
  cliniko: apiKeyHealthHandler423,
  "practice-better": apiKeyHealthHandler424,
  "any-do": apiKeyHealthHandler425,
  "remember-the-milk": apiKeyHealthHandler426,
  "exa-search": apiKeyHealthHandler427,
} satisfies ApiKeyHealthHandlerMap;
