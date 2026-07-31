import type {
  ApiKeyHealthHandler,
  ApiKeyHealthHandlerMap,
} from "./api-key-health-handler";

const apiKeyHealthHandler001: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.newRelicApi.health(this.newRelicCredentials(stored));
};

const apiKeyHealthHandler002: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.statuspageApi.health(this.statuspageCredentials(stored));
};

const apiKeyHealthHandler003: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.fuseBaseMcp.health(this.fuseBaseCredentials(stored));
};

const apiKeyHealthHandler004: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.atlassianRovoMcp.health(this.atlassianRovoCredentials(stored));
};

const apiKeyHealthHandler005: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.opsgenieCloudApi.health(this.opsgenieCloudCredentials(stored));
};

const apiKeyHealthHandler006: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.statuspageCloudApi.health(this.statuspageCloudCredentials(stored));
};

const apiKeyHealthHandler007: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.memApi.health(this.memCredentials(stored));
};

const apiKeyHealthHandler008: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.readwiseApi.health(this.readwiseCredentials(stored));
};

const apiKeyHealthHandler009: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.commonRoomApi.tokenStatus(this.commonRoomCredentials(stored));
};

const apiKeyHealthHandler010: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.slackEnterpriseGridApi.identity(
    this.slackEnterpriseGridCredentials(stored),
  );
};

const apiKeyHealthHandler011: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.slackCanvasApi.health(this.slackCanvasCredentials(stored));
};

const apiKeyHealthHandler012: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.slackListsApi.health(this.slackListsCredentials(stored));
};

const apiKeyHealthHandler013: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.zoomPhoneApi.health(this.zoomPhoneCredentials(stored));
};

const apiKeyHealthHandler014: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.zoomRoomsApi.health(this.zoomRoomsCredentials(stored));
};

const apiKeyHealthHandler015: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.zoomWebinarsApi.health(this.zoomWebinarsCredentials(stored));
};

const apiKeyHealthHandler016: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.zoomEventsApi.health(this.zoomEventsCredentials(stored));
};

const apiKeyHealthHandler017: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.feedlyApi.profile(this.feedlyCredentials(stored));
};

const apiKeyHealthHandler018: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.readMeApi.getProject(this.readMeCredentials(stored));
};

const apiKeyHealthHandler019: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.document360Api.listWorkspaces(this.document360Credentials(stored));
};

const apiKeyHealthHandler020: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.archbeeApi.searchDocuments(this.archbeeCredentials(stored), {
    query: "relay-connection-health",
  });
};

const apiKeyHealthHandler021: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.tettraApi.search(this.tettraCredentials(stored), {});
};

const apiKeyHealthHandler022: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.knowledgeOwlApi.listArticles(
    this.knowledgeOwlCredentials(stored),
    { limit: 1 },
  );
};

const apiKeyHealthHandler023: ApiKeyHealthHandler = async function (
  _manifest,
  _connection,
  stored,
) {
  await this.togglTrackApi.health(this.togglTrackCredentials(stored));
};

const apiKeyHealthHandler024: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const identity = await this.lumaApi.health({
    apiKey:
      this.stringOrNull(stored?.LUMA_API_KEY) ??
      this.stringOrNull(stored?.apiKey) ??
      "",
  });
  connection.metadata = {
    ...(connection.metadata ?? {}),
    lumaUserId: identity.userId,
    lumaCalendarId: identity.calendarId,
    lumaApiOrigin: identity.apiOrigin,
    displayName: identity.userName,
    accountLabel: identity.calendarName,
    userBindingVerified: true,
    calendarBindingVerified: true,
    fullAccessKeyReadSurfaceOnly: true,
    automaticRetry: false,
    automaticPagination: false,
    rawToolsEnabled: false,
  };
};

const apiKeyHealthHandler025: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const identity = await this.openPhoneApi.health({
    apiKey:
      this.stringOrNull(stored?.OPENPHONE_API_KEY) ??
      this.stringOrNull(stored?.apiKey) ??
      "",
  });
  connection.metadata = {
    ...(connection.metadata ?? {}),
    openPhoneApiOrigin: identity.apiOrigin,
    accountLabel: "Quo workspace",
    currentProviderName: "Quo",
    legacyProviderName: "OpenPhone",
    keyValidated: true,
    fullAccessWorkspaceKeyReadSurfaceOnly: true,
    rawAuthorizationHeader: true,
    privacyMasked: true,
    maxPhoneNumbers: 10,
    maxResponseBytes: 512 * 1024,
    automaticRetry: false,
    automaticPagination: false,
    rawToolsEnabled: false,
  };
};

const apiKeyHealthHandler026: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const credentials = this.twilioCredentials(stored);
  const identity = await this.twilioApi.health(credentials);
  connection.metadata = {
    ...(connection.metadata ?? {}),
    twilioApiOrigin: identity.apiOrigin,
    accountLabel: `Twilio account ${credentials.accountSid.slice(-4)}`,
    keyValidated: true,
    restrictedMessageReadOnly: true,
    basicAPIKeyAuthentication: true,
    canonicalTwilioOnly: true,
    privacyMasked: true,
    maxMessageStatuses: 10,
    maxResponseBytes: 512 * 1024,
    automaticRetry: false,
    automaticPagination: false,
    rawToolsEnabled: false,
  };
};

const apiKeyHealthHandler027: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const credentials = this.vonageCredentials(stored);
  const identity = await this.vonageApi.health(credentials);
  connection.metadata = {
    ...(connection.metadata ?? {}),
    vonageApiOrigin: identity.apiOrigin,
    accountLabel: `Vonage API account ${credentials.apiKey.slice(-4)}`,
    keyValidated: true,
    dedicatedSecondarySecretRequired: true,
    fullAccountSecretReadSurfaceOnly: true,
    basicAuthentication: true,
    canonicalNexmoOnly: true,
    financialReadOnly: true,
    balanceCurrency: "EUR",
    maxResponseBytes: 64 * 1024,
    automaticRetry: false,
    automaticPagination: false,
    rawToolsEnabled: false,
  };
};

const apiKeyHealthHandler028: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const credentials = this.messageBirdCredentials(stored);
  const identity = await this.messageBirdApi.health(credentials);
  connection.metadata = {
    ...(connection.metadata ?? {}),
    messageBirdApiOrigin: identity.apiOrigin,
    accountLabel: `Bird workspace ${credentials.workspaceId.slice(-4)}`,
    accessKeyValidated: true,
    dedicatedRoleBoundKeyRequired: true,
    selectedWorkspaceMetadataOnly: true,
    accessKeyAuthentication: true,
    canonicalBirdOnly: true,
    customerContentBlocked: true,
    maxResponseBytes: 64 * 1024,
    automaticRetry: false,
    automaticPagination: false,
    rawToolsEnabled: false,
  };
};

const apiKeyHealthHandler029: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const credentials = this.fredCredentials(stored);
  const identity = await this.fredApi.health(credentials);
  connection.metadata = {
    ...(connection.metadata ?? {}),
    fredApiOrigin: identity.apiOrigin,
    accountLabel: `FRED API key ${credentials.apiKey.slice(-4)}`,
    apiKeyValidated: true,
    publicEconomicDataReadOnly: true,
    fixedSeriesRoutesOnly: true,
    queryParameterAuthentication: true,
    maxSeriesResults: 10,
    maxObservationResults: 25,
    maxResponseBytes: 256 * 1024,
    automaticRetry: false,
    automaticPagination: false,
    rawToolsEnabled: false,
  };
};

const apiKeyHealthHandler030: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const credentials = this.apolloGraphOsCredentials(stored);
  const identity = await this.apolloGraphOsApi.health(credentials);
  connection.metadata = {
    ...(connection.metadata ?? {}),
    apolloGraphOsApiOrigin: identity.apiOrigin,
    apolloGraphId: identity.graphId,
    apolloGraphVariant: identity.variant,
    accountLabel: `${identity.graphId}@${identity.variant}`,
    graphApiKeyValidated: true,
    fixedGraphMetadataQueriesOnly: true,
    schemaContentBlocked: true,
    telemetryBlocked: true,
    mutationsBlocked: true,
    maxResponseBytes: 256 * 1024,
    automaticRetry: false,
    automaticPagination: false,
    rawToolsEnabled: false,
  };
};

const apiKeyHealthHandler031: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const credentials = this.hunterCredentials(stored);
  const identity = await this.hunterApi.health(credentials);
  connection.metadata = {
    ...(connection.metadata ?? {}),
    hunterApiOrigin: identity.apiOrigin,
    accountLabel: `Hunter API key ${credentials.apiKey.slice(-4)}`,
    apiKeyValidated: true,
    fixedReducedReadsOnly: true,
    contactDiscoveryBlocked: true,
    outreachBlocked: true,
    verificationCreditApprovalRequiredInSafe: true,
    maxResponseBytes: 256 * 1024,
    automaticRetry: false,
    automaticPagination: false,
    rawToolsEnabled: false,
  };
};

const apiKeyHealthHandler032: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const credentials = this.snovCredentials(stored);
  const identity = await this.snovApi.health(credentials);
  connection.metadata = {
    ...(connection.metadata ?? {}),
    snovApiOrigin: identity.apiOrigin,
    accountLabel: `Snov.io API user ${credentials.clientId.slice(-4)}`,
    clientCredentialsValidated: true,
    fixedSingleEmailVerificationOnly: true,
    oneEmailPerStart: true,
    webhookBlocked: true,
    maxProviderRequestsPerAction: 2,
    maxResponseBytes: 256 * 1024,
    automaticRetry: false,
    automaticPagination: false,
    rawToolsEnabled: false,
  };
};

const apiKeyHealthHandler033: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const credentials = this.lushaCredentials(stored);
  const identity = await this.lushaApi.health(credentials);
  connection.metadata = {
    ...(connection.metadata ?? {}),
    lushaApiOrigin: identity.apiOrigin,
    accountLabel: `Lusha ${identity.planCategory} key ${credentials.apiKey.slice(-4)}`,
    apiKeyValidated: true,
    fixedAccountUsageOnly: true,
    businessProfileDataBlocked: true,
    providerHostedMcpBlocked: true,
    maxProviderRequestsPerAction: 1,
    providerRequestsPerMinute: 5,
    maxResponseBytes: 256 * 1024,
    automaticRetry: false,
    automaticPagination: false,
    rawToolsEnabled: false,
  };
};

const apiKeyHealthHandler034: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const credentials = this.leadIqCredentials(stored);
  const identity = await this.leadIqApi.health(credentials);
  connection.metadata = {
    ...(connection.metadata ?? {}),
    leadIqApiEndpoint: identity.apiEndpoint,
    accountLabel: `LeadIQ ${identity.accountLabel} key ${credentials.apiKey.slice(-4)}`,
    apiKeyValidated: true,
    fixedAccountQueryOnly: true,
    noCreditOperationOnly: true,
    peopleCompanyDataBlocked: true,
    providerHostedMcpBlocked: true,
    maxProviderRequestsPerAction: 1,
    maxResponseBytes: 128 * 1024,
    automaticRetry: false,
    automaticPagination: false,
    rawToolsEnabled: false,
  };
};

const apiKeyHealthHandler035: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const credentials = this.seamlessAiCredentials(stored);
  const identity = await this.seamlessAiApi.health(credentials);
  connection.metadata = {
    ...(connection.metadata ?? {}),
    seamlessAiApiOrigin: identity.apiOrigin,
    accountLabel: `Seamless.AI key ${credentials.apiKey.slice(-4)}`,
    apiKeyValidated: true,
    fixedCompanySearchOnly: true,
    publicApiV1Only: true,
    maxResults: 5,
    peopleContactDataBlocked: true,
    researchOutreachMcpBlocked: true,
    maxProviderRequestsPerAction: 1,
    maxResponseBytes: 256 * 1024,
    automaticRetry: false,
    automaticPagination: false,
    rawToolsEnabled: false,
  };
};

const apiKeyHealthHandler036: ApiKeyHealthHandler = async function (
  _manifest,
  connection,
  stored,
) {
  const credentials = this.rocketReachCredentials(stored);
  const identity = await this.rocketReachApi.health(credentials);
  connection.metadata = {
    ...(connection.metadata ?? {}),
    rocketReachApiEndpoint: identity.apiEndpoint,
    accountLabel: `RocketReach ${identity.accountLabel} key ${credentials.apiKey.slice(-4)}`,
    apiKeyValidated: true,
    fixedUniversalAccountReadOnly: true,
    accountIdentityStripped: true,
    peopleCompanyDataBlocked: true,
    providerHostedMcpBlocked: true,
    maxProviderRequestsPerAction: 1,
    maxResponseBytes: 128 * 1024,
    automaticRetry: false,
    automaticPagination: false,
    rawToolsEnabled: false,
  };
};

export const ApiKeyHealthHandlers01 = {
  "new-relic": apiKeyHealthHandler001,
  statuspage: apiKeyHealthHandler002,
  "nimbus-note": apiKeyHealthHandler003,
  "atlassian-rovo": apiKeyHealthHandler004,
  "opsgenie-cloud": apiKeyHealthHandler005,
  "statuspage-cloud": apiKeyHealthHandler006,
  mem: apiKeyHealthHandler007,
  readwise: apiKeyHealthHandler008,
  "common-room": apiKeyHealthHandler009,
  "slack-enterprise-grid": apiKeyHealthHandler010,
  "slack-canvas": apiKeyHealthHandler011,
  "slack-lists": apiKeyHealthHandler012,
  "zoom-phone": apiKeyHealthHandler013,
  "zoom-rooms": apiKeyHealthHandler014,
  "zoom-webinars": apiKeyHealthHandler015,
  "zoom-events": apiKeyHealthHandler016,
  feedly: apiKeyHealthHandler017,
  readme: apiKeyHealthHandler018,
  document360: apiKeyHealthHandler019,
  archbee: apiKeyHealthHandler020,
  tettra: apiKeyHealthHandler021,
  knowledgeowl: apiKeyHealthHandler022,
  "toggl-track": apiKeyHealthHandler023,
  luma: apiKeyHealthHandler024,
  openphone: apiKeyHealthHandler025,
  twilio: apiKeyHealthHandler026,
  vonage: apiKeyHealthHandler027,
  messagebird: apiKeyHealthHandler028,
  fred: apiKeyHealthHandler029,
  "apollo-graphql-studio": apiKeyHealthHandler030,
  "hunter-io": apiKeyHealthHandler031,
  "snov-io": apiKeyHealthHandler032,
  lusha: apiKeyHealthHandler033,
  leadiq: apiKeyHealthHandler034,
  "seamless-ai": apiKeyHealthHandler035,
  rocketreach: apiKeyHealthHandler036,
} satisfies ApiKeyHealthHandlerMap;
