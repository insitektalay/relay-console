import type {
  ApiKeyHealthHandler,
  ApiKeyHealthHandlerMap,
} from "./api-key-health-handler";

const apiKeyHealthHandler037: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const credentials = this.upLeadCredentials(stored);
  const identity = await this.upLeadApi.health(credentials);
  connection.metadata = {
    ...(connection.metadata ?? {}),
    upLeadApiEndpoint: identity.apiEndpoint,
    accountLabel: `UpLead credit account key ${credentials.apiKey.slice(-4)}`,
    apiKeyValidated: true,
    fixedCreditsReadOnly: true,
    accountEmailStripped: true,
    peopleCompanyDataBlocked: true,
    prospectingPreviewListsExportsBlocked: true,
    maxProviderRequestsPerAction: 1,
    maxResponseBytes: 64 * 1024,
    automaticRetry: false,
    automaticPagination: false,
    rawToolsEnabled: false,
  };
};

const apiKeyHealthHandler038: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const credentials = this.wizaCredentials(stored);
  const identity = await this.wizaApi.health(credentials);
  connection.metadata = {
    ...(connection.metadata ?? {}),
    wizaApiEndpoint: identity.apiEndpoint,
    accountLabel: `Wiza credit account key ${credentials.apiKey.slice(-4)}`,
    apiKeyValidated: true,
    fixedCreditBalancesReadOnly: true,
    peopleCompanyDataBlocked: true,
    bulkListsWebhooksExportsBlocked: true,
    adminFinancialRawBlocked: true,
    maxProviderRequestsPerAction: 1,
    maxResponseBytes: 64 * 1024,
    automaticRetry: false,
    automaticPagination: false,
    rawToolsEnabled: false,
  };
};

const apiKeyHealthHandler039: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const credentials = this.hopinCredentials(stored);
  const identity = await this.hopinApi.health(credentials);
  connection.metadata = {
    ...(connection.metadata ?? {}),
    ringCentralEventsOrganizationId: identity.organizationId,
    ringCentralEventsApiOrigin: identity.apiOrigin,
    accountLabel: identity.organizationName,
    organizationBindingVerified: true,
    currentProviderName: "RingCentral Events",
    legacyMarketplaceSlug: "hopin",
    automaticRetry: false,
    automaticPagination: false,
    rawToolsEnabled: false,
  };
};

const apiKeyHealthHandler040: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const identity = await this.clockifyApi.health(
    this.clockifyCredentials(stored),
  );
  connection.metadata = {
    ...(connection.metadata ?? {}),
    clockifyUserId: identity.userId,
    clockifyApiOrigin: identity.apiOrigin,
    clockifyActiveWorkspace: identity.activeWorkspace,
    accountLabel: "Clockify account",
  };
};

const apiKeyHealthHandler041: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const identity = await this.tempoTimesheetsApi.health(
    this.tempoTimesheetsCredentials(stored),
  );
  connection.metadata = {
    ...(connection.metadata ?? {}),
    tempoJiraSiteHost: identity.siteHost,
    tempoApiOrigin: identity.apiOrigin,
    accountLabel: identity.siteHost,
  };
};

const apiKeyHealthHandler042: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const identity = await this.zephyrScaleApi.health(
    this.zephyrScaleCredentials(stored),
  );
  connection.metadata = {
    ...(connection.metadata ?? {}),
    zephyrScaleRegion: identity.region,
    zephyrScaleProjectKey: identity.projectKey,
    zephyrScaleApiOrigin: identity.apiOrigin,
    accountLabel: `${identity.projectKey} (${identity.region})`,
  };
};

const apiKeyHealthHandler043: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const identity = await this.calendlyApi.health(
    this.calendlyCredentials(stored, connection),
  );
  connection.metadata = {
    ...(connection.metadata ?? {}),
    calendlyUserUri: identity.userUri,
    calendlyOrganizationUri: identity.organizationUri,
    calendlyUserName: identity.userName,
    calendlyApiOrigin: identity.apiOrigin,
    accountLabel: identity.userName ?? "Calendly user",
  };
};

const apiKeyHealthHandler044: ApiKeyHealthHandler = async function (
  manifest,
  connection,
  _stored,
) {
  await this.partnerFinanceApi.health(
    manifest.slug,
    this.credentials.decrypt(connection),
  );
};

const apiKeyHealthHandler045: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const identity = await this.calComApi.health(
    this.calComCredentials(stored, connection),
  );
  connection.metadata = {
    ...(connection.metadata ?? {}),
    calComUserId: identity.userId,
    calComUsername: identity.username,
    calComUserName: identity.userName,
    calComApiOrigin: identity.apiOrigin,
    accountLabel: identity.userName ?? identity.username,
  };
};

const apiKeyHealthHandler046: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const identity = await this.ironcladClickwrapApi.health(
    this.ironcladClickwrapCredentials(stored),
  );
  connection.metadata = {
    ...(connection.metadata ?? {}),
    ironcladClickwrapSiteId: identity.siteId,
    ironcladClickwrapApiOrigin: identity.apiOrigin,
    accountLabel: identity.siteName ?? `Clickwrap Site ${identity.siteId}`,
  };
};

const apiKeyHealthHandler047: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const identity = await this.docusignApi.health(
    this.docusignCredentials(stored, connection),
  );
  connection.metadata = {
    ...(connection.metadata ?? {}),
    docusignUserId: identity.userId,
    docusignUserName: identity.userName,
    docusignAccountId: identity.accountId,
    docusignAccountName: identity.accountName,
    docusignBaseUri: identity.baseUri,
    accountLabel:
      identity.accountName ?? identity.userName ?? "Docusign account",
  };
};

const apiKeyHealthHandler048: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const identity = await this.dropboxSignApi.health(
    this.dropboxSignCredentials(stored, connection),
  );
  connection.metadata = {
    ...(connection.metadata ?? {}),
    dropboxSignAccountId: identity.accountId,
    dropboxSignAccountLabel: identity.accountLabel,
    dropboxSignLocale: identity.locale,
    dropboxSignLocked: identity.locked,
    dropboxSignPaid: identity.paid,
    dropboxSignApiOrigin: identity.apiOrigin,
    accountLabel:
      identity.accountLabel ??
      `Dropbox Sign account …${identity.accountId.slice(-8)}`,
  };
};

const apiKeyHealthHandler049: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const identity = await this.pandaDocApi.health(
    this.pandaDocCredentials(stored, connection),
  );
  connection.metadata = {
    ...(connection.metadata ?? {}),
    pandaDocMembershipId: identity.membershipId,
    pandaDocMembershipLabel: identity.membershipLabel,
    pandaDocWorkspaceId: identity.workspaceId,
    pandaDocWorkspaceName: identity.workspaceName,
    pandaDocApiOrigin: identity.apiOrigin,
    accountLabel:
      identity.workspaceName ??
      identity.membershipLabel ??
      "PandaDoc workspace",
  };
};

const apiKeyHealthHandler050: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const identity = await this.typeformApi.health(
    this.typeformCredentials(stored, connection),
  );
  connection.metadata = {
    ...(connection.metadata ?? {}),
    typeformAccountId: identity.accountId,
    typeformAccountLabel: identity.accountLabel,
    typeformWorkspaceId: identity.workspaceId,
    typeformWorkspaceName: identity.workspaceName,
    typeformApiOrigin: identity.apiOrigin,
    accountLabel:
      identity.workspaceName ?? identity.accountLabel ?? "Typeform workspace",
  };
};

const apiKeyHealthHandler051: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const identity = await this.sendFoxApi.health(
    this.sendFoxCredentials(stored, connection),
  );
  connection.metadata = {
    ...(connection.metadata ?? {}),
    sendFoxAccountId: identity.accountId,
    sendFoxAccountLabel: identity.accountLabel,
    sendFoxApiOrigin: identity.apiOrigin,
    accountLabel: identity.accountLabel,
  };
};

const apiKeyHealthHandler052: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const identity = await this.beehiivApi.health(
    this.beehiivCredentials(stored, connection),
  );
  connection.metadata = {
    ...(connection.metadata ?? {}),
    beehiivOrganizationId: identity.organizationId,
    beehiivAccountLabel: identity.accountLabel,
    beehiivApiOrigin: identity.apiOrigin,
    accountLabel: identity.accountLabel,
  };
};

const apiKeyHealthHandler053: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const identity = await this.substackApi.health(
    this.substackCredentials(stored, connection),
  );
  connection.metadata = {
    ...(connection.metadata ?? {}),
    substackApiOrigin: identity.apiOrigin,
    substackValidationLinkedInHandle: identity.validationLinkedInHandle,
    substackValidationResultCount: identity.resultCount,
    accountLabel: "Substack Developer API token",
  };
};

const apiKeyHealthHandler054: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const identity = await this.hootsuiteApi.health(
    this.hootsuiteCredentials(stored),
  );
  connection.metadata = {
    ...(connection.metadata ?? {}),
    hootsuiteApiOrigin: identity.apiOrigin,
    hootsuiteMemberId: identity.memberId,
    accountLabel: identity.memberId
      ? `Hootsuite member …${identity.memberId.slice(-8)}`
      : "Hootsuite member",
  };
};

const apiKeyHealthHandler055: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  _stored,
) {
  const token = await this.oauth.refreshIfNeeded(connection);
  const identity = await this.bufferApi.health({
    accessToken: token.accessToken,
  });
  connection.metadata = {
    ...(connection.metadata ?? {}),
    bufferApiOrigin: identity.apiOrigin,
    bufferAccountId: identity.accountId,
    accountLabel: identity.accountId
      ? `Buffer account …${identity.accountId.slice(-8)}`
      : "Buffer account",
  };
};

const apiKeyHealthHandler056: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const identity = await this.sproutSocialApi.health(
    this.sproutSocialCredentials(stored),
  );
  connection.metadata = {
    ...(connection.metadata ?? {}),
    sproutSocialApiOrigin: identity.apiOrigin,
    sproutSocialAccessibleCustomerCount: identity.accessibleCustomerCount,
    sproutSocialScope: identity.scope,
    accountLabel: "Sprout Social API organization",
  };
};

const apiKeyHealthHandler057: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const identity = await this.laterApi.health(this.laterCredentials(stored));
  connection.metadata = {
    ...(connection.metadata ?? {}),
    laterApiOrigin: identity.apiOrigin,
    laterAccessibleInstanceCount: identity.accessibleInstanceCount,
    laterTokenLifetimeHours: identity.tokenLifetimeHours,
    accountLabel: "Later Influence Reporting API client",
  };
};

const apiKeyHealthHandler058: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const identity = await this.agorapulseApi.health(
    this.agorapulseCredentials(stored),
  );
  connection.metadata = {
    ...(connection.metadata ?? {}),
    agorapulseApiOrigin: identity.apiOrigin,
    agorapulseOrganizationId: identity.organizationId,
    agorapulseWorkspaceId: identity.workspaceId,
    accountLabel: `Agorapulse workspace …${identity.workspaceId.slice(-8)}`,
  };
};

const apiKeyHealthHandler059: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const identity = await this.metricoolApi.health(
    this.metricoolCredentials(stored),
  );
  connection.metadata = {
    ...(connection.metadata ?? {}),
    metricoolApiOrigin: identity.apiOrigin,
    metricoolUserId: identity.userId,
    metricoolBlogId: identity.blogId,
    accountLabel: `Metricool brand …${identity.blogId.slice(-8)}`,
  };
};

const apiKeyHealthHandler060: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const identity = await this.publerApi.health(this.publerCredentials(stored));
  connection.metadata = {
    ...(connection.metadata ?? {}),
    publerApiOrigin: identity.apiOrigin,
    publerWorkspaceId: identity.workspaceId,
    accountLabel: `Publer workspace …${identity.workspaceId.slice(-8)}`,
  };
};

const apiKeyHealthHandler061: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const identity = await this.brandwatchApi.health(
    this.brandwatchCredentials(stored),
  );
  connection.metadata = {
    ...(connection.metadata ?? {}),
    brandwatchApiOrigin: identity.apiOrigin,
    brandwatchProjectId: identity.projectId,
    accountLabel: `Brandwatch project …${identity.projectId.slice(-8)}`,
  };
};

const apiKeyHealthHandler062: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const identity = await this.mentionApi.health(
    this.mentionCredentials(stored),
  );
  connection.metadata = {
    ...(connection.metadata ?? {}),
    mentionApiOrigin: identity.apiOrigin,
    mentionAccountId: identity.accountId,
    accountLabel: `Mention account …${identity.accountId.slice(-8)}`,
  };
};

export const ApiKeyHealthHandlers02 = {
  uplead: apiKeyHealthHandler037,
  wiza: apiKeyHealthHandler038,
  hopin: apiKeyHealthHandler039,
  clockify: apiKeyHealthHandler040,
  "tempo-timesheets": apiKeyHealthHandler041,
  "zephyr-scale": apiKeyHealthHandler042,
  calendly: apiKeyHealthHandler043,
  "yodlee-fastlink": apiKeyHealthHandler044,
  mx: apiKeyHealthHandler044,
  finicity: apiKeyHealthHandler044,
  "plaid-link": apiKeyHealthHandler044,
  etoro: apiKeyHealthHandler044,
  "cal-com": apiKeyHealthHandler045,
  "ironclad-clickwrap": apiKeyHealthHandler046,
  docusign: apiKeyHealthHandler047,
  "dropbox-sign": apiKeyHealthHandler048,
  pandadoc: apiKeyHealthHandler049,
  typeform: apiKeyHealthHandler050,
  sendfox: apiKeyHealthHandler051,
  beehiiv: apiKeyHealthHandler052,
  substack: apiKeyHealthHandler053,
  hootsuite: apiKeyHealthHandler054,
  buffer: apiKeyHealthHandler055,
  "sprout-social": apiKeyHealthHandler056,
  later: apiKeyHealthHandler057,
  agorapulse: apiKeyHealthHandler058,
  metricool: apiKeyHealthHandler059,
  publer: apiKeyHealthHandler060,
  brandwatch: apiKeyHealthHandler061,
  mention: apiKeyHealthHandler062,
} satisfies ApiKeyHealthHandlerMap;
