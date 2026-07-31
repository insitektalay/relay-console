import { safeConnectorFetch } from "./safe-connector-fetch";
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Optional,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import {
  createHash,
  createHmac,
  createPublicKey,
  timingSafeEqual,
  verify,
} from "node:crypto";
import { IsNull, LessThan, Not, Repository } from "typeorm";
import {
  MarketplaceConnectionEntity,
  MarketplaceOAuthStateEntity,
} from "../../../entities";
import { AuditLogService } from "../../audit-log/audit-log.service";
import { ToolRequestService } from "../../tool-request/tool-request.service";
import { MarketplaceConnectorCredentialService } from "./connector-credential.service";
import { MarketplaceConnectorRegistry } from "./connector-registry";
import { LinkedInApiAdapter } from "./linkedin/linkedin-api.adapter";
import { OUTLOOK_CONNECTOR_MANIFEST } from "./outlook/outlook.connector";
import { MICROSOFT_TEAMS_CONNECTOR_MANIFEST } from "./microsoft-teams/microsoft-teams.connector";
import { OutlookGraphAdapter } from "./outlook/outlook-graph.adapter";
import { MicrosoftDynamics365SalesApiAdapter } from "./microsoft-dynamics-365-sales/microsoft-dynamics-365-sales-api.adapter";
import { MicrosoftDynamics365CustomerServiceApiAdapter } from "./microsoft-dynamics-365-customer-service/microsoft-dynamics-365-customer-service-api.adapter";
import { MicrosoftDynamics365BusinessCentralApiAdapter } from "./microsoft-dynamics-365-business-central/microsoft-dynamics-365-business-central-api.adapter";
import { MicrosoftEntraIdGraphAdapter } from "./microsoft-entra-id/microsoft-entra-id-graph.adapter";
import { YammerApiAdapter } from "./yammer/yammer-api.adapter";
import { VivaLearningGraphAdapter } from "./viva-learning/viva-learning-graph.adapter";
import { InstapaperApiAdapter } from "./instapaper/instapaper-api.adapter";
import { SliteMcpAdapter } from "./slite/slite-mcp.adapter";
import { NuclinoMcpAdapter } from "./nuclino/nuclino-mcp.adapter";
import { ScribeMcpAdapter } from "./scribe/scribe-mcp.adapter";
import { OtterAiMcpAdapter } from "./otter-ai/otter-ai-mcp.adapter";
import { FirefliesAiMcpAdapter } from "./fireflies-ai/fireflies-ai-mcp.adapter";
import { AnyDoMcpAdapter } from "./any-do/any-do-mcp.adapter";
import { AkiflowMcpAdapter } from "./akiflow/akiflow-mcp.adapter";
import { SunsamaMcpAdapter } from "./sunsama/sunsama-mcp.adapter";
import { RememberTheMilkMcpAdapter } from "./remember-the-milk/remember-the-milk-mcp.adapter";
import { FathomMcpAdapter } from "./fathom/fathom-mcp.adapter";
import { BonsaiMcpAdapter } from "./bonsai/bonsai-mcp.adapter";
import { GrainMcpAdapter } from "./grain/grain-mcp.adapter";
import { WhimsicalMcpAdapter } from "./whimsical/whimsical-mcp.adapter";
import { CognitoFormsMcpAdapter } from "./cognito-forms/cognito-forms-mcp.adapter";
import { JotformMcpAdapter } from "./jotform/jotform-mcp.adapter";
import { XMindMcpAdapter } from "./xmind/xmind-mcp.adapter";
import { AdobeAnalyticsMcpAdapter } from "./adobe-analytics/adobe-analytics-mcp.adapter";
import { CloudinaryMcpAdapter } from "./cloudinary/cloudinary-mcp.adapter";
import { TrelloApiAdapter } from "./trello/trello-api.adapter";
import { SmugMugApiAdapter } from "./smugmug/smugmug-api.adapter";
import { FlickrApiAdapter } from "./flickr/flickr-api.adapter";
import { AudiomackApiAdapter } from "./audiomack/audiomack-api.adapter";
import {
  MastodonApiAdapter,
  MastodonApiError,
} from "./mastodon/mastodon-api.adapter";
import {
  getOAuthFrontendUrl,
  normalizeOAuthReturnTo,
} from "../oauth-return-url";
import { OAUTH_LOCAL_DISCONNECT_HANDLER_BY_SLUG } from "./oauth/provider-disconnect/oauth-provider-disconnect-registry.index";
import { OAUTH_PROVIDER_STRATEGY_BY_SLUG } from "./oauth/oauth-provider-strategy.index";
import { installOAuthServiceMethodModules } from "./oauth/oauth-service-method-module";
import {
  OAUTH_SERVICE_EXTENSIONS,
  type OAuthServiceExtensionMethods,
} from "./oauth/service-extensions/oauth-service-extensions.index";
import type { OAuthTokenResponse } from "./oauth/oauth-token-response";
export type { OAuthTokenResponse } from "./oauth/oauth-token-response";

export type OAuthAccessTokenResult = {
  accessToken: string;
  credentials: Record<string, unknown>;
  refreshed: boolean;
};

const ZOHO_MAIL_REGIONS = {
  "accounts.zoho.com": { code: "us", mailOrigin: "https://mail.zoho.com" },
  "accounts.zoho.eu": { code: "eu", mailOrigin: "https://mail.zoho.eu" },
  "accounts.zoho.in": { code: "in", mailOrigin: "https://mail.zoho.in" },
  "accounts.zoho.com.au": {
    code: "au",
    mailOrigin: "https://mail.zoho.com.au",
  },
  "accounts.zoho.jp": { code: "jp", mailOrigin: "https://mail.zoho.jp" },
  "accounts.zohocloud.ca": {
    code: "ca",
    mailOrigin: "https://mail.zohocloud.ca",
  },
  "accounts.zoho.com.cn": {
    code: "cn",
    mailOrigin: "https://mail.zoho.com.cn",
  },
  "accounts.zoho.ae": { code: "ae", mailOrigin: "https://mail.zoho.ae" },
  "accounts.zoho.sa": { code: "sa", mailOrigin: "https://mail.zoho.sa" },
} as const;

type ZohoMailAccountsHost = keyof typeof ZOHO_MAIL_REGIONS;

const ZOHO_WORKDRIVE_REGIONS = {
  "accounts.zoho.com": {
    code: "us",
    apiOrigin: "https://www.zohoapis.com",
    downloadOrigin: "https://download.zoho.com",
    uploadOrigin: "https://upload.zoho.com",
  },
  "accounts.zoho.eu": {
    code: "eu",
    apiOrigin: "https://www.zohoapis.eu",
    downloadOrigin: "https://download.zoho.eu",
    uploadOrigin: "https://upload.zoho.eu",
  },
  "accounts.zoho.in": {
    code: "in",
    apiOrigin: "https://www.zohoapis.in",
    downloadOrigin: "https://download.zoho.in",
    uploadOrigin: "https://upload.zoho.in",
  },
  "accounts.zoho.com.au": {
    code: "au",
    apiOrigin: "https://www.zohoapis.com.au",
    downloadOrigin: "https://download.zoho.com.au",
    uploadOrigin: "https://upload.zoho.com.au",
  },
  "accounts.zoho.jp": {
    code: "jp",
    apiOrigin: "https://www.zohoapis.jp",
    downloadOrigin: "https://download.zoho.jp",
    uploadOrigin: "https://upload.zoho.jp",
  },
  "accounts.zohocloud.ca": {
    code: "ca",
    apiOrigin: "https://www.zohoapis.ca",
    downloadOrigin: "https://download.zohocloud.ca",
    uploadOrigin: "https://upload.zohocloud.ca",
  },
  "accounts.zoho.com.cn": {
    code: "cn",
    apiOrigin: "https://www.zohoapis.com.cn",
    downloadOrigin: "https://download.zoho.com.cn",
    uploadOrigin: "https://upload.zoho.com.cn",
  },
  "accounts.zoho.ae": {
    code: "ae",
    apiOrigin: "https://www.zohoapis.ae",
    downloadOrigin: "https://files.zoho.ae",
    uploadOrigin: "https://files.zoho.ae",
  },
  "accounts.zoho.sa": {
    code: "sa",
    apiOrigin: "https://www.zohoapis.sa",
    downloadOrigin: "https://files.zoho.sa",
    uploadOrigin: "https://files.zoho.sa",
  },
} as const;

type ZohoWorkDriveAccountsHost = keyof typeof ZOHO_WORKDRIVE_REGIONS;

const ZOHO_CRM_REGIONS = {
  "accounts.zoho.com": { code: "us", apiOrigin: "https://www.zohoapis.com" },
  "accounts.zoho.eu": { code: "eu", apiOrigin: "https://www.zohoapis.eu" },
  "accounts.zoho.in": { code: "in", apiOrigin: "https://www.zohoapis.in" },
  "accounts.zoho.com.au": {
    code: "au",
    apiOrigin: "https://www.zohoapis.com.au",
  },
  "accounts.zoho.jp": { code: "jp", apiOrigin: "https://www.zohoapis.jp" },
  "accounts.zohocloud.ca": {
    code: "ca",
    apiOrigin: "https://www.zohoapis.ca",
  },
  "accounts.zoho.com.cn": {
    code: "cn",
    apiOrigin: "https://www.zohoapis.com.cn",
  },
  "accounts.zoho.ae": { code: "ae", apiOrigin: "https://www.zohoapis.ae" },
  "accounts.zoho.sa": { code: "sa", apiOrigin: "https://www.zohoapis.sa" },
  "accounts.zoho.uk": { code: "uk", apiOrigin: "https://www.zohoapis.uk" },
} as const;

type ZohoCrmAccountsHost = keyof typeof ZOHO_CRM_REGIONS;

const ZOHO_DESK_REGIONS = {
  "accounts.zoho.com": { code: "us", apiOrigin: "https://desk.zoho.com" },
  "accounts.zoho.eu": { code: "eu", apiOrigin: "https://desk.zoho.eu" },
  "accounts.zoho.in": { code: "in", apiOrigin: "https://desk.zoho.in" },
  "accounts.zoho.com.au": { code: "au", apiOrigin: "https://desk.zoho.com.au" },
  "accounts.zohocloud.ca": {
    code: "ca",
    apiOrigin: "https://desk.zohocloud.ca",
  },
  "accounts.zoho.sa": { code: "sa", apiOrigin: "https://desk.zoho.sa" },
  "accounts.zoho.jp": { code: "jp", apiOrigin: "https://desk.zoho.jp" },
  "accounts.zoho.com.cn": { code: "cn", apiOrigin: "https://desk.zoho.com.cn" },
  "accounts.zoho.sg": { code: "sg", apiOrigin: "https://desk.zoho.sg" },
  "accounts.zoho.ae": { code: "ae", apiOrigin: "https://desk.zoho.ae" },
} as const;

type ZohoDeskAccountsHost = keyof typeof ZOHO_DESK_REGIONS;

const ZOHO_CAMPAIGNS_REGIONS = {
  "accounts.zoho.com": {
    code: "us",
    tokenApiOrigin: "https://www.zohoapis.com",
    apiOrigin: "https://campaigns.zoho.com",
  },
  "accounts.zoho.eu": {
    code: "eu",
    tokenApiOrigin: "https://www.zohoapis.eu",
    apiOrigin: "https://campaigns.zoho.eu",
  },
  "accounts.zoho.in": {
    code: "in",
    tokenApiOrigin: "https://www.zohoapis.in",
    apiOrigin: "https://campaigns.zoho.in",
  },
  "accounts.zoho.com.au": {
    code: "au",
    tokenApiOrigin: "https://www.zohoapis.com.au",
    apiOrigin: "https://campaigns.zoho.com.au",
  },
  "accounts.zoho.jp": {
    code: "jp",
    tokenApiOrigin: "https://www.zohoapis.jp",
    apiOrigin: "https://campaigns.zoho.jp",
  },
  "accounts.zoho.com.cn": {
    code: "cn",
    tokenApiOrigin: "https://www.zohoapis.com.cn",
    apiOrigin: "https://campaigns.zoho.com.cn",
  },
} as const;

type ZohoCampaignsAccountsHost = keyof typeof ZOHO_CAMPAIGNS_REGIONS;

const ZOHO_ANALYTICS_REGIONS = {
  "accounts.zoho.com": {
    code: "us",
    tokenApiOrigin: "https://www.zohoapis.com",
    apiOrigin: "https://analyticsapi.zoho.com",
  },
  "accounts.zoho.eu": {
    code: "eu",
    tokenApiOrigin: "https://www.zohoapis.eu",
    apiOrigin: "https://analyticsapi.zoho.eu",
  },
  "accounts.zoho.in": {
    code: "in",
    tokenApiOrigin: "https://www.zohoapis.in",
    apiOrigin: "https://analyticsapi.zoho.in",
  },
  "accounts.zoho.com.au": {
    code: "au",
    tokenApiOrigin: "https://www.zohoapis.com.au",
    apiOrigin: "https://analyticsapi.zoho.com.au",
  },
  "accounts.zoho.com.cn": {
    code: "cn",
    tokenApiOrigin: "https://www.zohoapis.com.cn",
    apiOrigin: "https://analyticsapi.zoho.com.cn",
  },
  "accounts.zoho.jp": {
    code: "jp",
    tokenApiOrigin: "https://www.zohoapis.jp",
    apiOrigin: "https://analyticsapi.zoho.jp",
  },
  "accounts.zoho.sa": {
    code: "sa",
    tokenApiOrigin: "https://www.zohoapis.sa",
    apiOrigin: "https://analyticsapi.zoho.sa",
  },
  "accounts.zohocloud.ca": {
    code: "ca",
    tokenApiOrigin: "https://www.zohoapis.ca",
    apiOrigin: "https://analyticsapi.zohocloud.ca",
  },
} as const;
type ZohoAnalyticsAccountsHost = keyof typeof ZOHO_ANALYTICS_REGIONS;

export type MicrosoftAuthorityMode =
  | "single_tenant"
  | "multi_tenant_org"
  | "multi_tenant_common";

export type MicrosoftSenderIdentity = {
  id: string;
  email: string;
  displayName: string | null;
  type:
    | "primary_mailbox"
    | "verified_alias"
    | "shared_mailbox"
    | "unknown_unverified"
    | "missing";
  validationStatus: "verified" | "unverified" | "missing";
  lastValidatedAt: string;
  allowedForConnection: boolean;
  agentIds: string[];
  installIds: string[];
  source: "graph_me" | "manual";
  adminUrl?: string;
};

@Injectable()
export class MarketplaceConnectorOAuthService {
  constructor(
    readonly registry: MarketplaceConnectorRegistry,
    readonly credentials: MarketplaceConnectorCredentialService,
    readonly auditLogService: AuditLogService,
    readonly toolRequestService: ToolRequestService,
    readonly configService: ConfigService,
    readonly outlookGraph: OutlookGraphAdapter,
    @InjectRepository(MarketplaceConnectionEntity)
    readonly connectionRepo: Repository<MarketplaceConnectionEntity>,
    @InjectRepository(MarketplaceOAuthStateEntity)
    readonly oauthStateRepo: Repository<MarketplaceOAuthStateEntity>,
    @Optional()
    readonly linkedInApi: LinkedInApiAdapter = new LinkedInApiAdapter(),
    @Optional()
    readonly instapaperApi: InstapaperApiAdapter = new InstapaperApiAdapter(),
    @Optional()
    readonly trelloApi: TrelloApiAdapter = new TrelloApiAdapter(),
    @Optional()
    readonly mastodonApi: MastodonApiAdapter = new MastodonApiAdapter(),
    @Optional()
    readonly smugMugApi: SmugMugApiAdapter = new SmugMugApiAdapter(),
    @Optional()
    readonly flickrApi: FlickrApiAdapter = new FlickrApiAdapter(),
    @Optional()
    readonly audiomackApi: AudiomackApiAdapter = new AudiomackApiAdapter(),
    @Optional()
    readonly sliteMcp: SliteMcpAdapter = new SliteMcpAdapter(),
  ) {}

  readonly nuclinoMcp = new NuclinoMcpAdapter();
  readonly scribeMcp = new ScribeMcpAdapter();
  readonly otterAiMcp = new OtterAiMcpAdapter();
  readonly firefliesAiMcp = new FirefliesAiMcpAdapter();
  readonly anyDoMcp = new AnyDoMcpAdapter();
  readonly akiflowMcp = new AkiflowMcpAdapter();
  readonly sunsamaMcp = new SunsamaMcpAdapter();
  readonly rememberTheMilkMcp = new RememberTheMilkMcpAdapter();
  readonly fathomMcp = new FathomMcpAdapter();
  readonly bonsaiMcp = new BonsaiMcpAdapter();
  readonly grainMcp = new GrainMcpAdapter();
  readonly whimsicalMcp = new WhimsicalMcpAdapter();
  readonly cognitoFormsMcp = new CognitoFormsMcpAdapter();
  readonly jotformMcp = new JotformMcpAdapter();
  readonly xmindMcp = new XMindMcpAdapter();
  readonly adobeAnalyticsMcp = new AdobeAnalyticsMcpAdapter();
  readonly cloudinaryMcp = new CloudinaryMcpAdapter();
  readonly microsoftDynamics365SalesApi =
    new MicrosoftDynamics365SalesApiAdapter();
  readonly microsoftDynamics365CustomerServiceApi =
    new MicrosoftDynamics365CustomerServiceApiAdapter();
  readonly microsoftDynamics365BusinessCentralApi =
    new MicrosoftDynamics365BusinessCentralApiAdapter();
  readonly microsoftEntraIdGraph = new MicrosoftEntraIdGraphAdapter();
  readonly yammerApi = new YammerApiAdapter();
  readonly vivaLearningGraph = new VivaLearningGraphAdapter();
  readonly tokenRefreshes = new Map<string, Promise<OAuthAccessTokenResult>>();

  quickBooksEnvironment(): "sandbox" | "production" {
    const value = this.configService
      .get<string>("QUICKBOOKS_ENVIRONMENT")
      ?.trim()
      .toLowerCase();
    if (value !== "sandbox" && value !== "production")
      throw new BadRequestException(
        "QUICKBOOKS_ENVIRONMENT must be configured as sandbox or production",
      );
    return value;
  }

  evernoteClient(options: Record<string, unknown>) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Evernote = require("evernote") as {
      Client: new (input: Record<string, unknown>) => any;
    };
    return new Evernote.Client({ sandbox: false, china: false, ...options });
  }

  async validateNextdoorProfile(
    connection: MarketplaceConnectionEntity,
    accessToken: string,
  ) {
    if (connection.appSlug !== "nextdoor") {
      throw new BadRequestException(
        "Nextdoor profile validation requires a Nextdoor connection",
      );
    }
    const expectedProfileLabel =
      this.stringOrNull(connection.metadata?.displayName) ?? "";
    const profile = await this.fetchProviderProfile("nextdoor", accessToken, {
      expectedProfileLabel,
    });
    const validated = this.buildMetadata(
      "nextdoor",
      this.stringOrNull(connection.metadata?.clientId) ?? "",
      this.stringArray(connection.metadata?.grantedScopes),
      profile,
    );
    if (
      validated.selectedProfileId !== connection.metadata?.selectedProfileId
    ) {
      throw new ForbiddenException("Nextdoor selected profile binding changed");
    }
    connection.metadata = { ...(connection.metadata ?? {}), ...validated };
    return validated;
  }

  async validateMeetupMember(
    connection: MarketplaceConnectionEntity,
    accessToken: string,
  ) {
    if (connection.appSlug !== "meetup") {
      throw new BadRequestException(
        "Meetup member validation requires a Meetup connection",
      );
    }
    const profile = (await this.fetchProviderProfile(
      "meetup",
      accessToken,
    )) as Record<string, unknown>;
    const metadata = this.buildMetadata(
      "meetup",
      this.stringOrNull(connection.metadata?.clientId) ?? "",
      [],
      profile,
    );
    if (metadata.meetupMemberId !== connection.metadata?.meetupMemberId) {
      throw new ForbiddenException("Meetup connected member binding changed");
    }
    connection.metadata = { ...(connection.metadata ?? {}), ...metadata };
    return metadata;
  }

  async validateEventbriteUser(
    connection: MarketplaceConnectionEntity,
    accessToken: string,
  ) {
    if (connection.appSlug !== "eventbrite") {
      throw new BadRequestException(
        "Eventbrite user validation requires an Eventbrite connection",
      );
    }
    const profile = await this.fetchProviderProfile("eventbrite", accessToken);
    const metadata = this.buildMetadata(
      "eventbrite",
      this.stringOrNull(connection.metadata?.clientId) ?? "",
      [],
      profile,
    );
    if (metadata.eventbriteUserId !== connection.metadata?.eventbriteUserId) {
      throw new ForbiddenException("Eventbrite connected user binding changed");
    }
    connection.metadata = { ...(connection.metadata ?? {}), ...metadata };
    return metadata;
  }

  async validateThreadsProfile(
    connection: MarketplaceConnectionEntity,
    accessToken: string,
  ) {
    const profile = await this.fetchProviderProfile("threads", accessToken);
    const metadata = this.buildMetadata(
      "threads",
      this.stringOrNull(connection.metadata?.clientId) ?? "",
      this.stringArray(connection.metadata?.grantedScopes),
      profile,
    );
    if (metadata.threadsProfileId !== connection.metadata?.threadsProfileId)
      throw new ForbiddenException(
        "Threads connected profile changed; reconnect is required",
      );
    connection.metadata = { ...(connection.metadata ?? {}), ...metadata };
    connection.lastValidatedAt = new Date();
    await this.connectionRepo.save(connection);
  }

  async validatePinterestAccount(
    connection: MarketplaceConnectionEntity,
    accessToken: string,
  ) {
    if (connection.appSlug !== "pinterest")
      throw new BadRequestException(
        "Pinterest account validation requires a Pinterest connection",
      );
    const profile = await this.fetchProviderProfile("pinterest", accessToken);
    const metadata = this.buildMetadata(
      "pinterest",
      this.stringOrNull(connection.metadata?.clientId) ?? "",
      this.stringArray(connection.metadata?.grantedScopes),
      profile,
    );
    if (
      metadata.pinterestUserAccountId !==
      connection.metadata?.pinterestUserAccountId
    )
      throw new ForbiddenException(
        "Pinterest connected user account changed; reconnect is required",
      );
    connection.metadata = { ...(connection.metadata ?? {}), ...metadata };
    connection.lastValidatedAt = new Date();
    await this.connectionRepo.save(connection);
  }

  async validateTumblrAccount(
    connection: MarketplaceConnectionEntity,
    accessToken: string,
  ) {
    if (connection.appSlug !== "tumblr")
      throw new BadRequestException(
        "Tumblr account validation requires a Tumblr connection",
      );
    const profile = await this.fetchProviderProfile("tumblr", accessToken);
    const metadata = this.buildMetadata(
      "tumblr",
      this.stringOrNull(connection.metadata?.clientId) ?? "",
      this.stringArray(connection.metadata?.grantedScopes),
      profile,
    );
    if (
      metadata.tumblrAccountName !== connection.metadata?.tumblrAccountName ||
      metadata.tumblrSelectedBlogUuid !==
        connection.metadata?.tumblrSelectedBlogUuid
    )
      throw new ForbiddenException(
        "Tumblr connected account or selected blog changed; reconnect is required",
      );
    connection.metadata = { ...(connection.metadata ?? {}), ...metadata };
    connection.lastValidatedAt = new Date();
    await this.connectionRepo.save(connection);
  }

  async validateMastodonAccount(
    connection: MarketplaceConnectionEntity,
    accessToken: string,
  ) {
    if (connection.appSlug !== "mastodon")
      throw new BadRequestException(
        "Mastodon account validation requires a Mastodon connection",
      );
    const providerSession = {
      mastodonInstanceOrigin: this.stringOrNull(
        connection.metadata?.mastodonInstanceOrigin,
      ),
      mastodonInstanceDomain: this.stringOrNull(
        connection.metadata?.mastodonInstanceDomain,
      ),
      mastodonInstanceVersion: this.stringOrNull(
        connection.metadata?.mastodonInstanceVersion,
      ),
      mastodonMaxCharacters:
        typeof connection.metadata?.mastodonMaxCharacters === "number"
          ? connection.metadata.mastodonMaxCharacters
          : null,
    };
    const profile = await this.fetchProviderProfile(
      "mastodon",
      accessToken,
      providerSession,
    );
    const metadata = this.buildMetadata(
      "mastodon",
      this.stringOrNull(connection.metadata?.clientId) ?? "",
      this.stringArray(connection.metadata?.grantedScopes),
      profile,
      providerSession,
    );
    if (
      metadata.mastodonInstanceOrigin !==
        connection.metadata?.mastodonInstanceOrigin ||
      metadata.mastodonAccountId !== connection.metadata?.mastodonAccountId
    )
      throw new ForbiddenException(
        "Mastodon connected instance or account changed; reconnect is required",
      );
    connection.metadata = { ...(connection.metadata ?? {}), ...metadata };
    connection.lastValidatedAt = new Date();
    await this.connectionRepo.save(connection);
  }

  async validateTwistUser(
    connection: MarketplaceConnectionEntity,
    accessToken: string,
  ) {
    if (connection.appSlug !== "twist") {
      throw new BadRequestException(
        "Twist user validation requires a Twist connection",
      );
    }
    const profile = await this.fetchProviderProfile("twist", accessToken);
    const metadata = this.buildMetadata(
      "twist",
      this.stringOrNull(connection.metadata?.clientId) ?? "",
      this.stringArray(connection.metadata?.grantedScopes),
      profile,
    );
    if (metadata.twistUserId !== connection.metadata?.twistUserId) {
      throw new ForbiddenException("Twist connected user binding changed");
    }
    connection.metadata = { ...(connection.metadata ?? {}), ...metadata };
    return metadata;
  }

  async validateZohoMailAccount(
    connection: MarketplaceConnectionEntity,
    accessToken: string,
  ) {
    if (connection.appSlug !== "zoho-mail") {
      throw new BadRequestException(
        "Zoho Mail account validation requires a Zoho Mail connection",
      );
    }
    const profile = await this.fetchProviderProfile("zoho-mail", accessToken, {
      zohoAccountsOrigin: connection.metadata?.zohoAccountsOrigin,
      zohoMailOrigin: connection.metadata?.zohoMailOrigin,
      zohoRegion: connection.metadata?.zohoRegion,
    });
    const metadata = this.buildMetadata(
      "zoho-mail",
      this.stringOrNull(connection.metadata?.clientId) ?? "",
      this.stringArray(connection.metadata?.grantedScopes),
      profile,
      {
        zohoAccountsOrigin:
          this.stringOrNull(connection.metadata?.zohoAccountsOrigin) ??
          undefined,
        zohoMailOrigin:
          this.stringOrNull(connection.metadata?.zohoMailOrigin) ?? undefined,
        zohoRegion:
          this.stringOrNull(connection.metadata?.zohoRegion) ?? undefined,
      },
    );
    if (metadata.zohoAccountId !== connection.metadata?.zohoAccountId) {
      throw new ForbiddenException(
        "Zoho Mail connected account binding changed",
      );
    }
    connection.metadata = { ...(connection.metadata ?? {}), ...metadata };
    return metadata;
  }

  async validateZohoWorkDriveUser(
    connection: MarketplaceConnectionEntity,
    accessToken: string,
  ) {
    if (connection.appSlug !== "zoho-workdrive") {
      throw new BadRequestException(
        "Zoho WorkDrive user validation requires a Zoho WorkDrive connection",
      );
    }
    const authority = {
      zohoAccountsOrigin:
        this.stringOrNull(connection.metadata?.zohoAccountsOrigin) ?? undefined,
      zohoWorkDriveApiOrigin:
        this.stringOrNull(connection.metadata?.zohoWorkDriveApiOrigin) ??
        undefined,
      zohoWorkDriveDownloadOrigin:
        this.stringOrNull(connection.metadata?.zohoWorkDriveDownloadOrigin) ??
        undefined,
      zohoWorkDriveUploadOrigin:
        this.stringOrNull(connection.metadata?.zohoWorkDriveUploadOrigin) ??
        undefined,
      zohoRegion:
        this.stringOrNull(connection.metadata?.zohoRegion) ?? undefined,
    };
    const profile = await this.fetchProviderProfile(
      "zoho-workdrive",
      accessToken,
      authority,
    );
    const metadata = this.buildMetadata(
      "zoho-workdrive",
      this.stringOrNull(connection.metadata?.clientId) ?? "",
      this.stringArray(connection.metadata?.grantedScopes),
      profile,
      authority,
    );
    if (
      metadata.zohoWorkDriveUserId !== connection.metadata?.zohoWorkDriveUserId
    ) {
      throw new ForbiddenException(
        "Zoho WorkDrive connected user binding changed",
      );
    }
    connection.metadata = { ...(connection.metadata ?? {}), ...metadata };
    return metadata;
  }

  async validateWebexPerson(
    connection: MarketplaceConnectionEntity,
    accessToken: string,
  ) {
    if (connection.appSlug !== "webex") {
      throw new BadRequestException(
        "Webex Person validation requires a Webex connection",
      );
    }
    const profile = await this.fetchProviderProfile("webex", accessToken);
    const metadata = this.buildMetadata(
      "webex",
      this.stringOrNull(connection.metadata?.clientId) ?? "",
      this.stringArray(connection.metadata?.grantedScopes),
      profile,
    );
    if (metadata.webexPersonId !== connection.metadata?.webexPersonId) {
      throw new ForbiddenException("Webex connected Person binding changed");
    }
    connection.metadata = { ...(connection.metadata ?? {}), ...metadata };
    return metadata;
  }

  async validateGoToMeetingIdentity(
    connection: MarketplaceConnectionEntity,
    accessToken: string,
  ) {
    if (connection.appSlug !== "goto-meeting") {
      throw new BadRequestException(
        "GoTo organizer validation requires a GoTo Meeting connection",
      );
    }
    const profile = await this.fetchProviderProfile(
      "goto-meeting",
      accessToken,
    );
    const metadata = this.buildMetadata(
      "goto-meeting",
      this.stringOrNull(connection.metadata?.clientId) ?? "",
      [],
      profile,
    );
    if (metadata.gotoOrganizerKey !== connection.metadata?.gotoOrganizerKey) {
      throw new ForbiddenException("GoTo connected organizer binding changed");
    }
    connection.metadata = { ...(connection.metadata ?? {}), ...metadata };
    return metadata;
  }

  async validateRingCentralExtension(
    connection: MarketplaceConnectionEntity,
    accessToken: string,
  ) {
    if (connection.appSlug !== "ringcentral") {
      throw new BadRequestException(
        "RingCentral extension validation requires a RingCentral connection",
      );
    }
    const profile = await this.fetchProviderProfile("ringcentral", accessToken);
    const metadata = this.buildMetadata(
      "ringcentral",
      this.stringOrNull(connection.metadata?.clientId) ?? "",
      this.stringArray(connection.metadata?.grantedScopes),
      profile,
    );
    if (
      metadata.ringCentralExtensionId !==
      connection.metadata?.ringCentralExtensionId
    ) {
      throw new ForbiddenException(
        "RingCentral connected extension binding changed",
      );
    }
    connection.metadata = { ...(connection.metadata ?? {}), ...metadata };
    return metadata;
  }

  async validateDialpadUser(
    connection: MarketplaceConnectionEntity,
    accessToken: string,
  ) {
    if (connection.appSlug !== "dialpad")
      throw new BadRequestException(
        "Dialpad user validation requires a Dialpad connection",
      );
    const profile = await this.fetchProviderProfile("dialpad", accessToken);
    const metadata = this.buildMetadata(
      "dialpad",
      this.stringOrNull(connection.metadata?.clientId) ?? "",
      this.stringArray(connection.metadata?.grantedScopes),
      profile,
    );
    if (metadata.dialpadUserId !== connection.metadata?.dialpadUserId) {
      throw new ForbiddenException("Dialpad connected user binding changed");
    }
    connection.metadata = { ...(connection.metadata ?? {}), ...metadata };
    return metadata;
  }

  async validateAircallCompany(
    connection: MarketplaceConnectionEntity,
    accessToken: string,
  ) {
    if (connection.appSlug !== "aircall")
      throw new BadRequestException(
        "Aircall company validation requires an Aircall connection",
      );
    const profile = await this.fetchProviderProfile("aircall", accessToken);
    const metadata = this.buildMetadata(
      "aircall",
      this.stringOrNull(connection.metadata?.clientId) ?? "",
      this.stringArray(connection.metadata?.grantedScopes),
      profile,
    );
    if (
      metadata.aircallIntegrationId !==
        connection.metadata?.aircallIntegrationId ||
      metadata.aircallCompanyId !== connection.metadata?.aircallCompanyId
    ) {
      throw new ForbiddenException("Aircall connected company binding changed");
    }
    connection.metadata = { ...(connection.metadata ?? {}), ...metadata };
    return metadata;
  }

  async validateLineProfile(
    connection: MarketplaceConnectionEntity,
    accessToken: string,
  ) {
    if (connection.appSlug !== "line")
      throw new BadRequestException(
        "LINE profile validation requires a LINE connection",
      );
    const boundSubject = this.stringOrNull(connection.metadata?.lineUserId);
    const profile = await this.fetchProviderProfile("line", accessToken, {
      lineSubject: boundSubject,
    });
    const metadata = this.buildMetadata(
      "line",
      this.stringOrNull(connection.metadata?.clientId) ?? "",
      this.stringArray(connection.metadata?.grantedScopes),
      profile,
    );
    if (metadata.lineUserId !== boundSubject)
      throw new ForbiddenException("LINE connected subject binding changed");
    connection.metadata = { ...(connection.metadata ?? {}), ...metadata };
    return metadata;
  }

  async validateSlackWorkspace(
    connection: MarketplaceConnectionEntity,
    accessToken: string,
  ) {
    if (connection.appSlug !== "slack") {
      throw new BadRequestException(
        "Slack workspace validation requires a Slack connection",
      );
    }
    const profile = await this.fetchProviderProfile("slack", accessToken);
    const metadata = this.buildMetadata(
      "slack",
      this.stringOrNull(connection.metadata?.clientId) ?? "",
      this.stringArray(connection.metadata?.grantedScopes),
      profile,
    );
    if (metadata.teamId !== connection.metadata?.teamId) {
      throw new ForbiddenException("Slack connected workspace binding changed");
    }
    connection.metadata = { ...(connection.metadata ?? {}), ...metadata };
    return metadata;
  }

  async disconnect(
    workspaceId: string,
    userId: string,
    appSlug: string,
    connectionId: string,
  ) {
    const localHandler = OAUTH_LOCAL_DISCONNECT_HANDLER_BY_SLUG[appSlug];
    if (localHandler) {
      return localHandler.call(
        this,
        workspaceId,
        userId,
        appSlug,
        connectionId,
      );
    }
    const manifest = this.requireOAuthManifest(appSlug);
    const connection = await this.getConnectionWithSecrets(
      workspaceId,
      manifest.slug,
      connectionId,
    );
    const stored = this.credentials.decrypt(connection) ?? {};
    const revocationHandler =
      OAUTH_PROVIDER_STRATEGY_BY_SLUG[manifest.slug]?.revoke;
    if (revocationHandler) {
      await revocationHandler.call(this, stored, connection);
    }
    const preserved = {
      ...(stored.clientId ? { clientId: stored.clientId } : {}),
      ...(stored.clientSecret &&
      ![
        "box",
        "dropbox",
        "dropbox-paper",
        "pcloud",
        "sharefile",
        "zoho",
        "zoho-desk",
        "close",
        "attio",
        "zendesk",
        "intercom",
        "help-scout",
        "front",
        "zoho-workdrive",
        "inoreader",
        "guru",
        "vimeo",
        "wistia",
        "frame-io",
        "mural",
        "figjam",
        "figma",
        "miro",
        "canva",
        "webflow",
        "wordpress-com",
        "lucidspark",
        "lucidchart",
        "mindmeister",
        "meistertask",
        "jane-app",
        "timely-time-tracking",
        "mastodon",
      ].includes(manifest.slug)
        ? { clientSecret: stored.clientSecret }
        : {}),
    };
    if (Object.keys(preserved).length)
      this.credentials.applyEncrypted(connection, preserved);
    else {
      connection.secretCiphertext = null;
      connection.secretIv = null;
      connection.secretAuthTag = null;
      connection.secretKeyVersion = null;
    }
    connection.status = "needs_credentials";
    connection.lastErrorCode = `${manifest.slug}_oauth_disconnected`;
    connection.lastErrorMessage = `${manifest.name} connection disconnected locally.`;
    connection.metadata = {
      provider: manifest.slug,
      tokenStatus: "disconnected",
      disconnectedAt: new Date().toISOString(),
    };
    connection.updatedByUserId = userId;
    const saved = await this.connectionRepo.save(connection);
    await this.auditLogService.record({
      actorType: "user",
      actorId: userId,
      workspaceId,
      eventType: `marketplace.${manifest.slug}.oauth.disconnected`,
      resourceType: "marketplace_connection",
      resourceId: connection.id,
      metadata: {
        localDisconnectOnly: ![
          "box",
          "miro",
          "canva",
          "webflow",
          "dropbox",
          "ringcentral",
          "dialpad",
          "line",
          "slack",
          "linear",
          "asana",
          "zoho-mail",
          "zoho",
          "zoho-desk",
          "close",
          "zendesk",
          "zoho-workdrive",
          "quip",
          "productboard",
          "sunsama",
          "acuity-scheduling",
          "square-appointments",
          "jane-app",
          "timely-time-tracking",
          "xero",
          "quickbooks",
          "freshbooks",
          "wave",
          "digitalocean",
          "firebase",
          "gmail",
          "google-calendar",
          "google-vault",
          "clio-manage",
          "clio-grow",
          "supabase",
          "mastodon",
        ].includes(manifest.slug),
        providerRevoked: [
          "box",
          "miro",
          "canva",
          "webflow",
          "dropbox",
          "ringcentral",
          "dialpad",
          "line",
          "slack",
          "linear",
          "asana",
          "zoho-mail",
          "zoho",
          "zoho-desk",
          "close",
          "zendesk",
          "zoho-workdrive",
          "quip",
          "productboard",
          "sunsama",
          "acuity-scheduling",
          "square-appointments",
          "jane-app",
          "timely-time-tracking",
          "xero",
          "quickbooks",
          "freshbooks",
          "wave",
          "digitalocean",
          "firebase",
          "gmail",
          "google-calendar",
          "google-vault",
          "clio-manage",
          "clio-grow",
          "supabase",
          "mastodon",
        ].includes(manifest.slug),
      },
    });
    return this.toConnectionView(saved);
  }

  async getConnectionWithSecrets(
    workspaceId: string,
    appSlug: string,
    connectionId: string,
  ) {
    const connection = await this.connectionRepo
      .createQueryBuilder("connection")
      .addSelect([
        "connection.secretCiphertext",
        "connection.secretIv",
        "connection.secretAuthTag",
        "connection.secretKeyVersion",
      ])
      .where("connection.id = :connectionId", { connectionId })
      .andWhere('connection."workspaceId" = :workspaceId', { workspaceId })
      .andWhere('connection."appSlug" = :appSlug', { appSlug })
      .getOne();
    if (!connection)
      throw new BadRequestException(`${appSlug} connection not found`);
    return connection;
  }

  async validateSenderIdentity(
    workspaceId: string,
    appSlug: string,
    connectionId: string,
    input: {
      email: string;
      agentId?: string | null;
      installId?: string | null;
    },
  ) {
    const manifest = this.requireOAuthManifest(appSlug);
    if (manifest.slug === OUTLOOK_CONNECTOR_MANIFEST.slug) {
      throw new BadRequestException(
        "The bounded read-only Outlook connector does not support sender identities.",
      );
    }
    if (manifest.slug !== OUTLOOK_CONNECTOR_MANIFEST.slug) {
      throw new BadRequestException(
        `${manifest.name} does not support sender identities`,
      );
    }
    const email = this.normalizeEmail(input.email);
    if (!email)
      throw new BadRequestException("Sender email address is required");
    const connection = await this.getConnectionWithSecrets(
      workspaceId,
      manifest.slug,
      connectionId,
    );
    const token = await this.refreshIfNeeded(connection);
    const profile = await this.outlookGraph.getMe(token.accessToken);
    const identity = this.validateOutlookSenderIdentity(
      connection,
      profile,
      email,
      input,
    );
    connection.metadata = this.upsertSenderIdentityMetadata(
      connection.metadata ?? {},
      identity,
    );
    await this.connectionRepo.save(connection);
    await this.auditLogService.record({
      actorType: "system",
      workspaceId,
      eventType: "marketplace.outlook.sender_identity.validated",
      resourceType: "marketplace_connection",
      resourceId: connection.id,
      metadata: {
        email: identity.email,
        validationStatus: identity.validationStatus,
        type: identity.type,
        agentId: input.agentId ?? null,
        installId: input.installId ?? null,
      },
    });
    return {
      connection: this.toConnectionView(connection),
      identity,
      adminUrls: this.microsoftAdminUrls(),
    };
  }

  requireOAuthManifest(appSlug: string) {
    const manifest = this.registry.get(appSlug);
    if (!manifest?.auth.oauth)
      throw new BadRequestException(
        `${appSlug} does not define OAuth connector auth`,
      );
    return manifest;
  }

  async exchangeMastodonAuthorizationCode(
    origin: string,
    code: string,
    callbackUrl: string,
    clientId: string,
    clientSecret: string,
    codeVerifier: string,
  ): Promise<OAuthTokenResponse> {
    try {
      return await this.mastodonApi.exchangeAuthorizationCode(
        origin,
        code,
        callbackUrl,
        clientId,
        clientSecret,
        codeVerifier,
      );
    } catch (error) {
      if (error instanceof MastodonApiError)
        throw new BadRequestException(error.message);
      throw error;
    }
  }

  async exchangeToken(
    appSlug: string,
    form: Record<string, string>,
    authority?: { tokenUrl: string },
  ) {
    const manifest = this.requireOAuthManifest(appSlug);
    const requestForm = { ...form };
    if (manifest.slug === "canto") {
      requestForm.app_id = requestForm.client_id;
      requestForm.app_secret = requestForm.client_secret;
      delete requestForm.client_id;
      delete requestForm.client_secret;
    }
    const isRefresh = requestForm.grant_type === "refresh_token";
    if (manifest.slug === "convertkit" && isRefresh)
      delete requestForm.client_secret;
    if (manifest.slug === "campaign-monitor" && isRefresh) {
      delete requestForm.client_id;
      delete requestForm.client_secret;
    }
    if (manifest.slug === "ringcentral") delete requestForm.client_secret;
    const stripeDeveloperSecret =
      manifest.slug === "stripe" ? requestForm.client_secret : undefined;
    if (manifest.slug === "stripe") {
      delete requestForm.client_id;
      delete requestForm.client_secret;
    }
    const basicSecret =
      manifest.slug === "nextdoor" ||
      manifest.slug === "goto-meeting" ||
      manifest.slug === "any-do" ||
      manifest.slug === "remember-the-milk" ||
      manifest.slug === "signnow" ||
      manifest.slug === "vimeo" ||
      manifest.slug === "frame-io" ||
      manifest.slug === "canva" ||
      ["figjam", "figma"].includes(manifest.slug) ||
      manifest.slug === "nifty" ||
      manifest.slug === "bitbucket" ||
      manifest.slug === "notion" ||
      manifest.slug === "airtable" ||
      manifest.slug === "xero" ||
      manifest.slug === "quickbooks" ||
      manifest.slug === "freeagent" ||
      manifest.slug === "pipedrive" ||
      manifest.slug === "zoom" ||
      manifest.slug === "front" ||
      manifest.slug === "ticktick" ||
      manifest.slug === "hootsuite" ||
      manifest.slug === "klaviyo" ||
      manifest.slug === "constant-contact" ||
      manifest.slug === "cloudflare" ||
      manifest.slug === "supabase" ||
      manifest.slug === "greenhouse" ||
      manifest.slug === "pinterest" ||
      manifest.slug === "podbean"
        ? requestForm.client_secret
        : undefined;
    const basicClientId = requestForm.client_id;
    if (basicSecret) delete requestForm.client_secret;
    // Notion authenticates confidential public integrations exclusively with
    // HTTP Basic; its token endpoint does not require the client id in the body.
    if (
      [
        "notion",
        "signnow",
        "airtable",
        "xero",
        "quickbooks",
        "freeagent",
        "pipedrive",
        "front",
        "ticktick",
        "hootsuite",
        "klaviyo",
        "klaviyo-sms",
        "constant-contact",
        "cloudflare",
        "supabase",
        "greenhouse",
        "pinterest",
        "podbean",
      ].includes(manifest.slug)
    )
      delete requestForm.client_id;
    if (["figjam", "figma", "canva"].includes(manifest.slug)) {
      delete requestForm.client_id;
    }
    if (manifest.slug === "nifty") delete requestForm.client_id;
    if (manifest.slug === "heroku") {
      delete requestForm.client_id;
      delete requestForm.redirect_uri;
    }
    if (manifest.slug === "digitalocean" && isRefresh) {
      delete requestForm.client_id;
      delete requestForm.client_secret;
    }
    const tokenUrl =
      isRefresh && manifest.slug === "adobe-acrobat-sign"
        ? `${new URL(authority?.tokenUrl ?? manifest.auth.oauth!.tokenUrl).origin}/oauth/v2/refresh`
        : isRefresh &&
            manifest.auth.oauth!.refreshUrl &&
            manifest.slug !== "shopify"
          ? manifest.auth.oauth!.refreshUrl
          : (authority?.tokenUrl ?? manifest.auth.oauth!.tokenUrl);
    const greenhouseUrl = new URL(tokenUrl);
    if (manifest.slug === "greenhouse") {
      for (const [key, value] of Object.entries(requestForm))
        greenhouseUrl.searchParams.set(key, value);
    }
    const requestUrl =
      manifest.slug === "greenhouse" ? greenhouseUrl.toString() : tokenUrl;
    const response = await safeConnectorFetch(requestUrl, {
      method: "POST",
      headers: {
        "Content-Type": [
          "raindrop-io",
          "vimeo",
          "lucidspark",
          "lucidchart",
          "frontify",
          "confluence",
          "jira",
          "jira-service-management",
          "buffer",
          "atlassian-compass",
          "nifty",
          "square-appointments",
          "timely-time-tracking",
          "rescuetime",
          "monday-com",
          "webflow",
          "freshbooks",
          "zendesk",
          "teamwork",
          "convertkit",
          "aircall",
          "signeasy",
          "audius",
          "lawpay",
        ].includes(manifest.slug)
          ? "application/json"
          : "application/x-www-form-urlencoded",
        ...(manifest.slug === "vimeo"
          ? { Accept: "application/vnd.vimeo.*+json;version=3.4" }
          : {}),
        ...(manifest.slug === "github" ? { Accept: "application/json" } : {}),
        ...(manifest.slug === "convertkit"
          ? { Accept: "application/json" }
          : {}),
        ...(manifest.slug === "square-appointments"
          ? { "Square-Version": "2026-05-20" }
          : {}),
        ...(basicSecret
          ? {
              Authorization: `Basic ${Buffer.from(`${basicClientId}:${basicSecret}`).toString("base64")}`,
            }
          : stripeDeveloperSecret
            ? {
                Authorization: `Basic ${Buffer.from(`${stripeDeveloperSecret}:`).toString("base64")}`,
              }
            : {}),
      },
      body:
        manifest.slug === "greenhouse"
          ? new URLSearchParams()
          : [
                "raindrop-io",
                "vimeo",
                "lucidspark",
                "lucidchart",
                "frontify",
                "confluence",
                "jira",
                "jira-service-management",
                "nifty",
                "square-appointments",
                "timely-time-tracking",
                "rescuetime",
                "monday-com",
                "webflow",
                "freshbooks",
                "zendesk",
                "teamwork",
                "convertkit",
                "aircall",
                "audius",
                "lawpay",
              ].includes(manifest.slug)
            ? JSON.stringify(requestForm)
            : new URLSearchParams(requestForm),
    });
    let parsedToken: unknown;
    if (manifest.slug === "mixcloud") {
      const tokenText = await response.text();
      try {
        parsedToken = JSON.parse(tokenText);
      } catch {
        parsedToken = Object.fromEntries(new URLSearchParams(tokenText));
      }
    } else {
      parsedToken = await response.json().catch(() => ({}));
    }
    const body = parsedToken as OAuthTokenResponse & {
      error_description?: string;
      accessToken?: string;
      refreshToken?: string;
      expiresIn?: number;
    };
    if (manifest.slug === "canto") {
      body.access_token = body.access_token ?? body.accessToken;
      body.refresh_token = body.refresh_token ?? body.refreshToken;
      body.expires_in = body.expires_in ?? body.expiresIn;
    }
    if (manifest.slug === "front") {
      const rawExpiresAt = (body as unknown as Record<string, unknown>)
        .expires_at;
      const parsedExpiresAt =
        typeof rawExpiresAt === "number" && Number.isFinite(rawExpiresAt)
          ? new Date(rawExpiresAt * 1000)
          : typeof rawExpiresAt === "string" &&
              !Number.isNaN(Date.parse(rawExpiresAt))
            ? new Date(rawExpiresAt)
            : null;
      if (parsedExpiresAt) {
        body.expires_at = parsedExpiresAt.toISOString();
        body.expires_in = Math.max(
          1,
          Math.floor((parsedExpiresAt.getTime() - Date.now()) / 1000),
        );
      }
    }
    if (
      !response.ok ||
      body.ok === false ||
      (manifest.slug === "pcloud" && Number(body.result ?? 0) !== 0)
    ) {
      throw new BadRequestException(
        body.error_description ||
          body.error ||
          `${manifest.name} OAuth token request failed`,
      );
    }
    return body;
  }

  async exchangeThreadsLongLivedToken(
    shortLivedToken: string,
    clientSecret: string,
  ): Promise<OAuthTokenResponse> {
    const url = new URL("https://graph.threads.net/access_token");
    url.searchParams.set("grant_type", "th_exchange_token");
    url.searchParams.set("client_secret", clientSecret);
    url.searchParams.set("access_token", shortLivedToken);
    return this.fetchThreadsToken(url, "long-lived exchange");
  }

  async refreshThreadsLongLivedToken(
    accessToken: string,
  ): Promise<OAuthTokenResponse> {
    const url = new URL("https://graph.threads.net/refresh_access_token");
    url.searchParams.set("grant_type", "th_refresh_token");
    url.searchParams.set("access_token", accessToken);
    return this.fetchThreadsToken(url, "long-lived refresh");
  }

  async fetchThreadsToken(
    url: URL,
    stage: string,
  ): Promise<OAuthTokenResponse> {
    const response = await safeConnectorFetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 1_000_000)
      throw new BadRequestException(
        `Threads ${stage} response exceeded Relay bounds`,
      );
    let token: OAuthTokenResponse;
    try {
      token = (raw ? JSON.parse(raw) : {}) as OAuthTokenResponse;
    } catch {
      throw new BadRequestException(`Threads ${stage} returned invalid JSON`);
    }
    if (!response.ok || !this.stringOrNull(token.access_token))
      throw new BadRequestException(`Threads ${stage} failed`);
    return token;
  }

  async fetchProviderProfile(
    appSlug: string,
    accessToken: string,
    providerSession: Record<string, unknown> | null = null,
    tokenResponse: OAuthTokenResponse | null = null,
    grantedScopes: readonly string[] = [],
  ): Promise<Record<string, unknown>> {
    const handler = OAUTH_PROVIDER_STRATEGY_BY_SLUG[appSlug]?.profile;
    return handler
      ? handler.call(
          this,
          appSlug,
          accessToken,
          providerSession,
          tokenResponse,
          grantedScopes,
        )
      : {};
  }

  buildMetadata(
    appSlug: string,
    clientId: string,
    grantedScopes: string[],
    profile: unknown,
    authority?: {
      authorityMode?: string | null;
      authorityTenantId?: string | null;
      zohoAccountsOrigin?: string;
      zohoMailOrigin?: string;
      zohoRegion?: string;
      zohoWorkDriveApiOrigin?: string;
      zohoWorkDriveDownloadOrigin?: string;
      zohoWorkDriveUploadOrigin?: string;
      zohoCrmApiOrigin?: string;
      zohoPeopleApiOrigin?: string;
      zohoCampaignsApiOrigin?: string;
      zohoAnalyticsApiOrigin?: string;
      zohoBooksApiOrigin?: string;
      zohoBooksOrganizationId?: string | null;
      zohoInvoiceApiOrigin?: string;
      zohoInvoiceOrganizationId?: string | null;
      zohoExpenseApiOrigin?: string;
      zohoExpenseOrganizationId?: string | null;
      zohoDeskApiOrigin?: string;
      zohoDeskOrganizationId?: string | null;
      zohoProjectsApiOrigin?: string;
      zohoProjectsPortalId?: string | null;
      egnyteDomain?: string | null;
      nationBuilderNationSlug?: string | null;
      bynderPortalOrigin?: string | null;
      cantoAccountOrigin?: string | null;
      msProjectEnvironmentOrigin?: string | null;
      dynamics365SalesEnvironmentOrigin?: string | null;
      dynamics365CustomerServiceEnvironmentOrigin?: string | null;
      businessCentralEnvironmentName?: string | null;
      frontifyAccountOrigin?: string | null;
      assetBankBaseUrl?: string | null;
      shareFileApiOrigin?: string | null;
      deputyApiOrigin?: string | null;
      pCloudApiOrigin?: string | null;
      pCloudLocationId?: number | null;
      pCloudUserId?: string | null;
      ahaAccountSubdomain?: string | null;
      ahaApiOrigin?: string | null;
      shopDomain?: string | null;
      zendeskInstanceOrigin?: string | null;
      mastodonInstanceOrigin?: string | null;
      mastodonInstanceDomain?: string | null;
      mastodonInstanceVersion?: string | null;
      mastodonMaxCharacters?: number | null;
      customerId?: string | null;
      loginCustomerId?: string | null;
      propertyId?: string | null;
      siteUrl?: string | null;
      accountName?: string | null;
      locationName?: string | null;
    },
  ): Record<string, unknown> {
    const profileObject =
      profile && typeof profile === "object" && !Array.isArray(profile)
        ? (profile as Record<string, unknown>)
        : {};
    const handler = OAUTH_PROVIDER_STRATEGY_BY_SLUG[appSlug]?.metadata;
    return handler
      ? handler.call(
          this,
          appSlug,
          clientId,
          grantedScopes,
          profileObject,
          authority,
        )
      : { provider: appSlug, tokenStatus: "valid", clientId, grantedScopes };
  }

  async verifyLineIdToken(
    idToken: string | undefined,
    clientId: string,
    expectedNonce: string | null,
  ) {
    if (!idToken || !expectedNonce)
      throw new BadRequestException("LINE ID token or nonce is missing");
    const segments = idToken.split(".");
    if (segments.length !== 3)
      throw new BadRequestException("LINE ID token is malformed");
    let header: Record<string, unknown>;
    let claims: Record<string, unknown>;
    try {
      header = JSON.parse(
        Buffer.from(segments[0], "base64url").toString("utf8"),
      ) as Record<string, unknown>;
      claims = JSON.parse(
        Buffer.from(segments[1], "base64url").toString("utf8"),
      ) as Record<string, unknown>;
    } catch {
      throw new BadRequestException("LINE ID token payload is invalid");
    }
    const kid = this.stringOrNull(header.kid);
    if (header.alg !== "RS256" || !kid)
      throw new BadRequestException("LINE ID token algorithm is not allowed");
    const certsResponse = await safeConnectorFetch(
      "https://api.line.me/oauth2/v2.1/certs",
      {
        method: "GET",
        headers: { Accept: "application/json" },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      },
    );
    const certs = (await certsResponse.json().catch(() => ({}))) as {
      keys?: Array<Record<string, unknown>>;
    };
    const jwk = certs.keys?.find(
      (key) => key.kid === kid && key.kty === "RSA" && key.alg === "RS256",
    );
    if (!certsResponse.ok || !jwk)
      throw new BadRequestException("LINE ID token signing key is unavailable");
    let validSignature = false;
    try {
      const publicKey = createPublicKey({ key: jwk as never, format: "jwk" });
      validSignature = verify(
        "RSA-SHA256",
        Buffer.from(`${segments[0]}.${segments[1]}`),
        publicKey,
        Buffer.from(segments[2], "base64url"),
      );
    } catch {
      validSignature = false;
    }
    const subject = this.stringOrNull(claims.sub);
    const expiresAt = typeof claims.exp === "number" ? claims.exp : 0;
    if (
      !validSignature ||
      claims.iss !== "https://access.line.me" ||
      claims.aud !== clientId ||
      claims.nonce !== expectedNonce ||
      !subject ||
      expiresAt * 1000 <= Date.now()
    ) {
      throw new ForbiddenException("LINE ID token verification failed");
    }
    return { sub: subject };
  }

  async verifySliteIdToken(
    idToken: string | undefined,
    clientId: string,
    expectedNonce: string | null,
  ) {
    if (!idToken || !expectedNonce) {
      throw new BadRequestException("Slite ID token or nonce is missing");
    }
    const segments = idToken.split(".");
    if (segments.length !== 3) {
      throw new BadRequestException("Slite ID token is malformed");
    }
    let header: Record<string, unknown>;
    let claims: Record<string, unknown>;
    try {
      header = JSON.parse(
        Buffer.from(segments[0], "base64url").toString("utf8"),
      ) as Record<string, unknown>;
      claims = JSON.parse(
        Buffer.from(segments[1], "base64url").toString("utf8"),
      ) as Record<string, unknown>;
    } catch {
      throw new BadRequestException("Slite ID token payload is invalid");
    }
    const kid = this.stringOrNull(header.kid);
    if (header.alg !== "RS256" || !kid) {
      throw new BadRequestException("Slite ID token algorithm is not allowed");
    }
    const jwksResponse = await safeConnectorFetch(
      "https://slite.com/api/mcp/oauth/jwks",
      {
        method: "GET",
        headers: { Accept: "application/json" },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      },
    );
    const jwks = (await jwksResponse.json().catch(() => ({}))) as {
      keys?: Array<Record<string, unknown>>;
    };
    const jwk = jwks.keys?.find(
      (key) => key.kid === kid && key.kty === "RSA" && key.alg === "RS256",
    );
    if (!jwksResponse.ok || !jwk) {
      throw new BadRequestException(
        "Slite ID token signing key is unavailable",
      );
    }
    let validSignature = false;
    try {
      const publicKey = createPublicKey({ key: jwk as never, format: "jwk" });
      validSignature = verify(
        "RSA-SHA256",
        Buffer.from(`${segments[0]}.${segments[1]}`),
        publicKey,
        Buffer.from(segments[2], "base64url"),
      );
    } catch {
      validSignature = false;
    }
    const subject = this.stringOrNull(claims.sub);
    const email = this.stringOrNull(claims.email);
    const expiresAt = typeof claims.exp === "number" ? claims.exp : 0;
    const audience = Array.isArray(claims.aud)
      ? claims.aud.includes(clientId)
      : claims.aud === clientId;
    if (
      !validSignature ||
      claims.iss !== "https://slite.com" ||
      !audience ||
      claims.nonce !== expectedNonce ||
      !subject ||
      !email ||
      expiresAt * 1000 <= Date.now()
    ) {
      throw new ForbiddenException("Slite ID token verification failed");
    }
    return {
      sub: subject,
      email,
      email_verified: claims.email_verified === true,
      name: this.stringOrNull(claims.name),
    };
  }

  async verifyHubstaffIdToken(
    idToken: string | undefined,
    clientId: string,
    expectedNonce: string | null,
  ) {
    if (!idToken || !expectedNonce) {
      throw new BadRequestException("Hubstaff ID token or nonce is missing");
    }
    const segments = idToken.split(".");
    if (segments.length !== 3)
      throw new BadRequestException("Hubstaff ID token is malformed");
    let header: Record<string, unknown>;
    let claims: Record<string, unknown>;
    try {
      header = JSON.parse(
        Buffer.from(segments[0], "base64url").toString("utf8"),
      ) as Record<string, unknown>;
      claims = JSON.parse(
        Buffer.from(segments[1], "base64url").toString("utf8"),
      ) as Record<string, unknown>;
    } catch {
      throw new BadRequestException("Hubstaff ID token payload is invalid");
    }
    const kid = this.stringOrNull(header.kid);
    if (header.alg !== "RS256" || !kid)
      throw new BadRequestException(
        "Hubstaff ID token algorithm is not allowed",
      );
    const jwksResponse = await safeConnectorFetch(
      "https://account.hubstaff.com/jwks.json",
      {
        method: "GET",
        headers: { Accept: "application/json" },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      },
    );
    const jwks = (await jwksResponse.json().catch(() => ({}))) as {
      keys?: Array<Record<string, unknown>>;
    };
    const jwk = jwks.keys?.find(
      (key) => key.kid === kid && key.kty === "RSA" && key.use === "sig",
    );
    if (!jwksResponse.ok || !jwk)
      throw new BadRequestException(
        "Hubstaff ID token signing key is unavailable",
      );
    let validSignature = false;
    try {
      const publicKey = createPublicKey({ key: jwk as never, format: "jwk" });
      validSignature = verify(
        "RSA-SHA256",
        Buffer.from(`${segments[0]}.${segments[1]}`),
        publicKey,
        Buffer.from(segments[2], "base64url"),
      );
    } catch {
      validSignature = false;
    }
    const subject = this.stringOrNull(claims.sub);
    const expiresAt = typeof claims.exp === "number" ? claims.exp : 0;
    const audience = Array.isArray(claims.aud)
      ? claims.aud.includes(clientId)
      : claims.aud === clientId;
    if (
      !validSignature ||
      claims.iss !== "https://account.hubstaff.com" ||
      !audience ||
      claims.nonce !== expectedNonce ||
      !subject ||
      expiresAt * 1000 <= Date.now()
    ) {
      throw new ForbiddenException("Hubstaff ID token verification failed");
    }
    return { sub: subject };
  }

  async cancelOAuthState(appSlug: string, state: string) {
    const manifest = this.requireOAuthManifest(appSlug);
    const normalizedState = this.stringOrNull(state);
    if (!normalizedState) return false;
    const oauthState = await this.oauthStateRepo.findOne({
      where: {
        stateHash: this.hashState(normalizedState),
        appSlug: manifest.slug,
      },
    });
    if (!oauthState) return false;
    await this.oauthStateRepo.delete({ id: oauthState.id });
    await this.auditLogService.record({
      actorType: "user",
      actorId: oauthState.userId,
      workspaceId: oauthState.workspaceId,
      eventType: `marketplace.${manifest.slug}.oauth.denied`,
      resourceType: "marketplace_app",
      resourceId: manifest.slug,
      metadata: { stateDestroyed: true },
    });
    return true;
  }

  async buildCallbackRedirect(
    appSlug: string,
    input: {
      state?: string;
      status: "connected" | "error";
      connectionId?: string;
      message?: string;
      returnTo?: string | null;
    },
  ) {
    const stateReturnTo = input.state
      ? await this.findStateReturnTo(appSlug, input.state)
      : null;
    const target =
      this.normalizeReturnTo(input.returnTo ?? undefined) ??
      this.normalizeReturnTo(stateReturnTo ?? undefined) ??
      this.getFrontendMarketplaceUrl();
    const url = new URL(target);
    const isIOSCallback = url.protocol === "relayconsole:";
    url.searchParams.set("connector_oauth", appSlug);
    url.searchParams.set("status", input.status);
    if (input.connectionId) {
      url.searchParams.set("connectionId", input.connectionId);
      url.searchParams.set("marketplace_connection_id", input.connectionId);
    }
    if (input.message && !isIOSCallback) {
      url.searchParams.set("message", input.message);
    }
    if (input.status === "error" && isIOSCallback) {
      url.searchParams.set("error", "oauth_failed");
    }
    return url.toString();
  }

  decryptStateClientSecret(state: MarketplaceOAuthStateEntity) {
    if (
      !state.clientSecretCiphertext ||
      !state.clientSecretIv ||
      !state.clientSecretAuthTag ||
      !state.clientSecretKeyVersion
    ) {
      return null;
    }
    const decrypted = this.credentials.decryptEncrypted({
      ciphertext: state.clientSecretCiphertext,
      iv: state.clientSecretIv,
      authTag: state.clientSecretAuthTag,
      keyVersion: state.clientSecretKeyVersion,
    });
    return decrypted ? (JSON.parse(decrypted).clientSecret ?? decrypted) : null;
  }

  decryptStateCodeVerifier(
    providerName: string,
    state: MarketplaceOAuthStateEntity,
  ) {
    if (
      state.codeVerifierCiphertext &&
      state.codeVerifierIv &&
      state.codeVerifierAuthTag &&
      state.codeVerifierKeyVersion
    ) {
      const decrypted = this.credentials.decryptEncrypted({
        ciphertext: state.codeVerifierCiphertext,
        iv: state.codeVerifierIv,
        authTag: state.codeVerifierAuthTag,
        keyVersion: state.codeVerifierKeyVersion,
      });
      const parsed = JSON.parse(decrypted);
      const codeVerifier =
        parsed && typeof parsed === "object" && !Array.isArray(parsed)
          ? (parsed as { codeVerifier?: unknown }).codeVerifier
          : null;
      if (typeof codeVerifier === "string" && codeVerifier) return codeVerifier;
    }
    if (state.legacyCodeVerifier) return state.legacyCodeVerifier;
    throw new BadRequestException(
      `${providerName} OAuth state is missing PKCE verifier`,
    );
  }

  decryptStateProviderSession(state: MarketplaceOAuthStateEntity) {
    if (
      !state.providerSessionCiphertext ||
      !state.providerSessionIv ||
      !state.providerSessionAuthTag ||
      !state.providerSessionKeyVersion
    )
      return null;
    const decrypted = this.credentials.decryptEncrypted({
      ciphertext: state.providerSessionCiphertext,
      iv: state.providerSessionIv,
      authTag: state.providerSessionAuthTag,
      keyVersion: state.providerSessionKeyVersion,
    });
    const value = JSON.parse(decrypted);
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }

  async consumeOAuthState(state: MarketplaceOAuthStateEntity) {
    state.consumedAt = new Date();
    state.legacyCodeVerifier = null;
    state.codeVerifierCiphertext = null;
    state.codeVerifierIv = null;
    state.codeVerifierAuthTag = null;
    state.codeVerifierKeyVersion = null;
    state.providerSessionCiphertext = null;
    state.providerSessionIv = null;
    state.providerSessionAuthTag = null;
    state.providerSessionKeyVersion = null;
    await this.oauthStateRepo.save(state);
    await this.oauthStateRepo.delete({ id: state.id });
  }

  async cleanupOAuthStates(appSlug: string) {
    const now = new Date();
    await this.oauthStateRepo.delete({
      appSlug,
      expiresAt: LessThan(now),
    });
    await this.oauthStateRepo.delete({
      appSlug,
      consumedAt: Not(IsNull()),
    });
  }

  githubInstallationUrl(state: string) {
    const appSlug =
      this.configService.get<string>("GITHUB_APP_SLUG")?.trim().toLowerCase() ??
      "";
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(appSlug)) {
      throw new BadRequestException(
        "GitHub App installation slug is not configured on Railway",
      );
    }
    const url = new URL(`https://github.com/apps/${appSlug}/installations/new`);
    url.searchParams.set("state", state);
    return url.toString();
  }

  getCallbackUrl(appSlug: string) {
    return `${this.getBackendOrigin()}/api/v1/marketplace/oauth/${appSlug}/callback`;
  }

  getBackendOrigin() {
    const explicit =
      this.configService.get<string>("PUBLIC_API_ORIGIN") ||
      this.configService.get<string>("BACKEND_PUBLIC_ORIGIN") ||
      this.configService.get<string>("CLAWCHAT_RAILWAY_ORIGIN");
    if (explicit)
      return explicit
        .trim()
        .replace(/\/+$/, "")
        .replace(/\/api\/v1$/, "");
    const railwayDomain = this.configService.get<string>(
      "RAILWAY_PUBLIC_DOMAIN",
    );
    if (railwayDomain) {
      return railwayDomain.startsWith("http")
        ? railwayDomain.replace(/\/+$/, "")
        : `https://${railwayDomain.replace(/\/+$/, "")}`;
    }
    throw new ServiceUnavailableException(
      "Marketplace OAuth public backend origin is not configured",
    );
  }

  base64UrlSha256(input: string) {
    return createHash("sha256").update(input).digest("base64url");
  }

  jwtExpiry(token: string): string | null {
    const segments = token.split(".");
    if (segments.length !== 3) return null;
    try {
      const claims = JSON.parse(
        Buffer.from(segments[1], "base64url").toString("utf8"),
      ) as Record<string, unknown>;
      if (typeof claims.exp !== "number" || claims.exp * 1000 <= Date.now())
        return null;
      return new Date(claims.exp * 1000).toISOString();
    } catch {
      return null;
    }
  }

  jwtStringClaim(token: string, claim: string): string | null {
    const segments = token.split(".");
    if (segments.length !== 3) return null;
    try {
      const claims = JSON.parse(
        Buffer.from(segments[1], "base64url").toString("utf8"),
      ) as Record<string, unknown>;
      return this.stringOrNull(claims[claim]);
    } catch {
      return null;
    }
  }

  isUuid(value: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    );
  }

  hashState(state: string) {
    return createHash("sha256").update(state).digest("hex");
  }

  resolveBatch23OAuthClientId(appSlug: string): string | null {
    const batch43ConfigKey: Record<string, string> = {
      "clio-manage": "CLIO_MANAGE_CLIENT_ID",
      "clio-grow": "CLIO_GROW_CLIENT_ID",
      practicepanther: "PRACTICEPANTHER_CLIENT_ID",
      smokeball: "SMOKEBALL_CLIENT_ID",
      lawpay: "LAWPAY_CLIENT_ID",
      filevine: "FILEVINE_CLIENT_ID",
    };
    if (batch43ConfigKey[appSlug]) {
      return (
        this.configService.get<string>(batch43ConfigKey[appSlug])?.trim() ??
        null
      );
    }
    if (appSlug === "microsoft-365-ediscovery") {
      return (
        this.configService.get<string>("MICROSOFT_CLIENT_ID")?.trim() ?? null
      );
    }
    if (appSlug === "adobe-analytics") {
      return (
        this.configService
          .get<string>("ADOBE_ANALYTICS_MCP_CLIENT_ID")
          ?.trim() ?? null
      );
    }
    if (["microsoft-entra-id", "yammer", "viva-learning"].includes(appSlug)) {
      return (
        this.configService.get<string>("MICROSOFT_CLIENT_ID")?.trim() ?? null
      );
    }
    if (appSlug.startsWith("microsoft-dynamics-365-")) {
      return (
        this.configService
          .get<string>("MICROSOFT_DYNAMICS_365_CLIENT_ID")
          ?.trim() ??
        this.configService.get<string>("MICROSOFT_CLIENT_ID")?.trim() ??
        null
      );
    }
    return null;
  }

  resolveBatch23OAuthClientSecret(appSlug: string): string | null {
    const batch43ConfigKey: Record<string, string> = {
      "clio-manage": "CLIO_MANAGE_CLIENT_SECRET",
      "clio-grow": "CLIO_GROW_CLIENT_SECRET",
      practicepanther: "PRACTICEPANTHER_CLIENT_SECRET",
      smokeball: "SMOKEBALL_CLIENT_SECRET",
      lawpay: "LAWPAY_CLIENT_SECRET",
      filevine: "FILEVINE_CLIENT_SECRET",
    };
    if (batch43ConfigKey[appSlug]) {
      return (
        this.configService.get<string>(batch43ConfigKey[appSlug])?.trim() ??
        null
      );
    }
    if (appSlug === "microsoft-365-ediscovery") {
      return (
        this.configService.get<string>("MICROSOFT_CLIENT_SECRET")?.trim() ??
        null
      );
    }
    if (["microsoft-entra-id", "yammer", "viva-learning"].includes(appSlug)) {
      return (
        this.configService.get<string>("MICROSOFT_CLIENT_SECRET")?.trim() ??
        null
      );
    }
    if (appSlug.startsWith("microsoft-dynamics-365-")) {
      return (
        this.configService
          .get<string>("MICROSOFT_DYNAMICS_365_CLIENT_SECRET")
          ?.trim() ??
        this.configService.get<string>("MICROSOFT_CLIENT_SECRET")?.trim() ??
        null
      );
    }
    return null;
  }

  normalizeOptionalScopes(input: string[], allowed: string[]) {
    const allowedSet = new Set(allowed);
    return Array.from(new Set(input.filter((scope) => allowedSet.has(scope))));
  }

  normalizeScopeString(value?: string | string[]) {
    if (!value) return null;
    return (Array.isArray(value) ? value : value.split(/[ ,+]+/))
      .map((scope) => scope.trim())
      .filter(Boolean);
  }

  resolveGrantedScopes(
    appSlug: string,
    tokenScope: string | string[] | undefined,
    requestedScopes: string[],
    refreshToken?: string,
  ) {
    const returnedScopes = this.normalizeScopeString(tokenScope);
    if (appSlug === "stripe" && returnedScopes?.includes("stripe_apps")) {
      return requestedScopes;
    }
    if (appSlug === "jotform") {
      return requestedScopes;
    }
    const scopes = returnedScopes?.length
      ? returnedScopes
      : requestedScopes.filter((scope) => scope !== "offline_access");
    if (
      appSlug === "microsoft-viva-engage" &&
      !returnedScopes?.length &&
      requestedScopes.includes("https://www.yammer.com/.default")
    ) {
      return refreshToken
        ? ["access_as_user", "offline_access"]
        : ["access_as_user"];
    }
    if (
      [
        OUTLOOK_CONNECTOR_MANIFEST.slug,
        MICROSOFT_TEAMS_CONNECTOR_MANIFEST.slug,
        "microsoft-365-ediscovery",
        "slite",
        "confluence",
        "microsoft-dynamics-365-sales",
        "microsoft-dynamics-365-customer-service",
        "microsoft-dynamics-365-business-central",
        "microsoft-entra-id",
        "yammer",
        "viva-learning",
        "ms-project",
        "onedrive",
        "sharepoint",
        "microsoft-planner",
        "microsoft-to-do",
        "microsoft-lists",
        "microsoft-viva-engage",
        "jira",
        "jira-service-management",
        "atlassian-compass",
      ].includes(appSlug) &&
      requestedScopes.includes("offline_access") &&
      refreshToken &&
      !scopes.includes("offline_access")
    ) {
      return [...scopes, "offline_access"];
    }
    if (
      appSlug === "bynder" &&
      requestedScopes.includes("offline") &&
      refreshToken &&
      !scopes.includes("offline")
    ) {
      return [...scopes, "offline"];
    }
    return scopes;
  }

  assertRequiredScopes(
    appSlug: string,
    scopes: string[],
    input: { requestedScopes?: string[]; refreshToken?: string } = {},
  ) {
    const manifest = this.requireOAuthManifest(appSlug);
    const granted = new Set(scopes);
    const requested = new Set(input.requestedScopes ?? []);
    const requiredScopes = manifest.auth.oauth?.accessOptions?.length
      ? (input.requestedScopes ?? [])
      : manifest.auth.oauth!.requiredScopes;
    const missing = requiredScopes.filter((scope) => {
      if (
        [
          OUTLOOK_CONNECTOR_MANIFEST.slug,
          MICROSOFT_TEAMS_CONNECTOR_MANIFEST.slug,
          "microsoft-365-ediscovery",
        ].includes(appSlug) &&
        (scope === "openid" || scope === "profile")
      ) {
        return !requested.has(scope);
      }
      if (
        [
          OUTLOOK_CONNECTOR_MANIFEST.slug,
          "slite",
          "microsoft-365-ediscovery",
          "confluence",
          "ms-project",
          "onedrive",
          "sharepoint",
          "microsoft-planner",
          "microsoft-to-do",
          "microsoft-lists",
          "microsoft-dynamics-365",
          "microsoft-dynamics-365-sales",
          "microsoft-dynamics-365-customer-service",
          "microsoft-dynamics-365-business-central",
          "microsoft-entra-id",
          "yammer",
          "viva-learning",
          "microsoft-viva-engage",
          "jira",
          "jira-service-management",
          "atlassian-compass",
        ].includes(appSlug) &&
        scope === "offline_access"
      ) {
        return !(requested.has(scope) && input.refreshToken);
      }
      if (
        appSlug === OUTLOOK_CONNECTOR_MANIFEST.slug &&
        scope === "https://graph.microsoft.com/Mail.Read"
      ) {
        return !(
          granted.has(scope) ||
          granted.has("Mail.Read") ||
          granted.has("https://graph.microsoft.com/.default")
        );
      }
      if (
        appSlug === MICROSOFT_TEAMS_CONNECTOR_MANIFEST.slug &&
        [
          "https://graph.microsoft.com/Team.ReadBasic.All",
          "https://graph.microsoft.com/Channel.ReadBasic.All",
        ].includes(scope)
      ) {
        const shortScope = scope.replace("https://graph.microsoft.com/", "");
        return !(granted.has(scope) || granted.has(shortScope));
      }
      if (
        appSlug === "microsoft-365-ediscovery" &&
        scope === "https://graph.microsoft.com/eDiscovery.Read.All"
      ) {
        return !(
          granted.has(scope) ||
          granted.has("eDiscovery.Read.All") ||
          granted.has("https://graph.microsoft.com/.default")
        );
      }
      if (
        [
          "ms-project",
          "microsoft-dynamics-365",
          "microsoft-dynamics-365-sales",
          "microsoft-dynamics-365-customer-service",
        ].includes(appSlug) &&
        scope === "user_impersonation"
      ) {
        return !(
          scopes.some(
            (grantedScope) =>
              grantedScope === "user_impersonation" ||
              grantedScope.endsWith("/user_impersonation"),
          ) ||
          (input.requestedScopes ?? []).some((requestedScope) =>
            requestedScope.endsWith("/user_impersonation"),
          )
        );
      }
      if (appSlug === "yammer" && scope === "https://www.yammer.com/.default") {
        return !scopes.some(
          (grantedScope) =>
            grantedScope === scope ||
            grantedScope === "access_as_user" ||
            grantedScope.endsWith("/access_as_user"),
        );
      }
      if (
        appSlug === "microsoft-dynamics-365-business-central" &&
        scope ===
          "https://api.businesscentral.dynamics.com/Financials.ReadWrite.All"
      ) {
        return !scopes.some(
          (grantedScope) =>
            grantedScope === "Financials.ReadWrite.All" ||
            grantedScope === scope ||
            grantedScope.endsWith("/Financials.ReadWrite.All"),
        );
      }
      if (appSlug === "microsoft-viva-engage" && scope === "access_as_user") {
        return !(
          scopes.some(
            (grantedScope) =>
              grantedScope === "access_as_user" ||
              grantedScope.endsWith("/access_as_user"),
          ) || requested.has("https://www.yammer.com/.default")
        );
      }
      if (appSlug === "bynder" && scope === "offline") {
        return !(requested.has(scope) && input.refreshToken);
      }
      return !granted.has(scope);
    });
    if (missing.length) {
      throw new ForbiddenException(
        `${manifest.name} did not grant required scopes: ${missing.join(", ")}`,
      );
    }
  }

  normalizeReturnTo(value?: string) {
    return normalizeOAuthReturnTo(value, this.configService);
  }

  appendOAuthResult(returnTo: string | null, connectionId: string) {
    const normalizedReturnTo = this.normalizeReturnTo(returnTo ?? undefined);
    if (!normalizedReturnTo) return null;
    const url = new URL(normalizedReturnTo);
    if (url.protocol === "relayconsole:") {
      // buildCallbackRedirect validates the pristine native target before it
      // appends the verified connection result and callback status.
      return url.toString();
    }
    url.searchParams.set("marketplace_connection_id", connectionId);
    return url.toString();
  }

  async findStateReturnTo(appSlug: string, state: string) {
    const oauthState = await this.oauthStateRepo.findOne({
      where: { stateHash: this.hashState(state), appSlug },
    });
    return oauthState?.returnTo ?? null;
  }

  getFrontendMarketplaceUrl() {
    return getOAuthFrontendUrl("/app", this.configService);
  }

  toConnectionView(connection: MarketplaceConnectionEntity) {
    return {
      id: connection.id,
      workspaceId: connection.workspaceId,
      appSlug: connection.appSlug,
      displayName: connection.displayName,
      environment: connection.environment,
      authType: connection.authType,
      credentialNames: connection.credentialNames,
      selectedCapabilities: connection.selectedCapabilities,
      status: connection.status,
      lastValidatedAt: connection.lastValidatedAt?.toISOString() ?? null,
      lastErrorCode: connection.lastErrorCode,
      lastErrorMessage: connection.lastErrorMessage,
      metadata: connection.metadata,
      createdByUserId: connection.createdByUserId,
      updatedByUserId: connection.updatedByUserId,
      createdAt: connection.createdAt.toISOString(),
      updatedAt: connection.updatedAt.toISOString(),
    };
  }

  stringOrNull(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }

  positiveNumericId(value: unknown) {
    const id =
      typeof value === "number" && Number.isSafeInteger(value)
        ? String(value)
        : this.stringOrNull(value);
    return id && /^[1-9][0-9]{0,19}$/.test(id) ? id : null;
  }

  pipedriveApiOrigin(value: string | null) {
    try {
      if (!value) throw new Error();
      const url = new URL(value);
      const host = url.hostname.toLowerCase();
      if (
        url.protocol !== "https:" ||
        !host.endsWith(".pipedrive.com") ||
        host === "pipedrive.com" ||
        url.username ||
        url.password ||
        url.port ||
        (url.pathname !== "/" && url.pathname !== "") ||
        url.search ||
        url.hash
      )
        throw new Error();
      return url.origin;
    } catch {
      throw new BadRequestException("Pipedrive API domain binding is invalid");
    }
  }

  stringArray(value: unknown) {
    return Array.isArray(value)
      ? value.filter((entry): entry is string => typeof entry === "string")
      : [];
  }

  normalizeEgnyteDomain(value: string) {
    const normalized = value
      .trim()
      .toLowerCase()
      .replace(/^https:\/\//, "")
      .replace(/\.egnyte\.com\/?$/, "")
      .replace(/\/$/, "");
    if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(normalized)) {
      throw new BadRequestException(
        "Enter a valid Egnyte domain, such as acme or acme.egnyte.com",
      );
    }
    return normalized;
  }

  normalizeNationBuilderNationSlug(value: string) {
    const normalized = value
      .trim()
      .toLowerCase()
      .replace(/^https:\/\//, "")
      .replace(/\.nationbuilder\.com\/?$/, "")
      .replace(/\/$/, "");
    if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(normalized)) {
      throw new BadRequestException(
        "Enter a valid NationBuilder nation slug, such as acme or acme.nationbuilder.com",
      );
    }
    return normalized;
  }

  normalizeShopifyDomain(value: string) {
    const normalized = value
      .trim()
      .toLowerCase()
      .replace(/^https:\/\//, "")
      .replace(/\/$/, "");
    if (
      value.trim() !== normalized ||
      !/^[a-z0-9][a-z0-9-]{0,61}\.myshopify\.com$/.test(normalized)
    ) {
      throw new BadRequestException(
        "Enter the exact myshopify.com shop domain, such as acme.myshopify.com",
      );
    }
    return normalized;
  }

  normalizeZendeskInstance(value: string) {
    const raw = value.trim().toLowerCase();
    const candidate = /^https:\/\//.test(raw) ? raw : `https://${raw}`;
    let url: URL;
    try {
      url = new URL(candidate);
    } catch {
      throw new BadRequestException(
        "Enter the Zendesk account name from your support address, such as acme",
      );
    }
    const label = url.hostname.endsWith(".zendesk.com")
      ? url.hostname.slice(0, -".zendesk.com".length)
      : url.hostname;
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      (url.pathname !== "/" && url.pathname !== "") ||
      url.search ||
      url.hash ||
      !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)
    )
      throw new BadRequestException(
        "Enter the Zendesk account name from your support address, such as acme",
      );
    return `https://${label}.zendesk.com`;
  }

  normalizeTeamworkApiOrigin(value: string) {
    let url: URL;
    try {
      url = new URL(value.trim());
    } catch {
      throw new BadRequestException(
        "Teamwork did not return a valid installation API address",
      );
    }
    if (
      url.protocol !== "https:" ||
      !/^[a-z0-9-]+\.teamwork\.com$/i.test(url.hostname) ||
      url.username ||
      url.password ||
      url.port ||
      !["", "/"].includes(url.pathname) ||
      url.search ||
      url.hash
    )
      throw new BadRequestException(
        "Teamwork did not return a valid installation API address",
      );
    return url.origin;
  }

  normalizeBasecampAccountOrigin(value: string) {
    let url: URL;
    try {
      url = new URL(value.trim());
    } catch {
      throw new BadRequestException(
        "Basecamp did not return a valid account API address",
      );
    }
    const accountId = url.pathname.replace(/^\/+|\/+$/g, "");
    if (
      url.protocol !== "https:" ||
      url.hostname !== "3.basecampapi.com" ||
      url.username ||
      url.password ||
      url.port ||
      url.search ||
      url.hash ||
      !/^[1-9][0-9]{0,18}$/.test(accountId)
    )
      throw new BadRequestException(
        "Basecamp did not return a valid account API address",
      );
    return `${url.origin}/${accountId}`;
  }

  normalizeWrikeHost(value: string) {
    const candidate = value.trim().toLowerCase();
    let url: URL;
    try {
      url = new URL(
        candidate.includes("://") ? candidate : `https://${candidate}`,
      );
    } catch {
      throw new BadRequestException(
        "Wrike did not return a valid regional host",
      );
    }
    if (
      url.protocol !== "https:" ||
      !(url.hostname === "wrike.com" || url.hostname.endsWith(".wrike.com")) ||
      url.username ||
      url.password ||
      url.port ||
      !["", "/"].includes(url.pathname) ||
      url.search ||
      url.hash
    )
      throw new BadRequestException(
        "Wrike did not return a valid regional host",
      );
    return url.hostname;
  }

  wrikeOpaqueId(value: unknown, kind: string) {
    const id = this.stringOrNull(value);
    if (!id || !/^[A-Za-z0-9_-]{1,200}$/.test(id))
      throw new BadRequestException(`Wrike ${kind} binding is invalid`);
    return id;
  }

  smartsheetNumericId(value: unknown, kind: string) {
    const id =
      typeof value === "number" && Number.isFinite(value)
        ? String(Math.trunc(value))
        : this.stringOrNull(value);
    if (!id || !/^[1-9][0-9]{0,24}$/.test(id))
      throw new BadRequestException(`Smartsheet ${kind} binding is invalid`);
    return id;
  }

  todoistOpaqueId(value: unknown) {
    const id =
      typeof value === "number" && Number.isSafeInteger(value)
        ? String(value)
        : this.stringOrNull(value);
    if (!id || !/^[A-Za-z0-9_-]{1,64}$/.test(id))
      throw new BadRequestException("Todoist user binding is invalid");
    return id;
  }

  intercomApiOrigin(regionValue: string) {
    const region = regionValue.trim().toUpperCase();
    if (region === "EU") return "https://api.eu.intercom.io";
    if (region === "AU") return "https://api.au.intercom.io";
    if (region === "US") return "https://api.intercom.io";
    throw new BadRequestException("Intercom workspace region is invalid");
  }

  zendeskAuthority(instanceValue: string) {
    const instanceOrigin = this.normalizeZendeskInstance(instanceValue);
    return {
      mode: new URL(instanceOrigin).hostname.replace(/\.zendesk\.com$/, ""),
      tenantId: null,
      authorizationUrl: `${instanceOrigin}/oauth/authorizations/new`,
      tokenUrl: `${instanceOrigin}/oauth/tokens`,
    };
  }

  shopifyAuthority(shopValue: string) {
    const shopDomain = this.normalizeShopifyDomain(shopValue);
    return {
      mode: shopDomain,
      tenantId: null,
      authorizationUrl: `https://${shopDomain}/admin/oauth/authorize`,
      tokenUrl: `https://${shopDomain}/admin/oauth/access_token`,
    };
  }

  egnyteAuthority(domainValue: string) {
    const domain = this.normalizeEgnyteDomain(domainValue);
    const tokenUrl = `https://${domain}.egnyte.com/puboauth/token`;
    return {
      mode: domain,
      tenantId: null,
      authorizationUrl: tokenUrl,
      tokenUrl,
    };
  }

  nationBuilderAuthority(nationSlugValue: string) {
    const nationSlug = this.normalizeNationBuilderNationSlug(nationSlugValue);
    const origin = `https://${nationSlug}.nationbuilder.com`;
    return {
      mode: nationSlug,
      tenantId: null,
      authorizationUrl: `${origin}/oauth/authorize`,
      tokenUrl: `${origin}/oauth/token`,
    };
  }

  normalizeBynderPortal(value: string) {
    let url: URL;
    try {
      url = new URL(
        /^https:\/\//i.test(value.trim())
          ? value.trim()
          : `https://${value.trim()}`,
      );
    } catch {
      throw new BadRequestException(
        "Enter a valid Bynder portal hostname, such as acme.bynder.com",
      );
    }
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      (url.pathname !== "/" && url.pathname !== "") ||
      url.search ||
      url.hash ||
      !/^[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?$/i.test(url.hostname)
    ) {
      throw new BadRequestException(
        "Enter a valid Bynder portal hostname, such as acme.bynder.com",
      );
    }
    return url.origin;
  }

  bynderAuthority(portalValue: string) {
    const portalOrigin = this.normalizeBynderPortal(portalValue);
    return {
      mode: portalOrigin,
      tenantId: null,
      authorizationUrl: `${portalOrigin}/v6/authentication/oauth2/auth`,
      tokenUrl: `${portalOrigin}/v6/authentication/oauth2/token`,
    };
  }

  normalizeCantoAccount(value: string) {
    let url: URL;
    try {
      url = new URL(
        /^https:\/\//i.test(value.trim())
          ? value.trim()
          : `https://${value.trim()}`,
      );
    } catch {
      throw new BadRequestException(
        "Enter a valid Canto account hostname, such as acme.canto.com",
      );
    }
    const host = url.hostname.toLowerCase();
    const supported =
      /^[a-z0-9][a-z0-9-]{0,62}(?:\.[a-z0-9-]{1,63})*\.(?:canto\.com|canto\.global|canto\.de)$/.test(
        host,
      ) ||
      /^[a-z0-9][a-z0-9-]{0,62}(?:\.[a-z0-9-]{1,63})*\.ca\.canto\.com$/.test(
        host,
      );
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      (url.pathname !== "/" && url.pathname !== "") ||
      url.search ||
      url.hash ||
      !supported
    ) {
      throw new BadRequestException(
        "Enter a valid Canto account hostname, such as acme.canto.com",
      );
    }
    return url.origin;
  }

  cantoAuthority(accountValue: string) {
    const accountOrigin = this.normalizeCantoAccount(accountValue);
    const host = new URL(accountOrigin).hostname.toLowerCase();
    const oauthOrigin = host.endsWith(".ca.canto.com")
      ? "https://oauth.ca.canto.com"
      : host.endsWith(".canto.global")
        ? "https://oauth.canto.global"
        : host.endsWith(".canto.de")
          ? "https://oauth.canto.de"
          : "https://oauth.canto.com";
    return {
      mode: accountOrigin,
      tenantId: null,
      authorizationUrl: `${oauthOrigin}/oauth/api/oauth2/authorize`,
      tokenUrl: `${oauthOrigin}/oauth/api/oauth2/compatible/token`,
    };
  }

  normalizeMsProjectEnvironment(value: string) {
    let url: URL;
    try {
      url = new URL(value.trim());
    } catch {
      throw new BadRequestException(
        "Enter the Dataverse environment URL containing your Microsoft Project schedules",
      );
    }
    const host = url.hostname.toLowerCase();
    const supported = [
      /^[a-z0-9][a-z0-9-]{0,62}\.crm\d*\.dynamics\.com$/,
      /^[a-z0-9][a-z0-9-]{0,62}\.crm\.dynamics\.cn$/,
      /^[a-z0-9][a-z0-9-]{0,62}\.crm\.microsoftdynamics\.us$/,
      /^[a-z0-9][a-z0-9-]{0,62}\.crm\.appsplatform\.us$/,
    ].some((pattern) => pattern.test(host));
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      (url.pathname !== "/" && url.pathname !== "") ||
      url.search ||
      url.hash ||
      !supported
    ) {
      throw new BadRequestException(
        "Microsoft Project requires a supported HTTPS Dataverse environment URL without a path",
      );
    }
    return url.origin;
  }

  normalizeSharePointSite(value: string) {
    let url: URL;
    try {
      url = new URL(value.trim());
    } catch {
      throw new BadRequestException(
        "Enter the exact administrator-granted SharePoint /sites/ or /teams/ URL",
      );
    }
    const hostname = url.hostname.toLowerCase();
    const relativePath = url.pathname.replace(/\/+$/, "");
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      url.search ||
      url.hash ||
      !/^[a-z0-9][a-z0-9-]{0,62}\.sharepoint\.com$/.test(hostname) ||
      !/^\/(?:sites|teams)\/[A-Za-z0-9._~-]{1,128}(?:\/[A-Za-z0-9._~-]{1,128}){0,8}$/.test(
        relativePath,
      )
    )
      throw new BadRequestException(
        "SharePoint requires an exact HTTPS tenant.sharepoint.com/sites/... or /teams/... URL without query or fragment",
      );
    return {
      webUrl: `https://${hostname}${relativePath}`,
      hostname,
      relativePath,
    };
  }

  normalizeMicrosoftPowerBIBinding(input: {
    workspaceId?: unknown;
    workspaceName?: unknown;
  }) {
    const workspaceId = this.stringOrNull(input.workspaceId)?.trim() ?? "";
    const workspaceName = this.stringOrNull(input.workspaceName)?.trim() ?? "";
    if (
      !/^[A-Za-z0-9_-]{1,128}$/.test(workspaceId) ||
      !workspaceName ||
      workspaceName.length > 512
    )
      throw new BadRequestException(
        "Microsoft Power BI requires one safe selected workspace ID and name",
      );
    return { workspaceId, workspaceName };
  }

  normalizeMicrosoftDynamics365Binding(input: {
    environmentOrigin?: unknown;
    environmentDisplayName?: unknown;
  }) {
    const rawOrigin = this.stringOrNull(input.environmentOrigin)?.trim() ?? "";
    const environmentDisplayName =
      this.stringOrNull(input.environmentDisplayName)?.trim() ?? "";
    let url: URL;
    try {
      url = new URL(rawOrigin);
    } catch {
      throw new BadRequestException(
        "Microsoft Dynamics 365 requires one trusted Dataverse environment origin and display name",
      );
    }
    const hostname = url.hostname.toLowerCase();
    if (
      url.protocol !== "https:" ||
      !/^(?:[a-z0-9-]{1,63}\.)+(?:api\.crm\.dynamics\.com|api\.crm\.dynamics\.cn|api\.crm\.microsoftdynamics\.us|api\.crm9\.dynamics\.com)$/.test(
        hostname,
      ) ||
      url.port ||
      (url.pathname !== "/" && url.pathname !== "") ||
      url.search ||
      url.hash ||
      url.username ||
      url.password ||
      !environmentDisplayName ||
      environmentDisplayName.length > 512
    )
      throw new BadRequestException(
        "Microsoft Dynamics 365 requires one trusted Dataverse environment origin and display name",
      );
    return {
      environmentOrigin: `https://${hostname}`,
      environmentDisplayName,
    };
  }

  normalizeMicrosoftVivaEngageBinding(input: {
    communityId?: unknown;
    communityName?: unknown;
  }) {
    const communityId = this.stringOrNull(input.communityId)?.trim() ?? "";
    const communityName = this.stringOrNull(input.communityName)?.trim() ?? "";
    if (
      !/^\d{1,32}$/.test(communityId) ||
      !communityName ||
      communityName.length > 512
    )
      throw new BadRequestException(
        "Microsoft Viva Engage requires one numeric selected community ID and name",
      );
    return { communityId, communityName };
  }

  normalizeMicrosoftBookingsBinding(input: {
    businessId?: unknown;
    displayName?: unknown;
  }) {
    const businessId = this.stringOrNull(input.businessId)?.trim() ?? "";
    const displayName = this.stringOrNull(input.displayName)?.trim() ?? "";
    if (
      !/^[A-Za-z0-9._@!~=-]{1,512}$/.test(businessId) ||
      !displayName ||
      displayName.length > 512
    )
      throw new BadRequestException(
        "Microsoft Bookings requires one safe selected business ID and display name",
      );
    return { businessId, displayName };
  }

  normalizeMicrosoftListsBinding(input: {
    siteId?: unknown;
    listId?: unknown;
    listWebUrl?: unknown;
    listDisplayName?: unknown;
    allowedFieldNames?: unknown;
  }) {
    const siteId = this.stringOrNull(input.siteId) ?? "";
    const listId = this.stringOrNull(input.listId) ?? "";
    const listWebUrl = this.normalizeMicrosoftListWebUrl(
      this.stringOrNull(input.listWebUrl) ?? "",
    );
    const listDisplayName =
      this.stringOrNull(input.listDisplayName)?.trim().slice(0, 512) ?? "";
    const allowedFieldNames = Array.isArray(input.allowedFieldNames)
      ? input.allowedFieldNames.filter(
          (value): value is string => typeof value === "string",
        )
      : [];
    if (
      !/^[A-Za-z0-9.,_-]{1,512}$/.test(siteId) ||
      !/^[A-Za-z0-9._!~=-]{1,512}$/.test(listId) ||
      allowedFieldNames.length < 1 ||
      allowedFieldNames.length > 20 ||
      new Set(allowedFieldNames).size !== allowedFieldNames.length ||
      !allowedFieldNames.every((field) => /^[A-Za-z0-9_]{1,64}$/.test(field))
    )
      throw new BadRequestException(
        "Microsoft Lists requires one safe selected site/list and one to twenty explicit safe field names",
      );
    return {
      siteId,
      listId,
      listWebUrl,
      listDisplayName,
      allowedFieldNames: allowedFieldNames.slice().sort(),
    };
  }

  normalizeMicrosoftListWebUrl(value: string) {
    let url: URL;
    try {
      url = new URL(value.trim());
    } catch {
      throw new BadRequestException(
        "Enter the exact administrator-granted Microsoft List URL",
      );
    }
    const hostname = url.hostname.toLowerCase();
    const relativePath = url.pathname.replace(/\/+$/, "");
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      url.search ||
      url.hash ||
      !/^[a-z0-9][a-z0-9-]{0,62}\.sharepoint\.com$/.test(hostname) ||
      !/^\/(?:sites|teams)\/[A-Za-z0-9._~-]{1,128}(?:\/[A-Za-z0-9._~-]{1,128}){0,8}\/Lists\/[A-Za-z0-9%._~()-]{1,256}$/i.test(
        relativePath,
      )
    )
      throw new BadRequestException(
        "Microsoft Lists requires an exact HTTPS tenant.sharepoint.com/sites/.../Lists/... or /teams/.../Lists/... URL without query or fragment",
      );
    return `https://${hostname}${relativePath}`;
  }

  normalizeJaneClinicOrigin(value: string) {
    let url: URL;
    try {
      url = new URL(value.trim());
    } catch {
      throw new BadRequestException("Enter the clinic's Jane URL");
    }
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      (url.pathname !== "/" && url.pathname !== "") ||
      url.search ||
      url.hash ||
      !/^[a-z0-9][a-z0-9-]{0,62}\.janeapp\.com$/i.test(url.hostname)
    ) {
      throw new BadRequestException(
        "Jane App requires the clinic's exact HTTPS janeapp.com URL",
      );
    }
    return url.origin;
  }

  normalizeFrontifyAccount(value: string) {
    let url: URL;
    try {
      url = new URL(
        /^https:\/\//i.test(value.trim())
          ? value.trim()
          : `https://${value.trim()}`,
      );
    } catch {
      throw new BadRequestException(
        "Enter a valid Frontify hostname, such as brand.frontify.com",
      );
    }
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      (url.pathname !== "/" && url.pathname !== "") ||
      url.search ||
      url.hash ||
      !/^[a-z0-9](?:[a-z0-9-]{0,62})\.frontify\.com$/i.test(url.hostname)
    ) {
      throw new BadRequestException(
        "Enter a valid Frontify hostname, such as brand.frontify.com",
      );
    }
    return url.origin;
  }

  frontifyAuthority(accountValue: string) {
    const accountOrigin = this.normalizeFrontifyAccount(accountValue);
    return {
      mode: accountOrigin,
      tenantId: null,
      authorizationUrl: `${accountOrigin}/api/oauth/authorize`,
      tokenUrl: `${accountOrigin}/api/oauth/accesstoken`,
    };
  }

  normalizeAssetBankSite(value: string) {
    let url: URL;
    try {
      url = new URL(value.trim());
    } catch {
      throw new BadRequestException(
        "Enter the complete Asset Bank site URL, including its context path",
      );
    }
    const host = url.hostname.toLowerCase();
    const supported =
      /^[a-z0-9](?:[a-z0-9-]{0,62}\.)*assetbank\.app$/.test(host) ||
      /^[a-z0-9](?:[a-z0-9-]{0,62}\.)*assetbank-server\.com$/.test(host);
    const segments = url.pathname.split("/").filter(Boolean);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      url.search ||
      url.hash ||
      !supported ||
      segments.length !== 1
    ) {
      throw new BadRequestException(
        "Enter a supported Asset Bank site URL with one context path",
      );
    }
    return `${url.origin}/${segments[0]}`;
  }

  normalizeSageAccountingSubscriptionKey(value: string) {
    const key = value.trim();
    if (!/^[A-Za-z0-9_-]{8,512}$/.test(key)) {
      throw new BadRequestException(
        "Enter a valid Sage Accounting API subscription key",
      );
    }
    return key;
  }

  normalizeMyobCompanyFileToken(value: string) {
    const token = value.trim();
    if (
      token.length < 4 ||
      token.length > 8192 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(token)
    )
      throw new BadRequestException(
        "Enter a valid Base64 MYOB company-file credential token",
      );
    const decoded = Buffer.from(token, "base64").toString("utf8");
    if (!decoded.includes(":") || /[\r\n\0]/.test(decoded))
      throw new BadRequestException(
        "Enter a valid Base64 MYOB company-file credential token",
      );
    return token;
  }

  assetBankAuthority(siteValue: string) {
    const baseUrl = this.normalizeAssetBankSite(siteValue);
    return {
      mode: baseUrl,
      tenantId: null,
      authorizationUrl: `${baseUrl}/oauth/authorize`,
      tokenUrl: `${baseUrl}/oauth/token`,
    };
  }

  salesforceAuthority() {
    const environment = this.configService
      .get<string>("SALESFORCE_ENVIRONMENT")
      ?.trim()
      .toLowerCase();
    if (environment !== "production" && environment !== "sandbox")
      throw new BadRequestException(
        "SALESFORCE_ENVIRONMENT must be production or sandbox",
      );
    const origin =
      environment === "sandbox"
        ? "https://test.salesforce.com"
        : "https://login.salesforce.com";
    return {
      mode: environment,
      tenantId: null,
      authorizationUrl: `${origin}/services/oauth2/authorize`,
      tokenUrl: `${origin}/services/oauth2/token`,
    };
  }

  verifySalesforceTokenResponse(
    token: OAuthTokenResponse,
    clientSecret: string | null,
  ) {
    const identityUrl = this.stringOrNull(token.id);
    const instanceOrigin = this.stringOrNull(token.instance_url);
    const issuedAt = this.stringOrNull(token.issued_at);
    const signature = this.stringOrNull(token.signature);
    if (
      !clientSecret ||
      !identityUrl ||
      !instanceOrigin ||
      !issuedAt ||
      !signature
    )
      throw new BadRequestException(
        "Salesforce OAuth response is missing its signed organization binding",
      );
    const expected = createHmac("sha256", clientSecret)
      .update(identityUrl + issuedAt)
      .digest();
    let received: Buffer;
    try {
      received = Buffer.from(signature, "base64");
    } catch {
      throw new BadRequestException(
        "Salesforce OAuth response signature is invalid",
      );
    }
    if (
      received.length !== expected.length ||
      !timingSafeEqual(received, expected)
    )
      throw new BadRequestException(
        "Salesforce OAuth response signature is invalid",
      );
    let identity: URL;
    let instance: URL;
    try {
      identity = new URL(identityUrl);
      instance = new URL(instanceOrigin);
    } catch {
      throw new BadRequestException(
        "Salesforce OAuth response binding is invalid",
      );
    }
    const match = identity.pathname.match(
      /^\/id\/(00D[A-Za-z0-9]{12}(?:[A-Za-z0-9]{3})?)\/(005[A-Za-z0-9]{12}(?:[A-Za-z0-9]{3})?)$/,
    );
    if (
      identity.protocol !== "https:" ||
      instance.protocol !== "https:" ||
      !instance.hostname.toLowerCase().endsWith(".my.salesforce.com") ||
      instance.username ||
      instance.password ||
      instance.port ||
      (instance.pathname !== "/" && instance.pathname !== "") ||
      instance.search ||
      instance.hash ||
      !match
    )
      throw new BadRequestException(
        "Salesforce OAuth response binding is invalid",
      );
    return {
      salesforceOrganizationId: match[1],
      salesforceUserId: match[2],
      salesforceInstanceOrigin: instance.origin,
    };
  }

  bambooHRAuthority(companyValue: string) {
    const companyDomain = companyValue.trim().toLowerCase();
    if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(companyDomain))
      throw new BadRequestException("BambooHR Company Domain is invalid");
    const origin = `https://${companyDomain}.bamboohr.com`;
    return {
      mode: null,
      tenantId: null,
      authorizationUrl: `${origin}/authorize.php`,
      tokenUrl: `${origin}/token.php?request=token`,
    };
  }

  resolveOAuthAuthority(
    appSlug: string,
    input: {
      mode?: MicrosoftAuthorityMode | string | null;
      tenantId?: string | null;
      existingMetadata?: Record<string, unknown> | null;
      allowMissingTenant?: boolean;
    } = {},
  ) {
    const manifest = this.requireOAuthManifest(appSlug);
    if (manifest.slug === "salesforce") return this.salesforceAuthority();
    if (manifest.slug === "zoho") {
      const configured =
        this.stringOrNull(input.existingMetadata?.zohoAccountsOrigin) ??
        this.configService.get<string>("ZOHO_ACCOUNTS_ORIGIN") ??
        "https://accounts.zoho.com";
      return this.zohoCrmAuthority(configured);
    }
    if (manifest.slug === "zoho-desk") {
      const configured =
        this.stringOrNull(input.existingMetadata?.zohoAccountsOrigin) ??
        this.configService.get<string>("ZOHO_ACCOUNTS_ORIGIN") ??
        "https://accounts.zoho.com";
      return this.zohoDeskAuthority(configured);
    }
    if (manifest.slug === "zoho-projects") {
      const configured =
        this.stringOrNull(input.existingMetadata?.zohoAccountsOrigin) ??
        this.configService.get<string>("ZOHO_ACCOUNTS_ORIGIN") ??
        "https://accounts.zoho.com";
      return this.zohoCrmAuthority(configured);
    }
    if (manifest.slug === "zoho-books") {
      const configured =
        this.stringOrNull(input.existingMetadata?.zohoAccountsOrigin) ??
        "https://accounts.zoho.com";
      return this.zohoCrmAuthority(configured);
    }
    if (manifest.slug === "zoho-invoice") {
      const configured =
        this.stringOrNull(input.existingMetadata?.zohoAccountsOrigin) ??
        "https://accounts.zoho.com";
      return this.zohoCrmAuthority(configured);
    }
    if (manifest.slug === "zoho-expense") {
      const configured =
        this.stringOrNull(input.existingMetadata?.zohoAccountsOrigin) ??
        "https://accounts.zoho.com";
      return this.zohoCrmAuthority(configured);
    }
    if (manifest.slug === "zoho-people") {
      const configured =
        this.stringOrNull(input.existingMetadata?.zohoAccountsOrigin) ??
        this.configService.get<string>("ZOHO_PEOPLE_ACCOUNTS_ORIGIN") ??
        "https://accounts.zoho.com";
      return this.zohoPeopleAuthority(configured);
    }
    if (manifest.slug === "zoho-campaigns") {
      const configured =
        this.stringOrNull(input.existingMetadata?.zohoAccountsOrigin) ??
        this.configService.get<string>("ZOHO_CAMPAIGNS_ACCOUNTS_ORIGIN") ??
        "https://accounts.zoho.com";
      return this.zohoCampaignsAuthority(configured);
    }
    if (manifest.slug === "zoho-analytics") {
      const configured =
        this.stringOrNull(input.existingMetadata?.zohoAccountsOrigin) ??
        this.configService.get<string>("ZOHO_ANALYTICS_ACCOUNTS_ORIGIN") ??
        "https://accounts.zoho.com";
      return this.zohoAnalyticsAuthority(configured);
    }
    if (manifest.slug === "zoho-workdrive") {
      const configured =
        this.stringOrNull(input.existingMetadata?.zohoAccountsOrigin) ??
        this.configService.get<string>("ZOHO_WORKDRIVE_ACCOUNTS_ORIGIN") ??
        "https://accounts.zoho.com";
      return this.zohoWorkDriveAuthority(configured);
    }
    if (manifest.slug === "zoho-mail") {
      const configured =
        this.stringOrNull(input.existingMetadata?.zohoAccountsOrigin) ??
        this.configService.get<string>("ZOHO_MAIL_ACCOUNTS_ORIGIN") ??
        "https://accounts.zoho.com";
      return this.zohoMailAuthority(configured);
    }
    if (manifest.slug === "nifty") {
      const configured = this.configService
        .get<string>("NIFTY_AUTHORIZATION_URL")
        ?.trim();
      if (!configured) {
        throw new BadRequestException(
          "Nifty authorization URL is not configured on Railway",
        );
      }
      let authorizationUrl: URL;
      try {
        authorizationUrl = new URL(configured);
      } catch {
        throw new BadRequestException("Nifty authorization URL is invalid");
      }
      const host = authorizationUrl.hostname.toLowerCase();
      if (
        authorizationUrl.protocol !== "https:" ||
        (host !== "niftypm.com" && !host.endsWith(".niftypm.com")) ||
        authorizationUrl.username ||
        authorizationUrl.password ||
        authorizationUrl.hash
      ) {
        throw new BadRequestException(
          "Nifty authorization URL must be an HTTPS niftypm.com URL",
        );
      }
      return {
        mode: null,
        tenantId: null,
        authorizationUrl: authorizationUrl.toString(),
        tokenUrl: "https://openapi.niftypm.com/oauth/token",
      };
    }
    if (manifest.auth.oauth?.authority?.provider !== "microsoft") {
      return {
        mode: null,
        tenantId: null,
        authorizationUrl: manifest.auth.oauth!.authorizationUrl,
        tokenUrl: manifest.auth.oauth!.tokenUrl,
      };
    }
    if (manifest.slug === MICROSOFT_TEAMS_CONNECTOR_MANIFEST.slug) {
      return {
        mode: "multi_tenant_org" as const,
        tenantId: null,
        authorizationUrl:
          "https://login.microsoftonline.com/organizations/oauth2/v2.0/authorize",
        tokenUrl:
          "https://login.microsoftonline.com/organizations/oauth2/v2.0/token",
      };
    }
    const rawMode =
      this.stringOrNull(input.mode) ??
      this.stringOrNull(input.existingMetadata?.microsoftAuthorityMode) ??
      this.configService.get<string>("MICROSOFT_AUTHORITY_MODE") ??
      manifest.auth.oauth.authority.defaultMode;
    const mode = this.normalizeMicrosoftAuthorityMode(rawMode);
    const tenantId =
      this.stringOrNull(input.tenantId) ??
      this.stringOrNull(input.existingMetadata?.microsoftAuthorityTenantId) ??
      this.configService.get<string>(
        manifest.auth.oauth.authority.tenantIdEnv ?? "MICROSOFT_TENANT_ID",
      ) ??
      null;
    const segment =
      mode === "single_tenant"
        ? input.allowMissingTenant
          ? (tenantId ?? "<TENANT_ID>")
          : this.requireTenantId(tenantId)
        : mode === "multi_tenant_org"
          ? "organizations"
          : "common";
    return {
      mode,
      tenantId: mode === "single_tenant" ? segment : null,
      authorizationUrl: `https://login.microsoftonline.com/${encodeURIComponent(segment)}/oauth2/v2.0/authorize`,
      tokenUrl: `https://login.microsoftonline.com/${encodeURIComponent(segment)}/oauth2/v2.0/token`,
    };
  }

  oauthStateAuthority(appSlug: string, state: MarketplaceOAuthStateEntity) {
    const authorizationUrl = this.stringOrNull(state.authorityAuthorizeUrl);
    const tokenUrl = this.stringOrNull(state.authorityTokenUrl);
    if (authorizationUrl && tokenUrl) {
      if (appSlug === "mastodon") {
        const providerSession = this.decryptStateProviderSession(state);
        let origin: string;
        try {
          origin = this.mastodonApi.normalizeInstanceOrigin(
            providerSession?.mastodonInstanceOrigin,
          );
        } catch (error) {
          if (error instanceof MastodonApiError)
            throw new BadRequestException(error.message);
          throw error;
        }
        const authority = {
          mode: null,
          tenantId: null,
          authorizationUrl: `${origin}/oauth/authorize`,
          tokenUrl: `${origin}/oauth/token`,
        };
        if (
          authority.authorizationUrl !== authorizationUrl ||
          authority.tokenUrl !== tokenUrl
        )
          throw new BadRequestException(
            "Mastodon OAuth state contains an invalid instance authority",
          );
        return authority;
      }
      if (appSlug === "shopify") {
        const providerSession = this.decryptStateProviderSession(state);
        const authority = this.shopifyAuthority(
          this.stringOrNull(providerSession?.shopDomain) ?? "",
        );
        if (
          authority.authorizationUrl !== authorizationUrl ||
          authority.tokenUrl !== tokenUrl
        ) {
          throw new BadRequestException(
            "Shopify OAuth state contains an invalid shop authority",
          );
        }
        return authority;
      }
      if (appSlug === "salesforce") {
        const authority = this.salesforceAuthority();
        if (
          authority.authorizationUrl !== authorizationUrl ||
          authority.tokenUrl !== tokenUrl
        )
          throw new BadRequestException(
            "Salesforce OAuth state contains an invalid environment authority",
          );
        return authority;
      }
      if (appSlug === "zoho-workdrive") {
        const authority = this.zohoWorkDriveAuthority(authorizationUrl);
        if (authority.tokenUrl !== tokenUrl) {
          throw new BadRequestException(
            "Zoho WorkDrive OAuth state contains an invalid regional token authority",
          );
        }
        return authority;
      }
      if (appSlug === "zoho") {
        const authority = this.zohoCrmAuthority(authorizationUrl);
        if (authority.tokenUrl !== tokenUrl) {
          throw new BadRequestException(
            "Zoho CRM OAuth state contains an invalid regional token authority",
          );
        }
        return authority;
      }
      if (appSlug === "zoho-desk") {
        const authority = this.zohoDeskAuthority(authorizationUrl);
        if (authority.tokenUrl !== tokenUrl)
          throw new BadRequestException(
            "Zoho Desk OAuth state contains an invalid regional token authority",
          );
        return authority;
      }
      if (appSlug === "zoho-projects") {
        const authority = this.zohoCrmAuthority(authorizationUrl);
        if (authority.tokenUrl !== tokenUrl)
          throw new BadRequestException(
            "Zoho Projects OAuth state contains an invalid regional token authority",
          );
        return authority;
      }
      if (appSlug === "zoho-books") {
        const authority = this.zohoCrmAuthority(authorizationUrl);
        if (authority.tokenUrl !== tokenUrl)
          throw new BadRequestException(
            "Zoho Books OAuth state contains an invalid regional token authority",
          );
        return authority;
      }
      if (appSlug === "zoho-invoice") {
        const authority = this.zohoCrmAuthority(authorizationUrl);
        if (authority.tokenUrl !== tokenUrl)
          throw new BadRequestException(
            "Zoho Invoice OAuth state contains an invalid regional token authority",
          );
        return authority;
      }
      if (appSlug === "zoho-expense") {
        const authority = this.zohoCrmAuthority(authorizationUrl);
        if (authority.tokenUrl !== tokenUrl)
          throw new BadRequestException(
            "Zoho Expense OAuth state contains an invalid regional token authority",
          );
        return authority;
      }
      if (appSlug === "zoho-people") {
        const authority = this.zohoPeopleAuthority(authorizationUrl);
        if (authority.tokenUrl !== tokenUrl) {
          throw new BadRequestException(
            "Zoho People OAuth state contains an invalid regional token authority",
          );
        }
        return authority;
      }
      if (appSlug === "zoho-campaigns") {
        const authority = this.zohoCampaignsAuthority(authorizationUrl);
        if (authority.tokenUrl !== tokenUrl) {
          throw new BadRequestException(
            "Zoho Campaigns OAuth state contains an invalid regional token authority",
          );
        }
        return authority;
      }
      if (appSlug === "zoho-analytics") {
        const authority = this.zohoAnalyticsAuthority(authorizationUrl);
        if (authority.tokenUrl !== tokenUrl) {
          throw new BadRequestException(
            "Zoho Analytics OAuth state contains an invalid regional token authority",
          );
        }
        return authority;
      }
      if (appSlug === "zoho-mail") {
        const authority = this.zohoMailAuthority(authorizationUrl);
        if (authority.tokenUrl !== tokenUrl) {
          throw new BadRequestException(
            "Zoho Mail OAuth state contains an invalid regional token authority",
          );
        }
        return authority;
      }
      if (appSlug === "bamboohr") {
        const providerSession = this.decryptStateProviderSession(state);
        const authority = this.bambooHRAuthority(
          this.stringOrNull(providerSession?.bambooHRCompanyDomain) ?? "",
        );
        if (
          authority.authorizationUrl !== authorizationUrl ||
          authority.tokenUrl !== tokenUrl
        )
          throw new BadRequestException(
            "BambooHR OAuth state contains an invalid Company authority",
          );
        return authority;
      }
      return {
        mode: this.stringOrNull(state.authorityMode),
        tenantId: this.stringOrNull(state.authorityTenantId),
        authorizationUrl,
        tokenUrl,
      };
    }
    return this.resolveOAuthAuthority(appSlug, {
      mode: state.authorityMode,
      tenantId: state.authorityTenantId,
    });
  }

  connectionAuthority(
    appSlug: string,
    connection: MarketplaceConnectionEntity,
  ) {
    if (appSlug === "adobe-acrobat-sign") {
      return this.adobeAcrobatSignAuthority(
        this.stringOrNull(connection.metadata?.adobeAcrobatSignApiOrigin) ?? "",
      );
    }
    if (appSlug === "shopify") {
      return this.shopifyAuthority(
        this.stringOrNull(connection.metadata?.shopDomain) ?? "",
      );
    }
    if (appSlug === "zendesk") {
      return this.zendeskAuthority(
        this.stringOrNull(connection.metadata?.zendeskInstanceOrigin) ?? "",
      );
    }
    if (appSlug === "wrike") {
      const host = this.normalizeWrikeHost(
        this.stringOrNull(connection.metadata?.wrikeProviderHost) ?? "",
      );
      return {
        mode: host,
        tenantId: null,
        authorizationUrl: "https://login.wrike.com/oauth2/authorize/v4",
        tokenUrl: `https://${host}/oauth2/token`,
      };
    }
    if (appSlug === "pcloud") {
      return this.pCloudAuthority(
        this.stringOrNull(connection.metadata?.pCloudApiOrigin) ?? "",
      );
    }
    if (appSlug === "sharefile") {
      return this.shareFileAuthority(
        this.stringOrNull(connection.metadata?.shareFileApiOrigin) ?? "",
      );
    }
    if (appSlug === "deputy") {
      return this.deputyAuthority(
        this.stringOrNull(connection.metadata?.deputyApiOrigin) ?? "",
      );
    }
    if (appSlug === "bynder") {
      return this.bynderAuthority(
        this.stringOrNull(connection.metadata?.bynderPortalOrigin) ?? "",
      );
    }
    if (appSlug === "canto") {
      return this.cantoAuthority(
        this.stringOrNull(connection.metadata?.cantoAccountOrigin) ?? "",
      );
    }
    if (appSlug === "frontify") {
      return this.frontifyAuthority(
        this.stringOrNull(connection.metadata?.frontifyAccountOrigin) ?? "",
      );
    }
    if (appSlug === "asset-bank") {
      return this.assetBankAuthority(
        this.stringOrNull(connection.metadata?.assetBankBaseUrl) ?? "",
      );
    }
    if (appSlug === "bamboohr") {
      return this.bambooHRAuthority(
        this.stringOrNull(connection.metadata?.bambooHRCompanyDomain) ?? "",
      );
    }
    return this.resolveOAuthAuthority(appSlug, {
      mode: this.stringOrNull(connection.metadata?.microsoftAuthorityMode),
      tenantId: this.stringOrNull(
        connection.metadata?.microsoftAuthorityTenantId,
      ),
      existingMetadata: connection.metadata,
    });
  }

  ahaAuthorityFromCallback(value?: string) {
    const accountSubdomain = this.stringOrNull(value);
    if (!accountSubdomain)
      throw new BadRequestException(
        "Aha! callback did not identify the authorized account",
      );
    return this.ahaAuthority(accountSubdomain);
  }

  adobeAcrobatSignAuthority(value: string) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new BadRequestException(
        "Adobe Acrobat Sign callback returned an invalid API shard",
      );
    }
    const hostname = url.hostname.toLowerCase();
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      (url.pathname !== "/" && url.pathname !== "") ||
      url.search ||
      url.hash ||
      !/^api(?:\.[a-z0-9-]{1,32})?\.(?:adobesign|echosign)\.com$/.test(hostname)
    )
      throw new BadRequestException(
        "Adobe Acrobat Sign callback API shard is outside the documented HTTPS API domains",
      );
    const apiOrigin = `https://${hostname}`;
    return {
      mode: hostname,
      tenantId: null,
      authorizationUrl: "https://secure.echosign.com/public/oauth/v2",
      tokenUrl: `${apiOrigin}/oauth/v2/token`,
      apiOrigin,
    };
  }

  ahaAuthority(value: string) {
    const accountSubdomain = value.trim().toLowerCase();
    if (
      !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(accountSubdomain) ||
      accountSubdomain === "secure" ||
      accountSubdomain === "www"
    ) {
      throw new BadRequestException(
        "Aha! callback returned an invalid account subdomain",
      );
    }
    const apiOrigin = `https://${accountSubdomain}.aha.io`;
    return {
      mode: accountSubdomain,
      tenantId: null,
      authorizationUrl: "https://secure.aha.io/oauth/authorize",
      tokenUrl: `${apiOrigin}/oauth/token`,
      apiOrigin,
      accountSubdomain,
    };
  }

  pCloudAuthorityFromCallback(input: {
    pCloudLocationId?: string;
    pCloudHostname?: string;
  }) {
    const hostname = (
      this.stringOrNull(input.pCloudHostname) ?? ""
    ).toLowerCase();
    const locationId = Number(this.stringOrNull(input.pCloudLocationId));
    const expected =
      locationId === 1
        ? "api.pcloud.com"
        : locationId === 2
          ? "eapi.pcloud.com"
          : null;
    if (!expected || hostname !== expected) {
      throw new BadRequestException(
        "pCloud callback returned an invalid or mismatched regional API authority",
      );
    }
    return { ...this.pCloudAuthority(`https://${hostname}`), locationId };
  }

  pCloudAuthority(value: string) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new BadRequestException("pCloud API authority is invalid");
    }
    const hostname = url.hostname.toLowerCase();
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      url.pathname !== "/" ||
      url.search ||
      url.hash ||
      !["api.pcloud.com", "eapi.pcloud.com"].includes(hostname)
    ) {
      throw new BadRequestException(
        "pCloud API authority must be the OAuth-bound US or Europe API origin",
      );
    }
    const apiOrigin = `https://${hostname}`;
    return {
      mode: hostname === "eapi.pcloud.com" ? "eu" : "us",
      tenantId: null,
      authorizationUrl: "https://my.pcloud.com/oauth2/authorize",
      tokenUrl: `${apiOrigin}/oauth2_token`,
      apiOrigin,
    };
  }

  shareFileAuthorityFromCallback(
    input: {
      subdomain?: string;
      apicp?: string;
      appcp?: string;
      callbackHmac?: string;
      rawCallbackPathAndQuery?: string;
    },
    clientSecret?: string | null,
  ) {
    if (!clientSecret) {
      throw new BadRequestException(
        "ShareFile client secret is not configured on Railway",
      );
    }
    const raw = this.stringOrNull(input.rawCallbackPathAndQuery);
    const callbackHmac = this.stringOrNull(input.callbackHmac);
    if (!raw || !callbackHmac) {
      throw new BadRequestException(
        "ShareFile signed callback authority is required",
      );
    }
    const [path, rawQuery = ""] = raw.split("?", 2);
    const unsignedQuery = rawQuery
      .split("&")
      .filter((part) => decodeURIComponent(part.split("=", 1)[0] ?? "") !== "h")
      .join("&");
    const unsigned = `${path}${unsignedQuery ? `?${unsignedQuery}` : ""}`;
    const expected = createHmac("sha256", clientSecret)
      .update(unsigned, "utf8")
      .digest("base64");
    const expectedBytes = Buffer.from(expected, "utf8");
    const providedBytes = Buffer.from(callbackHmac, "utf8");
    if (
      expectedBytes.length !== providedBytes.length ||
      !timingSafeEqual(expectedBytes, providedBytes)
    ) {
      throw new BadRequestException(
        "ShareFile callback signature validation failed",
      );
    }
    const subdomain = (this.stringOrNull(input.subdomain) ?? "").toLowerCase();
    const apicp = (this.stringOrNull(input.apicp) ?? "").toLowerCase();
    const appcp = (this.stringOrNull(input.appcp) ?? "").toLowerCase();
    if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(subdomain)) {
      throw new BadRequestException(
        "ShareFile callback returned an invalid account subdomain",
      );
    }
    if (
      !["sf-api.com", "sharefile.com", "securevdr.com"].includes(apicp) ||
      !["sharefile.com", "securevdr.com"].includes(appcp)
    ) {
      throw new BadRequestException(
        "ShareFile callback returned an undocumented control plane",
      );
    }
    return this.shareFileAuthority(`https://${subdomain}.${apicp}`);
  }

  validateShopifyCallback(
    input: {
      shopifyHmac?: string;
      shopifyShop?: string;
      shopifyTimestamp?: string;
      rawCallbackPathAndQuery?: string;
    },
    clientSecret?: string | null,
  ) {
    if (!clientSecret) {
      throw new BadRequestException(
        "Shopify client secret is not configured on staging",
      );
    }
    const raw = this.stringOrNull(input.rawCallbackPathAndQuery);
    const provided = this.stringOrNull(input.shopifyHmac)?.toLowerCase();
    const shop = this.stringOrNull(input.shopifyShop);
    const timestamp = this.stringOrNull(input.shopifyTimestamp);
    if (
      !raw ||
      !provided ||
      !shop ||
      !timestamp ||
      !/^[a-f0-9]{64}$/.test(provided)
    ) {
      throw new BadRequestException("Shopify signed callback is incomplete");
    }
    this.normalizeShopifyDomain(shop);
    if (!/^\d{10,13}$/.test(timestamp)) {
      throw new BadRequestException("Shopify callback timestamp is invalid");
    }
    const timestampMs =
      Number(timestamp) * (timestamp.length === 10 ? 1000 : 1);
    if (
      !Number.isSafeInteger(timestampMs) ||
      Math.abs(Date.now() - timestampMs) > 10 * 60 * 1000
    ) {
      throw new BadRequestException(
        "Shopify callback timestamp is outside the allowed window",
      );
    }
    const [, rawQuery = ""] = raw.split("?", 2);
    const params = new URLSearchParams(rawQuery);
    const message = [...params.entries()]
      .filter(([key]) => !["hmac", "signature"].includes(key))
      .sort(([leftKey, leftValue], [rightKey, rightValue]) =>
        leftKey === rightKey
          ? leftValue.localeCompare(rightValue)
          : leftKey.localeCompare(rightKey),
      )
      .map(([key, value]) => `${key}=${value}`)
      .join("&");
    const expected = createHmac("sha256", clientSecret)
      .update(message, "utf8")
      .digest("hex");
    const expectedBytes = Buffer.from(expected, "utf8");
    const providedBytes = Buffer.from(provided, "utf8");
    if (
      expectedBytes.length !== providedBytes.length ||
      !timingSafeEqual(expectedBytes, providedBytes)
    ) {
      throw new BadRequestException(
        "Shopify callback signature validation failed",
      );
    }
  }

  shareFileAuthority(value: string) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new BadRequestException("ShareFile account authority is invalid");
    }
    const labels = url.hostname.toLowerCase().split(".");
    const controlPlane = labels.slice(1).join(".");
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      url.pathname !== "/" ||
      url.search ||
      url.hash ||
      labels.length < 3 ||
      !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(labels[0]) ||
      !["sf-api.com", "sharefile.com", "securevdr.com"].includes(controlPlane)
    ) {
      throw new BadRequestException(
        "ShareFile account authority is outside the documented control planes",
      );
    }
    const apiOrigin = `https://${url.hostname.toLowerCase()}`;
    return {
      mode: apiOrigin,
      tenantId: null,
      authorizationUrl: "https://secure.sharefile.com/oauth/authorize",
      tokenUrl: `${apiOrigin}/oauth/token`,
      apiOrigin,
    };
  }

  deputyAuthority(value: string) {
    const raw = value.trim().match(/^https?:\/\//i)
      ? value.trim()
      : `https://${value.trim()}`;
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      throw new BadRequestException("Deputy install authority is invalid");
    }
    const labels = url.hostname.toLowerCase().split(".");
    const install = labels[0];
    const geo = labels[1];
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      (url.pathname !== "/" && url.pathname !== "") ||
      url.search ||
      url.hash ||
      labels.length !== 4 ||
      labels[2] !== "deputy" ||
      labels[3] !== "com" ||
      !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(install) ||
      !["au", "eu", "uk", "us"].includes(geo)
    ) {
      throw new BadRequestException(
        "Deputy install authority must be an OAuth-returned HTTPS install in a documented Deputy region",
      );
    }
    const apiOrigin = `https://${url.hostname.toLowerCase()}`;
    return {
      mode: geo,
      tenantId: null,
      authorizationUrl: "https://once.deputy.com/my/oauth/login",
      tokenUrl: `${apiOrigin}/oauth/access_token`,
      apiOrigin,
    };
  }

  zohoCrmAuthority(value: string) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new BadRequestException(
        "Zoho CRM Accounts origin must be an allowlisted HTTPS Zoho origin",
      );
    }
    const host = url.hostname.toLowerCase() as ZohoCrmAccountsHost;
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      (url.pathname !== "/" && url.pathname !== "/oauth/v2/auth") ||
      url.search ||
      url.hash ||
      !(host in ZOHO_CRM_REGIONS)
    ) {
      throw new BadRequestException(
        "Zoho CRM Accounts origin must be an allowlisted HTTPS Zoho origin",
      );
    }
    const origin = `https://${host}`;
    const region = ZOHO_CRM_REGIONS[host];
    return {
      mode: region.code,
      tenantId: null,
      authorizationUrl: `${origin}/oauth/v2/auth`,
      tokenUrl: `${origin}/oauth/v2/token`,
      accountsOrigin: origin,
      apiOrigin: region.apiOrigin,
      region: region.code,
    };
  }

  zohoDeskAuthority(value: string) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new BadRequestException(
        "Zoho Desk Accounts origin must be an allowlisted HTTPS Zoho origin",
      );
    }
    const host = url.hostname.toLowerCase() as ZohoDeskAccountsHost;
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      (url.pathname !== "/" && url.pathname !== "/oauth/v2/auth") ||
      url.search ||
      url.hash ||
      !(host in ZOHO_DESK_REGIONS)
    )
      throw new BadRequestException(
        "Zoho Desk Accounts origin must be an allowlisted HTTPS Zoho origin",
      );
    const origin = `https://${host}`;
    const region = ZOHO_DESK_REGIONS[host];
    return {
      mode: region.code,
      tenantId: null,
      authorizationUrl: `${origin}/oauth/v2/auth`,
      tokenUrl: `${origin}/oauth/v2/token`,
      accountsOrigin: origin,
      apiOrigin: region.apiOrigin,
      region: region.code,
    };
  }

  zohoDeskAuthorityFromToken(
    token: OAuthTokenResponse,
    fallbackAuthorizationUrl: string,
  ) {
    const accountsServer = this.stringOrNull(token["accounts-server"]);
    let authority = accountsServer
      ? this.zohoDeskAuthority(accountsServer)
      : this.zohoDeskAuthority(fallbackAuthorizationUrl);
    const location = this.stringOrNull(token.location)?.toLowerCase();
    if (location && location !== authority.region) {
      const entry = Object.entries(ZOHO_DESK_REGIONS).find(
        ([, region]) => region.code === location,
      );
      if (!entry)
        throw new BadRequestException(
          "Zoho Desk token response returned an unsupported data center",
        );
      authority = this.zohoDeskAuthority(`https://${entry[0]}`);
    }
    const apiDomain = this.stringOrNull(token.api_domain);
    let apiOrigin = "";
    try {
      if (!apiDomain) throw new Error();
      const apiUrl = new URL(apiDomain);
      apiOrigin = apiUrl.origin;
      if (
        apiUrl.protocol !== "https:" ||
        apiUrl.origin !== apiDomain ||
        apiUrl.username ||
        apiUrl.password ||
        apiUrl.port ||
        apiUrl.search ||
        apiUrl.hash
      )
        throw new Error();
    } catch {
      throw new BadRequestException(
        "Zoho Desk token response returned an invalid API domain",
      );
    }
    if (apiOrigin !== authority.apiOrigin)
      throw new BadRequestException(
        "Zoho Desk Accounts and API data centers do not match",
      );
    return authority;
  }

  zohoCrmAuthorityFromToken(
    token: OAuthTokenResponse,
    fallbackAuthorizationUrl: string,
  ) {
    const accountsServer = this.stringOrNull(token["accounts-server"]);
    let authority = accountsServer
      ? this.zohoCrmAuthority(accountsServer)
      : this.zohoCrmAuthority(fallbackAuthorizationUrl);
    const location = this.stringOrNull(token.location)?.toLowerCase();
    if (location && location !== authority.region) {
      const entry = Object.entries(ZOHO_CRM_REGIONS).find(
        ([, region]) => region.code === location,
      );
      if (!entry) {
        throw new BadRequestException(
          "Zoho CRM token response returned an unsupported data center",
        );
      }
      authority = this.zohoCrmAuthority(`https://${entry[0]}`);
    }
    const apiDomain = this.stringOrNull(token.api_domain);
    if (!apiDomain) {
      throw new BadRequestException(
        "Zoho CRM token response did not return its regional API domain",
      );
    }
    let apiOrigin: string;
    try {
      const apiUrl = new URL(apiDomain);
      apiOrigin = apiUrl.origin;
      if (
        apiUrl.protocol !== "https:" ||
        apiUrl.username ||
        apiUrl.password ||
        apiUrl.port ||
        (apiUrl.pathname !== "/" && apiUrl.pathname !== "") ||
        apiUrl.search ||
        apiUrl.hash
      ) {
        throw new Error("invalid");
      }
    } catch {
      throw new BadRequestException(
        "Zoho CRM token response returned an invalid API domain",
      );
    }
    if (apiOrigin !== authority.apiOrigin) {
      throw new BadRequestException(
        "Zoho CRM Accounts and API data centers do not match",
      );
    }
    return authority;
  }

  zohoPeopleAuthority(value: string) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new BadRequestException(
        "Zoho People Accounts origin must be an allowlisted HTTPS Zoho origin",
      );
    }
    const host = url.hostname.toLowerCase() as ZohoCrmAccountsHost;
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      (url.pathname !== "/" && url.pathname !== "/oauth/v2/auth") ||
      url.search ||
      url.hash ||
      !(host in ZOHO_CRM_REGIONS)
    ) {
      throw new BadRequestException(
        "Zoho People Accounts origin must be an allowlisted HTTPS Zoho origin",
      );
    }
    const origin = `https://${host}`;
    const region = ZOHO_CRM_REGIONS[host];
    return {
      mode: region.code,
      tenantId: null,
      authorizationUrl: `${origin}/oauth/v2/auth`,
      tokenUrl: `${origin}/oauth/v2/token`,
      accountsOrigin: origin,
      apiOrigin: region.apiOrigin,
      region: region.code,
    };
  }

  zohoPeopleAuthorityFromToken(
    token: OAuthTokenResponse,
    fallbackAuthorizationUrl: string,
  ) {
    const accountsServer = this.stringOrNull(token["accounts-server"]);
    let authority = accountsServer
      ? this.zohoPeopleAuthority(accountsServer)
      : this.zohoPeopleAuthority(fallbackAuthorizationUrl);
    const location = this.stringOrNull(token.location)?.toLowerCase();
    if (location && location !== authority.region) {
      const entry = Object.entries(ZOHO_CRM_REGIONS).find(
        ([, region]) => region.code === location,
      );
      if (!entry) {
        throw new BadRequestException(
          "Zoho People token response returned an unsupported data center",
        );
      }
      authority = this.zohoPeopleAuthority(`https://${entry[0]}`);
    }
    const apiDomain = this.stringOrNull(token.api_domain);
    if (!apiDomain) {
      throw new BadRequestException(
        "Zoho People token response did not return its regional API domain",
      );
    }
    let apiOrigin: string;
    try {
      const apiUrl = new URL(apiDomain);
      apiOrigin = apiUrl.origin;
      if (
        apiUrl.protocol !== "https:" ||
        apiUrl.username ||
        apiUrl.password ||
        apiUrl.port ||
        (apiUrl.pathname !== "/" && apiUrl.pathname !== "") ||
        apiUrl.search ||
        apiUrl.hash
      )
        throw new Error("invalid");
    } catch {
      throw new BadRequestException(
        "Zoho People token response returned an invalid API domain",
      );
    }
    if (apiOrigin !== authority.apiOrigin) {
      throw new BadRequestException(
        "Zoho People Accounts and API data centers do not match",
      );
    }
    return authority;
  }

  zohoCampaignsAuthority(value: string) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new BadRequestException(
        "Zoho Campaigns Accounts origin must be an allowlisted HTTPS Zoho origin",
      );
    }
    const host = url.hostname.toLowerCase() as ZohoCampaignsAccountsHost;
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      (url.pathname !== "/" && url.pathname !== "/oauth/v2/auth") ||
      url.search ||
      url.hash ||
      !(host in ZOHO_CAMPAIGNS_REGIONS)
    ) {
      throw new BadRequestException(
        "Zoho Campaigns Accounts origin must be an allowlisted HTTPS Zoho origin",
      );
    }
    const origin = `https://${host}`;
    const region = ZOHO_CAMPAIGNS_REGIONS[host];
    return {
      mode: region.code,
      tenantId: null,
      authorizationUrl: `${origin}/oauth/v2/auth`,
      tokenUrl: `${origin}/oauth/v2/token`,
      accountsOrigin: origin,
      apiOrigin: region.apiOrigin,
      tokenApiOrigin: region.tokenApiOrigin,
      region: region.code,
    };
  }

  zohoCampaignsAuthorityFromToken(
    token: OAuthTokenResponse,
    fallbackAuthorizationUrl: string,
  ) {
    const accountsServer = this.stringOrNull(token["accounts-server"]);
    let authority = accountsServer
      ? this.zohoCampaignsAuthority(accountsServer)
      : this.zohoCampaignsAuthority(fallbackAuthorizationUrl);
    const location = this.stringOrNull(token.location)?.toLowerCase();
    if (location && location !== authority.region) {
      const entry = Object.entries(ZOHO_CAMPAIGNS_REGIONS).find(
        ([, region]) => region.code === location,
      );
      if (!entry) {
        throw new BadRequestException(
          "Zoho Campaigns token response returned an unsupported data center",
        );
      }
      authority = this.zohoCampaignsAuthority(`https://${entry[0]}`);
    }
    const apiDomain = this.stringOrNull(token.api_domain);
    if (!apiDomain) {
      throw new BadRequestException(
        "Zoho Campaigns token response did not return its regional API domain",
      );
    }
    let tokenApiOrigin: string;
    try {
      const apiUrl = new URL(apiDomain);
      tokenApiOrigin = apiUrl.origin;
      if (
        apiUrl.protocol !== "https:" ||
        apiUrl.username ||
        apiUrl.password ||
        apiUrl.port ||
        (apiUrl.pathname !== "/" && apiUrl.pathname !== "") ||
        apiUrl.search ||
        apiUrl.hash
      )
        throw new Error("invalid");
    } catch {
      throw new BadRequestException(
        "Zoho Campaigns token response returned an invalid API domain",
      );
    }
    if (tokenApiOrigin !== authority.tokenApiOrigin) {
      throw new BadRequestException(
        "Zoho Campaigns Accounts and API data centers do not match",
      );
    }
    return authority;
  }

  zohoAnalyticsAuthority(value: string) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new BadRequestException(
        "Zoho Analytics Accounts origin must be an allowlisted HTTPS Zoho origin",
      );
    }
    const host = url.hostname.toLowerCase() as ZohoAnalyticsAccountsHost;
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      (url.pathname !== "/" && url.pathname !== "/oauth/v2/auth") ||
      url.search ||
      url.hash ||
      !(host in ZOHO_ANALYTICS_REGIONS)
    )
      throw new BadRequestException(
        "Zoho Analytics Accounts origin must be an allowlisted HTTPS Zoho origin",
      );
    const origin = `https://${host}`;
    const region = ZOHO_ANALYTICS_REGIONS[host];
    return {
      mode: region.code,
      tenantId: null,
      authorizationUrl: `${origin}/oauth/v2/auth`,
      tokenUrl: `${origin}/oauth/v2/token`,
      accountsOrigin: origin,
      apiOrigin: region.apiOrigin,
      tokenApiOrigin: region.tokenApiOrigin,
      region: region.code,
    };
  }

  zohoAnalyticsAuthorityFromToken(
    token: OAuthTokenResponse,
    fallbackAuthorizationUrl: string,
  ) {
    const accountsServer = this.stringOrNull(token["accounts-server"]);
    let authority = accountsServer
      ? this.zohoAnalyticsAuthority(accountsServer)
      : this.zohoAnalyticsAuthority(fallbackAuthorizationUrl);
    const location = this.stringOrNull(token.location)?.toLowerCase();
    if (location && location !== authority.region) {
      const entry = Object.entries(ZOHO_ANALYTICS_REGIONS).find(
        ([, region]) => region.code === location,
      );
      if (!entry)
        throw new BadRequestException(
          "Zoho Analytics token response returned an unsupported data center",
        );
      authority = this.zohoAnalyticsAuthority(`https://${entry[0]}`);
    }
    const apiDomain = this.stringOrNull(token.api_domain);
    if (!apiDomain)
      throw new BadRequestException(
        "Zoho Analytics token response did not return its regional API domain",
      );
    let tokenApiOrigin: string;
    try {
      const apiUrl = new URL(apiDomain);
      tokenApiOrigin = apiUrl.origin;
      if (
        apiUrl.protocol !== "https:" ||
        apiUrl.username ||
        apiUrl.password ||
        apiUrl.port ||
        (apiUrl.pathname !== "/" && apiUrl.pathname !== "") ||
        apiUrl.search ||
        apiUrl.hash
      )
        throw new Error("invalid");
    } catch {
      throw new BadRequestException(
        "Zoho Analytics token response returned an invalid API domain",
      );
    }
    if (tokenApiOrigin !== authority.tokenApiOrigin)
      throw new BadRequestException(
        "Zoho Analytics Accounts and API data centers do not match",
      );
    return authority;
  }

  zohoMailAuthority(value: string) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new BadRequestException(
        "ZOHO_MAIL_ACCOUNTS_ORIGIN must be an allowlisted HTTPS Zoho Accounts origin",
      );
    }
    const host = url.hostname.toLowerCase() as ZohoMailAccountsHost;
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      !(host in ZOHO_MAIL_REGIONS)
    ) {
      throw new BadRequestException(
        "ZOHO_MAIL_ACCOUNTS_ORIGIN must be an allowlisted HTTPS Zoho Accounts origin",
      );
    }
    const origin = `https://${host}`;
    const region = ZOHO_MAIL_REGIONS[host];
    return {
      mode: region.code,
      tenantId: null,
      authorizationUrl: `${origin}/oauth/v2/auth`,
      tokenUrl: `${origin}/oauth/v2/token`,
      accountsOrigin: origin,
      mailOrigin: region.mailOrigin,
      region: region.code,
    };
  }

  zohoWorkDriveAuthority(value: string) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new BadRequestException(
        "Zoho WorkDrive Accounts origin must be an allowlisted HTTPS Zoho origin",
      );
    }
    const host = url.hostname.toLowerCase() as ZohoWorkDriveAccountsHost;
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      !(host in ZOHO_WORKDRIVE_REGIONS)
    ) {
      throw new BadRequestException(
        "Zoho WorkDrive Accounts origin must be an allowlisted HTTPS Zoho origin",
      );
    }
    const origin = `https://${host}`;
    const region = ZOHO_WORKDRIVE_REGIONS[host];
    return {
      mode: region.code,
      tenantId: null,
      authorizationUrl: `${origin}/oauth/v2/auth`,
      tokenUrl: `${origin}/oauth/v2/token`,
      accountsOrigin: origin,
      apiOrigin: region.apiOrigin,
      downloadOrigin: region.downloadOrigin,
      uploadOrigin: region.uploadOrigin,
      region: region.code,
    };
  }

  zohoWorkDriveAuthorityFromToken(
    token: OAuthTokenResponse,
    fallbackAuthorizationUrl: string,
  ) {
    const accountsServer = this.stringOrNull(token["accounts-server"]);
    let authority = accountsServer
      ? this.zohoWorkDriveAuthority(accountsServer)
      : this.zohoWorkDriveAuthority(fallbackAuthorizationUrl);
    const location = this.stringOrNull(token.location)?.toLowerCase();
    if (location && location !== authority.region) {
      const entry = Object.entries(ZOHO_WORKDRIVE_REGIONS).find(
        ([, region]) => region.code === location,
      );
      if (!entry) {
        throw new BadRequestException(
          "Zoho WorkDrive token response returned an unsupported data center",
        );
      }
      authority = this.zohoWorkDriveAuthority(`https://${entry[0]}`);
    }
    const apiDomain = this.stringOrNull(token.api_domain);
    if (apiDomain) {
      let apiOrigin: string;
      try {
        apiOrigin = new URL(apiDomain).origin;
      } catch {
        throw new BadRequestException(
          "Zoho WorkDrive token response returned an invalid API domain",
        );
      }
      if (apiOrigin !== authority.apiOrigin) {
        throw new BadRequestException(
          "Zoho WorkDrive Accounts and API data centers do not match",
        );
      }
    }
    return authority;
  }

  zohoMailAuthorityFromToken(
    token: OAuthTokenResponse,
    fallbackAuthorizationUrl: string,
  ) {
    const accountsServer = this.stringOrNull(token["accounts-server"]);
    if (accountsServer) return this.zohoMailAuthority(accountsServer);
    const location = this.stringOrNull(token.location)?.toLowerCase();
    if (location) {
      const entry = Object.entries(ZOHO_MAIL_REGIONS).find(
        ([, region]) => region.code === location,
      );
      if (!entry) {
        throw new BadRequestException(
          "Zoho Mail token response returned an unsupported data center",
        );
      }
      return this.zohoMailAuthority(`https://${entry[0]}`);
    }
    return this.zohoMailAuthority(fallbackAuthorizationUrl);
  }

  requireZohoMailOrigin(value: unknown) {
    const origin = this.stringOrNull(value);
    if (
      !origin ||
      !Object.values(ZOHO_MAIL_REGIONS).some(
        (region) => region.mailOrigin === origin,
      )
    ) {
      throw new BadRequestException(
        "Zoho Mail requires an allowlisted regional Mail API origin",
      );
    }
    return origin;
  }

  normalizeMicrosoftAuthorityMode(value: string): MicrosoftAuthorityMode {
    if (value === "multi_tenant_org" || value === "organizations")
      return "multi_tenant_org";
    if (value === "multi_tenant_common" || value === "common")
      return "multi_tenant_common";
    return "single_tenant";
  }

  requireTenantId(value: string | null) {
    const tenantId = this.stringOrNull(value);
    if (!tenantId) {
      throw new BadRequestException(
        "MICROSOFT_TENANT_ID is required when Microsoft authority mode is single_tenant",
      );
    }
    return tenantId;
  }

  senderIdentitiesFromProfile(
    profile: Record<string, unknown>,
    primaryMailboxAddress: string | null,
  ) {
    const now = new Date().toISOString();
    const displayName = this.stringOrNull(profile.displayName);
    const identities = new Map<string, MicrosoftSenderIdentity>();
    const add = (
      email: string | null,
      type: MicrosoftSenderIdentity["type"],
    ) => {
      const normalized = this.normalizeEmail(email);
      if (!normalized || identities.has(normalized)) return;
      identities.set(normalized, {
        id: type === "primary_mailbox" ? "primary" : `alias:${normalized}`,
        email: normalized,
        displayName,
        type,
        validationStatus: "verified",
        lastValidatedAt: now,
        allowedForConnection: true,
        agentIds: [],
        installIds: [],
        source: "graph_me",
        adminUrl: "https://admin.exchange.microsoft.com/#/mailboxes",
      });
    };
    add(primaryMailboxAddress, "primary_mailbox");
    for (const entry of this.stringArray(profile.proxyAddresses)) {
      add(entry.replace(/^smtp:/i, ""), "verified_alias");
    }
    for (const entry of this.stringArray(profile.otherMails)) {
      add(entry, "verified_alias");
    }
    return Array.from(identities.values());
  }

  validateOutlookSenderIdentity(
    connection: MarketplaceConnectionEntity,
    profile: unknown,
    requestedEmail: string,
    input: { agentId?: string | null; installId?: string | null },
  ): MicrosoftSenderIdentity {
    const profileObject =
      profile && typeof profile === "object" && !Array.isArray(profile)
        ? (profile as Record<string, unknown>)
        : {};
    const primaryMailboxAddress =
      this.stringOrNull(profileObject.mail) ??
      this.stringOrNull(profileObject.userPrincipalName) ??
      this.stringOrNull(connection.metadata?.primaryMailboxAddress);
    const known = this.senderIdentitiesFromProfile(
      profileObject,
      primaryMailboxAddress,
    );
    const existing = known.find(
      (identity) => identity.email === requestedEmail,
    );
    const now = new Date().toISOString();
    if (existing) {
      return {
        ...existing,
        agentIds: this.mergeIdentityRef(existing.agentIds, input.agentId),
        installIds: this.mergeIdentityRef(existing.installIds, input.installId),
      };
    }
    const configured = this.senderIdentitiesFromMetadata(
      connection.metadata,
    ).find(
      (identity) =>
        identity.email === requestedEmail &&
        identity.validationStatus === "verified",
    );
    if (configured) {
      return {
        ...configured,
        agentIds: this.mergeIdentityRef(configured.agentIds, input.agentId),
        installIds: this.mergeIdentityRef(
          configured.installIds,
          input.installId,
        ),
        lastValidatedAt: now,
      };
    }
    return {
      id: `missing:${requestedEmail}`,
      email: requestedEmail,
      displayName: null,
      type: "missing",
      validationStatus: "missing",
      lastValidatedAt: now,
      allowedForConnection: false,
      agentIds: this.mergeIdentityRef([], input.agentId),
      installIds: this.mergeIdentityRef([], input.installId),
      source: "manual",
      adminUrl: "https://admin.exchange.microsoft.com/#/mailboxes",
    };
  }

  upsertSenderIdentityMetadata(
    metadata: Record<string, unknown>,
    identity: MicrosoftSenderIdentity,
  ) {
    const current = this.senderIdentitiesFromMetadata(metadata);
    const next = new Map(current.map((entry) => [entry.email, entry]));
    next.set(identity.email, {
      ...(next.get(identity.email) ?? {}),
      ...identity,
      agentIds: this.mergeIdentityRefs(
        next.get(identity.email)?.agentIds,
        identity.agentIds,
      ),
      installIds: this.mergeIdentityRefs(
        next.get(identity.email)?.installIds,
        identity.installIds,
      ),
    });
    return {
      ...metadata,
      senderIdentities: Array.from(next.values()),
      approvedSenderIdentities: Array.from(next.values()),
    };
  }

  senderIdentitiesFromMetadata(
    metadata: Record<string, unknown> | null | undefined,
  ): MicrosoftSenderIdentity[] {
    const value =
      metadata?.senderIdentities ?? metadata?.approvedSenderIdentities;
    if (!Array.isArray(value)) return [];
    return value
      .filter(
        (entry): entry is Record<string, unknown> =>
          Boolean(entry) && typeof entry === "object" && !Array.isArray(entry),
      )
      .map((entry) => {
        const email = this.normalizeEmail(entry.email);
        if (!email) return null;
        const identity: MicrosoftSenderIdentity = {
          id: this.stringOrNull(entry.id) ?? `alias:${email}`,
          email,
          displayName: this.stringOrNull(entry.displayName),
          type: this.normalizeSenderIdentityType(entry.type),
          validationStatus: this.normalizeSenderValidationStatus(
            entry.validationStatus ??
              entry.status ??
              (entry.verified === true ? "verified" : null),
          ),
          lastValidatedAt:
            this.stringOrNull(entry.lastValidatedAt) ??
            new Date(0).toISOString(),
          allowedForConnection:
            entry.allowedForConnection !== false &&
            entry.approvedForAgents !== false,
          agentIds: this.stringArray(entry.agentIds),
          installIds: this.stringArray(entry.installIds),
          source: entry.source === "graph_me" ? "graph_me" : "manual",
          adminUrl:
            this.stringOrNull(entry.adminUrl) ??
            "https://admin.exchange.microsoft.com/#/mailboxes",
        };
        return identity;
      })
      .filter((entry): entry is MicrosoftSenderIdentity => Boolean(entry));
  }

  normalizeSenderIdentityType(value: unknown): MicrosoftSenderIdentity["type"] {
    if (
      value === "primary_mailbox" ||
      value === "verified_alias" ||
      value === "shared_mailbox" ||
      value === "missing"
    ) {
      return value;
    }
    return "unknown_unverified";
  }

  normalizeSenderValidationStatus(
    value: unknown,
  ): MicrosoftSenderIdentity["validationStatus"] {
    if (value === "verified" || value === "missing") return value;
    return "unverified";
  }

  normalizeEmail(value: unknown) {
    return this.stringOrNull(value)?.toLowerCase() ?? null;
  }

  googleAdsCustomerId(value: unknown, required: boolean) {
    const customerId = this.stringOrNull(value);
    if (!customerId && !required) return null;
    if (!customerId || !/^[0-9]{10}$/.test(customerId))
      throw new BadRequestException(
        "Google Ads customer IDs must contain exactly ten digits without hyphens",
      );
    return customerId;
  }

  googleAnalyticsPropertyId(value: unknown) {
    const propertyId = this.stringOrNull(value);
    if (!propertyId || !/^[0-9]{1,32}$/.test(propertyId))
      throw new BadRequestException(
        "Google Analytics propertyId must be a numeric GA4 property ID",
      );
    return propertyId;
  }

  googleSearchConsoleSiteUrl(value: unknown) {
    const siteUrl = this.stringOrNull(value);
    if (!siteUrl || siteUrl.length > 2048)
      throw new BadRequestException(
        "Google Search Console siteUrl is required and must be 2048 characters or fewer",
      );
    if (
      /^sc-domain:[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?$/i.test(siteUrl) &&
      !siteUrl.includes("..")
    )
      return siteUrl.toLowerCase();
    try {
      const url = new URL(siteUrl);
      if (
        (url.protocol === "https:" || url.protocol === "http:") &&
        url.hostname &&
        !url.username &&
        !url.password &&
        !url.hash
      )
        return siteUrl;
    } catch {}
    throw new BadRequestException(
      "Google Search Console siteUrl must be an HTTP(S) URL-prefix or sc-domain property",
    );
  }

  googleBusinessProfileAccountName(value: unknown) {
    const name = this.stringOrNull(value);
    if (!name || !/^accounts\/[0-9]{1,32}$/.test(name))
      throw new BadRequestException(
        "Google Business Profile accountName must use accounts/{id}",
      );
    return name;
  }

  googleBusinessProfileLocationName(value: unknown) {
    const name = this.stringOrNull(value);
    if (!name || !/^locations\/[0-9]{1,32}$/.test(name))
      throw new BadRequestException(
        "Google Business Profile locationName must use locations/{id}",
      );
    return name;
  }

  googleMerchantCenterAccountName(value: unknown) {
    const name = this.stringOrNull(value);
    if (!name || !/^accounts\/[0-9]{1,32}$/.test(name))
      throw new BadRequestException(
        "Google Merchant Center accountName must use accounts/{numeric id}",
      );
    return name;
  }

  mergeIdentityRef(values: string[] | undefined, value?: string | null) {
    return this.mergeIdentityRefs(values, value ? [value] : []);
  }

  mergeIdentityRefs(
    values: string[] | undefined,
    nextValues: string[] | undefined,
  ) {
    return Array.from(
      new Set([...(values ?? []), ...(nextValues ?? [])].filter(Boolean)),
    );
  }

  microsoftAdminUrls() {
    return {
      microsoft365AdminCenter: "https://admin.microsoft.com/",
      exchangeAdminCenter: "https://admin.exchange.microsoft.com/#/mailboxes",
      mailboxAliasSettings: "https://admin.exchange.microsoft.com/#/mailboxes",
    };
  }
}

export interface MarketplaceConnectorOAuthService extends OAuthServiceExtensionMethods {}

installOAuthServiceMethodModules(
  MarketplaceConnectorOAuthService.prototype,
  OAUTH_SERVICE_EXTENSIONS,
);
