import type { MarketplaceConnectorExecutionService } from "../../connector-execution.service";
import { MarketplaceConnectionEntity } from "../../../../../entities";
import { type AbTastyCredentials } from "../../ab-tasty/ab-tasty-api.adapter";
import { type ActiTimeCredentials } from "../../actitime/actitime-api.adapter";
import { type ActiveCampaignCredentials } from "../../activecampaign/activecampaign-api.adapter";
import { type AgileCrmCredentials } from "../../agile-crm/agile-crm-api.adapter";
import {
  type AlchemerCredentials,
  type AlchemerRegion,
} from "../../alchemer/alchemer-api.adapter";
import { type AmplitudeCredentials } from "../../amplitude/amplitude-api.adapter";
import { type AskNicelyCredentials } from "../../asknicely/asknicely-api.adapter";
import { type AudiomackCredentials } from "../../audiomack/audiomack-api.adapter";
import { type BandcampCredentials } from "../../bandcamp/bandcamp-api.adapter";
import { type Bitrix24Credentials } from "../../bitrix24/bitrix24-api.adapter";
import { type BrandfolderCredentials } from "../../brandfolder/brandfolder-api.adapter";
import { type BrazeCredentials } from "../../braze/braze-api.adapter";
import { type BuzzsproutCredentials } from "../../buzzsprout/buzzsprout-api.adapter";
import { type CampaignMonitorApiCredentials } from "../../campaign-monitor/campaign-monitor-api.adapter";
import { type CaptivateFmCredentials } from "../../captivate-fm/captivate-fm-api.adapter";
import { type ChorusAiCredentials } from "../../chorus-ai/chorus-ai-api.adapter";
import { type CirrusInsightCredentials } from "../../cirrus-insight/cirrus-insight-api.adapter";
import { type ClariCopilotCredentials } from "../../clari/clari-copilot-api.adapter";
import { type ClayCredentials } from "../../clay/clay-api.adapter";
import { type ClearbitCredentials } from "../../clearbit/clearbit-api.adapter";
import { type CognismCredentials } from "../../cognism/cognism-api.adapter";
import { type ConstantContactApiCredentials } from "../../constant-contact/constant-contact-api.adapter";
import { type ConvertKitApiCredentials } from "../../convertkit/convertkit-api.adapter";
import { type CustomerIoCredentials } from "../../customer-io/customer-io-api.adapter";
import { type DaminionCredentials } from "../../daminion/daminion-api.adapter";
import { type DelightedCredentials } from "../../delighted/delighted-api.adapter";
import { type DescriptCredentials } from "../../descript/descript-api.adapter";
import { type EhrFhirCredentials } from "../../ehr-fhir/ehr-fhir-api.adapter";
import { type EvabootCredentials } from "../../evaboot/evaboot-api.adapter";
import { type FilestackCredentials } from "../../filestack/filestack-api.adapter";
import { type FilloutApiCredentials } from "../../fillout/fillout-api.adapter";
import { type FlickrCredentials } from "../../flickr/flickr-api.adapter";
import { type FormstackCredentials } from "../../formstack/formstack-api.adapter";
import { type FullstoryCredentials } from "../../fullstory/fullstory-api.adapter";
import { type GravityFormsCredentials } from "../../gravity-forms/gravity-forms-api.adapter";
import { type HightailCredentials } from "../../hightail/hightail-api.adapter";
import { type HomebaseCredentials } from "../../homebase/homebase-api.adapter";
import { type HotjarCredentials } from "../../hotjar/hotjar-api.adapter";
import { type HyperproofCredentials } from "../../hyperproof/hyperproof-api.adapter";
import { type ImgixCredentials } from "../../imgix/imgix-api.adapter";
import { type InstapageCredentials } from "../../instapage/instapage-api.adapter";
import { type JiraAlignCredentials } from "../../jira-align/jira-align-api.adapter";
import {
  type JotformCredentials,
  type JotformRegion,
} from "../../jotform/jotform-api.adapter";
import { type KashFlowCredentials } from "../../kashflow/kashflow-soap.adapter";
import { type KlaviyoApiCredentials } from "../../klaviyo/klaviyo-api.adapter";
import { type KontainerCredentials } from "../../kontainer/kontainer-api.adapter";
import { type LeadfeederCredentials } from "../../leadfeeder/leadfeeder-api.adapter";
import { type LemlistCredentials } from "../../lemlist/lemlist-api.adapter";
import { type LessAnnoyingCrmCredentials } from "../../less-annoying-crm/less-annoying-crm-api.adapter";
import { type MailchimpApiCredentials } from "../../mailchimp/mailchimp-api.adapter";
import { type MailshakeCredentials } from "../../mailshake/mailshake-api.adapter";
import { type MixmaxCredentials } from "../../mixmax/mixmax-api.adapter";
import { type MixpanelCredentials } from "../../mixpanel/mixpanel-api.adapter";
import { type MyHoursCredentials } from "../../my-hours/my-hours-api.adapter";
import { type MyobCredentials } from "../../myob/myob-api.adapter";
import { type NetSuiteCredentials } from "../../netsuite/netsuite-api.adapter";
import { type NinjaFormsCredentials } from "../../ninja-forms/ninja-forms-api.adapter";
import { type NutshellCredentials } from "../../nutshell/nutshell-api.adapter";
import { type OdooCredentials } from "../../odoo/odoo-api.adapter";
import { type OntraportCredentials } from "../../ontraport/ontraport-mcp.adapter";
import {
  type PaperformCredentials,
  type PaperformRegion,
} from "../../paperform/paperform-api.adapter";
import { type PendoCredentials } from "../../pendo/pendo-api.adapter";
import { type PeopleAiCredentials } from "../../people-ai/people-ai-mcp.adapter";
import { type PhantomBusterCredentials } from "../../phantombuster/phantombuster-api.adapter";
import { type PostHogCredentials } from "../../posthog/posthog-api.adapter";
import { type QualtricsCredentials } from "../../qualtrics/qualtrics-api.adapter";
import { type QuickBooksTimeCredentials } from "../../quickbooks-time/quickbooks-time-api.adapter";
import { type RefinerCredentials } from "../../refiner/refiner-api.adapter";
import { type RepliconCredentials } from "../../replicon/replicon-api.adapter";
import { type ReplyIoCredentials } from "../../reply-io/reply-io-api.adapter";
import { type RevCredentials } from "../../rev/rev-api.adapter";
import { type RewardfulCredentials } from "../../rewardful/rewardful-api.adapter";
import { type RiversideFmCredentials } from "../../riverside-fm/riverside-fm-api.adapter";
import { type RunnCredentials } from "../../runn/runn-api.adapter";
import { type SageAccountingCredentials } from "../../sage-accounting/sage-accounting-api.adapter";
import { type SageIntacctCredentials } from "../../sage-intacct/sage-intacct-api.adapter";
import { type ScoroCredentials } from "../../scoro/scoro-api.adapter";
import { type SegmentCredentials } from "../../segment/segment-api.adapter";
import { type SentryCredentials } from "../../sentry/sentry-api.adapter";
import { type SevenShiftsCredentials } from "../../seven-shifts/seven-shifts-api.adapter";
import { type SlabCredentials } from "../../slab/slab-graphql.adapter";
import { type SmugMugCredentials } from "../../smugmug/smugmug-api.adapter";
import { type SpotioCredentials } from "../../spotio/spotio-api.adapter";
import { type StreakCredentials } from "../../streak/streak-api.adapter";
import { type SurveyMonkeyApiCredentials } from "../../surveymonkey/surveymonkey-api.adapter";
import { type TallyCredentials } from "../../tally/tally-api.adapter";
import { type TexAuCredentials } from "../../texau/texau-api.adapter";
import { type TimeDoctorCredentials } from "../../time-doctor/time-doctor-api.adapter";
import { type TlDvCredentials } from "../../tl-dv/tl-dv-api.adapter";
import { type TransistorFmCredentials } from "../../transistor-fm/transistor-fm-api.adapter";
import { type TresoritCredentials } from "../../tresorit/tresorit-s3.adapter";
import { type UnbounceCredentials } from "../../unbounce/unbounce-api.adapter";
import { type VwoCredentials } from "../../vwo/vwo-api.adapter";
import { type WidenCollectiveCredentials } from "../../widen-collective/widen-collective-api.adapter";
import { type WoodpeckerCredentials } from "../../woodpecker/woodpecker-api.adapter";
import { type WorkivaCredentials } from "../../workiva/workiva-api.adapter";
import { type WpFormsCredentials } from "../../wpforms/wpforms-api.adapter";
import { type WufooCredentials } from "../../wufoo/wufoo-api.adapter";
import { type ZohoBooksCredentials } from "../../zoho-books/zoho-books-api.adapter";
import { type ZohoDeskCredentials } from "../../zoho-desk/zoho-desk-api.adapter";
import { type ZohoExpenseCredentials } from "../../zoho-expense/zoho-expense-api.adapter";
import { type ZohoInvoiceCredentials } from "../../zoho-invoice/zoho-invoice-api.adapter";
import { type ZohoProjectsCredentials } from "../../zoho-projects/zoho-projects-api.adapter";
import { type ZoomInfoCredentials } from "../../zoominfo/zoominfo-api.adapter";
import { ConnectorExecutionError } from "../connector-execution.error";

export const CredentialsExtension4 = {
  hyperproofCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): HyperproofCredentials {
    return {
      clientId:
        this.stringOrNull(stored?.HYPERPROOF_CLIENT_ID) ??
        this.stringOrNull(stored?.clientId) ??
        "",
      clientSecret:
        this.stringOrNull(stored?.HYPERPROOF_CLIENT_SECRET) ??
        this.stringOrNull(stored?.clientSecret) ??
        "",
    };
  },

  workivaCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): WorkivaCredentials {
    return {
      region:
        this.stringOrNull(stored?.WORKIVA_REGION) ??
        this.stringOrNull(stored?.region) ??
        "",
      clientId:
        this.stringOrNull(stored?.WORKIVA_CLIENT_ID) ??
        this.stringOrNull(stored?.clientId) ??
        "",
      clientSecret:
        this.stringOrNull(stored?.WORKIVA_CLIENT_SECRET) ??
        this.stringOrNull(stored?.clientSecret) ??
        "",
    };
  },

  tresoritCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): TresoritCredentials {
    return {
      endpoint:
        this.stringOrNull(stored?.TRESORIT_S3_ENDPOINT) ??
        this.stringOrNull(stored?.endpoint) ??
        "",
      accessKeyId:
        this.stringOrNull(stored?.TRESORIT_S3_ACCESS_KEY_ID) ??
        this.stringOrNull(stored?.accessKeyId) ??
        "",
      secretAccessKey:
        this.stringOrNull(stored?.TRESORIT_S3_SECRET_ACCESS_KEY) ??
        this.stringOrNull(stored?.secretAccessKey) ??
        "",
    };
  },

  hightailCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): HightailCredentials {
    return {
      apiToken:
        this.stringOrNull(stored?.HIGHTAIL_API_TOKEN) ??
        this.stringOrNull(stored?.apiToken) ??
        "",
      senderEmail:
        this.stringOrNull(stored?.HIGHTAIL_SENDER_EMAIL) ??
        this.stringOrNull(stored?.senderEmail) ??
        "",
    };
  },

  filestackCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): FilestackCredentials {
    return {
      apiKey:
        this.stringOrNull(stored?.FILESTACK_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
      appSecret:
        this.stringOrNull(stored?.FILESTACK_APP_SECRET) ??
        this.stringOrNull(stored?.appSecret) ??
        "",
    };
  },

  imgixCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): ImgixCredentials {
    return {
      apiKey:
        this.stringOrNull(stored?.IMGIX_MANAGEMENT_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
    };
  },

  brandfolderCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): BrandfolderCredentials {
    return {
      apiKey:
        this.stringOrNull(stored?.BRANDFOLDER_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
    };
  },

  widenCollectiveCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): WidenCollectiveCredentials {
    return {
      collective:
        this.stringOrNull(stored?.WIDEN_COLLECTIVE_SUBDOMAIN) ??
        this.stringOrNull(stored?.collective) ??
        "",
      accessToken:
        this.stringOrNull(stored?.WIDEN_COLLECTIVE_ACCESS_TOKEN) ??
        this.stringOrNull(stored?.accessToken) ??
        "",
    };
  },

  kontainerCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): KontainerCredentials {
    return {
      tenant:
        this.stringOrNull(stored?.KONTAINER_TENANT) ??
        this.stringOrNull(stored?.tenant) ??
        "",
      accessToken:
        this.stringOrNull(stored?.KONTAINER_ACCESS_TOKEN) ??
        this.stringOrNull(stored?.accessToken) ??
        "",
    };
  },

  jiraAlignCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): JiraAlignCredentials {
    return {
      siteUrl:
        this.stringOrNull(stored?.JIRA_ALIGN_SITE_URL) ??
        this.stringOrNull(stored?.siteUrl) ??
        "",
      email:
        this.stringOrNull(stored?.JIRA_ALIGN_EMAIL) ??
        this.stringOrNull(stored?.email) ??
        "",
      apiToken:
        this.stringOrNull(stored?.JIRA_ALIGN_API_TOKEN) ??
        this.stringOrNull(stored?.apiToken) ??
        "",
    };
  },

  daminionCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): DaminionCredentials {
    return {
      tenant:
        this.stringOrNull(stored?.DAMINION_TENANT) ??
        this.stringOrNull(stored?.tenant) ??
        "",
      username:
        this.stringOrNull(stored?.DAMINION_USERNAME) ??
        this.stringOrNull(stored?.username) ??
        "",
      password:
        this.stringOrNull(stored?.DAMINION_PASSWORD) ??
        this.stringOrNull(stored?.password) ??
        "",
    };
  },

  descriptCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): DescriptCredentials {
    return {
      apiToken:
        this.stringOrNull(stored?.DESCRIPT_API_TOKEN) ??
        this.stringOrNull(stored?.apiToken) ??
        "",
    };
  },

  revCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): RevCredentials {
    return {
      clientApiKey:
        this.stringOrNull(stored?.REV_CLIENT_API_KEY) ??
        this.stringOrNull(stored?.clientApiKey) ??
        "",
      userApiKey:
        this.stringOrNull(stored?.REV_USER_API_KEY) ??
        this.stringOrNull(stored?.userApiKey) ??
        "",
    };
  },

  buzzsproutCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
    metadata: Record<string, unknown> | null | undefined,
  ): BuzzsproutCredentials {
    return {
      apiToken:
        this.stringOrNull(stored?.BUZZSPROUT_API_TOKEN) ??
        this.stringOrNull(stored?.apiToken) ??
        "",
      podcastId:
        this.stringOrNull(metadata?.BUZZSPROUT_PODCAST_ID) ??
        this.stringOrNull(metadata?.buzzsproutPodcastId) ??
        this.stringOrNull(stored?.BUZZSPROUT_PODCAST_ID) ??
        "",
    };
  },

  captivateFmCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
    metadata: Record<string, unknown> | null | undefined,
  ): CaptivateFmCredentials {
    return {
      apiKey:
        this.stringOrNull(stored?.CAPTIVATE_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
      userId:
        this.stringOrNull(metadata?.CAPTIVATE_USER_ID) ??
        this.stringOrNull(metadata?.captivateUserId) ??
        this.stringOrNull(stored?.CAPTIVATE_USER_ID) ??
        "",
      showId:
        this.stringOrNull(metadata?.CAPTIVATE_SHOW_ID) ??
        this.stringOrNull(metadata?.captivateShowId) ??
        this.stringOrNull(stored?.CAPTIVATE_SHOW_ID) ??
        "",
    };
  },

  transistorFmCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
    metadata: Record<string, unknown> | null | undefined,
  ): TransistorFmCredentials {
    return {
      apiKey:
        this.stringOrNull(stored?.TRANSISTOR_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
      showId:
        this.stringOrNull(metadata?.TRANSISTOR_SHOW_ID) ??
        this.stringOrNull(metadata?.transistorShowId) ??
        this.stringOrNull(stored?.TRANSISTOR_SHOW_ID) ??
        "",
    };
  },

  riversideFmCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): RiversideFmCredentials {
    return {
      apiKey:
        this.stringOrNull(stored?.RIVERSIDE_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
    };
  },

  tlDvCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): TlDvCredentials {
    return {
      apiKey:
        this.stringOrNull(stored?.TL_DV_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
    };
  },

  slabCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): SlabCredentials {
    return {
      apiToken:
        this.stringOrNull(stored?.SLAB_API_TOKEN) ??
        this.stringOrNull(stored?.apiToken) ??
        "",
    };
  },

  ehrFhirCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): EhrFhirCredentials {
    return {
      fhirBaseUrl: this.requiredCredential(stored, "EHR_FHIR_BASE_URL"),
      accessToken: this.requiredCredential(stored, "EHR_FHIR_ACCESS_TOKEN"),
    };
  },

  homebaseCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): HomebaseCredentials {
    return {
      apiKey:
        this.stringOrNull(stored?.HOMEBASE_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
    };
  },

  sevenShiftsCredentials(
    this: MarketplaceConnectorExecutionService,
    connection: MarketplaceConnectionEntity,
    accessToken: string,
  ): SevenShiftsCredentials {
    return {
      accessToken,
      companyGuid: this.requiredString(
        connection.metadata?.sevenShiftsCompanyGuid,
        "7shifts company GUID",
      ),
      companyId: this.requiredString(
        connection.metadata?.sevenShiftsCompanyId,
        "7shifts company ID",
      ),
    };
  },

  runnCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): RunnCredentials {
    const apiToken =
      this.stringOrNull(stored?.RUNN_API_TOKEN) ??
      this.stringOrNull(stored?.apiToken) ??
      "";
    const rawOrigin =
      this.stringOrNull(stored?.RUNN_API_ORIGIN) ??
      this.stringOrNull(stored?.apiOrigin) ??
      "";
    const originAliases: Record<string, RunnCredentials["apiOrigin"]> = {
      eu: "https://api.runn.io",
      europe: "https://api.runn.io",
      "https://api.runn.io": "https://api.runn.io",
      us: "https://api.us.runn.io",
      "united states": "https://api.us.runn.io",
      "https://api.us.runn.io": "https://api.us.runn.io",
    };
    return {
      apiToken,
      apiOrigin:
        originAliases[rawOrigin.trim().toLowerCase()] ??
        (rawOrigin as RunnCredentials["apiOrigin"]),
    };
  },

  smugMugCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): SmugMugCredentials {
    return {
      consumerKey:
        this.stringOrNull(stored?.consumerKey) ??
        this.stringOrNull(stored?.clientId) ??
        "",
      consumerSecret:
        this.stringOrNull(stored?.consumerSecret) ??
        this.stringOrNull(stored?.clientSecret) ??
        "",
      accessToken: this.stringOrNull(stored?.accessToken) ?? "",
      accessTokenSecret: this.stringOrNull(stored?.accessTokenSecret) ?? "",
    };
  },

  flickrCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): FlickrCredentials {
    return {
      consumerKey:
        this.stringOrNull(stored?.consumerKey) ??
        this.stringOrNull(stored?.clientId) ??
        "",
      consumerSecret:
        this.stringOrNull(stored?.consumerSecret) ??
        this.stringOrNull(stored?.clientSecret) ??
        "",
      accessToken: this.stringOrNull(stored?.accessToken) ?? "",
      accessTokenSecret: this.stringOrNull(stored?.accessTokenSecret) ?? "",
    };
  },

  bandcampCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): BandcampCredentials {
    return {
      clientId:
        this.stringOrNull(stored?.BANDCAMP_CLIENT_ID) ??
        this.stringOrNull(stored?.clientId) ??
        "",
      clientSecret:
        this.stringOrNull(stored?.BANDCAMP_CLIENT_SECRET) ??
        this.stringOrNull(stored?.clientSecret) ??
        "",
      refreshToken:
        this.stringOrNull(stored?.BANDCAMP_REFRESH_TOKEN) ??
        this.stringOrNull(stored?.refreshToken) ??
        "",
    };
  },

  audiomackCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): AudiomackCredentials {
    return {
      consumerKey:
        this.stringOrNull(stored?.consumerKey) ??
        this.stringOrNull(stored?.clientId) ??
        "",
      consumerSecret:
        this.stringOrNull(stored?.consumerSecret) ??
        this.stringOrNull(stored?.clientSecret) ??
        "",
      accessToken: this.stringOrNull(stored?.accessToken) ?? "",
      accessTokenSecret: this.stringOrNull(stored?.accessTokenSecret) ?? "",
    };
  },

  timeDoctorCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): TimeDoctorCredentials {
    return {
      jwtToken:
        this.stringOrNull(stored?.TIME_DOCTOR_JWT_TOKEN) ??
        this.stringOrNull(stored?.jwtToken) ??
        this.stringOrNull(stored?.apiToken) ??
        "",
    };
  },

  quickBooksTimeCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): QuickBooksTimeCredentials {
    return {
      accessToken:
        this.stringOrNull(stored?.QUICKBOOKS_TIME_ACCESS_TOKEN) ??
        this.stringOrNull(stored?.accessToken) ??
        this.stringOrNull(stored?.apiToken) ??
        "",
    };
  },

  repliconCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): RepliconCredentials {
    return {
      companyKey:
        this.stringOrNull(stored?.REPLICON_COMPANY_KEY) ??
        this.stringOrNull(stored?.companyKey) ??
        "",
      accessToken:
        this.stringOrNull(stored?.REPLICON_ACCESS_TOKEN) ??
        this.stringOrNull(stored?.accessToken) ??
        this.stringOrNull(stored?.apiToken) ??
        "",
    };
  },

  actiTimeCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): ActiTimeCredentials {
    return {
      installationUrl:
        this.stringOrNull(stored?.ACTITIME_INSTALLATION_URL) ??
        this.stringOrNull(stored?.installationUrl) ??
        "",
      username:
        this.stringOrNull(stored?.ACTITIME_USERNAME) ??
        this.stringOrNull(stored?.username) ??
        "",
      password:
        this.stringOrNull(stored?.ACTITIME_PASSWORD) ??
        this.stringOrNull(stored?.password) ??
        "",
    };
  },

  ontraportCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): OntraportCredentials {
    return {
      appId:
        this.stringOrNull(stored?.ONTRAPORT_APP_ID) ??
        this.stringOrNull(stored?.appId) ??
        "",
      apiKey:
        this.stringOrNull(stored?.ONTRAPORT_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
    };
  },

  bitrix24Credentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): Bitrix24Credentials {
    return {
      webhookUrl:
        this.stringOrNull(stored?.BITRIX24_WEBHOOK_URL) ??
        this.stringOrNull(stored?.webhookUrl) ??
        "",
    };
  },

  agileCrmCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): AgileCrmCredentials {
    return {
      domain:
        this.stringOrNull(stored?.AGILE_CRM_DOMAIN) ??
        this.stringOrNull(stored?.domain) ??
        "",
      email:
        this.stringOrNull(stored?.AGILE_CRM_EMAIL) ??
        this.stringOrNull(stored?.email) ??
        "",
      apiKey:
        this.stringOrNull(stored?.AGILE_CRM_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
    };
  },

  streakCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): StreakCredentials {
    return {
      apiKey:
        this.stringOrNull(stored?.STREAK_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
    };
  },

  lessAnnoyingCrmCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): LessAnnoyingCrmCredentials {
    return {
      apiKey:
        this.stringOrNull(stored?.LESS_ANNOYING_CRM_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
    };
  },

  nutshellCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): NutshellCredentials {
    return {
      email:
        this.stringOrNull(stored?.NUTSHELL_EMAIL) ??
        this.stringOrNull(stored?.email) ??
        "",
      apiKey:
        this.stringOrNull(stored?.NUTSHELL_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
    };
  },

  scoroCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): ScoroCredentials {
    return {
      site:
        this.stringOrNull(stored?.SCORO_SITE) ??
        this.stringOrNull(stored?.site) ??
        "",
      companyAccountId:
        this.stringOrNull(stored?.SCORO_COMPANY_ACCOUNT_ID) ??
        this.stringOrNull(stored?.companyAccountId) ??
        "",
      apiKey:
        this.stringOrNull(stored?.SCORO_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
    };
  },

  odooCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): OdooCredentials {
    return {
      database:
        this.stringOrNull(stored?.ODOO_DATABASE) ??
        this.stringOrNull(stored?.database) ??
        "",
      apiKey:
        this.stringOrNull(stored?.ODOO_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
    };
  },

  netSuiteCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): NetSuiteCredentials {
    return {
      accountId:
        this.stringOrNull(stored?.NETSUITE_ACCOUNT_ID) ??
        this.stringOrNull(stored?.accountId) ??
        "",
      suiteTalkOrigin:
        this.stringOrNull(stored?.NETSUITE_SUITETALK_ORIGIN) ??
        this.stringOrNull(stored?.suiteTalkOrigin) ??
        "",
      consumerKey:
        this.stringOrNull(stored?.NETSUITE_CONSUMER_KEY) ??
        this.stringOrNull(stored?.consumerKey) ??
        "",
      consumerSecret:
        this.stringOrNull(stored?.NETSUITE_CONSUMER_SECRET) ??
        this.stringOrNull(stored?.consumerSecret) ??
        "",
      tokenId:
        this.stringOrNull(stored?.NETSUITE_TOKEN_ID) ??
        this.stringOrNull(stored?.tokenId) ??
        "",
      tokenSecret:
        this.stringOrNull(stored?.NETSUITE_TOKEN_SECRET) ??
        this.stringOrNull(stored?.tokenSecret) ??
        "",
    };
  },

  sageAccountingCredentials(
    this: MarketplaceConnectorExecutionService,
    connection: MarketplaceConnectionEntity,
    stored: Record<string, unknown> | null | undefined,
    accessToken: string,
  ): SageAccountingCredentials {
    const businessId = this.stringOrNull(
      connection.metadata?.sageAccountingBusinessId,
    );
    const subscriptionKey =
      this.stringOrNull(stored?.sageAccountingSubscriptionKey) ??
      this.stringOrNull(stored?.SAGE_ACCOUNTING_SUBSCRIPTION_KEY);
    if (!businessId || !subscriptionKey)
      throw new ConnectorExecutionError(
        "credential_missing",
        "Sage Accounting business or subscription binding is missing.",
      );
    return { accessToken, businessId, subscriptionKey };
  },

  sageIntacctCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): SageIntacctCredentials {
    return {
      clientId:
        this.stringOrNull(stored?.SAGE_INTACCT_CLIENT_ID) ??
        this.stringOrNull(stored?.clientId) ??
        "",
      clientSecret:
        this.stringOrNull(stored?.SAGE_INTACCT_CLIENT_SECRET) ??
        this.stringOrNull(stored?.clientSecret) ??
        "",
      username:
        this.stringOrNull(stored?.SAGE_INTACCT_USERNAME) ??
        this.stringOrNull(stored?.username) ??
        "",
    };
  },

  myobCredentials(
    this: MarketplaceConnectorExecutionService,
    connection: MarketplaceConnectionEntity,
    stored: Record<string, unknown> | null | undefined,
    accessToken: string,
  ): MyobCredentials {
    const clientId =
      this.stringOrNull(stored?.clientId) ??
      this.stringOrNull(stored?.MYOB_CLIENT_ID);
    const companyFileId = this.stringOrNull(
      connection.metadata?.myobCompanyFileId,
    );
    const companyFileToken =
      this.stringOrNull(stored?.myobCompanyFileToken) ??
      this.stringOrNull(stored?.MYOB_COMPANY_FILE_TOKEN);
    if (!clientId || !companyFileId || !companyFileToken)
      throw new ConnectorExecutionError(
        "credential_missing",
        "MYOB API key or company-file binding is missing.",
      );
    return { accessToken, clientId, companyFileId, companyFileToken };
  },

  kashFlowCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): KashFlowCredentials {
    return {
      username:
        this.stringOrNull(stored?.KASHFLOW_USERNAME) ??
        this.stringOrNull(stored?.username) ??
        "",
      apiPassword:
        this.stringOrNull(stored?.KASHFLOW_API_PASSWORD) ??
        this.stringOrNull(stored?.apiPassword) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
    };
  },

  zohoBooksCredentials(
    this: MarketplaceConnectorExecutionService,
    connection: MarketplaceConnectionEntity,
    accessToken: string,
  ): ZohoBooksCredentials {
    const apiOrigin = this.stringOrNull(
      connection.metadata?.zohoBooksApiOrigin,
    );
    const organizationId = this.stringOrNull(
      connection.metadata?.zohoBooksOrganizationId,
    );
    if (!apiOrigin || !organizationId)
      throw new ConnectorExecutionError(
        "credential_missing",
        "Zoho Books regional API or organization binding is missing.",
      );
    return { accessToken, apiOrigin, organizationId };
  },

  zohoInvoiceCredentials(
    this: MarketplaceConnectorExecutionService,
    connection: MarketplaceConnectionEntity,
    accessToken: string,
  ): ZohoInvoiceCredentials {
    const apiOrigin = this.stringOrNull(
      connection.metadata?.zohoInvoiceApiOrigin,
    );
    const organizationId = this.stringOrNull(
      connection.metadata?.zohoInvoiceOrganizationId,
    );
    if (!apiOrigin || !organizationId)
      throw new ConnectorExecutionError(
        "credential_missing",
        "Zoho Invoice regional API or organization binding is missing.",
      );
    return { accessToken, apiOrigin, organizationId };
  },

  zohoExpenseCredentials(
    this: MarketplaceConnectorExecutionService,
    connection: MarketplaceConnectionEntity,
    accessToken: string,
  ): ZohoExpenseCredentials {
    const apiOrigin = this.stringOrNull(
      connection.metadata?.zohoExpenseApiOrigin,
    );
    const organizationId = this.stringOrNull(
      connection.metadata?.zohoExpenseOrganizationId,
    );
    if (!apiOrigin || !organizationId)
      throw new ConnectorExecutionError(
        "credential_missing",
        "Zoho Expense regional API or organization binding is missing.",
      );
    return { accessToken, apiOrigin, organizationId };
  },

  zohoDeskCredentials(
    this: MarketplaceConnectorExecutionService,
    connection: MarketplaceConnectionEntity,
    accessToken: string,
  ): ZohoDeskCredentials {
    const apiOrigin = this.stringOrNull(connection.metadata?.zohoDeskApiOrigin);
    const organizationId = this.stringOrNull(
      connection.metadata?.zohoDeskOrganizationId,
    );
    if (!apiOrigin || !organizationId)
      throw new ConnectorExecutionError(
        "credential_missing",
        "Zoho Desk regional API or organization binding is missing.",
      );
    return { accessToken, apiOrigin, organizationId };
  },

  zohoProjectsCredentials(
    this: MarketplaceConnectorExecutionService,
    connection: MarketplaceConnectionEntity,
    accessToken: string,
  ): ZohoProjectsCredentials {
    const apiOrigin = this.stringOrNull(
      connection.metadata?.zohoProjectsApiOrigin,
    );
    const portalId = this.stringOrNull(
      connection.metadata?.zohoProjectsPortalId,
    );
    if (!apiOrigin || !portalId)
      throw new ConnectorExecutionError(
        "credential_missing",
        "Zoho Projects regional API or portal binding is missing.",
      );
    return { accessToken, apiOrigin, portalId };
  },

  clayCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): ClayCredentials {
    return {
      apiKey:
        this.stringOrNull(stored?.CLAY_PUBLIC_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
    };
  },

  claygentCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): ClayCredentials {
    return {
      apiKey:
        this.stringOrNull(stored?.CLAYGENT_PUBLIC_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
    };
  },

  phantomBusterCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): PhantomBusterCredentials {
    return {
      apiKey: this.stringOrNull(stored?.PHANTOMBUSTER_API_KEY) ?? "",
      agentId: this.stringOrNull(stored?.PHANTOMBUSTER_AGENT_ID) ?? "",
    };
  },

  texAuCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): TexAuCredentials {
    return { apiKey: this.stringOrNull(stored?.TEXAU_API_KEY) ?? "" };
  },

  evabootCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): EvabootCredentials {
    return { apiToken: this.stringOrNull(stored?.EVABOOT_API_TOKEN) ?? "" };
  },

  lemlistCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): LemlistCredentials {
    return {
      apiKey: this.stringOrNull(stored?.LEMLIST_API_KEY) ?? "",
      campaignId: this.stringOrNull(stored?.LEMLIST_CAMPAIGN_ID) ?? "",
    };
  },

  mailshakeCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): MailshakeCredentials {
    return {
      apiKey: this.stringOrNull(stored?.MAILSHAKE_API_KEY) ?? "",
      campaignId: this.stringOrNull(stored?.MAILSHAKE_CAMPAIGN_ID) ?? "",
    };
  },

  woodpeckerCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): WoodpeckerCredentials {
    return {
      apiKey: this.stringOrNull(stored?.WOODPECKER_API_KEY) ?? "",
      campaignId: this.stringOrNull(stored?.WOODPECKER_CAMPAIGN_ID) ?? "",
    };
  },

  replyIoCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): ReplyIoCredentials {
    return {
      apiKey: this.stringOrNull(stored?.REPLY_IO_API_KEY) ?? "",
      sequenceId: this.stringOrNull(stored?.REPLY_IO_SEQUENCE_ID) ?? "",
    };
  },

  mixmaxCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): MixmaxCredentials {
    return {
      apiToken: this.stringOrNull(stored?.MIXMAX_API_TOKEN) ?? "",
      sequenceId: this.stringOrNull(stored?.MIXMAX_SEQUENCE_ID) ?? "",
    };
  },

  cirrusInsightCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): CirrusInsightCredentials {
    return {
      organizationId:
        this.stringOrNull(stored?.CIRRUS_INSIGHT_ORGANIZATION_ID) ?? "",
      userEmail: this.stringOrNull(stored?.CIRRUS_INSIGHT_USER_EMAIL) ?? "",
    };
  },

  spotioCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): SpotioCredentials {
    return {
      clientId: this.stringOrNull(stored?.SPOTIO_CLIENT_ID) ?? "",
      clientSecret: this.stringOrNull(stored?.SPOTIO_CLIENT_SECRET) ?? "",
      dataObjectId: this.stringOrNull(stored?.SPOTIO_DATA_OBJECT_ID) ?? "",
    };
  },

  myHoursCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): MyHoursCredentials {
    return {
      apiKey:
        this.stringOrNull(stored?.MY_HOURS_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        this.stringOrNull(stored?.apiToken) ??
        "",
    };
  },

  paperformCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): PaperformCredentials {
    const rawRegion = (
      this.stringOrNull(stored?.PAPERFORM_API_REGION) ??
      this.stringOrNull(stored?.region) ??
      ""
    ).toLowerCase();
    const regionAliases: Record<string, PaperformRegion> = {
      us: "us",
      usa: "us",
      default: "us",
      au: "au",
      australia: "au",
      eu: "eu",
      europe: "eu",
    };
    const region = regionAliases[rawRegion];
    if (!region)
      throw new ConnectorExecutionError(
        "provider_validation_error",
        "Paperform account region must be US, AU, or EU.",
      );
    return {
      apiKey:
        this.stringOrNull(stored?.PAPERFORM_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        this.stringOrNull(stored?.apiToken) ??
        "",
      region,
    };
  },

  jotformCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): JotformCredentials {
    const rawRegion = (
      this.stringOrNull(stored?.JOTFORM_API_REGION) ??
      this.stringOrNull(stored?.region) ??
      ""
    ).toLowerCase();
    const regionAliases: Record<string, JotformRegion> = {
      standard: "standard",
      default: "standard",
      us: "standard",
      eu: "eu",
      europe: "eu",
      hipaa: "hipaa",
    };
    const region = regionAliases[rawRegion];
    if (!region)
      throw new ConnectorExecutionError(
        "provider_validation_error",
        "Jotform API region must be Standard, EU, or HIPAA.",
      );
    return {
      apiKey:
        this.stringOrNull(stored?.JOTFORM_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
      region,
    };
  },

  formstackCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): FormstackCredentials {
    return {
      personalAccessToken:
        this.stringOrNull(stored?.FORMSTACK_PERSONAL_ACCESS_TOKEN) ??
        this.stringOrNull(stored?.personalAccessToken) ??
        this.stringOrNull(stored?.accessToken) ??
        "",
    };
  },

  wufooCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): WufooCredentials {
    return {
      apiKey:
        this.stringOrNull(stored?.WUFOO_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        this.stringOrNull(stored?.apiToken) ??
        "",
      subdomain:
        this.stringOrNull(stored?.WUFOO_SUBDOMAIN) ??
        this.stringOrNull(stored?.subdomain) ??
        "",
    };
  },

  surveyMonkeyCredentials(
    this: MarketplaceConnectorExecutionService,
    connection: MarketplaceConnectionEntity,
    accessToken: string,
  ): SurveyMonkeyApiCredentials {
    const accessUrl = this.stringOrNull(
      connection.metadata?.surveyMonkeyAccessUrl,
    );
    const userId = this.stringOrNull(connection.metadata?.surveyMonkeyUserId);
    if (!accessUrl || !userId)
      throw new ConnectorExecutionError(
        "credential_missing",
        "SurveyMonkey regional origin or user binding is missing.",
      );
    return { accessToken, accessUrl, userId };
  },

  filloutCredentials(
    this: MarketplaceConnectorExecutionService,
    connection: MarketplaceConnectionEntity,
    accessToken: string,
  ): FilloutApiCredentials {
    const baseUrl = this.stringOrNull(connection.metadata?.filloutBaseUrl);
    if (!baseUrl)
      throw new ConnectorExecutionError(
        "credential_missing",
        "Fillout provider-returned API base URL binding is missing.",
      );
    return { accessToken, baseUrl };
  },

  tallyCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): TallyCredentials {
    return {
      apiKey:
        this.stringOrNull(stored?.TALLY_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
    };
  },

  gravityFormsCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): GravityFormsCredentials {
    return {
      siteUrl:
        this.stringOrNull(stored?.GRAVITY_FORMS_SITE_URL) ??
        this.stringOrNull(stored?.siteUrl) ??
        "",
      consumerKey:
        this.stringOrNull(stored?.GRAVITY_FORMS_CONSUMER_KEY) ??
        this.stringOrNull(stored?.consumerKey) ??
        "",
      consumerSecret:
        this.stringOrNull(stored?.GRAVITY_FORMS_CONSUMER_SECRET) ??
        this.stringOrNull(stored?.consumerSecret) ??
        "",
    };
  },

  mailchimpCredentials(
    this: MarketplaceConnectorExecutionService,
    connection: MarketplaceConnectionEntity,
    accessToken: string,
  ): MailchimpApiCredentials {
    const apiOrigin = this.stringOrNull(
      connection.metadata?.mailchimpApiOrigin,
    );
    const accountId = this.stringOrNull(
      connection.metadata?.mailchimpAccountId,
    );
    if (!apiOrigin || !accountId)
      throw new ConnectorExecutionError(
        "credential_missing",
        "Mailchimp metadata-derived data center or exact account binding is missing.",
      );
    return { accessToken, apiOrigin, accountId };
  },

  klaviyoCredentials(
    this: MarketplaceConnectorExecutionService,
    connection: MarketplaceConnectionEntity,
    accessToken: string,
  ): KlaviyoApiCredentials {
    const accountId = this.stringOrNull(connection.metadata?.klaviyoAccountId);
    if (!accountId)
      throw new ConnectorExecutionError(
        "credential_missing",
        "Klaviyo exact Account binding is missing.",
      );
    return { accessToken, accountId };
  },

  convertKitCredentials(
    this: MarketplaceConnectorExecutionService,
    connection: MarketplaceConnectionEntity,
    accessToken: string,
  ): ConvertKitApiCredentials {
    const accountId = this.stringOrNull(
      connection.metadata?.convertKitAccountId,
    );
    if (!accountId)
      throw new ConnectorExecutionError(
        "credential_missing",
        "Kit exact account binding is missing.",
      );
    return { accessToken, accountId };
  },

  campaignMonitorCredentials(
    this: MarketplaceConnectorExecutionService,
    connection: MarketplaceConnectionEntity,
    accessToken: string,
  ): CampaignMonitorApiCredentials {
    const clientId = this.stringOrNull(
      connection.metadata?.campaignMonitorClientId,
    );
    if (!clientId)
      throw new ConnectorExecutionError(
        "credential_missing",
        "Campaign Monitor exact Client binding is missing.",
      );
    return { accessToken, clientId };
  },

  constantContactCredentials(
    this: MarketplaceConnectorExecutionService,
    connection: MarketplaceConnectionEntity,
    accessToken: string,
  ): ConstantContactApiCredentials {
    const accountId = this.stringOrNull(
      connection.metadata?.constantContactAccountId,
    );
    if (!accountId)
      throw new ConnectorExecutionError(
        "credential_missing",
        "Constant Contact exact Account binding is missing.",
      );
    return { accessToken, accountId };
  },

  activeCampaignCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): ActiveCampaignCredentials {
    return {
      apiUrl:
        this.stringOrNull(stored?.ACTIVECAMPAIGN_API_URL) ??
        this.stringOrNull(stored?.apiUrl) ??
        "",
      apiToken:
        this.stringOrNull(stored?.ACTIVECAMPAIGN_API_TOKEN) ??
        this.stringOrNull(stored?.apiToken) ??
        "",
    };
  },

  ninjaFormsCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): NinjaFormsCredentials {
    return {
      siteUrl:
        this.stringOrNull(stored?.NINJA_FORMS_SITE_URL) ??
        this.stringOrNull(stored?.siteUrl) ??
        "",
      username:
        this.stringOrNull(stored?.NINJA_FORMS_USERNAME) ??
        this.stringOrNull(stored?.username) ??
        "",
      applicationPassword:
        this.stringOrNull(stored?.NINJA_FORMS_APPLICATION_PASSWORD) ??
        this.stringOrNull(stored?.applicationPassword) ??
        "",
    };
  },

  customerIoCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): CustomerIoCredentials {
    return {
      apiOrigin:
        this.stringOrNull(stored?.CUSTOMER_IO_APP_API_ORIGIN) ??
        this.stringOrNull(stored?.apiOrigin) ??
        "",
      workspaceId:
        this.stringOrNull(stored?.CUSTOMER_IO_WORKSPACE_ID) ??
        this.stringOrNull(stored?.workspaceId) ??
        "",
      appApiKey:
        this.stringOrNull(stored?.CUSTOMER_IO_APP_API_KEY) ??
        this.stringOrNull(stored?.appApiKey) ??
        "",
    };
  },

  wpFormsCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): WpFormsCredentials {
    return {
      siteUrl:
        this.stringOrNull(stored?.WPFORMS_SITE_URL) ??
        this.stringOrNull(stored?.siteUrl) ??
        "",
      username:
        this.stringOrNull(stored?.WPFORMS_USERNAME) ??
        this.stringOrNull(stored?.username) ??
        "",
      applicationPassword:
        this.stringOrNull(stored?.WPFORMS_APPLICATION_PASSWORD) ??
        this.stringOrNull(stored?.applicationPassword) ??
        "",
    };
  },

  brazeCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): BrazeCredentials {
    return {
      restEndpoint:
        this.stringOrNull(stored?.BRAZE_REST_ENDPOINT) ??
        this.stringOrNull(stored?.restEndpoint) ??
        "",
      restApiKey:
        this.stringOrNull(stored?.BRAZE_REST_API_KEY) ??
        this.stringOrNull(stored?.restApiKey) ??
        "",
    };
  },

  segmentCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): SegmentCredentials {
    return {
      apiOrigin:
        this.stringOrNull(stored?.SEGMENT_PUBLIC_API_ORIGIN) ??
        this.stringOrNull(stored?.apiOrigin) ??
        "",
      workspaceId:
        this.stringOrNull(stored?.SEGMENT_WORKSPACE_ID) ??
        this.stringOrNull(stored?.workspaceId) ??
        "",
      publicApiToken:
        this.stringOrNull(stored?.SEGMENT_PUBLIC_API_TOKEN) ??
        this.stringOrNull(stored?.publicApiToken) ??
        "",
    };
  },

  mixpanelCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): MixpanelCredentials {
    return {
      apiOrigin:
        this.stringOrNull(stored?.MIXPANEL_API_ORIGIN) ??
        this.stringOrNull(stored?.apiOrigin) ??
        "",
      projectId:
        this.stringOrNull(stored?.MIXPANEL_PROJECT_ID) ??
        this.stringOrNull(stored?.projectId) ??
        "",
      serviceAccountUsername:
        this.stringOrNull(stored?.MIXPANEL_SERVICE_ACCOUNT_USERNAME) ??
        this.stringOrNull(stored?.serviceAccountUsername) ??
        "",
      serviceAccountSecret:
        this.stringOrNull(stored?.MIXPANEL_SERVICE_ACCOUNT_SECRET) ??
        this.stringOrNull(stored?.serviceAccountSecret) ??
        "",
    };
  },

  amplitudeCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): AmplitudeCredentials {
    return {
      apiOrigin:
        this.stringOrNull(stored?.AMPLITUDE_DASHBOARD_REST_ORIGIN) ??
        this.stringOrNull(stored?.apiOrigin) ??
        "",
      projectApiKey:
        this.stringOrNull(stored?.AMPLITUDE_PROJECT_API_KEY) ??
        this.stringOrNull(stored?.projectApiKey) ??
        "",
      projectSecretKey:
        this.stringOrNull(stored?.AMPLITUDE_PROJECT_SECRET_KEY) ??
        this.stringOrNull(stored?.projectSecretKey) ??
        "",
    };
  },

  pendoCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): PendoCredentials {
    return {
      apiOrigin:
        this.stringOrNull(stored?.PENDO_ENGAGE_API_ORIGIN) ??
        this.stringOrNull(stored?.apiOrigin) ??
        "",
      applicationId:
        this.stringOrNull(stored?.PENDO_APPLICATION_ID) ??
        this.stringOrNull(stored?.applicationId) ??
        "",
      integrationKey:
        this.stringOrNull(stored?.PENDO_INTEGRATION_KEY) ??
        this.stringOrNull(stored?.integrationKey) ??
        "",
    };
  },

  postHogCredentials(
    this: MarketplaceConnectorExecutionService,
    connection: MarketplaceConnectionEntity,
    accessToken: string,
  ): PostHogCredentials {
    const apiOrigin =
      this.stringOrNull(connection.metadata?.POSTHOG_API_ORIGIN) ??
      this.stringOrNull(connection.metadata?.apiOrigin) ??
      this.stringOrNull(connection.metadata?.baseUrl) ??
      "";
    const organizationId =
      this.stringOrNull(connection.metadata?.POSTHOG_ORGANIZATION_ID) ??
      this.stringOrNull(connection.metadata?.organizationId) ??
      "";
    const projectId =
      this.stringOrNull(connection.metadata?.POSTHOG_PROJECT_ID) ??
      this.stringOrNull(connection.metadata?.projectId) ??
      "";
    return { apiOrigin, organizationId, projectId, accessToken };
  },

  sentryCredentials(
    this: MarketplaceConnectorExecutionService,
    connection: MarketplaceConnectionEntity,
    accessToken: string,
  ): SentryCredentials {
    return {
      organization:
        this.stringOrNull(connection.metadata?.SENTRY_ORGANIZATION) ??
        this.stringOrNull(connection.metadata?.organization) ??
        this.stringOrNull(connection.metadata?.organizationSlug) ??
        "",
      accessToken,
    };
  },

  alchemerCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): AlchemerCredentials {
    return {
      region: (this.stringOrNull(stored?.ALCHEMER_REGION)?.toLowerCase() ??
        "") as AlchemerRegion,
      consumerKey: this.stringOrNull(stored?.ALCHEMER_OAUTH_CONSUMER_KEY) ?? "",
      consumerSecret:
        this.stringOrNull(stored?.ALCHEMER_OAUTH_CONSUMER_SECRET) ?? "",
      accessToken: this.stringOrNull(stored?.ALCHEMER_OAUTH_ACCESS_TOKEN) ?? "",
      accessTokenSecret:
        this.stringOrNull(stored?.ALCHEMER_OAUTH_ACCESS_TOKEN_SECRET) ?? "",
    };
  },

  qualtricsCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): QualtricsCredentials {
    return {
      dataCenterId:
        this.stringOrNull(stored?.QUALTRICS_DATA_CENTER_ID)?.toLowerCase() ??
        "",
      apiToken: this.stringOrNull(stored?.QUALTRICS_API_TOKEN) ?? "",
    };
  },

  askNicelyCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): AskNicelyCredentials {
    return {
      subdomain:
        this.stringOrNull(stored?.ASKNICELY_SUBDOMAIN)?.toLowerCase() ?? "",
      apiKey: this.stringOrNull(stored?.ASKNICELY_API_KEY) ?? "",
    };
  },

  delightedCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): DelightedCredentials {
    return { apiKey: this.stringOrNull(stored?.DELIGHTED_API_KEY) ?? "" };
  },

  rewardfulCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): RewardfulCredentials {
    return {
      apiSecret: this.stringOrNull(stored?.REWARDFUL_API_SECRET) ?? "",
    };
  },

  chorusAiCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): ChorusAiCredentials {
    return {
      apiToken: this.stringOrNull(stored?.CHORUS_AI_API_TOKEN) ?? "",
    };
  },

  clariCopilotCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): ClariCopilotCredentials {
    return {
      apiKey: this.stringOrNull(stored?.CLARI_COPILOT_API_KEY) ?? "",
      apiPassword: this.stringOrNull(stored?.CLARI_COPILOT_API_PASSWORD) ?? "",
    };
  },

  peopleAiCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): PeopleAiCredentials {
    return {
      clientId: this.stringOrNull(stored?.PEOPLE_AI_MCP_CLIENT_ID) ?? "",
      clientSecret:
        this.stringOrNull(stored?.PEOPLE_AI_MCP_CLIENT_SECRET) ?? "",
    };
  },

  cognismCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): CognismCredentials {
    return {
      apiKey: this.stringOrNull(stored?.COGNISM_API_KEY) ?? "",
    };
  },

  zoomInfoCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): ZoomInfoCredentials {
    return {
      clientId: this.stringOrNull(stored?.ZOOMINFO_CLIENT_ID) ?? "",
      clientSecret: this.stringOrNull(stored?.ZOOMINFO_CLIENT_SECRET) ?? "",
    };
  },

  clearbitCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): ClearbitCredentials {
    return {
      apiKey: this.stringOrNull(stored?.CLEARBIT_API_KEY) ?? "",
    };
  },

  leadfeederCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): LeadfeederCredentials {
    return {
      apiKey: this.stringOrNull(stored?.LEADFEEDER_API_KEY) ?? "",
    };
  },

  unbounceCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): UnbounceCredentials {
    return {
      apiKey: this.stringOrNull(stored?.UNBOUNCE_API_KEY) ?? "",
    };
  },

  instapageCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): InstapageCredentials {
    return {
      apiToken: this.stringOrNull(stored?.INSTAPAGE_API_TOKEN) ?? "",
    };
  },

  vwoCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): VwoCredentials {
    return { apiToken: this.stringOrNull(stored?.VWO_API_TOKEN) ?? "" };
  },

  abTastyCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): AbTastyCredentials {
    return {
      accessToken: this.stringOrNull(stored?.AB_TASTY_ACCESS_TOKEN) ?? "",
      accountId: this.stringOrNull(stored?.AB_TASTY_ACCOUNT_ID) ?? "",
    };
  },

  fullstoryCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): FullstoryCredentials {
    return {
      apiKey: this.stringOrNull(stored?.FULLSTORY_API_KEY) ?? "",
    };
  },

  refinerCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): RefinerCredentials {
    return { apiKey: this.stringOrNull(stored?.REFINER_API_KEY) ?? "" };
  },

  hotjarCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): HotjarCredentials {
    return {
      clientId: this.stringOrNull(stored?.HOTJAR_CLIENT_ID) ?? "",
      clientSecret: this.stringOrNull(stored?.HOTJAR_CLIENT_SECRET) ?? "",
      siteId: this.stringOrNull(stored?.HOTJAR_SITE_ID) ?? "",
    };
  },
};
