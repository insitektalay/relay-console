import type {
  ApiKeyHealthHandler,
  ApiKeyHealthHandlerMap,
} from "./api-key-health-handler";
import { ConnectorExecutionError } from "../connector-execution.error";

const apiKeyHealthHandler428: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const token = this.stringOrNull(stored?.DISCORD_BOT_TOKEN);
  if (!token)
    throw new ConnectorExecutionError(
      "credential_missing",
      "Discord bot token is missing.",
    );
  await this.discordApi.health(token, this.discordBinding(connection));
};

const apiKeyHealthHandler429: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  this.googleMapsPlatformApi.health(this.requiredMapsApiKey(stored));
};

const apiKeyHealthHandler430: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  _stored,
) {
  const token = await this.oauth.refreshIfNeeded(connection);
  await this.adobeAcrobatSignApi.health(
    token.accessToken,
    this.requiredAdobeAcrobatSignApiOrigin(connection.metadata),
  );
};

const apiKeyHealthHandler431: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  _stored,
) {
  const token = await this.oauth.refreshIfNeeded(connection);
  await this.signNowApi.health(token.accessToken);
};

const apiKeyHealthHandler432: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  _stored,
) {
  const token = await this.oauth.refreshIfNeeded(connection);
  await this.signRequestApi.health(token.accessToken);
};

const apiKeyHealthHandler433: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  _stored,
) {
  const token = await this.oauth.refreshIfNeeded(connection);
  await this.signeasyApi.health(token.accessToken);
};

const apiKeyHealthHandler434: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.oneSpanSignApi.health(this.oneSpanSignCredentials(stored));
};

const apiKeyHealthHandler435: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  _stored,
) {
  const token = await this.oauth.refreshIfNeeded(connection);
  await this.rightSignatureApi.health(token.accessToken);
};

const apiKeyHealthHandler436: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.getAcceptApi.health(this.getAcceptCredentials(stored));
};

const apiKeyHealthHandler437: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.qwilrApi.health(this.qwilrCredentials(stored));
};

const apiKeyHealthHandler438: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.proposifyApi.health(this.proposifyCredentials(stored));
};

const apiKeyHealthHandler439: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.betterProposalsApi.health(this.betterProposalsCredentials(stored));
};

const apiKeyHealthHandler440: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.concordApi.health(this.concordCredentials(stored));
};

const apiKeyHealthHandler441: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.juroApi.health(this.juroCredentials(stored));
};

const apiKeyHealthHandler442: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.ironcladApi.health(this.ironcladCredentials(stored));
};

const apiKeyHealthHandler443: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.linkSquaresApi.health(this.linkSquaresCredentials(stored));
};

const apiKeyHealthHandler444: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.spotDraftApi.health(this.spotDraftCredentials(stored));
};

const apiKeyHealthHandler445: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.contractbookApi.health(this.contractbookCredentials(stored));
};

const apiKeyHealthHandler446: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.logRocketMcp.health(this.logRocketCredentials(stored));
};

const apiKeyHealthHandler447: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.smartlookApi.health(this.smartlookCredentials(stored));
};

const apiKeyHealthHandler448: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.crazyEggApi.health(this.crazyEggCredentials(stored));
};

const apiKeyHealthHandler449: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.appcuesApi.health(this.appcuesCredentials(stored));
};

const apiKeyHealthHandler450: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.userflowApi.health(this.userflowCredentials(stored));
};

const apiKeyHealthHandler451: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.userpilotApi.health(this.userpilotCredentials(stored));
};

const apiKeyHealthHandler452: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.chameleonApi.health(this.chameleonCredentials(stored));
};

const apiKeyHealthHandler453: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.vitallyApi.health(this.vitallyCredentials(stored));
};

const apiKeyHealthHandler454: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.gainsightApi.health(this.gainsightCredentials(stored));
};

const apiKeyHealthHandler455: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.totangoApi.health(this.totangoCredentials(stored));
};

const apiKeyHealthHandler456: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.custifyApi.health(this.custifyCredentials(stored));
};

const apiKeyHealthHandler457: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.planhatApi.health(this.planhatCredentials(stored));
};

const apiKeyHealthHandler458: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.clientSuccessApi.health(this.clientSuccessCredentials(stored));
};

const apiKeyHealthHandler459: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.freshsalesApi.health(this.freshsalesCredentials(stored));
};

const apiKeyHealthHandler460: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.insightlyApi.health(this.insightlyCredentials(stored));
};

const apiKeyHealthHandler461: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.nimbleApi.health(this.nimbleCredentials(stored));
};

const apiKeyHealthHandler462: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.capsuleCrmApi.health(this.capsuleCrmCredentials(stored));
};

const apiKeyHealthHandler463: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.keapApi.health(this.keapCredentials(stored));
};

const apiKeyHealthHandler464: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  await this.dataForSeoApi.health(
    this.dataForSeoCredentials(stored, connection),
  );
};

const apiKeyHealthHandler465: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.mailgunApi.health(this.mailgunCredentials(stored));
};

const apiKeyHealthHandler466: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.sendGridApi.health(this.sendGridCredentials(stored));
};

const apiKeyHealthHandler467: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.mailchimpTransactionalApi.health(
    this.mailchimpTransactionalCredentials(stored),
  );
};

const apiKeyHealthHandler468: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.postmarkApi.health(this.postmarkCredentials(stored));
};

const apiKeyHealthHandler469: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.resendApi.health(this.resendCredentials(stored));
};

const apiKeyHealthHandler470: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.sparkPostApi.health(this.sparkPostCredentials(stored));
};

const apiKeyHealthHandler471: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.brevoApi.health(this.brevoCredentials(stored));
};

const apiKeyHealthHandler472: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.mailjetApi.health(this.mailjetCredentials(stored));
};

export const ApiKeyHealthHandlers09 = {
  discord: apiKeyHealthHandler428,
  "google-maps-platform": apiKeyHealthHandler429,
  "adobe-acrobat-sign": apiKeyHealthHandler430,
  signnow: apiKeyHealthHandler431,
  signrequest: apiKeyHealthHandler432,
  signeasy: apiKeyHealthHandler433,
  "onespan-sign": apiKeyHealthHandler434,
  rightsignature: apiKeyHealthHandler435,
  getaccept: apiKeyHealthHandler436,
  qwilr: apiKeyHealthHandler437,
  proposify: apiKeyHealthHandler438,
  "better-proposals": apiKeyHealthHandler439,
  concord: apiKeyHealthHandler440,
  juro: apiKeyHealthHandler441,
  ironclad: apiKeyHealthHandler442,
  linksquares: apiKeyHealthHandler443,
  spotdraft: apiKeyHealthHandler444,
  contractbook: apiKeyHealthHandler445,
  logrocket: apiKeyHealthHandler446,
  smartlook: apiKeyHealthHandler447,
  "crazy-egg": apiKeyHealthHandler448,
  appcues: apiKeyHealthHandler449,
  userflow: apiKeyHealthHandler450,
  userpilot: apiKeyHealthHandler451,
  chameleon: apiKeyHealthHandler452,
  vitally: apiKeyHealthHandler453,
  gainsight: apiKeyHealthHandler454,
  totango: apiKeyHealthHandler455,
  custify: apiKeyHealthHandler456,
  planhat: apiKeyHealthHandler457,
  clientsuccess: apiKeyHealthHandler458,
  freshsales: apiKeyHealthHandler459,
  insightly: apiKeyHealthHandler460,
  nimble: apiKeyHealthHandler461,
  "capsule-crm": apiKeyHealthHandler462,
  keap: apiKeyHealthHandler463,
  dataforseo: apiKeyHealthHandler464,
  mailgun: apiKeyHealthHandler465,
  sendgrid: apiKeyHealthHandler466,
  "mailchimp-transactional": apiKeyHealthHandler467,
  postmark: apiKeyHealthHandler468,
  resend: apiKeyHealthHandler469,
  sparkpost: apiKeyHealthHandler470,
  brevo: apiKeyHealthHandler471,
  "sinch-mailjet": apiKeyHealthHandler472,
} satisfies ApiKeyHealthHandlerMap;
