import type {
  OAuthProviderHealthHandler,
  OAuthProviderHealthHandlerMap,
} from "./oauth-provider-health-handler";
import { ConnectorExecutionError } from "../connector-execution.error";
import { BadRequestException } from "@nestjs/common";

const oauthProviderHealthHandler001: OAuthProviderHealthHandler =
  async function (_manifest, connection, token) {
    await this.postHogApi.health(
      this.postHogCredentials(connection, token.accessToken),
    );
  };

const oauthProviderHealthHandler002: OAuthProviderHealthHandler =
  async function (_manifest, connection, token) {
    await this.sentryApi.health(
      this.sentryCredentials(connection, token.accessToken),
    );
  };

const oauthProviderHealthHandler003: OAuthProviderHealthHandler =
  async function (_manifest, connection, token) {
    await this.cloudflareApi.health(
      this.cloudflareCredentials(
        this.credentials.decrypt(connection),
        token.accessToken,
      ),
    );
  };

const oauthProviderHealthHandler004: OAuthProviderHealthHandler =
  async function (_manifest, connection, token) {
    await this.vercelApi.health(
      this.vercelCredentials(
        this.credentials.decrypt(connection),
        token.accessToken,
      ),
    );
  };

const oauthProviderHealthHandler005: OAuthProviderHealthHandler =
  async function (_manifest, connection, token) {
    await this.contentfulApi.getCurrentUser(
      token.accessToken,
      this.requiredString(
        connection.metadata?.contentfulCmaOrigin,
        "contentfulCmaOrigin",
      ),
    );
  };

const oauthProviderHealthHandler006: OAuthProviderHealthHandler =
  async function (_manifest, _connection, token) {
    await this.teamsPhoneGraph.health(token.accessToken);
  };

const oauthProviderHealthHandler007: OAuthProviderHealthHandler =
  async function (_manifest, _connection, token) {
    await this.webexCallingApi.health(token.accessToken);
  };

const oauthProviderHealthHandler008: OAuthProviderHealthHandler =
  async function (_manifest, _connection, token) {
    await this.goToWebinarApi.health(token.accessToken);
  };

const oauthProviderHealthHandler009: OAuthProviderHealthHandler =
  async function (_manifest, _connection, token) {
    await this.livestormApi.health(token.accessToken);
  };

const oauthProviderHealthHandler010: OAuthProviderHealthHandler =
  async function (_manifest, connection, token) {
    await this.msProjectApi.health(
      token.accessToken,
      this.requiredString(
        connection.metadata?.msProjectEnvironmentOrigin,
        "Microsoft Project environment",
      ),
    );
  };

const oauthProviderHealthHandler011: OAuthProviderHealthHandler =
  async function (_manifest, connection, token) {
    await this.microsoftDynamics365SalesApi.health(
      token.accessToken,
      this.requiredString(
        connection.metadata?.dynamics365SalesEnvironmentOrigin,
        "Dynamics 365 Sales environment",
      ),
    );
  };

const oauthProviderHealthHandler012: OAuthProviderHealthHandler =
  async function (_manifest, connection, token) {
    await this.microsoftDynamics365CustomerServiceApi.health(
      token.accessToken,
      this.requiredString(
        connection.metadata?.dynamics365CustomerServiceEnvironmentOrigin,
        "Dynamics 365 Customer Service environment",
      ),
    );
  };

const oauthProviderHealthHandler013: OAuthProviderHealthHandler =
  async function (_manifest, connection, token) {
    await this.microsoftDynamics365BusinessCentralApi.health(
      token.accessToken,
      this.requiredString(
        connection.metadata?.businessCentralEnvironmentName,
        "Business Central environment",
      ),
    );
  };

const oauthProviderHealthHandler014: OAuthProviderHealthHandler =
  async function (_manifest, _connection, token) {
    await this.microsoftEntraIdGraph.health(token.accessToken);
  };

const oauthProviderHealthHandler015: OAuthProviderHealthHandler =
  async function (_manifest, _connection, token) {
    await this.yammerApi.health(token.accessToken);
  };

const oauthProviderHealthHandler016: OAuthProviderHealthHandler =
  async function (_manifest, _connection, token) {
    await this.vivaLearningGraph.health(token.accessToken);
  };

const oauthProviderHealthHandler017: OAuthProviderHealthHandler =
  async function (_manifest, connection, token) {
    const cloudId = this.stringOrNull(connection.metadata?.cloudId);
    if (!cloudId)
      throw new ConnectorExecutionError(
        "connection_not_ready",
        "Jira connection is not site-bound.",
      );
    await this.jiraApi.health(token.accessToken, cloudId);
  };

const oauthProviderHealthHandler018: OAuthProviderHealthHandler =
  async function (_manifest, connection, token) {
    const cloudId = this.stringOrNull(connection.metadata?.cloudId);
    if (!cloudId)
      throw new ConnectorExecutionError(
        "connection_not_ready",
        "Jira Service Management connection is not site-bound.",
      );
    await this.jiraServiceManagementApi.health(token.accessToken, cloudId);
  };

const oauthProviderHealthHandler019: OAuthProviderHealthHandler =
  async function (_manifest, _connection, token) {
    await this.outlookGraph.getMe(token.accessToken);
  };

const oauthProviderHealthHandler020: OAuthProviderHealthHandler =
  async function (_manifest, connection, token) {
    await this.helpScoutApi.health(
      this.helpScoutCredentials(connection, token.accessToken),
    );
  };

const oauthProviderHealthHandler021: OAuthProviderHealthHandler =
  async function (_manifest, connection, token) {
    const identity = await this.docusignIdentifyApi.health({
      accessToken: token.accessToken,
    });
    connection.metadata = {
      ...(connection.metadata ?? {}),
      docusignIdentifyUserId: identity.userId,
      docusignIdentifyAccountId: identity.accountId,
      docusignIdentifyBaseUri: identity.baseUri,
      accountLabel:
        identity.accountName ?? identity.userName ?? "Docusign account",
    };
  };

const oauthProviderHealthHandler022: OAuthProviderHealthHandler =
  async function (_manifest, connection, token) {
    await this.frontApi.health(
      this.frontCredentials(connection, token.accessToken),
    );
  };

const oauthProviderHealthHandler023: OAuthProviderHealthHandler =
  async function (_manifest, connection, token) {
    await this.teamworkApi.health(
      this.teamworkCredentials(connection, token.accessToken),
    );
  };

const oauthProviderHealthHandler024: OAuthProviderHealthHandler =
  async function (_manifest, connection, token) {
    await this.basecampApi.health(
      this.basecampCredentials(connection, token.accessToken),
    );
  };

const oauthProviderHealthHandler025: OAuthProviderHealthHandler =
  async function (_manifest, connection, token) {
    await this.wrikeApi.health(
      this.wrikeCredentials(connection, token.accessToken),
    );
  };

const oauthProviderHealthHandler026: OAuthProviderHealthHandler =
  async function (_manifest, connection, token) {
    await this.smartsheetApi.health(
      this.smartsheetCredentials(connection, token.accessToken),
    );
  };

const oauthProviderHealthHandler027: OAuthProviderHealthHandler =
  async function (_manifest, connection, token) {
    await this.todoistApi.health(
      this.todoistCredentials(connection, token.accessToken),
    );
  };

const oauthProviderHealthHandler028: OAuthProviderHealthHandler =
  async function (_manifest, connection, token) {
    await this.ticktickApi.health(
      this.ticktickCredentials(connection, token.accessToken),
    );
  };

const oauthProviderHealthHandler029: OAuthProviderHealthHandler =
  async function (_manifest, connection, token) {
    await this.harvestApi.health(
      this.harvestCredentials(connection, token.accessToken),
    );
  };

const oauthProviderHealthHandler030: OAuthProviderHealthHandler =
  async function (_manifest, _connection, token) {
    await this.microsoftTeamsGraph.listJoinedTeams(token.accessToken);
  };

const oauthProviderHealthHandler031: OAuthProviderHealthHandler =
  async function (_manifest, _connection, token) {
    await this.oneDriveApi.health(token.accessToken);
  };

const oauthProviderHealthHandler032: OAuthProviderHealthHandler =
  async function (_manifest, connection, token) {
    const siteId = this.stringOrNull(
      connection.metadata?.sharepointSelectedSiteId,
    );
    if (!siteId)
      throw new BadRequestException(
        "SharePoint selected-site binding is missing",
      );
    await this.sharePointApi.health(token.accessToken, siteId);
  };

const oauthProviderHealthHandler033: OAuthProviderHealthHandler =
  async function (_manifest, _connection, token) {
    await this.microsoftPlannerApi.health(token.accessToken);
  };

const oauthProviderHealthHandler034: OAuthProviderHealthHandler =
  async function (_manifest, _connection, token) {
    await this.microsoftToDoApi.health(token.accessToken);
  };

const oauthProviderHealthHandler035: OAuthProviderHealthHandler =
  async function (_manifest, connection, token) {
    await this.microsoftListsApi.health(
      token.accessToken,
      this.microsoftListsBinding(connection),
    );
  };

const oauthProviderHealthHandler036: OAuthProviderHealthHandler =
  async function (_manifest, _connection, token) {
    await this.oneNoteApi.health(token.accessToken);
  };

const oauthProviderHealthHandler037: OAuthProviderHealthHandler =
  async function (_manifest, connection, token) {
    await this.microsoftBookingsApi.health(
      token.accessToken,
      this.microsoftBookingsBinding(connection),
    );
  };

const oauthProviderHealthHandler038: OAuthProviderHealthHandler =
  async function (_manifest, connection, token) {
    await this.microsoftPowerBIApi.health(
      token.accessToken,
      this.microsoftPowerBIBinding(connection),
    );
  };

const oauthProviderHealthHandler039: OAuthProviderHealthHandler =
  async function (_manifest, connection, token) {
    await this.microsoftDynamics365Api.health(
      token.accessToken,
      this.microsoftDynamics365Binding(connection),
    );
  };

const oauthProviderHealthHandler040: OAuthProviderHealthHandler =
  async function (_manifest, connection, token) {
    await this.microsoftVivaEngageApi.health(
      token.accessToken,
      this.microsoftVivaEngageBinding(connection),
    );
  };

const oauthProviderHealthHandler041: OAuthProviderHealthHandler =
  async function (_manifest, _connection, token) {
    await this.zoomApi.health(token.accessToken);
  };

const oauthProviderHealthHandler042: OAuthProviderHealthHandler =
  async function (_manifest, _connection, token) {
    await this.linkedInApi.health(token.accessToken);
  };

const oauthProviderHealthHandler043: OAuthProviderHealthHandler =
  async function (_manifest, connection, token) {
    await this.oauth.validateThreadsProfile(connection, token.accessToken);
  };

const oauthProviderHealthHandler044: OAuthProviderHealthHandler =
  async function (_manifest, connection, token) {
    await this.oauth.validatePinterestAccount(connection, token.accessToken);
  };

const oauthProviderHealthHandler045: OAuthProviderHealthHandler =
  async function (_manifest, connection, token) {
    await this.oauth.validateTumblrAccount(connection, token.accessToken);
  };

const oauthProviderHealthHandler046: OAuthProviderHealthHandler =
  async function (_manifest, connection, token) {
    await this.oauth.validateMastodonAccount(connection, token.accessToken);
  };

const oauthProviderHealthHandler047: OAuthProviderHealthHandler =
  async function (_manifest, connection, token) {
    await this.oauth.validateNextdoorProfile(connection, token.accessToken);
  };

const oauthProviderHealthHandler048: OAuthProviderHealthHandler =
  async function (_manifest, connection, token) {
    await this.oauth.validateMeetupMember(connection, token.accessToken);
  };

const oauthProviderHealthHandler049: OAuthProviderHealthHandler =
  async function (_manifest, connection, token) {
    await this.oauth.validateEventbriteUser(connection, token.accessToken);
  };

const oauthProviderHealthHandler050: OAuthProviderHealthHandler =
  async function (_manifest, connection, token) {
    await this.oauth.validateWebexPerson(connection, token.accessToken);
  };

const oauthProviderHealthHandler051: OAuthProviderHealthHandler =
  async function (_manifest, connection, token) {
    await this.oauth.validateGoToMeetingIdentity(connection, token.accessToken);
  };

const oauthProviderHealthHandler052: OAuthProviderHealthHandler =
  async function (_manifest, connection, token) {
    await this.oauth.validateRingCentralExtension(
      connection,
      token.accessToken,
    );
  };

const oauthProviderHealthHandler053: OAuthProviderHealthHandler =
  async function (_manifest, connection, token) {
    await this.oauth.validateDialpadUser(connection, token.accessToken);
  };

const oauthProviderHealthHandler054: OAuthProviderHealthHandler =
  async function (_manifest, connection, token) {
    await this.oauth.validateAircallCompany(connection, token.accessToken);
  };

const oauthProviderHealthHandler055: OAuthProviderHealthHandler =
  async function (_manifest, connection, token) {
    await this.oauth.validateLineProfile(connection, token.accessToken);
  };

const oauthProviderHealthHandler056: OAuthProviderHealthHandler =
  async function (_manifest, connection, token) {
    await this.oauth.validateTwistUser(connection, token.accessToken);
  };

const oauthProviderHealthHandler057: OAuthProviderHealthHandler =
  async function (_manifest, connection, token) {
    await this.oauth.validateZohoMailAccount(connection, token.accessToken);
  };

const oauthProviderHealthHandler058: OAuthProviderHealthHandler =
  async function (_manifest, connection, token) {
    await this.oauth.validateSlackWorkspace(connection, token.accessToken);
  };

const oauthProviderHealthHandler059: OAuthProviderHealthHandler =
  async function (_manifest, _connection, token) {
    await this.githubApi.getUser(token.accessToken);
  };

const oauthProviderHealthHandler060: OAuthProviderHealthHandler =
  async function (_manifest, _connection, token) {
    await this.gitlabApi.getUser(token.accessToken);
  };

const oauthProviderHealthHandler061: OAuthProviderHealthHandler =
  async function (_manifest, _connection, token) {
    await this.bitbucketApi.getUser(token.accessToken);
  };

const oauthProviderHealthHandler062: OAuthProviderHealthHandler =
  async function (_manifest, _connection, token) {
    await this.notionApi.getCurrentBot(token.accessToken);
  };

const oauthProviderHealthHandler063: OAuthProviderHealthHandler =
  async function (_manifest, _connection, token) {
    await this.linearApi.getIdentity(token.accessToken);
  };

const oauthProviderHealthHandler064: OAuthProviderHealthHandler =
  async function (_manifest, _connection, token) {
    await this.asanaApi.getIdentity(token.accessToken);
  };

const oauthProviderHealthHandler065: OAuthProviderHealthHandler =
  async function (_manifest, _connection, token) {
    await this.trelloApi.getIdentity({
      apiKey: this.requiredString(
        (token.credentials as Record<string, unknown>).clientId,
        "Trello API key",
      ),
      token: token.accessToken,
    });
  };

const oauthProviderHealthHandler066: OAuthProviderHealthHandler =
  async function (_manifest, _connection, token) {
    await this.clickUpApi.getIdentity(token.accessToken);
  };

const oauthProviderHealthHandler067: OAuthProviderHealthHandler =
  async function (_manifest, _connection, token) {
    await this.mondayApi.getIdentity(token.accessToken);
  };

const oauthProviderHealthHandler068: OAuthProviderHealthHandler =
  async function (_manifest, _connection, token) {
    await this.airtableApi.getIdentity(token.accessToken);
  };

const oauthProviderHealthHandler069: OAuthProviderHealthHandler =
  async function (_manifest, _connection, token) {
    await this.dropboxApi.getCurrentAccount(token.accessToken);
  };

const oauthProviderHealthHandler070: OAuthProviderHealthHandler =
  async function (_manifest, _connection, token) {
    await this.boxApi.getCurrentUser(token.accessToken);
  };

const oauthProviderHealthHandler071: OAuthProviderHealthHandler =
  async function (_manifest, connection, token) {
    const cloudId = this.stringOrNull(connection.metadata?.cloudId);
    if (!cloudId)
      throw new ConnectorExecutionError(
        "connection_not_ready",
        "Confluence connection is not site-bound.",
      );
    await this.confluenceApi.listSpaces(token.accessToken, cloudId, {
      limit: 1,
    });
  };

const oauthProviderHealthHandler072: OAuthProviderHealthHandler =
  async function (_manifest, _connection, token) {
    await this.quipApi.getCurrentUser(token.accessToken);
  };

const oauthProviderHealthHandler073: OAuthProviderHealthHandler =
  async function (_manifest, _connection, token) {
    await this.evernoteApi.health({ accessToken: token.accessToken });
  };

const oauthProviderHealthHandler074: OAuthProviderHealthHandler =
  async function (_manifest, _connection, token) {
    await this.reflectApi.getMe(token.accessToken);
    await this.reflectApi.listGraphs(token.accessToken);
  };

const oauthProviderHealthHandler075: OAuthProviderHealthHandler =
  async function (_manifest, _connection, token) {
    await this.raindropApi.getUser(token.accessToken);
    await this.raindropApi.listCollections(token.accessToken);
  };

const oauthProviderHealthHandler076: OAuthProviderHealthHandler =
  async function (_manifest, _connection, token) {
    await this.inoreaderApi.getUserInfo(token.accessToken);
    await this.inoreaderApi.listSubscriptions(token.accessToken);
    await this.inoreaderApi.listTags(token.accessToken);
  };

const oauthProviderHealthHandler077: OAuthProviderHealthHandler =
  async function (_manifest, _connection, token) {
    await this.dropboxPaperApi.getCurrentAccount(token.accessToken);
    await this.dropboxPaperApi.getPaperStorageMode(token.accessToken);
  };

const oauthProviderHealthHandler078: OAuthProviderHealthHandler =
  async function (_manifest, connection, token) {
    await this.oauth.validateZohoWorkDriveUser(connection, token.accessToken);
  };

const oauthProviderHealthHandler079: OAuthProviderHealthHandler =
  async function (_manifest, _connection, token) {
    await this.vimeoApi.getMe(token.accessToken);
  };

const oauthProviderHealthHandler080: OAuthProviderHealthHandler =
  async function (_manifest, _connection, token) {
    await this.wistiaApi.getAccount(token.accessToken);
  };

const oauthProviderHealthHandler081: OAuthProviderHealthHandler =
  async function (_manifest, _connection, token) {
    await this.frameIoApi.getMe(token.accessToken);
  };

const oauthProviderHealthHandler082: OAuthProviderHealthHandler =
  async function (_manifest, _connection, token) {
    await this.guruApi.listTeams(token.accessToken);
    await this.guruMcp.listAgents(token.accessToken);
  };

const oauthProviderHealthHandler083: OAuthProviderHealthHandler =
  async function (_manifest, _connection, token) {
    await this.sliteMcp.health(token.accessToken);
  };

const oauthProviderHealthHandler084: OAuthProviderHealthHandler =
  async function (_manifest, _connection, token) {
    await this.nuclinoMcp.health(token.accessToken);
  };

const oauthProviderHealthHandler085: OAuthProviderHealthHandler =
  async function (_manifest, _connection, token) {
    await this.scribeMcp.health(token.accessToken);
  };

const oauthProviderHealthHandler086: OAuthProviderHealthHandler =
  async function (_manifest, _connection, token) {
    await this.instapaperApi.verifyAccount(
      this.instapaperCredentials(token.credentials),
    );
  };

const oauthProviderHealthHandler087: OAuthProviderHealthHandler =
  async function (_manifest, _connection, token) {
    await this.googleDriveApi.health(token.accessToken);
  };

const oauthProviderHealthHandler088: OAuthProviderHealthHandler =
  async function (_manifest, _connection, token) {
    await this.googleDocsApi.health(token.accessToken);
  };

const oauthProviderHealthHandler089: OAuthProviderHealthHandler =
  async function (_manifest, _connection, token) {
    await this.googleSheetsApi.health(token.accessToken);
  };

const oauthProviderHealthHandler090: OAuthProviderHealthHandler =
  async function (_manifest, _connection, token) {
    await this.googleSlidesApi.health(token.accessToken);
  };

const oauthProviderHealthHandler091: OAuthProviderHealthHandler =
  async function (_manifest, _connection, token) {
    await this.googleFormsApi.health(token.accessToken);
  };

const oauthProviderHealthHandler092: OAuthProviderHealthHandler =
  async function (_manifest, _connection, token) {
    await this.googleTasksApi.health(token.accessToken);
  };

const oauthProviderHealthHandler093: OAuthProviderHealthHandler =
  async function (_manifest, _connection, token) {
    await this.googleContactsApi.health(token.accessToken);
  };

const oauthProviderHealthHandler094: OAuthProviderHealthHandler =
  async function (_manifest, _connection, token) {
    await this.googlePhotosApi.health(token.accessToken);
  };

const oauthProviderHealthHandler095: OAuthProviderHealthHandler =
  async function (_manifest, _connection, token) {
    await this.googleMeetApi.health(token.accessToken);
  };

const oauthProviderHealthHandler096: OAuthProviderHealthHandler =
  async function (_manifest, _connection, token) {
    await this.googleChatApi.health(token.accessToken);
  };

const oauthProviderHealthHandler097: OAuthProviderHealthHandler =
  async function (_manifest, _connection, token) {
    this.googleAdsApi.health(
      token.accessToken,
      this.configService?.get<string>("GOOGLE_ADS_DEVELOPER_TOKEN")?.trim() ??
        "",
    );
  };

const oauthProviderHealthHandler098: OAuthProviderHealthHandler =
  async function (_manifest, _connection, token) {
    this.googleAnalyticsApi.health(token.accessToken);
  };

const oauthProviderHealthHandler099: OAuthProviderHealthHandler =
  async function (_manifest, _connection, token) {
    this.googleSearchConsoleApi.health(token.accessToken);
  };

const oauthProviderHealthHandler100: OAuthProviderHealthHandler =
  async function (_manifest, _connection, token) {
    this.googleBusinessProfileApi.health(token.accessToken);
  };

const oauthProviderHealthHandler101: OAuthProviderHealthHandler =
  async function (_manifest, _connection, token) {
    this.googleMerchantCenterApi.health(token.accessToken);
  };

const oauthProviderHealthHandler102: OAuthProviderHealthHandler =
  async function (_manifest, _connection, token) {
    this.youtubeApi.health(token.accessToken);
  };

const oauthProviderHealthHandler103: OAuthProviderHealthHandler =
  async function (_manifest, _connection, token) {
    this.googleClassroomApi.health(token.accessToken);
  };

export const OAuthProviderHealthHandlers = {
  posthog: oauthProviderHealthHandler001,
  sentry: oauthProviderHealthHandler002,
  cloudflare: oauthProviderHealthHandler003,
  vercel: oauthProviderHealthHandler004,
  contentful: oauthProviderHealthHandler005,
  "teams-phone": oauthProviderHealthHandler006,
  "webex-calling": oauthProviderHealthHandler007,
  "goto-webinar": oauthProviderHealthHandler008,
  livestorm: oauthProviderHealthHandler009,
  "ms-project": oauthProviderHealthHandler010,
  "microsoft-dynamics-365-sales": oauthProviderHealthHandler011,
  "microsoft-dynamics-365-customer-service": oauthProviderHealthHandler012,
  "microsoft-dynamics-365-business-central": oauthProviderHealthHandler013,
  "microsoft-entra-id": oauthProviderHealthHandler014,
  yammer: oauthProviderHealthHandler015,
  "viva-learning": oauthProviderHealthHandler016,
  jira: oauthProviderHealthHandler017,
  "jira-service-management": oauthProviderHealthHandler018,
  outlook: oauthProviderHealthHandler019,
  "help-scout": oauthProviderHealthHandler020,
  "docusign-identify": oauthProviderHealthHandler021,
  front: oauthProviderHealthHandler022,
  teamwork: oauthProviderHealthHandler023,
  basecamp: oauthProviderHealthHandler024,
  wrike: oauthProviderHealthHandler025,
  smartsheet: oauthProviderHealthHandler026,
  todoist: oauthProviderHealthHandler027,
  ticktick: oauthProviderHealthHandler028,
  harvest: oauthProviderHealthHandler029,
  "microsoft-teams": oauthProviderHealthHandler030,
  onedrive: oauthProviderHealthHandler031,
  sharepoint: oauthProviderHealthHandler032,
  "microsoft-planner": oauthProviderHealthHandler033,
  "microsoft-to-do": oauthProviderHealthHandler034,
  "microsoft-lists": oauthProviderHealthHandler035,
  onenote: oauthProviderHealthHandler036,
  "microsoft-bookings": oauthProviderHealthHandler037,
  "microsoft-power-bi": oauthProviderHealthHandler038,
  "microsoft-dynamics-365": oauthProviderHealthHandler039,
  "microsoft-viva-engage": oauthProviderHealthHandler040,
  zoom: oauthProviderHealthHandler041,
  linkedin: oauthProviderHealthHandler042,
  threads: oauthProviderHealthHandler043,
  pinterest: oauthProviderHealthHandler044,
  tumblr: oauthProviderHealthHandler045,
  mastodon: oauthProviderHealthHandler046,
  nextdoor: oauthProviderHealthHandler047,
  meetup: oauthProviderHealthHandler048,
  eventbrite: oauthProviderHealthHandler049,
  webex: oauthProviderHealthHandler050,
  "goto-meeting": oauthProviderHealthHandler051,
  ringcentral: oauthProviderHealthHandler052,
  dialpad: oauthProviderHealthHandler053,
  aircall: oauthProviderHealthHandler054,
  line: oauthProviderHealthHandler055,
  twist: oauthProviderHealthHandler056,
  "zoho-mail": oauthProviderHealthHandler057,
  slack: oauthProviderHealthHandler058,
  github: oauthProviderHealthHandler059,
  gitlab: oauthProviderHealthHandler060,
  bitbucket: oauthProviderHealthHandler061,
  notion: oauthProviderHealthHandler062,
  linear: oauthProviderHealthHandler063,
  asana: oauthProviderHealthHandler064,
  trello: oauthProviderHealthHandler065,
  clickup: oauthProviderHealthHandler066,
  "monday-com": oauthProviderHealthHandler067,
  airtable: oauthProviderHealthHandler068,
  dropbox: oauthProviderHealthHandler069,
  box: oauthProviderHealthHandler070,
  confluence: oauthProviderHealthHandler071,
  quip: oauthProviderHealthHandler072,
  evernote: oauthProviderHealthHandler073,
  reflect: oauthProviderHealthHandler074,
  "raindrop-io": oauthProviderHealthHandler075,
  inoreader: oauthProviderHealthHandler076,
  "dropbox-paper": oauthProviderHealthHandler077,
  "zoho-workdrive": oauthProviderHealthHandler078,
  vimeo: oauthProviderHealthHandler079,
  wistia: oauthProviderHealthHandler080,
  "frame-io": oauthProviderHealthHandler081,
  guru: oauthProviderHealthHandler082,
  slite: oauthProviderHealthHandler083,
  nuclino: oauthProviderHealthHandler084,
  scribe: oauthProviderHealthHandler085,
  instapaper: oauthProviderHealthHandler086,
  "google-drive": oauthProviderHealthHandler087,
  "google-docs": oauthProviderHealthHandler088,
  "google-sheets": oauthProviderHealthHandler089,
  "google-slides": oauthProviderHealthHandler090,
  "google-forms": oauthProviderHealthHandler091,
  "google-tasks": oauthProviderHealthHandler092,
  "google-contacts": oauthProviderHealthHandler093,
  "google-photos": oauthProviderHealthHandler094,
  "google-meet": oauthProviderHealthHandler095,
  "google-chat": oauthProviderHealthHandler096,
  "google-ads": oauthProviderHealthHandler097,
  "google-analytics": oauthProviderHealthHandler098,
  "google-search-console": oauthProviderHealthHandler099,
  "google-business-profile": oauthProviderHealthHandler100,
  "google-merchant-center": oauthProviderHealthHandler101,
  youtube: oauthProviderHealthHandler102,
  "google-classroom": oauthProviderHealthHandler103,
} satisfies OAuthProviderHealthHandlerMap;
