import type {
  ApiKeyHealthHandler,
  ApiKeyHealthHandlerMap,
} from "./api-key-health-handler";

const apiKeyHealthHandler174: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const health = await this.liquidPlannerApi.health(
    this.liquidPlannerCredentials(stored),
  );
  connection.metadata = {
    ...(connection.metadata ?? {}),
    accessibleWorkspaces: health.workspaceCount,
    accountLabel: "LiquidPlanner New API user",
  };
};

const apiKeyHealthHandler175: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const health = await this.workfrontPlanningApi.health(
    this.workfrontPlanningCredentials(stored),
  );
  connection.metadata = {
    ...(connection.metadata ?? {}),
    workfrontPlanningHostname: health.customerHostname,
    accessibleWorkspaces: health.workspaceCount,
    accountLabel: "Adobe Workfront Planning technical account",
  };
};

const apiKeyHealthHandler176: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  await this.kantataOxApi.health(this.kantataOxCredentials(stored));
  connection.metadata = {
    ...(connection.metadata ?? {}),
    selectedWorkspaceBound: true,
    accountLabel: "Kantata OX selected project",
  };
};

const apiKeyHealthHandler177: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const health = await this.acceloApi.health(this.acceloCredentials(stored));
  connection.metadata = {
    ...(connection.metadata ?? {}),
    deploymentBound: true,
    selectedProjectBound: true,
    accountLabel: "Accelo selected project",
    selectedProjectStanding: health.project.standing,
  };
};

const apiKeyHealthHandler178: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const health = await this.avazaApi.health(this.avazaCredentials(stored));
  connection.metadata = {
    ...(connection.metadata ?? {}),
    selectedProjectBound: true,
    exactReadProjectsScopeRequired: true,
    accountLabel: "Avaza selected project",
    selectedProjectStatus: health.project.statusCode,
  };
};

const apiKeyHealthHandler179: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.homebrewApi.health(this.homebrewCredentials(stored));
};

const apiKeyHealthHandler180: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.calibreApi.health(this.calibreCredentials(stored));
};

const apiKeyHealthHandler181: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.plexPersonalMediaServerApi.health(
    this.plexPersonalMediaServerCredentials(stored),
  );
};

const apiKeyHealthHandler182: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.jellyfinApi.health(this.jellyfinCredentials(stored));
};

const apiKeyHealthHandler183: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.synologyDsmApi.health(this.synologyDsmCredentials(stored));
};

const apiKeyHealthHandler184: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.wordpressWooCommerceSelfHostedApi.health(
    this.wordpressWooCommerceSelfHostedCredentials(stored),
  );
};

const apiKeyHealthHandler185: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.magentoSelfHostedApi.health(
    this.magentoSelfHostedCredentials(stored),
  );
};

const apiKeyHealthHandler186: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.prestashopSelfHostedApi.health(
    this.prestashopSelfHostedCredentials(stored),
  );
};

const apiKeyHealthHandler187: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.drupalApi.health(this.drupalCredentials(stored));
};

const apiKeyHealthHandler188: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.joomlaApi.health(this.joomlaCredentials(stored));
};

const apiKeyHealthHandler189: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.concreteCmsApi.health(this.concreteCmsCredentials(stored));
};

const apiKeyHealthHandler190: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.craftCmsApi.health(this.craftCmsCredentials(stored));
};

const apiKeyHealthHandler191: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.statamicApi.health(this.statamicCredentials(stored));
};

const apiKeyHealthHandler192: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.kirbyCmsApi.health(this.kirbyCmsCredentials(stored));
};

const apiKeyHealthHandler193: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.directusSelfHostedApi.health(
    this.directusSelfHostedCredentials(stored),
  );
};

const apiKeyHealthHandler194: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.strapiSelfHostedApi.health(
    this.strapiSelfHostedCredentials(stored),
  );
};

const apiKeyHealthHandler195: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.supabaseSelfHostedApi.health(
    this.supabaseSelfHostedCredentials(stored),
  );
};

const apiKeyHealthHandler196: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.vidyardApi.health(this.vidyardCredentials(stored));
};

const apiKeyHealthHandler197: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.descriptApi.health(this.descriptCredentials(stored));
};

const apiKeyHealthHandler198: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.tlDvApi.health(this.tlDvCredentials(stored));
};

const apiKeyHealthHandler199: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  _stored,
) {
  const token = await this.oauth.refreshIfNeeded(connection);
  await this.grainMcp.health(token.accessToken);
};

const apiKeyHealthHandler200: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  _stored,
) {
  const token = await this.oauth.refreshIfNeeded(connection);
  await this.whimsicalMcp.health(token.accessToken);
};

const apiKeyHealthHandler201: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  _stored,
) {
  const token = await this.oauth.refreshIfNeeded(connection);
  await this.cognitoFormsMcp.health(token.accessToken);
};

const apiKeyHealthHandler202: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  _stored,
) {
  const token = await this.oauth.refreshIfNeeded(connection);
  await this.xmindMcp.health(token.accessToken);
};

const apiKeyHealthHandler203: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  _stored,
) {
  const token = await this.oauth.refreshIfNeeded(connection);
  await this.adobeAnalyticsMcp.health(token.accessToken);
};

const apiKeyHealthHandler204: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.adobeMarketoEngageApi.health(
    this.adobeMarketoEngageCredentials(stored),
  );
};

const apiKeyHealthHandler205: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.adobeTargetApi.health(this.adobeTargetCredentials(stored));
};

const apiKeyHealthHandler206: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.osanoApi.health(this.osanoCredentials(stored));
};

const apiKeyHealthHandler207: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.secureframeApi.health(this.secureframeCredentials(stored));
};

const apiKeyHealthHandler208: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.vantaApi.health(this.vantaCredentials(stored));
};

const apiKeyHealthHandler209: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.drataApi.health(this.drataCredentials(stored));
};

const apiKeyHealthHandler210: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.sprintoApi.health(this.sprintoCredentials(stored));
};

const apiKeyHealthHandler211: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.hyperproofApi.health(this.hyperproofCredentials(stored));
};

const apiKeyHealthHandler212: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.workivaApi.health(this.workivaCredentials(stored));
};

const apiKeyHealthHandler213: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.cartaApi.health(this.cartaCredentials(stored));
};

const apiKeyHealthHandler214: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.shareworksApi.health(this.shareworksCredentials(stored));
};

const apiKeyHealthHandler215: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.ledgyApi.health(this.ledgyCredentials(stored));
};

const apiKeyHealthHandler216: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  _stored,
) {
  const token = await this.oauth.refreshIfNeeded(connection);
  await this.cloudinaryMcp.health(token.accessToken);
};

const apiKeyHealthHandler217: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.padletApi.health(this.padletCredentials(stored));
};

const apiKeyHealthHandler218: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.tresoritS3.health(this.tresoritCredentials(stored));
};

const apiKeyHealthHandler219: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.hightailApi.health(this.hightailCredentials(stored));
};

const apiKeyHealthHandler220: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.filestackApi.health(this.filestackCredentials(stored));
};

const apiKeyHealthHandler221: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.imgixApi.health(this.imgixCredentials(stored));
};

const apiKeyHealthHandler222: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  _stored,
) {
  const token = await this.oauth.refreshIfNeeded(connection);
  await this.bynderApi.health(
    token.accessToken,
    this.requiredString(
      connection.metadata?.bynderPortalOrigin,
      "Bynder portal",
    ),
  );
};

const apiKeyHealthHandler223: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.netlifyApi.health(this.netlifyCredentials(stored));
};

const apiKeyHealthHandler224: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  _stored,
) {
  const token = await this.oauth.refreshIfNeeded(connection);
  await this.herokuApi.health(this.herokuCredentials(token.credentials));
};

const apiKeyHealthHandler225: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  _stored,
) {
  const token = await this.oauth.refreshIfNeeded(connection);
  await this.digitalOceanApi.health(
    this.digitalOceanCredentials(token.credentials),
  );
};

const apiKeyHealthHandler226: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  _stored,
) {
  const token = await this.oauth.refreshIfNeeded(connection);
  await this.firebaseApi.health(this.firebaseCredentials(token.credentials));
};

const apiKeyHealthHandler227: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  _stored,
) {
  const token = await this.oauth.refreshIfNeeded(connection);
  await this.supabaseApi.health(this.supabaseCredentials(token.credentials));
};

const apiKeyHealthHandler228: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.oktaApi.health(this.oktaCredentials(stored));
};

const apiKeyHealthHandler229: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  _stored,
) {
  const token = await this.oauth.refreshIfNeeded(connection);
  await this.bambooHRApi.health(this.bambooHRCredentials(token.credentials));
};

const apiKeyHealthHandler230: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  _stored,
) {
  const token = await this.oauth.refreshIfNeeded(connection);
  await this.greenhouseApi.health(
    this.greenhouseCredentials(token.credentials),
  );
};

const apiKeyHealthHandler231: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  _stored,
) {
  const token = await this.oauth.refreshIfNeeded(connection);
  await this.leverApi.health(this.leverCredentials(token.credentials));
};

const apiKeyHealthHandler232: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  _stored,
) {
  const token = await this.oauth.refreshIfNeeded(connection);
  await this.gmailApi.health(this.gmailCredentials(token.credentials));
};

const apiKeyHealthHandler233: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  _stored,
) {
  const token = await this.oauth.refreshIfNeeded(connection);
  await this.googleCalendarApi.health(
    this.googleCalendarCredentials(token.credentials),
  );
};

const apiKeyHealthHandler234: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  _stored,
) {
  const token = await this.oauth.refreshIfNeeded(connection);
  await this.cantoApi.health(
    token.accessToken,
    this.requiredString(
      connection.metadata?.cantoAccountOrigin,
      "Canto account",
    ),
  );
};

const apiKeyHealthHandler235: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  _stored,
) {
  const token = await this.oauth.refreshIfNeeded(connection);
  await this.frontifyApi.health(
    token.accessToken,
    this.requiredString(
      connection.metadata?.frontifyAccountOrigin,
      "Frontify account",
    ),
  );
};

const apiKeyHealthHandler236: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  _stored,
) {
  const token = await this.oauth.refreshIfNeeded(connection);
  await this.assetBankApi.health(
    token.accessToken,
    this.requiredString(
      connection.metadata?.assetBankBaseUrl,
      "Asset Bank site",
    ),
  );
};

const apiKeyHealthHandler237: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.brandfolderApi.health(this.brandfolderCredentials(stored));
};

const apiKeyHealthHandler238: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.widenCollectiveApi.health(this.widenCollectiveCredentials(stored));
};

const apiKeyHealthHandler239: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.kontainerApi.health(this.kontainerCredentials(stored));
};

const apiKeyHealthHandler240: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.jiraAlignApi.health(this.jiraAlignCredentials(stored));
};

const apiKeyHealthHandler241: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  _stored,
) {
  const token = await this.oauth.refreshIfNeeded(connection);
  await this.atlassianCompassApi.health(
    token.accessToken,
    this.requiredString(connection.metadata?.cloudId, "Compass cloud ID"),
    this.requiredString(connection.metadata?.siteUrl, "Compass site URL"),
  );
};

const apiKeyHealthHandler242: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.daminionApi.health(this.daminionCredentials(stored));
};

const apiKeyHealthHandler243: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  _stored,
) {
  await this.drawIoMcp.health();
};

const apiKeyHealthHandler244: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  _stored,
) {
  const token = await this.oauth.refreshIfNeeded(connection);
  await this.mindMeisterApi.health(token.accessToken);
};

const apiKeyHealthHandler245: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  _stored,
) {
  const token = await this.oauth.refreshIfNeeded(connection);
  await this.muralApi.health(token.accessToken);
};

const apiKeyHealthHandler246: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  _stored,
) {
  const token = await this.oauth.refreshIfNeeded(connection);
  await this.figJamApi.health(token.accessToken);
};

const apiKeyHealthHandler247: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  _stored,
) {
  const token = await this.oauth.refreshIfNeeded(connection);
  await this.figmaApi.health(token.accessToken);
};

const apiKeyHealthHandler248: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  _stored,
) {
  const token = await this.oauth.refreshIfNeeded(connection);
  await this.miroApi.listBoards(token.accessToken, {
    teamId: connection.metadata?.miroTeamId,
    maxResults: 1,
  });
};

export const ApiKeyHealthHandlers06 = {
  liquidplanner: apiKeyHealthHandler174,
  "workfront-planning": apiKeyHealthHandler175,
  "kantata-ox": apiKeyHealthHandler176,
  accelo: apiKeyHealthHandler177,
  avaza: apiKeyHealthHandler178,
  homebrew: apiKeyHealthHandler179,
  calibre: apiKeyHealthHandler180,
  "plex-personal-media-server": apiKeyHealthHandler181,
  jellyfin: apiKeyHealthHandler182,
  "synology-dsm": apiKeyHealthHandler183,
  "wordpress-woocommerce-self-hosted": apiKeyHealthHandler184,
  "magento-self-hosted": apiKeyHealthHandler185,
  "prestashop-self-hosted": apiKeyHealthHandler186,
  drupal: apiKeyHealthHandler187,
  joomla: apiKeyHealthHandler188,
  "concrete-cms": apiKeyHealthHandler189,
  "craft-cms": apiKeyHealthHandler190,
  statamic: apiKeyHealthHandler191,
  "kirby-cms": apiKeyHealthHandler192,
  "directus-self-hosted": apiKeyHealthHandler193,
  "strapi-self-hosted": apiKeyHealthHandler194,
  "supabase-self-hosted": apiKeyHealthHandler195,
  vidyard: apiKeyHealthHandler196,
  descript: apiKeyHealthHandler197,
  "tl-dv": apiKeyHealthHandler198,
  grain: apiKeyHealthHandler199,
  whimsical: apiKeyHealthHandler200,
  "cognito-forms": apiKeyHealthHandler201,
  xmind: apiKeyHealthHandler202,
  "adobe-analytics": apiKeyHealthHandler203,
  "adobe-marketo-engage": apiKeyHealthHandler204,
  "adobe-target": apiKeyHealthHandler205,
  osano: apiKeyHealthHandler206,
  secureframe: apiKeyHealthHandler207,
  vanta: apiKeyHealthHandler208,
  drata: apiKeyHealthHandler209,
  sprinto: apiKeyHealthHandler210,
  hyperproof: apiKeyHealthHandler211,
  workiva: apiKeyHealthHandler212,
  carta: apiKeyHealthHandler213,
  shareworks: apiKeyHealthHandler214,
  ledgy: apiKeyHealthHandler215,
  cloudinary: apiKeyHealthHandler216,
  padlet: apiKeyHealthHandler217,
  tresorit: apiKeyHealthHandler218,
  hightail: apiKeyHealthHandler219,
  filestack: apiKeyHealthHandler220,
  imgix: apiKeyHealthHandler221,
  bynder: apiKeyHealthHandler222,
  netlify: apiKeyHealthHandler223,
  heroku: apiKeyHealthHandler224,
  digitalocean: apiKeyHealthHandler225,
  firebase: apiKeyHealthHandler226,
  supabase: apiKeyHealthHandler227,
  okta: apiKeyHealthHandler228,
  bamboohr: apiKeyHealthHandler229,
  greenhouse: apiKeyHealthHandler230,
  lever: apiKeyHealthHandler231,
  gmail: apiKeyHealthHandler232,
  "google-calendar": apiKeyHealthHandler233,
  canto: apiKeyHealthHandler234,
  frontify: apiKeyHealthHandler235,
  "asset-bank": apiKeyHealthHandler236,
  brandfolder: apiKeyHealthHandler237,
  "widen-collective": apiKeyHealthHandler238,
  kontainer: apiKeyHealthHandler239,
  "jira-align": apiKeyHealthHandler240,
  "atlassian-compass": apiKeyHealthHandler241,
  daminion: apiKeyHealthHandler242,
  "draw-io": apiKeyHealthHandler243,
  mindmeister: apiKeyHealthHandler244,
  mural: apiKeyHealthHandler245,
  figjam: apiKeyHealthHandler246,
  figma: apiKeyHealthHandler247,
  miro: apiKeyHealthHandler248,
} satisfies ApiKeyHealthHandlerMap;
