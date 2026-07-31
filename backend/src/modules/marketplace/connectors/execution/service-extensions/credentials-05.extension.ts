import type { MarketplaceConnectorExecutionService } from "../../connector-execution.service";
import { MarketplaceConnectionEntity } from "../../../../../entities";
import { type AmazingMarvinCredentials } from "../../amazing-marvin/amazing-marvin-api.adapter";
import { type AppcuesCredentials } from "../../appcues/appcues-api.adapter";
import { type AttioCredentials } from "../../attio/attio-api.adapter";
import { type BenchmarkEmailCredentials } from "../../benchmark-email/benchmark-email-api.adapter";
import { type BetterProposalsCredentials } from "../../better-proposals/better-proposals-api.adapter";
import { type BigMarkerCredentials } from "../../bigmarker/bigmarker-api.adapter";
import { type BinanceCredentials } from "../../binance/binance-api.adapter";
import { type CapsuleCrmCredentials } from "../../capsule-crm/capsule-crm-api.adapter";
import { type ChameleonCredentials } from "../../chameleon/chameleon-api.adapter";
import { type ChimeCrmCredentials } from "../../chime-crm/chime-crm-api.adapter";
import { type ClientSuccessCredentials } from "../../clientsuccess/clientsuccess-api.adapter";
import { type ClinikoCredentials } from "../../cliniko/cliniko-api.adapter";
import { type ConcordCredentials } from "../../concord/concord-api.adapter";
import { type ContractbookCredentials } from "../../contractbook/contractbook-api.adapter";
import { type CookiebotCredentials } from "../../cookiebot/cookiebot-api.adapter";
import { type CrazyEggCredentials } from "../../crazy-egg/crazy-egg-api.adapter";
import { type CreatioCredentials } from "../../creatio/creatio-api.adapter";
import { type CustifyCredentials } from "../../custify/custify-api.adapter";
import { type DemioCredentials } from "../../demio/demio-api.adapter";
import { type DiscoEdiscoveryCredentials } from "../../disco-ediscovery/disco-ediscovery-api.adapter";
import { type DovetailCredentials } from "../../dovetail/dovetail-api.adapter";
import { type EloquaCredentials } from "../../eloqua/eloqua-api.adapter";
import { type EmmaCredentials } from "../../emma/emma-api.adapter";
import { type EverhourCredentials } from "../../everhour/everhour-api.adapter";
import { type FlodeskCredentials } from "../../flodesk/flodesk-api.adapter";
import { type FolkCrmCredentials } from "../../folk-crm/folk-crm-api.adapter";
import { type FollowUpBossCredentials } from "../../follow-up-boss/follow-up-boss-api.adapter";
import { type FreshsalesCredentials } from "../../freshsales/freshsales-api.adapter";
import { type GainsightCredentials } from "../../gainsight/gainsight-api.adapter";
import { type GeminiCredentials } from "../../gemini/gemini-api.adapter";
import { type GetAcceptCredentials } from "../../getaccept/getaccept-api.adapter";
import { type HabiticaCredentials } from "../../habitica/habitica-api.adapter";
import { type HiveCredentials } from "../../hive/hive-api.adapter";
import { type InsightlyCredentials } from "../../insightly/insightly-api.adapter";
import { type InstapaperCredentials } from "../../instapaper/instapaper-api.adapter";
import { type IroncladCredentials } from "../../ironclad/ironclad-api.adapter";
import { type JaneAppCredentials } from "../../jane-app/jane-app-api.adapter";
import { type JuroCredentials } from "../../juro/juro-api.adapter";
import { type KeapMaxClassicCredentials } from "../../keap-max-classic/keap-max-classic-api.adapter";
import { type KeapCredentials } from "../../keap/keap-api.adapter";
import { type KrakenCredentials } from "../../kraken/kraken-api.adapter";
import { type LinkSquaresCredentials } from "../../linksquares/linksquares-api.adapter";
import { type LogRocketCredentials } from "../../logrocket/logrocket-mcp.adapter";
import { type MailercloudCredentials } from "../../mailercloud/mailercloud-api.adapter";
import { type MailerLiteCredentials } from "../../mailerlite/mailerlite-api.adapter";
import { type MarketoCredentials } from "../../marketo/marketo-api.adapter";
import { type MindbodyCredentials } from "../../mindbody/mindbody-api.adapter";
import { type MoosendCredentials } from "../../moosend/moosend-api.adapter";
import { type MotionCredentials } from "../../motion/motion-api.adapter";
import { type NimbleCredentials } from "../../nimble/nimble-api.adapter";
import { type NozbeCredentials } from "../../nozbe/nozbe-api.adapter";
import { type OnceHubCredentials } from "../../oncehub/oncehub-api.adapter";
import { type OnePageCrmCredentials } from "../../onepagecrm/onepagecrm-api.adapter";
import { type OneSpanSignCredentials } from "../../onespan-sign/onespan-sign-api.adapter";
import { type OneTrustCredentials } from "../../onetrust/onetrust-api.adapter";
import { type PardotCredentials } from "../../pardot/pardot-api.adapter";
import { type PaymoCredentials } from "../../paymo/paymo-api.adapter";
import { type PlanhatCredentials } from "../../planhat/planhat-api.adapter";
import { type PlutioCredentials } from "../../plutio/plutio-api.adapter";
import { type PracticeBetterCredentials } from "../../practice-better/practice-better-api.adapter";
import { type ProofCredentials } from "../../proof/proof-api.adapter";
import { type ProofHubCredentials } from "../../proofhub/proofhub-api.adapter";
import { type ProposifyCredentials } from "../../proposify/proposify-api.adapter";
import { type QwilrCredentials } from "../../qwilr/qwilr-api.adapter";
import { type ReallySimpleSystemsCredentials } from "../../really-simple-systems/really-simple-systems-api.adapter";
import { type ReclaimAiCredentials } from "../../reclaim-ai/reclaim-ai-api.adapter";
import { type RespondentCredentials } from "../../respondent/respondent-api.adapter";
import {
  type RoadmunkCredentials,
  type RoadmunkRegion,
} from "../../roadmunk/roadmunk-graphql.adapter";
import { type SalesflareCredentials } from "../../salesflare/salesflare-api.adapter";
import { type SalesforceCommerceCloudCredentials } from "../../salesforce-commerce-cloud/salesforce-commerce-cloud-api.adapter";
import { type SalesforceMarketingCloudCredentials } from "../../salesforce-marketing-cloud/salesforce-marketing-cloud-api.adapter";
import { type SetmoreCredentials } from "../../setmore/setmore-api.adapter";
import { type ShortcutCredentials } from "../../shortcut/shortcut-api.adapter";
import { type SimplyBookMeCredentials } from "../../simplybook-me/simplybook-me-api.adapter";
import { type SmartlookCredentials } from "../../smartlook/smartlook-api.adapter";
import { type SpotDraftCredentials } from "../../spotdraft/spotdraft-api.adapter";
import { type SprigCredentials } from "../../sprig/sprig-api.adapter";
import { type SugarCrmCredentials } from "../../sugarcrm/sugarcrm-api.adapter";
import { type SuiteCrmCloudCredentials } from "../../suitecrm-cloud/suitecrm-cloud-api.adapter";
import { type TermlyCredentials } from "../../termly/termly-api.adapter";
import { type TotangoCredentials } from "../../totango/totango-api.adapter";
import { type UserInterviewsCredentials } from "../../user-interviews/user-interviews-api.adapter";
import { type UserflowCredentials } from "../../userflow/userflow-api.adapter";
import { type UserpilotCredentials } from "../../userpilot/userpilot-api.adapter";
import { type UserTestingCredentials } from "../../usertesting/usertesting-api.adapter";
import { type VagaroCredentials } from "../../vagaro/vagaro-api.adapter";
import { type VitallyCredentials } from "../../vitally/vitally-api.adapter";
import { type VtigerCrmCredentials } from "../../vtiger-crm/vtiger-crm-api.adapter";
import { type YouCanBookMeCredentials } from "../../youcanbookme/youcanbookme-api.adapter";
import { type ZendeskSellCredentials } from "../../zendesk-sell/zendesk-sell-api.adapter";
import { ConnectorExecutionError } from "../connector-execution.error";

export const CredentialsExtension5 = {
  userTestingCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): UserTestingCredentials {
    return {
      clientId: this.stringOrNull(stored?.USERTESTING_CLIENT_ID) ?? "",
      clientSecret: this.stringOrNull(stored?.USERTESTING_CLIENT_SECRET) ?? "",
    };
  },

  userInterviewsCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): UserInterviewsCredentials {
    return {
      apiKey: this.stringOrNull(stored?.USER_INTERVIEWS_API_KEY) ?? "",
    };
  },

  respondentCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): RespondentCredentials {
    return {
      clientId: this.stringOrNull(stored?.RESPONDENT_CLIENT_ID) ?? "",
      clientSecret: this.stringOrNull(stored?.RESPONDENT_CLIENT_SECRET) ?? "",
    };
  },

  dovetailCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): DovetailCredentials {
    return {
      apiToken: this.stringOrNull(stored?.DOVETAIL_API_TOKEN) ?? "",
    };
  },

  sprigCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): SprigCredentials {
    return { apiKey: this.stringOrNull(stored?.SPRIG_API_KEY) ?? "" };
  },

  everhourCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): EverhourCredentials {
    return {
      apiKey:
        this.stringOrNull(stored?.EVERHOUR_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
    };
  },

  roadmunkCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): RoadmunkCredentials {
    const rawRegion = (
      this.stringOrNull(stored?.ROADMUNK_REGION) ??
      this.stringOrNull(stored?.region) ??
      ""
    ).toLowerCase();
    const regionAliases: Record<string, RoadmunkRegion> = {
      na: "na",
      us: "na",
      "north america": "na",
      eu: "eu",
      europe: "eu",
      apac: "apac",
      "asia pacific": "apac",
    };
    const region = regionAliases[rawRegion];
    if (!region)
      throw new ConnectorExecutionError(
        "provider_validation_error",
        "Strategic Roadmaps data region must be North America, Europe, or Asia Pacific.",
      );
    return {
      apiToken:
        this.stringOrNull(stored?.ROADMUNK_API_TOKEN) ??
        this.stringOrNull(stored?.apiToken) ??
        "",
      region,
    };
  },

  shortcutCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): ShortcutCredentials {
    return {
      apiToken:
        this.stringOrNull(stored?.SHORTCUT_API_TOKEN) ??
        this.stringOrNull(stored?.apiToken) ??
        "",
    };
  },

  hiveCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): HiveCredentials {
    return {
      apiKey:
        this.stringOrNull(stored?.HIVE_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
      userId:
        this.stringOrNull(stored?.HIVE_USER_ID) ??
        this.stringOrNull(stored?.userId) ??
        "",
    };
  },

  paymoCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): PaymoCredentials {
    return {
      apiKey:
        this.stringOrNull(stored?.PAYMO_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
    };
  },

  krakenCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): KrakenCredentials {
    return {
      apiKey:
        this.stringOrNull(stored?.KRAKEN_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
      apiSecret:
        this.stringOrNull(stored?.KRAKEN_API_SECRET) ??
        this.stringOrNull(stored?.apiSecret) ??
        "",
    };
  },

  binanceCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): BinanceCredentials {
    return {
      apiKey:
        this.stringOrNull(stored?.BINANCE_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
      apiSecret:
        this.stringOrNull(stored?.BINANCE_API_SECRET) ??
        this.stringOrNull(stored?.apiSecret) ??
        "",
    };
  },

  geminiCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): GeminiCredentials {
    return {
      apiKey:
        this.stringOrNull(stored?.GEMINI_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
      apiSecret:
        this.stringOrNull(stored?.GEMINI_API_SECRET) ??
        this.stringOrNull(stored?.apiSecret) ??
        "",
    };
  },

  nozbeCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): NozbeCredentials {
    return {
      apiKey:
        this.stringOrNull(stored?.NOZBE_API_TOKEN) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
    };
  },

  habiticaCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): HabiticaCredentials {
    return {
      userId:
        this.stringOrNull(stored?.HABITICA_USER_ID) ??
        this.stringOrNull(stored?.userId) ??
        "",
      apiToken:
        this.stringOrNull(stored?.HABITICA_API_TOKEN) ??
        this.stringOrNull(stored?.apiToken) ??
        "",
    };
  },

  amazingMarvinCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): AmazingMarvinCredentials {
    return {
      apiToken:
        this.stringOrNull(stored?.AMAZING_MARVIN_API_TOKEN) ??
        this.stringOrNull(stored?.apiToken) ??
        "",
      fullAccessToken:
        this.stringOrNull(stored?.AMAZING_MARVIN_FULL_ACCESS_TOKEN) ??
        this.stringOrNull(stored?.fullAccessToken) ??
        "",
    };
  },

  motionCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): MotionCredentials {
    return {
      apiKey:
        this.stringOrNull(stored?.MOTION_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
    };
  },

  reclaimAiCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): ReclaimAiCredentials {
    return {
      apiKey:
        this.stringOrNull(stored?.RECLAIM_AI_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
    };
  },

  youCanBookMeCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): YouCanBookMeCredentials {
    return {
      accountId:
        this.stringOrNull(stored?.YOUCANBOOKME_ACCOUNT_ID) ??
        this.stringOrNull(stored?.accountId) ??
        "",
      apiKey:
        this.stringOrNull(stored?.YOUCANBOOKME_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
    };
  },

  simplyBookMeCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): SimplyBookMeCredentials {
    return {
      companyLogin:
        this.stringOrNull(stored?.SIMPLYBOOK_COMPANY_LOGIN) ??
        this.stringOrNull(stored?.companyLogin) ??
        "",
      apiKey:
        this.stringOrNull(stored?.SIMPLYBOOK_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
      userLogin:
        this.stringOrNull(stored?.SIMPLYBOOK_USER_LOGIN) ??
        this.stringOrNull(stored?.userLogin) ??
        undefined,
      userApiKey:
        this.stringOrNull(stored?.SIMPLYBOOK_USER_API_KEY) ??
        this.stringOrNull(stored?.userApiKey) ??
        undefined,
    };
  },

  onceHubCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): OnceHubCredentials {
    return {
      apiKey:
        this.stringOrNull(stored?.ONCEHUB_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
    };
  },

  salesflareCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): SalesflareCredentials {
    return {
      apiKey:
        this.stringOrNull(stored?.SALESFLARE_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
    };
  },

  zendeskSellCredentials(
    this: MarketplaceConnectorExecutionService,
    accessToken: string,
  ): ZendeskSellCredentials {
    return { accessToken };
  },

  keapMaxClassicCredentials(
    this: MarketplaceConnectorExecutionService,
    accessToken: string,
  ): KeapMaxClassicCredentials {
    return { accessToken };
  },

  folkCrmCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): FolkCrmCredentials {
    return {
      apiKey:
        this.stringOrNull(stored?.FOLK_CRM_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
    };
  },

  onePageCrmCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): OnePageCrmCredentials {
    return {
      userId:
        this.stringOrNull(stored?.ONEPAGECRM_USER_ID) ??
        this.stringOrNull(stored?.userId) ??
        "",
      apiKey:
        this.stringOrNull(stored?.ONEPAGECRM_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
    };
  },

  followUpBossCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): FollowUpBossCredentials {
    return {
      apiKey:
        this.stringOrNull(stored?.FOLLOW_UP_BOSS_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
      systemName:
        this.stringOrNull(stored?.FOLLOW_UP_BOSS_X_SYSTEM) ??
        this.stringOrNull(stored?.systemName) ??
        "",
      systemKey:
        this.stringOrNull(stored?.FOLLOW_UP_BOSS_X_SYSTEM_KEY) ??
        this.stringOrNull(stored?.systemKey) ??
        "",
    };
  },

  chimeCrmCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): ChimeCrmCredentials {
    return {
      apiKey:
        this.stringOrNull(stored?.CHIME_CRM_API_KEY) ??
        this.stringOrNull(stored?.LOFTY_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
    };
  },

  reallySimpleSystemsCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): ReallySimpleSystemsCredentials {
    return {
      accessToken:
        this.stringOrNull(stored?.SPOTLER_CRM_ACCESS_TOKEN) ??
        this.stringOrNull(stored?.REALLY_SIMPLE_SYSTEMS_ACCESS_TOKEN) ??
        this.stringOrNull(stored?.accessToken) ??
        "",
    };
  },

  vtigerCrmCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): VtigerCrmCredentials {
    return {
      instance:
        this.stringOrNull(stored?.VTIGER_INSTANCE) ??
        this.stringOrNull(stored?.instance) ??
        "",
      cluster:
        this.stringOrNull(stored?.VTIGER_CLUSTER) ??
        this.stringOrNull(stored?.cluster) ??
        "",
      username:
        this.stringOrNull(stored?.VTIGER_USERNAME) ??
        this.stringOrNull(stored?.username) ??
        "",
      accessKey:
        this.stringOrNull(stored?.VTIGER_ACCESS_KEY) ??
        this.stringOrNull(stored?.accessKey) ??
        "",
    };
  },

  suiteCrmCloudCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): SuiteCrmCloudCredentials {
    return {
      host:
        this.stringOrNull(stored?.SUITECRM_CLOUD_HOST) ??
        this.stringOrNull(stored?.host) ??
        "",
      clientId:
        this.stringOrNull(stored?.SUITECRM_CLOUD_CLIENT_ID) ??
        this.stringOrNull(stored?.clientId) ??
        "",
      clientSecret:
        this.stringOrNull(stored?.SUITECRM_CLOUD_CLIENT_SECRET) ??
        this.stringOrNull(stored?.clientSecret) ??
        "",
    };
  },

  sugarCrmCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): SugarCrmCredentials {
    return {
      host:
        this.stringOrNull(stored?.SUGARCRM_HOST) ??
        this.stringOrNull(stored?.host) ??
        "",
      clientId:
        this.stringOrNull(stored?.SUGARCRM_CLIENT_ID) ??
        this.stringOrNull(stored?.clientId) ??
        "",
      clientSecret:
        this.stringOrNull(stored?.SUGARCRM_CLIENT_SECRET) ??
        this.stringOrNull(stored?.clientSecret) ??
        "",
      username:
        this.stringOrNull(stored?.SUGARCRM_USERNAME) ??
        this.stringOrNull(stored?.username) ??
        "",
      password:
        this.stringOrNull(stored?.SUGARCRM_PASSWORD) ??
        this.stringOrNull(stored?.password) ??
        "",
    };
  },

  creatioCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): CreatioCredentials {
    return {
      host:
        this.stringOrNull(stored?.CREATIO_HOST) ??
        this.stringOrNull(stored?.host) ??
        "",
      username:
        this.stringOrNull(stored?.CREATIO_USERNAME) ??
        this.stringOrNull(stored?.username) ??
        "",
      password:
        this.stringOrNull(stored?.CREATIO_PASSWORD) ??
        this.stringOrNull(stored?.password) ??
        "",
    };
  },

  attioCredentials(
    this: MarketplaceConnectorExecutionService,
    connection: MarketplaceConnectionEntity,
    accessToken: string,
  ): AttioCredentials {
    const workspaceId = this.stringOrNull(
      connection.metadata?.attioWorkspaceId,
    );
    if (!workspaceId)
      throw new ConnectorExecutionError(
        "credential_missing",
        "Attio workspace binding is missing.",
      );
    return { accessToken, workspaceId };
  },

  setmoreCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): SetmoreCredentials {
    return {
      refreshToken:
        this.stringOrNull(stored?.SETMORE_REFRESH_TOKEN) ??
        this.stringOrNull(stored?.refreshToken) ??
        "",
    };
  },

  plutioCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): PlutioCredentials {
    return {
      clientId:
        this.stringOrNull(stored?.PLUTIO_CLIENT_ID) ??
        this.stringOrNull(stored?.clientId) ??
        "",
      clientSecret:
        this.stringOrNull(stored?.PLUTIO_CLIENT_SECRET) ??
        this.stringOrNull(stored?.clientSecret) ??
        "",
      businessSubdomain:
        this.stringOrNull(stored?.PLUTIO_BUSINESS_SUBDOMAIN) ??
        this.stringOrNull(stored?.businessSubdomain) ??
        "",
    };
  },

  vagaroCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): VagaroCredentials {
    return {
      clientId:
        this.stringOrNull(stored?.VAGARO_CLIENT_ID) ??
        this.stringOrNull(stored?.clientId) ??
        "",
      clientSecret:
        this.stringOrNull(stored?.VAGARO_CLIENT_SECRET) ??
        this.stringOrNull(stored?.clientSecret) ??
        "",
      region:
        this.stringOrNull(stored?.VAGARO_REGION) ??
        this.stringOrNull(stored?.region) ??
        "",
    };
  },

  demioCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): DemioCredentials {
    return {
      apiKey:
        this.stringOrNull(stored?.DEMIO_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
      apiSecret:
        this.stringOrNull(stored?.DEMIO_API_SECRET) ??
        this.stringOrNull(stored?.apiSecret) ??
        "",
    };
  },

  bigMarkerCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): BigMarkerCredentials {
    return {
      apiKey:
        this.stringOrNull(stored?.BIGMARKER_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
    };
  },

  mindbodyCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): MindbodyCredentials {
    return {
      apiKey:
        this.stringOrNull(stored?.MINDBODY_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
      siteId:
        this.stringOrNull(stored?.MINDBODY_SITE_ID) ??
        this.stringOrNull(stored?.siteId) ??
        "",
      staffToken:
        this.stringOrNull(stored?.MINDBODY_STAFF_TOKEN) ??
        this.stringOrNull(stored?.staffToken) ??
        "",
    };
  },

  janeAppCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
    metadata: Record<string, unknown> | null | undefined,
  ): JaneAppCredentials {
    return {
      accessToken: this.stringOrNull(stored?.accessToken) ?? "",
      clinicOrigin:
        this.stringOrNull(stored?.janeClinicOrigin) ??
        this.stringOrNull(metadata?.janeClinicOrigin) ??
        "",
    };
  },

  clinikoCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): ClinikoCredentials {
    return {
      apiKey:
        this.stringOrNull(stored?.CLINIKO_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
    };
  },

  practiceBetterCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): PracticeBetterCredentials {
    return {
      clientId:
        this.stringOrNull(stored?.PRACTICE_BETTER_CLIENT_ID) ??
        this.stringOrNull(stored?.clientId) ??
        "",
      clientSecret:
        this.stringOrNull(stored?.PRACTICE_BETTER_CLIENT_SECRET) ??
        this.stringOrNull(stored?.clientSecret) ??
        "",
    };
  },

  oneSpanSignCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): OneSpanSignCredentials {
    return {
      clientId:
        this.stringOrNull(stored?.ONESPAN_SIGN_CLIENT_ID) ??
        this.stringOrNull(stored?.clientId) ??
        "",
      clientSecret:
        this.stringOrNull(stored?.ONESPAN_SIGN_CLIENT_SECRET) ??
        this.stringOrNull(stored?.clientSecret) ??
        "",
      environment:
        this.stringOrNull(stored?.ONESPAN_SIGN_ENVIRONMENT) ??
        this.stringOrNull(stored?.environment) ??
        "",
    };
  },

  getAcceptCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): GetAcceptCredentials {
    return {
      accessToken:
        this.stringOrNull(stored?.GETACCEPT_ACCESS_TOKEN) ??
        this.stringOrNull(stored?.accessToken) ??
        "",
    };
  },

  qwilrCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): QwilrCredentials {
    return {
      accessToken:
        this.stringOrNull(stored?.QWILR_ACCESS_TOKEN) ??
        this.stringOrNull(stored?.accessToken) ??
        "",
    };
  },

  proposifyCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): ProposifyCredentials {
    return {
      clientId:
        this.stringOrNull(stored?.PROPOSIFY_CLIENT_ID) ??
        this.stringOrNull(stored?.clientId) ??
        "",
      clientSecret:
        this.stringOrNull(stored?.PROPOSIFY_CLIENT_SECRET) ??
        this.stringOrNull(stored?.clientSecret) ??
        "",
    };
  },

  betterProposalsCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): BetterProposalsCredentials {
    return {
      apiToken:
        this.stringOrNull(stored?.BETTER_PROPOSALS_API_TOKEN) ??
        this.stringOrNull(stored?.apiToken) ??
        this.stringOrNull(stored?.accessToken) ??
        "",
    };
  },

  concordCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): ConcordCredentials {
    return {
      apiOrigin:
        this.stringOrNull(stored?.CONCORD_API_ORIGIN) ??
        this.stringOrNull(stored?.apiOrigin) ??
        "",
      organizationId:
        this.stringOrNull(stored?.CONCORD_ORGANIZATION_ID) ??
        this.stringOrNull(stored?.organizationId) ??
        "",
      apiKey:
        this.stringOrNull(stored?.CONCORD_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
    };
  },

  juroCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): JuroCredentials {
    return {
      apiOrigin:
        this.stringOrNull(stored?.JURO_API_ORIGIN) ??
        this.stringOrNull(stored?.apiOrigin) ??
        "",
      apiKey:
        this.stringOrNull(stored?.JURO_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
    };
  },

  ironcladCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): IroncladCredentials {
    return {
      apiOrigin:
        this.stringOrNull(stored?.IRONCLAD_API_ORIGIN) ??
        this.stringOrNull(stored?.apiOrigin) ??
        "",
      clientId:
        this.stringOrNull(stored?.IRONCLAD_CLIENT_ID) ??
        this.stringOrNull(stored?.clientId) ??
        "",
      clientSecret:
        this.stringOrNull(stored?.IRONCLAD_CLIENT_SECRET) ??
        this.stringOrNull(stored?.clientSecret) ??
        "",
      asUserId:
        this.stringOrNull(stored?.IRONCLAD_AS_USER_ID) ??
        this.stringOrNull(stored?.asUserId) ??
        "",
    };
  },

  linkSquaresCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): LinkSquaresCredentials {
    return {
      apiKey:
        this.stringOrNull(stored?.LINKSQUARES_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
    };
  },

  spotDraftCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): SpotDraftCredentials {
    return {
      clientId:
        this.stringOrNull(stored?.SPOTDRAFT_CLIENT_ID) ??
        this.stringOrNull(stored?.clientId) ??
        "",
      clientSecret:
        this.stringOrNull(stored?.SPOTDRAFT_CLIENT_SECRET) ??
        this.stringOrNull(stored?.clientSecret) ??
        "",
    };
  },

  contractbookCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): ContractbookCredentials {
    return {
      apiKey:
        this.stringOrNull(stored?.CONTRACTBOOK_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
    };
  },

  logRocketCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): LogRocketCredentials {
    return {
      apiKey:
        this.stringOrNull(stored?.LOGROCKET_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
      organizationId:
        this.stringOrNull(stored?.LOGROCKET_ORGANIZATION_ID) ??
        this.stringOrNull(stored?.organizationId) ??
        "",
      projectId:
        this.stringOrNull(stored?.LOGROCKET_PROJECT_ID) ??
        this.stringOrNull(stored?.projectId) ??
        "",
    };
  },

  smartlookCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): SmartlookCredentials {
    return {
      apiToken:
        this.stringOrNull(stored?.SMARTLOOK_API_TOKEN) ??
        this.stringOrNull(stored?.apiToken) ??
        "",
      region:
        this.stringOrNull(stored?.SMARTLOOK_REGION) ??
        this.stringOrNull(stored?.region) ??
        "",
    };
  },

  crazyEggCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): CrazyEggCredentials {
    return {
      apiKey:
        this.stringOrNull(stored?.CRAZY_EGG_SITE_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
    };
  },

  appcuesCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): AppcuesCredentials {
    return {
      apiKey:
        this.stringOrNull(stored?.APPCUES_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
      apiSecret:
        this.stringOrNull(stored?.APPCUES_API_SECRET) ??
        this.stringOrNull(stored?.apiSecret) ??
        "",
      accountId:
        this.stringOrNull(stored?.APPCUES_ACCOUNT_ID) ??
        this.stringOrNull(stored?.accountId) ??
        "",
      region:
        this.stringOrNull(stored?.APPCUES_REGION) ??
        this.stringOrNull(stored?.region) ??
        "",
    };
  },

  userflowCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): UserflowCredentials {
    return {
      apiKey:
        this.stringOrNull(stored?.USERFLOW_ENVIRONMENT_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
      region:
        this.stringOrNull(stored?.USERFLOW_REGION) ??
        this.stringOrNull(stored?.region) ??
        "",
    };
  },

  userpilotCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): UserpilotCredentials {
    return {
      apiKey:
        this.stringOrNull(stored?.USERPILOT_ENVIRONMENT_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
      apiOrigin:
        this.stringOrNull(stored?.USERPILOT_EXPORT_API_ORIGIN) ??
        this.stringOrNull(stored?.apiOrigin) ??
        "",
    };
  },

  chameleonCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): ChameleonCredentials {
    return {
      accountSecret:
        this.stringOrNull(stored?.CHAMELEON_ACCOUNT_SECRET) ??
        this.stringOrNull(stored?.accountSecret) ??
        "",
    };
  },

  vitallyCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): VitallyCredentials {
    return {
      apiKey:
        this.stringOrNull(stored?.VITALLY_REST_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
      apiOrigin:
        this.stringOrNull(stored?.VITALLY_REST_API_ORIGIN) ??
        this.stringOrNull(stored?.apiOrigin) ??
        "",
    };
  },

  gainsightCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): GainsightCredentials {
    return {
      accessKey:
        this.stringOrNull(stored?.GAINSIGHT_ACCESS_KEY) ??
        this.stringOrNull(stored?.accessKey) ??
        "",
      tenantOrigin:
        this.stringOrNull(stored?.GAINSIGHT_TENANT_ORIGIN) ??
        this.stringOrNull(stored?.tenantOrigin) ??
        "",
    };
  },

  totangoCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): TotangoCredentials {
    return {
      appToken:
        this.stringOrNull(stored?.TOTANGO_APP_TOKEN) ??
        this.stringOrNull(stored?.appToken) ??
        "",
      region:
        this.stringOrNull(stored?.TOTANGO_REGION) ??
        this.stringOrNull(stored?.region) ??
        "",
    };
  },

  custifyCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): CustifyCredentials {
    return {
      apiKey:
        this.stringOrNull(stored?.CUSTIFY_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
      apiOrigin:
        this.stringOrNull(stored?.CUSTIFY_API_ORIGIN) ??
        this.stringOrNull(stored?.apiOrigin) ??
        "",
    };
  },

  planhatCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): PlanhatCredentials {
    return {
      apiToken:
        this.stringOrNull(stored?.PLANHAT_API_TOKEN) ??
        this.stringOrNull(stored?.apiToken) ??
        "",
      apiOrigin:
        this.stringOrNull(stored?.PLANHAT_API_ORIGIN) ??
        this.stringOrNull(stored?.apiOrigin) ??
        "",
    };
  },

  clientSuccessCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): ClientSuccessCredentials {
    return {
      authorization:
        this.stringOrNull(stored?.CLIENTSUCCESS_AUTHORIZATION) ??
        this.stringOrNull(stored?.authorization) ??
        "",
    };
  },

  freshsalesCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): FreshsalesCredentials {
    return {
      apiKey:
        this.stringOrNull(stored?.FRESHSALES_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
      apiBaseUrl:
        this.stringOrNull(stored?.FRESHSALES_API_BASE_URL) ??
        this.stringOrNull(stored?.apiBaseUrl) ??
        "",
    };
  },

  insightlyCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): InsightlyCredentials {
    return {
      apiKey:
        this.stringOrNull(stored?.INSIGHTLY_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
      apiBaseUrl:
        this.stringOrNull(stored?.INSIGHTLY_API_BASE_URL) ??
        this.stringOrNull(stored?.apiBaseUrl) ??
        "",
    };
  },

  nimbleCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): NimbleCredentials {
    return {
      apiKey:
        this.stringOrNull(stored?.NIMBLE_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
    };
  },

  capsuleCrmCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): CapsuleCrmCredentials {
    return {
      accessToken:
        this.stringOrNull(stored?.CAPSULE_CRM_ACCESS_TOKEN) ??
        this.stringOrNull(stored?.accessToken) ??
        "",
    };
  },

  keapCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): KeapCredentials {
    return {
      accessToken:
        this.stringOrNull(stored?.KEAP_ACCESS_TOKEN) ??
        this.stringOrNull(stored?.accessToken) ??
        "",
    };
  },

  proofHubCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): ProofHubCredentials {
    return {
      account:
        this.stringOrNull(stored?.PROOFHUB_ACCOUNT) ??
        this.stringOrNull(stored?.account) ??
        "",
      apiKey:
        this.stringOrNull(stored?.PROOFHUB_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
    };
  },

  proofCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): ProofCredentials {
    return {
      apiKey:
        this.stringOrNull(stored?.PROOF_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
    };
  },

  termlyCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): TermlyCredentials {
    return {
      publicKey:
        this.stringOrNull(stored?.TERMLY_PUBLIC_KEY) ??
        this.stringOrNull(stored?.publicKey) ??
        "",
      privateKey:
        this.stringOrNull(stored?.TERMLY_PRIVATE_KEY) ??
        this.stringOrNull(stored?.privateKey) ??
        "",
      accountId:
        this.stringOrNull(stored?.TERMLY_ACCOUNT_ID) ??
        this.stringOrNull(stored?.accountId) ??
        "",
      websiteId:
        this.stringOrNull(stored?.TERMLY_WEBSITE_ID) ??
        this.stringOrNull(stored?.websiteId) ??
        "",
    };
  },

  cookiebotCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): CookiebotCredentials {
    return {
      apiKey:
        this.stringOrNull(stored?.COOKIEBOT_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
      domainGroupId:
        this.stringOrNull(stored?.COOKIEBOT_DOMAIN_GROUP_ID) ??
        this.stringOrNull(stored?.domainGroupId) ??
        "",
      domain:
        this.stringOrNull(stored?.COOKIEBOT_DOMAIN) ??
        this.stringOrNull(stored?.domain) ??
        "",
    };
  },

  oneTrustCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): OneTrustCredentials {
    return {
      tenantHost:
        this.stringOrNull(stored?.ONETRUST_TENANT_HOST) ??
        this.stringOrNull(stored?.tenantHost) ??
        "",
      clientId:
        this.stringOrNull(stored?.ONETRUST_CLIENT_ID) ??
        this.stringOrNull(stored?.clientId) ??
        "",
      clientSecret:
        this.stringOrNull(stored?.ONETRUST_CLIENT_SECRET) ??
        this.stringOrNull(stored?.clientSecret) ??
        "",
      domainId:
        this.stringOrNull(stored?.ONETRUST_DOMAIN_ID) ??
        this.stringOrNull(stored?.domainId) ??
        "",
      scanId:
        this.stringOrNull(stored?.ONETRUST_SCAN_ID) ??
        this.stringOrNull(stored?.scanId) ??
        "",
    };
  },

  salesforceMarketingCloudCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): SalesforceMarketingCloudCredentials {
    return {
      subdomain:
        this.stringOrNull(stored?.SALESFORCE_MARKETING_CLOUD_SUBDOMAIN) ??
        this.stringOrNull(stored?.subdomain) ??
        "",
      clientId:
        this.stringOrNull(stored?.SALESFORCE_MARKETING_CLOUD_CLIENT_ID) ??
        this.stringOrNull(stored?.clientId) ??
        "",
      clientSecret:
        this.stringOrNull(stored?.SALESFORCE_MARKETING_CLOUD_CLIENT_SECRET) ??
        this.stringOrNull(stored?.clientSecret) ??
        "",
      accountId:
        this.stringOrNull(stored?.SALESFORCE_MARKETING_CLOUD_ACCOUNT_ID) ??
        this.stringOrNull(stored?.accountId) ??
        "",
    };
  },

  salesforceCommerceCloudCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): SalesforceCommerceCloudCredentials {
    return {
      shortCode:
        this.stringOrNull(stored?.SALESFORCE_COMMERCE_CLOUD_SHORT_CODE) ??
        this.stringOrNull(stored?.shortCode) ??
        "",
      organizationId:
        this.stringOrNull(stored?.SALESFORCE_COMMERCE_CLOUD_ORGANIZATION_ID) ??
        this.stringOrNull(stored?.organizationId) ??
        "",
      siteId:
        this.stringOrNull(stored?.SALESFORCE_COMMERCE_CLOUD_SITE_ID) ??
        this.stringOrNull(stored?.siteId) ??
        "",
      clientId:
        this.stringOrNull(stored?.SALESFORCE_COMMERCE_CLOUD_CLIENT_ID) ??
        this.stringOrNull(stored?.clientId) ??
        "",
      clientSecret:
        this.stringOrNull(stored?.SALESFORCE_COMMERCE_CLOUD_CLIENT_SECRET) ??
        this.stringOrNull(stored?.clientSecret) ??
        "",
      productId:
        this.stringOrNull(stored?.SALESFORCE_COMMERCE_CLOUD_PRODUCT_ID) ??
        this.stringOrNull(stored?.productId) ??
        "",
      categoryId:
        this.stringOrNull(stored?.SALESFORCE_COMMERCE_CLOUD_CATEGORY_ID) ??
        this.stringOrNull(stored?.categoryId) ??
        "",
    };
  },

  marketoCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): MarketoCredentials {
    return {
      subscriptionId:
        this.stringOrNull(stored?.MARKETO_SUBSCRIPTION_ID) ??
        this.stringOrNull(stored?.subscriptionId) ??
        "",
      clientId:
        this.stringOrNull(stored?.MARKETO_CLIENT_ID) ??
        this.stringOrNull(stored?.clientId) ??
        "",
      clientSecret:
        this.stringOrNull(stored?.MARKETO_CLIENT_SECRET) ??
        this.stringOrNull(stored?.clientSecret) ??
        "",
      apiUser:
        this.stringOrNull(stored?.MARKETO_API_USER) ??
        this.stringOrNull(stored?.apiUser) ??
        "",
      leadId:
        this.stringOrNull(stored?.MARKETO_LEAD_ID) ??
        this.stringOrNull(stored?.leadId) ??
        "",
      programId:
        this.stringOrNull(stored?.MARKETO_PROGRAM_ID) ??
        this.stringOrNull(stored?.programId) ??
        "",
    };
  },

  pardotCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): PardotCredentials {
    return {
      environment:
        this.stringOrNull(stored?.PARDOT_ENVIRONMENT) ??
        this.stringOrNull(stored?.environment) ??
        "",
      clientId:
        this.stringOrNull(stored?.PARDOT_CLIENT_ID) ??
        this.stringOrNull(stored?.clientId) ??
        "",
      clientSecret:
        this.stringOrNull(stored?.PARDOT_CLIENT_SECRET) ??
        this.stringOrNull(stored?.clientSecret) ??
        "",
      refreshToken:
        this.stringOrNull(stored?.PARDOT_REFRESH_TOKEN) ??
        this.stringOrNull(stored?.refreshToken) ??
        "",
      businessUnitId:
        this.stringOrNull(stored?.PARDOT_BUSINESS_UNIT_ID) ??
        this.stringOrNull(stored?.businessUnitId) ??
        "",
      prospectId:
        this.stringOrNull(stored?.PARDOT_PROSPECT_ID) ??
        this.stringOrNull(stored?.prospectId) ??
        "",
      campaignId:
        this.stringOrNull(stored?.PARDOT_CAMPAIGN_ID) ??
        this.stringOrNull(stored?.campaignId) ??
        "",
    };
  },

  eloquaCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): EloquaCredentials {
    return {
      siteName:
        this.stringOrNull(stored?.ELOQUA_SITE_NAME) ??
        this.stringOrNull(stored?.siteName) ??
        "",
      clientId:
        this.stringOrNull(stored?.ELOQUA_CLIENT_ID) ??
        this.stringOrNull(stored?.clientId) ??
        "",
      clientSecret:
        this.stringOrNull(stored?.ELOQUA_CLIENT_SECRET) ??
        this.stringOrNull(stored?.clientSecret) ??
        "",
      refreshToken:
        this.stringOrNull(stored?.ELOQUA_REFRESH_TOKEN) ??
        this.stringOrNull(stored?.refreshToken) ??
        "",
      contactId:
        this.stringOrNull(stored?.ELOQUA_CONTACT_ID) ??
        this.stringOrNull(stored?.contactId) ??
        "",
      campaignId:
        this.stringOrNull(stored?.ELOQUA_CAMPAIGN_ID) ??
        this.stringOrNull(stored?.campaignId) ??
        "",
    };
  },

  mailerLiteCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): MailerLiteCredentials {
    return {
      apiToken:
        this.stringOrNull(stored?.MAILERLITE_API_TOKEN) ??
        this.stringOrNull(stored?.apiToken) ??
        "",
      subscriberId:
        this.stringOrNull(stored?.MAILERLITE_SUBSCRIBER_ID) ??
        this.stringOrNull(stored?.subscriberId) ??
        "",
      campaignId:
        this.stringOrNull(stored?.MAILERLITE_CAMPAIGN_ID) ??
        this.stringOrNull(stored?.campaignId) ??
        "",
    };
  },

  moosendCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): MoosendCredentials {
    return {
      apiKey:
        this.stringOrNull(stored?.MOOSEND_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
      mailingListId:
        this.stringOrNull(stored?.MOOSEND_MAILING_LIST_ID) ??
        this.stringOrNull(stored?.mailingListId) ??
        "",
      subscriberId:
        this.stringOrNull(stored?.MOOSEND_SUBSCRIBER_ID) ??
        this.stringOrNull(stored?.subscriberId) ??
        "",
      campaignId:
        this.stringOrNull(stored?.MOOSEND_CAMPAIGN_ID) ??
        this.stringOrNull(stored?.campaignId) ??
        "",
    };
  },

  mailercloudCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): MailercloudCredentials {
    return {
      apiKey:
        this.stringOrNull(stored?.MAILERCLOUD_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
      contactId:
        this.stringOrNull(stored?.MAILERCLOUD_CONTACT_ID) ??
        this.stringOrNull(stored?.contactId) ??
        "",
      campaignId:
        this.stringOrNull(stored?.MAILERCLOUD_CAMPAIGN_ID) ??
        this.stringOrNull(stored?.campaignId) ??
        "",
    };
  },

  benchmarkEmailCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): BenchmarkEmailCredentials {
    return {
      apiKey:
        this.stringOrNull(stored?.BENCHMARK_EMAIL_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
      apiBaseUrl:
        this.stringOrNull(stored?.BENCHMARK_EMAIL_API_BASE_URL) ??
        this.stringOrNull(stored?.apiBaseUrl) ??
        "",
      contactId:
        this.stringOrNull(stored?.BENCHMARK_EMAIL_CONTACT_ID) ??
        this.stringOrNull(stored?.contactId) ??
        "",
      campaignId:
        this.stringOrNull(stored?.BENCHMARK_EMAIL_CAMPAIGN_ID) ??
        this.stringOrNull(stored?.campaignId) ??
        "",
    };
  },

  emmaCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): EmmaCredentials {
    return {
      accountId:
        this.stringOrNull(stored?.EMMA_ACCOUNT_ID) ??
        this.stringOrNull(stored?.accountId) ??
        "",
      publicKey:
        this.stringOrNull(stored?.EMMA_PUBLIC_API_KEY) ??
        this.stringOrNull(stored?.publicKey) ??
        "",
      privateKey:
        this.stringOrNull(stored?.EMMA_PRIVATE_API_KEY) ??
        this.stringOrNull(stored?.privateKey) ??
        "",
      memberId:
        this.stringOrNull(stored?.EMMA_MEMBER_ID) ??
        this.stringOrNull(stored?.memberId) ??
        "",
      mailingId:
        this.stringOrNull(stored?.EMMA_MAILING_ID) ??
        this.stringOrNull(stored?.mailingId) ??
        "",
    };
  },

  flodeskCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): FlodeskCredentials {
    return {
      apiKey:
        this.stringOrNull(stored?.FLODESK_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
      subscriberId:
        this.stringOrNull(stored?.FLODESK_SUBSCRIBER_ID) ??
        this.stringOrNull(stored?.subscriberId) ??
        "",
      segmentId:
        this.stringOrNull(stored?.FLODESK_SEGMENT_ID) ??
        this.stringOrNull(stored?.segmentId) ??
        "",
    };
  },

  instapaperCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): InstapaperCredentials {
    const accessToken = this.stringOrNull(stored?.accessToken);
    const accessTokenSecret = this.stringOrNull(stored?.accessTokenSecret);
    const consumerKey =
      this.configService?.get<string>("INSTAPAPER_CONSUMER_KEY")?.trim() ?? "";
    const consumerSecret =
      this.configService?.get<string>("INSTAPAPER_CONSUMER_SECRET")?.trim() ??
      "";
    if (!accessToken || !accessTokenSecret || !consumerKey || !consumerSecret)
      throw new ConnectorExecutionError(
        "credential_missing",
        "Instapaper OAuth token or Relay-owned consumer credentials are missing.",
      );
    return {
      consumerKey,
      consumerSecret,
      accessToken,
      accessTokenSecret,
      instaparserApiKey:
        this.stringOrNull(stored?.instaparserApiKey) ?? undefined,
    };
  },

  discoEdiscoveryCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): DiscoEdiscoveryCredentials {
    return {
      apiKey: this.stringOrNull(stored?.DISCO_EDISCOVERY_API_KEY) ?? "",
      organizationId:
        this.stringOrNull(stored?.DISCO_EDISCOVERY_ORGANIZATION_ID) ?? "",
    };
  },
};
