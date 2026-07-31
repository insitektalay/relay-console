import type { MarketplaceConnectorExecutionService } from "../../connector-execution.service";
import { MarketplaceConnectionEntity } from "../../../../../entities";
import { type AbTastyFeatureExperimentationCredentials } from "../../ab-tasty-feature-experimentation/ab-tasty-feature-experimentation-api.adapter";
import { type AcousticCampaignCredentials } from "../../acoustic-campaign/acoustic-campaign-api.adapter";
import { type AdobeRealTimeCdpCredentials } from "../../adobe-real-time-cdp/adobe-real-time-cdp-api.adapter";
import {
  AirmeetApiError,
  type AirmeetCredentials,
} from "../../airmeet/airmeet-api.adapter";
import { type AmplitudeExperimentCredentials } from "../../amplitude-experiment/amplitude-experiment-api.adapter";
import { type AnytypeLocalApiCredentials } from "../../anytype/anytype-local-api.adapter";
import { type ArchbeeCredentials } from "../../archbee/archbee-api.adapter";
import { type AtlassianRovoMcpCredentials } from "../../atlassian-rovo/atlassian-rovo-mcp.adapter";
import { type AttentiveCredentials } from "../../attentive/attentive-api.adapter";
import { type BloomreachEngagementCredentials } from "../../bloomreach-engagement/bloomreach-engagement-api.adapter";
import { type BrevoCredentials } from "../../brevo/brevo-api.adapter";
import { type BuildiumCredentials } from "../../buildium/buildium-api.adapter";
import { type CommonRoomCredentials } from "../../common-room/common-room-api.adapter";
import { type ConfigCatCredentials } from "../../configcat/configcat-api.adapter";
import { type CrispCredentials } from "../../crisp/crisp-api.adapter";
import {
  CventApiError,
  type CventCredentials,
} from "../../cvent/cvent-api.adapter";
import { type DataForSeoCredentials } from "../../dataforseo/dataforseo-api.adapter";
import { type Document360Credentials } from "../../document360/document360-api.adapter";
import { type DonorboxCredentials } from "../../donorbox/donorbox-api.adapter";
import { type DotdigitalCredentials } from "../../dotdigital/dotdigital-api.adapter";
import { type EmarsysCredentials } from "../../emarsys/emarsys-api.adapter";
import { type EventPlatformCredentials } from "../../event-platform/event-platform-read-api.adapter";
import { type FeedlyCredentials } from "../../feedly/feedly-api.adapter";
import { type FlagsmithCloudCredentials } from "../../flagsmith-cloud/flagsmith-cloud-api.adapter";
import { type FreshcallerCredentials } from "../../freshcaller/freshcaller-api.adapter";
import { type FreshchatCredentials } from "../../freshchat/freshchat-api.adapter";
import { type FreshmarketerCredentials } from "../../freshmarketer/freshmarketer-api.adapter";
import { type FreshserviceCredentials } from "../../freshservice/freshservice-api.adapter";
import { type FuseBaseMcpCredentials } from "../../fusebase/fusebase-mcp.adapter";
import { type GladlyCredentials } from "../../gladly/gladly-api.adapter";
import { type GrowthBookCloudCredentials } from "../../growthbook-cloud/growthbook-cloud-api.adapter";
import { type IterableSmsCredentials } from "../../iterable-sms/iterable-sms-api.adapter";
import { type IterableCredentials } from "../../iterable/iterable-api.adapter";
import { type KlaviyoSmsCredentials } from "../../klaviyo-sms/klaviyo-sms-api.adapter";
import { type KnowledgeOwlCredentials } from "../../knowledgeowl/knowledgeowl-api.adapter";
import { type KustomerCredentials } from "../../kustomer/kustomer-api.adapter";
import { type LaunchDarklyCredentials } from "../../launchdarkly/launchdarkly-api.adapter";
import { type ListrakCredentials } from "../../listrak/listrak-api.adapter";
import { type LiveAgentCredentials } from "../../liveagent/liveagent-api.adapter";
import { type LiveChatCredentials } from "../../livechat/livechat-api.adapter";
import { type LocalWordPressOrgCliCredentials } from "../../local-wordpress-org/local-wordpress-org-cli.adapter";
import { type LogseqCliCredentials } from "../../logseq/logseq-cli.adapter";
import { type MailchimpSurveysCredentials } from "../../mailchimp-surveys/mailchimp-surveys-api.adapter";
import { type MailchimpTransactionalCredentials } from "../../mailchimp-transactional/mailchimp-transactional-api.adapter";
import { type MailgunCredentials } from "../../mailgun/mailgun-api.adapter";
import { type MaropostCredentials } from "../../maropost/maropost-api.adapter";
import { type MemCredentials } from "../../mem/mem-api.adapter";
import { type MessageGearsCredentials } from "../../messagegears/messagegears-api.adapter";
import { type MixpanelCohortsCredentials } from "../../mixpanel-cohorts/mixpanel-cohorts-api.adapter";
import { type MoEngageCredentials } from "../../moengage/moengage-api.adapter";
import { type ObsidianCliCredentials } from "../../obsidian/obsidian-cli.adapter";
import { type OlarkCredentials } from "../../olark/olark-webhook.adapter";
import { type OpsgenieCloudCredentials } from "../../opsgenie-cloud/opsgenie-cloud-api.adapter";
import { type OptimizelyRolloutsCredentials } from "../../optimizely-rollouts/optimizely-rollouts-api.adapter";
import { type OrttoCredentials } from "../../ortto/ortto-api.adapter";
import { type PostHogFeatureFlagsCredentials } from "../../posthog-feature-flags/posthog-feature-flags-api.adapter";
import { type PostmarkCredentials } from "../../postmark/postmark-api.adapter";
import { type PostscriptCredentials } from "../../postscript/postscript-api.adapter";
import { type PretixCredentials } from "../../pretix/pretix-api.adapter";
import { type ReadMeCredentials } from "../../readme/readme-api.adapter";
import { type ReadwiseCredentials } from "../../readwise/readwise-api.adapter";
import { type ResendCredentials } from "../../resend/resend-api.adapter";
import { type RoamResearchCliCredentials } from "../../roam-research/roam-research-cli.adapter";
import { type SailthruCredentials } from "../../sailthru/sailthru-api.adapter";
import { type SalesforceDataCloudCredentials } from "../../salesforce-data-cloud/salesforce-data-cloud-api.adapter";
import { type SendGridCredentials } from "../../sendgrid/sendgrid-api.adapter";
import { type SendlaneCredentials } from "../../sendlane/sendlane-api.adapter";
import { type SessionizeCredentials } from "../../sessionize/sessionize-api.adapter";
import { type MailjetCredentials } from "../../sinch-mailjet/sinch-mailjet-api.adapter";
import { type SlackCanvasCredentials } from "../../slack-canvas/slack-canvas-api.adapter";
import { type SlackEnterpriseGridCredentials } from "../../slack-enterprise-grid/slack-enterprise-grid-api.adapter";
import { type SlackListsCredentials } from "../../slack-lists/slack-lists-api.adapter";
import { type SparkPostCredentials } from "../../sparkpost/sparkpost-api.adapter";
import { type SplashCredentials } from "../../splash/splash-api.adapter";
import { type SplitIoCredentials } from "../../split-io/split-io-api.adapter";
import { type StatsigCredentials } from "../../statsig/statsig-api.adapter";
import { type StatuspageCloudCredentials } from "../../statuspage-cloud/statuspage-cloud-api.adapter";
import { type TettraCredentials } from "../../tettra/tettra-api.adapter";
import { type TidioCredentials } from "../../tidio/tidio-api.adapter";
import { type TwilioSegmentEngageCredentials } from "../../twilio-segment-engage/twilio-segment-engage-api.adapter";
import { type UnleashCloudCredentials } from "../../unleash-cloud/unleash-cloud-api.adapter";
import { type UserlikeCredentials } from "../../userlike/userlike-api.adapter";
import { type VeroCredentials } from "../../vero/vero-api.adapter";
import { type VwoTestingCredentials } from "../../vwo-testing/vwo-testing-api.adapter";
import { type ZoomEventsCredentials } from "../../zoom-events/zoom-events-api.adapter";
import { type ZoomPhoneCredentials } from "../../zoom-phone/zoom-phone-api.adapter";
import { type ZoomRoomsCredentials } from "../../zoom-rooms/zoom-rooms-api.adapter";
import { type ZoomWebinarsCredentials } from "../../zoom-webinars/zoom-webinars-api.adapter";
import { ConnectorExecutionError } from "../connector-execution.error";

export const CredentialsExtension1 = {
  obsidianCredentials(
    this: MarketplaceConnectorExecutionService,
    connection: MarketplaceConnectionEntity,
  ): ObsidianCliCredentials {
    const stored = this.credentials.decrypt(connection);
    const sourceHostId = this.stringOrNull(stored?.OBSIDIAN_SOURCE_HOST_ID);
    const sourceHostType = this.stringOrNull(stored?.OBSIDIAN_SOURCE_HOST_TYPE);
    const vault = this.stringOrNull(stored?.OBSIDIAN_VAULT);
    if (!sourceHostId || !sourceHostType || !vault)
      throw new ConnectorExecutionError(
        "credential_missing",
        "Obsidian source host and exact vault binding are required",
      );
    if (
      !["hermes_bridge", "openclaw_bridge", "runtime_host"].includes(
        sourceHostType,
      )
    )
      throw new ConnectorExecutionError(
        "provider_validation_error",
        "Obsidian source host type is invalid",
      );
    return {
      sourceHostId,
      sourceHostType:
        sourceHostType as ObsidianCliCredentials["sourceHostType"],
      vault,
    };
  },

  roamResearchCredentials(
    this: MarketplaceConnectorExecutionService,
    connection: MarketplaceConnectionEntity,
  ): RoamResearchCliCredentials {
    const stored = this.credentials.decrypt(connection);
    const sourceHostId = this.stringOrNull(
      stored?.ROAM_RESEARCH_SOURCE_HOST_ID,
    );
    const sourceHostType = this.stringOrNull(
      stored?.ROAM_RESEARCH_SOURCE_HOST_TYPE,
    );
    const graph = this.stringOrNull(stored?.ROAM_RESEARCH_GRAPH);
    if (!sourceHostId || !sourceHostType || !graph)
      throw new ConnectorExecutionError(
        "credential_missing",
        "Roam Research source host and exact graph binding are required",
      );
    if (
      !["hermes_bridge", "openclaw_bridge", "runtime_host"].includes(
        sourceHostType,
      )
    )
      throw new ConnectorExecutionError(
        "provider_validation_error",
        "Roam Research source host type is invalid",
      );
    return {
      sourceHostId,
      sourceHostType:
        sourceHostType as RoamResearchCliCredentials["sourceHostType"],
      graph,
    };
  },

  logseqCredentials(
    this: MarketplaceConnectorExecutionService,
    connection: MarketplaceConnectionEntity,
  ): LogseqCliCredentials {
    const stored = this.credentials.decrypt(connection);
    const sourceHostId = this.stringOrNull(stored?.LOGSEQ_SOURCE_HOST_ID);
    const sourceHostType = this.stringOrNull(stored?.LOGSEQ_SOURCE_HOST_TYPE);
    const graph = this.stringOrNull(stored?.LOGSEQ_GRAPH);
    if (!sourceHostId || !sourceHostType || !graph)
      throw new ConnectorExecutionError(
        "credential_missing",
        "Logseq source host and exact local graph binding are required",
      );
    if (
      !["hermes_bridge", "openclaw_bridge", "runtime_host"].includes(
        sourceHostType,
      )
    )
      throw new ConnectorExecutionError(
        "provider_validation_error",
        "Logseq source host type is invalid",
      );
    return {
      sourceHostId,
      sourceHostType: sourceHostType as LogseqCliCredentials["sourceHostType"],
      graph,
    };
  },

  localWordPressOrgCredentials(
    this: MarketplaceConnectorExecutionService,
    connection: MarketplaceConnectionEntity,
  ): LocalWordPressOrgCliCredentials {
    const stored = this.credentials.decrypt(connection);
    const sourceHostId = this.stringOrNull(
      stored?.LOCAL_WORDPRESS_ORG_SOURCE_HOST_ID,
    );
    const sourceHostType = this.stringOrNull(
      stored?.LOCAL_WORDPRESS_ORG_SOURCE_HOST_TYPE,
    );
    const sitePath = this.stringOrNull(stored?.LOCAL_WORDPRESS_ORG_SITE_PATH);
    if (!sourceHostId || !sourceHostType || !sitePath)
      throw new ConnectorExecutionError(
        "credential_missing",
        "Local WordPress.org source host and exact site path are required",
      );
    if (
      !["hermes_bridge", "openclaw_bridge", "runtime_host"].includes(
        sourceHostType,
      )
    )
      throw new ConnectorExecutionError(
        "provider_validation_error",
        "Local WordPress.org source host type is invalid",
      );
    return {
      sourceHostId,
      sourceHostType:
        sourceHostType as LocalWordPressOrgCliCredentials["sourceHostType"],
      sitePath,
    };
  },

  anytypeCredentials(
    this: MarketplaceConnectorExecutionService,
    connection: MarketplaceConnectionEntity,
  ): AnytypeLocalApiCredentials {
    const stored = this.credentials.decrypt(connection);
    const apiKey = this.stringOrNull(stored?.ANYTYPE_API_KEY);
    const sourceHostId = this.stringOrNull(stored?.ANYTYPE_SOURCE_HOST_ID);
    const sourceHostType = this.stringOrNull(stored?.ANYTYPE_SOURCE_HOST_TYPE);
    const runtime = this.stringOrNull(stored?.ANYTYPE_RUNTIME);
    if (!apiKey || !sourceHostId || !sourceHostType || !runtime)
      throw new ConnectorExecutionError(
        "credential_missing",
        "Anytype API key, source host, and runtime binding are required",
      );
    if (
      !["hermes_bridge", "openclaw_bridge", "runtime_host"].includes(
        sourceHostType,
      ) ||
      !["desktop", "cli"].includes(runtime)
    )
      throw new ConnectorExecutionError(
        "provider_validation_error",
        "Anytype source host or runtime binding is invalid",
      );
    return {
      apiKey,
      sourceHostId,
      sourceHostType:
        sourceHostType as AnytypeLocalApiCredentials["sourceHostType"],
      runtime: runtime as AnytypeLocalApiCredentials["runtime"],
    };
  },

  dataForSeoCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
    connection: MarketplaceConnectionEntity,
  ): DataForSeoCredentials {
    const login = this.stringOrNull(stored?.DATAFORSEO_API_LOGIN);
    const password = this.stringOrNull(stored?.DATAFORSEO_API_PASSWORD);
    if (!login || !password) {
      throw new ConnectorExecutionError(
        "credential_missing",
        "DataForSEO API login and password are missing.",
      );
    }
    return {
      login,
      password,
      baseUrl:
        this.stringOrNull(stored?.DATAFORSEO_BASE_URL) ??
        this.stringOrNull(connection.metadata?.baseUrl) ??
        this.stringOrNull(connection.metadata?.DATAFORSEO_BASE_URL),
    };
  },

  mailgunCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): MailgunCredentials {
    const apiKey = this.stringOrNull(stored?.MAILGUN_API_KEY);
    const domain = this.stringOrNull(stored?.MAILGUN_DOMAIN)?.toLowerCase();
    const region = this.stringOrNull(stored?.MAILGUN_REGION)?.toUpperCase();
    const keyType = this.stringOrNull(stored?.MAILGUN_KEY_TYPE)?.toLowerCase();
    if (!apiKey || !domain)
      throw new ConnectorExecutionError(
        "credential_missing",
        "Mailgun API key and domain are required.",
      );
    if (region !== "US" && region !== "EU")
      throw new ConnectorExecutionError(
        "provider_validation_error",
        "MAILGUN_REGION must be US or EU.",
      );
    if (keyType !== "account" && keyType !== "domain_sending")
      throw new ConnectorExecutionError(
        "provider_validation_error",
        "MAILGUN_KEY_TYPE must be account or domain_sending.",
      );
    return { apiKey, domain, region, keyType };
  },

  sendGridCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): SendGridCredentials {
    const apiKey = this.stringOrNull(stored?.SENDGRID_API_KEY);
    const region = this.stringOrNull(stored?.SENDGRID_REGION)?.toUpperCase();
    const senderBoundary = this.stringOrNull(
      stored?.SENDGRID_SENDER_BOUNDARY,
    )?.toLowerCase();
    if (!apiKey || !senderBoundary)
      throw new ConnectorExecutionError(
        "credential_missing",
        "SendGrid API key and sender boundary are required.",
      );
    if (region !== "GLOBAL" && region !== "EU")
      throw new ConnectorExecutionError(
        "provider_validation_error",
        "SENDGRID_REGION must be GLOBAL or EU.",
      );
    return { apiKey, region, senderBoundary };
  },

  mailchimpTransactionalCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): MailchimpTransactionalCredentials {
    const apiKey = this.stringOrNull(stored?.MAILCHIMP_TRANSACTIONAL_API_KEY);
    const senderBoundary = this.stringOrNull(
      stored?.MAILCHIMP_TRANSACTIONAL_SENDER_BOUNDARY,
    )?.toLowerCase();
    if (!apiKey || !senderBoundary)
      throw new ConnectorExecutionError(
        "credential_missing",
        "Mailchimp Transactional API key and sender boundary are required.",
      );
    return { apiKey, senderBoundary };
  },

  mailchimpSurveysCredentials(
    this: MarketplaceConnectorExecutionService,
    connection: MarketplaceConnectionEntity,
    accessToken: string,
  ): MailchimpSurveysCredentials {
    const apiOrigin = this.stringOrNull(
      connection.metadata?.mailchimpApiOrigin,
    );
    const accountId = this.stringOrNull(
      connection.metadata?.mailchimpAccountId,
    );
    if (!apiOrigin || !accountId)
      throw new ConnectorExecutionError(
        "connection_not_ready",
        "Mailchimp Surveys metadata data-center and account binding are missing.",
      );
    return { accessToken, apiOrigin, accountId };
  },

  klaviyoSmsCredentials(
    this: MarketplaceConnectorExecutionService,
    connection: MarketplaceConnectionEntity,
    accessToken: string,
  ): KlaviyoSmsCredentials {
    const accountId = this.stringOrNull(connection.metadata?.klaviyoAccountId);
    if (!accountId)
      throw new ConnectorExecutionError(
        "connection_not_ready",
        "Klaviyo SMS account binding is missing.",
      );
    return { accessToken, accountId };
  },

  attentiveCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): AttentiveCredentials {
    const apiKey = this.stringOrNull(stored?.ATTENTIVE_API_KEY);
    if (!apiKey)
      throw new ConnectorExecutionError(
        "credential_missing",
        "Attentive private-app API key is required.",
      );
    return { apiKey };
  },

  postscriptCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): PostscriptCredentials {
    const apiKey = this.stringOrNull(stored?.POSTSCRIPT_PRIVATE_API_KEY);
    if (!apiKey)
      throw new ConnectorExecutionError(
        "credential_missing",
        "Postscript shop private API key is required.",
      );
    return { apiKey };
  },

  sendlaneCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): SendlaneCredentials {
    const apiToken = this.stringOrNull(stored?.SENDLANE_API_V2_TOKEN);
    const integrationToken = this.stringOrNull(
      stored?.SENDLANE_CUSTOM_INTEGRATION_TOKEN,
    );
    if (!apiToken || !integrationToken)
      throw new ConnectorExecutionError(
        "credential_missing",
        "Sendlane API v2 and custom integration tokens are required.",
      );
    return { apiToken, integrationToken };
  },

  iterableCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): IterableCredentials {
    const apiKey = this.stringOrNull(stored?.ITERABLE_SERVER_API_KEY);
    const region = this.stringOrNull(stored?.ITERABLE_REGION)?.toLowerCase();
    if (!apiKey || (region !== "us" && region !== "eu"))
      throw new ConnectorExecutionError(
        "credential_missing",
        "Iterable server API key and us/eu data-center region are required.",
      );
    return { apiKey, region };
  },

  iterableSmsCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): IterableSmsCredentials {
    const apiKey = this.stringOrNull(stored?.ITERABLE_SMS_SERVER_API_KEY);
    const region = this.stringOrNull(
      stored?.ITERABLE_SMS_REGION,
    )?.toLowerCase();
    if (!apiKey || (region !== "us" && region !== "eu"))
      throw new ConnectorExecutionError(
        "credential_missing",
        "Iterable SMS server API key and us/eu data-center region are required.",
      );
    return { apiKey, region };
  },

  orttoCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): OrttoCredentials {
    const apiKey = this.stringOrNull(stored?.ORTTO_CUSTOM_API_KEY);
    const region = this.stringOrNull(stored?.ORTTO_REGION)?.toLowerCase();
    if (!apiKey || !region || !["default", "au", "eu"].includes(region))
      throw new ConnectorExecutionError(
        "credential_missing",
        "Ortto custom API key and default/au/eu account region are required.",
      );
    return { apiKey, region: region as OrttoCredentials["region"] };
  },

  veroCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): VeroCredentials {
    const trackingApiKey = this.stringOrNull(stored?.VERO_TRACKING_API_KEY);
    const campaignsApiKey = this.stringOrNull(
      stored?.VERO_CAMPAIGNS_API_SECRET_KEY,
    );
    if (!trackingApiKey || !campaignsApiKey)
      throw new ConnectorExecutionError(
        "credential_missing",
        "Vero tracking and Campaigns API keys are required.",
      );
    return { trackingApiKey, campaignsApiKey };
  },

  messageGearsCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): MessageGearsCredentials {
    const accountId = this.stringOrNull(stored?.MESSAGEGEARS_ACCOUNT_ID);
    const apiKey = this.stringOrNull(stored?.MESSAGEGEARS_API_KEY);
    if (!accountId || !apiKey)
      throw new ConnectorExecutionError(
        "credential_missing",
        "MessageGears account ID and API key are required.",
      );
    return { accountId, apiKey };
  },

  maropostCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): MaropostCredentials {
    const accountId = this.stringOrNull(stored?.MAROPOST_ACCOUNT_ID);
    const apiKey = this.stringOrNull(stored?.MAROPOST_API_KEY);
    if (!accountId || !apiKey)
      throw new ConnectorExecutionError(
        "credential_missing",
        "Maropost account ID and API key are required.",
      );
    return { accountId, apiKey };
  },

  emarsysCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): EmarsysCredentials {
    const clientId = this.stringOrNull(stored?.EMARSYS_CLIENT_ID);
    const clientSecret = this.stringOrNull(stored?.EMARSYS_CLIENT_SECRET);
    if (!clientId || !clientSecret)
      throw new ConnectorExecutionError(
        "credential_missing",
        "Emarsys client ID and client secret are required.",
      );
    return { clientId, clientSecret };
  },

  sailthruCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): SailthruCredentials {
    const apiKey = this.stringOrNull(stored?.SAILTHRU_API_KEY);
    const apiSecret = this.stringOrNull(stored?.SAILTHRU_API_SECRET);
    const healthList = this.stringOrNull(stored?.SAILTHRU_HEALTH_LIST);
    if (!apiKey || !apiSecret || !healthList)
      throw new ConnectorExecutionError(
        "credential_missing",
        "Sailthru API key, API secret, and health-check list are required.",
      );
    return { apiKey, apiSecret, healthList };
  },

  listrakCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): ListrakCredentials {
    const clientId = this.stringOrNull(stored?.LISTRAK_CLIENT_ID);
    const clientSecret = this.stringOrNull(stored?.LISTRAK_CLIENT_SECRET);
    if (!clientId || !clientSecret)
      throw new ConnectorExecutionError(
        "credential_missing",
        "Listrak client ID and client secret are required.",
      );
    return { clientId, clientSecret };
  },

  dotdigitalCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): DotdigitalCredentials {
    const username = this.stringOrNull(stored?.DOTDIGITAL_API_USERNAME);
    const password = this.stringOrNull(stored?.DOTDIGITAL_API_PASSWORD);
    if (!username || !password)
      throw new ConnectorExecutionError(
        "credential_missing",
        "Dotdigital API username and password are required.",
      );
    return { username, password };
  },

  acousticCampaignCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): AcousticCampaignCredentials {
    const clientId = this.stringOrNull(stored?.ACOUSTIC_CAMPAIGN_CLIENT_ID);
    const clientSecret = this.stringOrNull(
      stored?.ACOUSTIC_CAMPAIGN_CLIENT_SECRET,
    );
    const refreshToken = this.stringOrNull(
      stored?.ACOUSTIC_CAMPAIGN_REFRESH_TOKEN,
    );
    const pod = this.stringOrNull(stored?.ACOUSTIC_CAMPAIGN_POD);
    if (!clientId || !clientSecret || !refreshToken || !pod)
      throw new ConnectorExecutionError(
        "credential_missing",
        "Acoustic Campaign client ID, client secret, refresh token, and pod are required.",
      );
    return { clientId, clientSecret, refreshToken, pod };
  },

  bloomreachEngagementCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): BloomreachEngagementCredentials {
    const projectToken = this.stringOrNull(
      stored?.BLOOMREACH_ENGAGEMENT_PROJECT_TOKEN,
    );
    const apiKeyId = this.stringOrNull(
      stored?.BLOOMREACH_ENGAGEMENT_API_KEY_ID,
    );
    const apiSecret = this.stringOrNull(
      stored?.BLOOMREACH_ENGAGEMENT_API_SECRET,
    );
    if (!projectToken || !apiKeyId || !apiSecret)
      throw new ConnectorExecutionError(
        "credential_missing",
        "Bloomreach Engagement project token, API key ID, and API secret are required.",
      );
    return { projectToken, apiKeyId, apiSecret };
  },

  moEngageCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): MoEngageCredentials {
    const workspaceId = this.stringOrNull(stored?.MOENGAGE_WORKSPACE_ID);
    const apiKey = this.stringOrNull(stored?.MOENGAGE_DATA_API_KEY);
    const dataCenter = this.stringOrNull(stored?.MOENGAGE_DATA_CENTER);
    const healthCustomerId = this.stringOrNull(
      stored?.MOENGAGE_HEALTH_CUSTOMER_ID,
    );
    if (!workspaceId || !apiKey || !dataCenter || !healthCustomerId)
      throw new ConnectorExecutionError(
        "credential_missing",
        "MoEngage workspace ID, Data API key, data center, and health customer ID are required.",
      );
    return { workspaceId, apiKey, dataCenter, healthCustomerId };
  },

  salesforceDataCloudCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): SalesforceDataCloudCredentials {
    const clientId = this.stringOrNull(stored?.SALESFORCE_DATA_CLOUD_CLIENT_ID);
    const clientSecret = this.stringOrNull(
      stored?.SALESFORCE_DATA_CLOUD_CLIENT_SECRET,
    );
    const loginEnvironment = this.stringOrNull(
      stored?.SALESFORCE_DATA_CLOUD_LOGIN_ENVIRONMENT,
    );
    if (!clientId || !clientSecret || !loginEnvironment)
      throw new ConnectorExecutionError(
        "credential_missing",
        "Salesforce Data Cloud client ID, client secret, and login environment are required.",
      );
    return { clientId, clientSecret, loginEnvironment };
  },

  adobeRealTimeCdpCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): AdobeRealTimeCdpCredentials {
    const clientId = this.stringOrNull(stored?.ADOBE_REAL_TIME_CDP_CLIENT_ID);
    const clientSecret = this.stringOrNull(
      stored?.ADOBE_REAL_TIME_CDP_CLIENT_SECRET,
    );
    const scopes = this.stringOrNull(stored?.ADOBE_REAL_TIME_CDP_SCOPES);
    const organizationId = this.stringOrNull(
      stored?.ADOBE_REAL_TIME_CDP_ORGANIZATION_ID,
    );
    const sandboxName = this.stringOrNull(
      stored?.ADOBE_REAL_TIME_CDP_SANDBOX_NAME,
    );
    if (
      !clientId ||
      !clientSecret ||
      !scopes ||
      !organizationId ||
      !sandboxName
    )
      throw new ConnectorExecutionError(
        "credential_missing",
        "Adobe Real-Time CDP client ID, client secret, scopes, organization ID, and sandbox name are required.",
      );
    return { clientId, clientSecret, scopes, organizationId, sandboxName };
  },

  twilioSegmentEngageCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): TwilioSegmentEngageCredentials {
    const apiToken = this.stringOrNull(stored?.TWILIO_SEGMENT_ENGAGE_API_TOKEN);
    const region = this.stringOrNull(stored?.TWILIO_SEGMENT_ENGAGE_REGION);
    const healthSpaceId = this.stringOrNull(
      stored?.TWILIO_SEGMENT_ENGAGE_HEALTH_SPACE_ID,
    );
    if (!apiToken || !region || !healthSpaceId)
      throw new ConnectorExecutionError(
        "credential_missing",
        "Twilio Segment Engage API token, region, and health space ID are required.",
      );
    return { apiToken, region, healthSpaceId };
  },

  amplitudeExperimentCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): AmplitudeExperimentCredentials {
    const managementApiKey = this.stringOrNull(
      stored?.AMPLITUDE_EXPERIMENT_MANAGEMENT_API_KEY,
    );
    const region = this.stringOrNull(stored?.AMPLITUDE_EXPERIMENT_REGION);
    const projectId = this.stringOrNull(
      stored?.AMPLITUDE_EXPERIMENT_PROJECT_ID,
    );
    if (!managementApiKey || !region || !projectId)
      throw new ConnectorExecutionError(
        "credential_missing",
        "Amplitude Experiment management API key, region, and project ID are required.",
      );
    return { managementApiKey, region, projectId };
  },

  mixpanelCohortsCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): MixpanelCohortsCredentials {
    const serviceAccountUsername = this.stringOrNull(
      stored?.MIXPANEL_COHORTS_SERVICE_ACCOUNT_USERNAME,
    );
    const serviceAccountSecret = this.stringOrNull(
      stored?.MIXPANEL_COHORTS_SERVICE_ACCOUNT_SECRET,
    );
    const region = this.stringOrNull(stored?.MIXPANEL_COHORTS_REGION);
    const projectId = this.stringOrNull(stored?.MIXPANEL_COHORTS_PROJECT_ID);
    const workspaceId = this.stringOrNull(
      stored?.MIXPANEL_COHORTS_WORKSPACE_ID,
    );
    if (
      !serviceAccountUsername ||
      !serviceAccountSecret ||
      !region ||
      !projectId ||
      !workspaceId
    )
      throw new ConnectorExecutionError(
        "credential_missing",
        "Mixpanel Cohorts service-account username, secret, region, project ID, and workspace ID are required.",
      );
    return {
      serviceAccountUsername,
      serviceAccountSecret,
      region,
      projectId,
      workspaceId,
    };
  },

  postHogFeatureFlagsCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): PostHogFeatureFlagsCredentials {
    const personalApiKey = this.stringOrNull(
      stored?.POSTHOG_FEATURE_FLAGS_PERSONAL_API_KEY,
    );
    const region = this.stringOrNull(stored?.POSTHOG_FEATURE_FLAGS_REGION);
    const projectId = this.stringOrNull(
      stored?.POSTHOG_FEATURE_FLAGS_PROJECT_ID,
    );
    if (!personalApiKey || !region || !projectId)
      throw new ConnectorExecutionError(
        "credential_missing",
        "PostHog Feature Flags personal API key, region, and project ID are required.",
      );
    return { personalApiKey, region, projectId };
  },

  statsigCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): StatsigCredentials {
    const personalConsoleApiKey = this.stringOrNull(
      stored?.STATSIG_PERSONAL_CONSOLE_API_KEY,
    );
    if (!personalConsoleApiKey)
      throw new ConnectorExecutionError(
        "credential_missing",
        "Statsig personal Console API key is required.",
      );
    return { personalConsoleApiKey };
  },

  launchDarklyCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): LaunchDarklyCredentials {
    const apiAccessToken = this.stringOrNull(
      stored?.LAUNCHDARKLY_READER_API_ACCESS_TOKEN,
    );
    const region = this.stringOrNull(stored?.LAUNCHDARKLY_REGION);
    const projectKey = this.stringOrNull(stored?.LAUNCHDARKLY_PROJECT_KEY);
    const environmentKey = this.stringOrNull(
      stored?.LAUNCHDARKLY_ENVIRONMENT_KEY,
    );
    if (!apiAccessToken || !region || !projectKey || !environmentKey)
      throw new ConnectorExecutionError(
        "credential_missing",
        "LaunchDarkly Reader API access token, region, project key, and environment key are required.",
      );
    return { apiAccessToken, region, projectKey, environmentKey };
  },

  splitIoCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): SplitIoCredentials {
    const adminApiKey = this.stringOrNull(
      stored?.SPLIT_IO_FEATURE_FLAG_VIEWER_API_KEY,
    );
    const workspaceId = this.stringOrNull(stored?.SPLIT_IO_WORKSPACE_ID);
    if (!adminApiKey || !workspaceId)
      throw new ConnectorExecutionError(
        "credential_missing",
        "Split.io Feature Flag Viewer Admin API key and workspace ID are required.",
      );
    return { adminApiKey, workspaceId };
  },

  flagsmithCloudCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): FlagsmithCloudCredentials {
    const serviceAccountToken = this.stringOrNull(
      stored?.FLAGSMITH_CLOUD_SERVICE_ACCOUNT_TOKEN,
    );
    const projectId = this.stringOrNull(stored?.FLAGSMITH_CLOUD_PROJECT_ID);
    if (!serviceAccountToken || !projectId)
      throw new ConnectorExecutionError(
        "credential_missing",
        "Flagsmith Cloud service-account token and project ID are required.",
      );
    return { serviceAccountToken, projectId };
  },

  configCatCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): ConfigCatCredentials {
    const publicApiUsername = this.stringOrNull(
      stored?.CONFIGCAT_PUBLIC_API_USERNAME,
    );
    const publicApiPassword = this.stringOrNull(
      stored?.CONFIGCAT_PUBLIC_API_PASSWORD,
    );
    const configId = this.stringOrNull(stored?.CONFIGCAT_CONFIG_ID);
    if (!publicApiUsername || !publicApiPassword || !configId)
      throw new ConnectorExecutionError(
        "credential_missing",
        "ConfigCat Public API username, password, and config ID are required.",
      );
    return { publicApiUsername, publicApiPassword, configId };
  },

  growthBookCloudCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): GrowthBookCloudCredentials {
    const secretApiKey = this.stringOrNull(
      stored?.GROWTHBOOK_CLOUD_READONLY_SECRET_API_KEY,
    );
    const projectId = this.stringOrNull(stored?.GROWTHBOOK_CLOUD_PROJECT_ID);
    if (!secretApiKey || !projectId)
      throw new ConnectorExecutionError(
        "credential_missing",
        "GrowthBook Cloud read-only secret API key and project ID are required.",
      );
    return { secretApiKey, projectId };
  },

  unleashCloudCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): UnleashCloudCredentials {
    const backendToken = this.stringOrNull(stored?.UNLEASH_CLOUD_BACKEND_TOKEN);
    const instanceUrl = this.stringOrNull(stored?.UNLEASH_CLOUD_INSTANCE_URL);
    const projectId = this.stringOrNull(stored?.UNLEASH_CLOUD_PROJECT_ID);
    const environment = this.stringOrNull(stored?.UNLEASH_CLOUD_ENVIRONMENT);
    if (!backendToken || !instanceUrl || !projectId || !environment)
      throw new ConnectorExecutionError(
        "credential_missing",
        "Unleash Cloud backend token, instance URL, project ID, and environment are required.",
      );
    return { backendToken, instanceUrl, projectId, environment };
  },

  optimizelyRolloutsCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): OptimizelyRolloutsCredentials {
    const personalAccessToken = this.stringOrNull(
      stored?.OPTIMIZELY_ROLLOUTS_VIEWER_PERSONAL_ACCESS_TOKEN,
    );
    const projectId = this.stringOrNull(stored?.OPTIMIZELY_ROLLOUTS_PROJECT_ID);
    if (!personalAccessToken || !projectId)
      throw new ConnectorExecutionError(
        "credential_missing",
        "Optimizely Rollouts Viewer personal access token and project ID are required.",
      );
    return { personalAccessToken, projectId };
  },

  vwoTestingCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): VwoTestingCredentials {
    const personalApiToken = this.stringOrNull(
      stored?.VWO_TESTING_PERSONAL_API_TOKEN,
    );
    const accountId = this.stringOrNull(stored?.VWO_TESTING_ACCOUNT_ID);
    if (!personalApiToken || !accountId)
      throw new ConnectorExecutionError(
        "credential_missing",
        "VWO Testing personal API token and workspace ID are required.",
      );
    return { personalApiToken, accountId };
  },

  abTastyFeatureExperimentationCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): AbTastyFeatureExperimentationCredentials {
    const remoteControlApiToken = this.stringOrNull(
      stored?.AB_TASTY_REMOTE_CONTROL_API_TOKEN,
    );
    const accountId = this.stringOrNull(stored?.AB_TASTY_ACCOUNT_ID);
    const accountEnvironmentId = this.stringOrNull(
      stored?.AB_TASTY_ACCOUNT_ENVIRONMENT_ID,
    );
    if (!remoteControlApiToken || !accountId || !accountEnvironmentId)
      throw new ConnectorExecutionError(
        "credential_missing",
        "AB Tasty Remote Control API token, account ID, and account environment ID are required.",
      );
    return { remoteControlApiToken, accountId, accountEnvironmentId };
  },

  postmarkCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): PostmarkCredentials {
    const serverToken = this.stringOrNull(stored?.POSTMARK_SERVER_TOKEN);
    const accountToken =
      this.stringOrNull(stored?.POSTMARK_ACCOUNT_TOKEN) ?? undefined;
    const senderBoundary = this.stringOrNull(
      stored?.POSTMARK_SENDER_BOUNDARY,
    )?.toLowerCase();
    const messageStream = this.stringOrNull(stored?.POSTMARK_MESSAGE_STREAM);
    if (!serverToken || !senderBoundary || !messageStream)
      throw new ConnectorExecutionError(
        "credential_missing",
        "Postmark server token, sender boundary, and message stream are required.",
      );
    return { serverToken, accountToken, senderBoundary, messageStream };
  },

  resendCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): ResendCredentials {
    const apiKey = this.stringOrNull(stored?.RESEND_API_KEY);
    const keyPermission = this.stringOrNull(
      stored?.RESEND_KEY_PERMISSION,
    )?.toUpperCase();
    const domain = this.stringOrNull(stored?.RESEND_DOMAIN)
      ?.toLowerCase()
      .replace(/^@/, "");
    if (!apiKey || !domain)
      throw new ConnectorExecutionError(
        "credential_missing",
        "Resend API key and verified domain are required.",
      );
    if (keyPermission !== "SENDING" && keyPermission !== "FULL")
      throw new ConnectorExecutionError(
        "provider_validation_error",
        "RESEND_KEY_PERMISSION must be SENDING or FULL.",
      );
    return { apiKey, keyPermission, domain };
  },

  sparkPostCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): SparkPostCredentials {
    const apiKey = this.stringOrNull(stored?.SPARKPOST_API_KEY);
    const region = this.stringOrNull(stored?.SPARKPOST_REGION)?.toUpperCase();
    const senderDomain = this.stringOrNull(stored?.SPARKPOST_SENDER_DOMAIN)
      ?.toLowerCase()
      .replace(/^@/, "");
    const subaccountId =
      this.stringOrNull(stored?.SPARKPOST_SUBACCOUNT_ID) ?? undefined;
    if (!apiKey || !senderDomain)
      throw new ConnectorExecutionError(
        "credential_missing",
        "SparkPost API key and sender domain are required.",
      );
    if (region !== "US" && region !== "EU")
      throw new ConnectorExecutionError(
        "provider_validation_error",
        "SPARKPOST_REGION must be US or EU.",
      );
    if (subaccountId && !/^\d+$/.test(subaccountId))
      throw new ConnectorExecutionError(
        "provider_validation_error",
        "SPARKPOST_SUBACCOUNT_ID must be numeric.",
      );
    return { apiKey, region, senderDomain, subaccountId };
  },

  brevoCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): BrevoCredentials {
    const apiKey = this.stringOrNull(stored?.BREVO_API_KEY);
    const senderBoundary = this.stringOrNull(stored?.BREVO_SENDER_BOUNDARY)
      ?.toLowerCase()
      .replace(/^@/, "");
    if (!apiKey || !senderBoundary)
      throw new ConnectorExecutionError(
        "credential_missing",
        "Brevo API key and sender boundary are required.",
      );
    return { apiKey, senderBoundary };
  },

  mailjetCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): MailjetCredentials {
    const apiKey = this.stringOrNull(stored?.MAILJET_API_KEY),
      secretKey = this.stringOrNull(stored?.MAILJET_SECRET_KEY),
      senderBoundary = this.stringOrNull(stored?.MAILJET_SENDER_BOUNDARY)
        ?.toLowerCase()
        .replace(/^@/, "");
    if (!apiKey || !secretKey || !senderBoundary)
      throw new ConnectorExecutionError(
        "credential_missing",
        "Mailjet API Key, Secret Key, and sender boundary are required.",
      );
    return { apiKey, secretKey, senderBoundary };
  },

  fuseBaseCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): FuseBaseMcpCredentials {
    const url = this.stringOrNull(stored?.FUSEBASE_MCP_URL);
    const token = this.stringOrNull(stored?.FUSEBASE_MCP_TOKEN);
    if (!url || !token)
      throw new ConnectorExecutionError(
        "credential_missing",
        "FuseBase MCP URL and token are required.",
      );
    return { url, token };
  },

  atlassianRovoCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): AtlassianRovoMcpCredentials {
    const serviceAccountApiKey = this.stringOrNull(
      stored?.ATLASSIAN_ROVO_SERVICE_ACCOUNT_API_KEY,
    );
    if (!serviceAccountApiKey)
      throw new ConnectorExecutionError(
        "credential_missing",
        "Atlassian Rovo service account API key is required.",
      );
    return { serviceAccountApiKey };
  },

  opsgenieCloudCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): OpsgenieCloudCredentials {
    const apiKey = this.stringOrNull(stored?.OPSGENIE_API_KEY);
    const region = this.stringOrNull(stored?.OPSGENIE_REGION)?.toUpperCase();
    if (!apiKey || (region !== "US" && region !== "EU"))
      throw new ConnectorExecutionError(
        "credential_missing",
        "Opsgenie API key and US or EU region are required.",
      );
    return { apiKey, region };
  },

  statuspageCloudCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): StatuspageCloudCredentials {
    const apiToken = this.stringOrNull(stored?.STATUSPAGE_API_TOKEN);
    const pageId = this.stringOrNull(stored?.STATUSPAGE_PAGE_ID);
    if (!apiToken || !pageId)
      throw new ConnectorExecutionError(
        "credential_missing",
        "Statuspage API token and page ID are required.",
      );
    return { apiToken, pageId };
  },

  memCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): MemCredentials {
    const apiKey = this.stringOrNull(stored?.MEM_API_KEY);
    if (!apiKey)
      throw new ConnectorExecutionError(
        "credential_missing",
        "Mem API key is required.",
      );
    return { apiKey };
  },

  readwiseCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): ReadwiseCredentials {
    return {
      accessToken:
        this.stringOrNull(stored?.READWISE_ACCESS_TOKEN) ??
        this.stringOrNull(stored?.accessToken) ??
        "",
    };
  },

  commonRoomCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): CommonRoomCredentials {
    return {
      apiToken:
        this.stringOrNull(stored?.COMMON_ROOM_API_TOKEN) ??
        this.stringOrNull(stored?.apiToken) ??
        "",
    };
  },

  slackEnterpriseGridCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): SlackEnterpriseGridCredentials {
    return {
      adminToken:
        this.stringOrNull(stored?.SLACK_ENTERPRISE_ADMIN_TOKEN) ??
        this.stringOrNull(stored?.adminToken) ??
        "",
    };
  },

  slackCanvasCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): SlackCanvasCredentials {
    return {
      accessToken:
        this.stringOrNull(stored?.SLACK_CANVAS_TOKEN) ??
        this.stringOrNull(stored?.accessToken) ??
        "",
    };
  },

  slackListsCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): SlackListsCredentials {
    return {
      accessToken:
        this.stringOrNull(stored?.SLACK_LISTS_TOKEN) ??
        this.stringOrNull(stored?.accessToken) ??
        "",
    };
  },

  zoomPhoneCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): ZoomPhoneCredentials {
    return {
      accountId:
        this.stringOrNull(stored?.ZOOM_PHONE_ACCOUNT_ID) ??
        this.stringOrNull(stored?.accountId) ??
        "",
      clientId:
        this.stringOrNull(stored?.ZOOM_PHONE_CLIENT_ID) ??
        this.stringOrNull(stored?.clientId) ??
        "",
      clientSecret:
        this.stringOrNull(stored?.ZOOM_PHONE_CLIENT_SECRET) ??
        this.stringOrNull(stored?.clientSecret) ??
        "",
    };
  },

  zoomRoomsCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): ZoomRoomsCredentials {
    return {
      accountId:
        this.stringOrNull(stored?.ZOOM_ROOMS_ACCOUNT_ID) ??
        this.stringOrNull(stored?.accountId) ??
        "",
      clientId:
        this.stringOrNull(stored?.ZOOM_ROOMS_CLIENT_ID) ??
        this.stringOrNull(stored?.clientId) ??
        "",
      clientSecret:
        this.stringOrNull(stored?.ZOOM_ROOMS_CLIENT_SECRET) ??
        this.stringOrNull(stored?.clientSecret) ??
        "",
    };
  },

  zoomWebinarsCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): ZoomWebinarsCredentials {
    return {
      accountId:
        this.stringOrNull(stored?.ZOOM_WEBINARS_ACCOUNT_ID) ??
        this.stringOrNull(stored?.accountId) ??
        "",
      clientId:
        this.stringOrNull(stored?.ZOOM_WEBINARS_CLIENT_ID) ??
        this.stringOrNull(stored?.clientId) ??
        "",
      clientSecret:
        this.stringOrNull(stored?.ZOOM_WEBINARS_CLIENT_SECRET) ??
        this.stringOrNull(stored?.clientSecret) ??
        "",
      hostId:
        this.stringOrNull(stored?.ZOOM_WEBINARS_HOST_ID) ??
        this.stringOrNull(stored?.hostId) ??
        "",
    };
  },

  zoomEventsCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): ZoomEventsCredentials {
    return {
      accountId:
        this.stringOrNull(stored?.ZOOM_EVENTS_ACCOUNT_ID) ??
        this.stringOrNull(stored?.accountId) ??
        "",
      clientId:
        this.stringOrNull(stored?.ZOOM_EVENTS_CLIENT_ID) ??
        this.stringOrNull(stored?.clientId) ??
        "",
      clientSecret:
        this.stringOrNull(stored?.ZOOM_EVENTS_CLIENT_SECRET) ??
        this.stringOrNull(stored?.clientSecret) ??
        "",
    };
  },

  eventPlatformCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
    field: string,
  ): EventPlatformCredentials {
    return {
      apiToken:
        this.stringOrNull(stored?.[field]) ??
        this.stringOrNull(stored?.apiToken) ??
        "",
    };
  },

  buildiumCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): BuildiumCredentials {
    return {
      clientId:
        this.stringOrNull(stored?.BUILDIUM_CLIENT_ID) ??
        this.stringOrNull(stored?.clientId) ??
        "",
      clientSecret:
        this.stringOrNull(stored?.BUILDIUM_CLIENT_SECRET) ??
        this.stringOrNull(stored?.clientSecret) ??
        "",
    };
  },

  sessionizeCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): SessionizeCredentials {
    return {
      endpointId:
        this.stringOrNull(stored?.SESSIONIZE_ENDPOINT_ID) ??
        this.stringOrNull(stored?.endpointId) ??
        "",
    };
  },

  pretixCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): PretixCredentials {
    return {
      apiToken:
        this.stringOrNull(stored?.PRETIX_API_TOKEN) ??
        this.stringOrNull(stored?.apiToken) ??
        "",
      organizer:
        this.stringOrNull(stored?.PRETIX_ORGANIZER) ??
        this.stringOrNull(stored?.organizer) ??
        "",
    };
  },

  donorboxCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): DonorboxCredentials {
    return {
      accountEmail:
        this.stringOrNull(stored?.DONORBOX_ACCOUNT_EMAIL) ??
        this.stringOrNull(stored?.accountEmail) ??
        "",
      apiKey:
        this.stringOrNull(stored?.DONORBOX_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
    };
  },

  airmeetCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): AirmeetCredentials {
    const region =
      this.stringOrNull(stored?.AIRMEET_REGION) ??
      this.stringOrNull(stored?.region) ??
      "default";
    if (region !== "default" && region !== "eu" && region !== "us")
      throw new AirmeetApiError(
        "provider_validation_error",
        "Airmeet region is invalid.",
      );
    return {
      accessKey:
        this.stringOrNull(stored?.AIRMEET_ACCESS_KEY) ??
        this.stringOrNull(stored?.accessKey) ??
        "",
      secretKey:
        this.stringOrNull(stored?.AIRMEET_SECRET_KEY) ??
        this.stringOrNull(stored?.secretKey) ??
        "",
      region,
    };
  },

  splashCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): SplashCredentials {
    return {
      clientId:
        this.stringOrNull(stored?.SPLASH_CLIENT_ID) ??
        this.stringOrNull(stored?.clientId) ??
        "",
      clientSecret:
        this.stringOrNull(stored?.SPLASH_CLIENT_SECRET) ??
        this.stringOrNull(stored?.clientSecret) ??
        "",
      username:
        this.stringOrNull(stored?.SPLASH_API_USERNAME) ??
        this.stringOrNull(stored?.username) ??
        "",
      password:
        this.stringOrNull(stored?.SPLASH_API_PASSWORD) ??
        this.stringOrNull(stored?.password) ??
        "",
    };
  },

  cventCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): CventCredentials {
    const region =
      this.stringOrNull(stored?.CVENT_REGION) ??
      this.stringOrNull(stored?.region) ??
      "us";
    if (region !== "us" && region !== "emea")
      throw new CventApiError(
        "provider_validation_error",
        "Cvent region is invalid.",
      );
    return {
      clientId:
        this.stringOrNull(stored?.CVENT_CLIENT_ID) ??
        this.stringOrNull(stored?.clientId) ??
        "",
      clientSecret:
        this.stringOrNull(stored?.CVENT_CLIENT_SECRET) ??
        this.stringOrNull(stored?.clientSecret) ??
        "",
      region,
    };
  },

  feedlyCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): FeedlyCredentials {
    return {
      accessToken:
        this.stringOrNull(stored?.FEEDLY_ACCESS_TOKEN) ??
        this.stringOrNull(stored?.accessToken) ??
        "",
    };
  },

  readMeCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): ReadMeCredentials {
    return {
      apiKey:
        this.stringOrNull(stored?.README_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
    };
  },

  document360Credentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): Document360Credentials {
    return {
      apiToken:
        this.stringOrNull(stored?.DOCUMENT360_API_TOKEN) ??
        this.stringOrNull(stored?.apiToken) ??
        "",
      apiOrigin:
        this.stringOrNull(stored?.DOCUMENT360_API_ORIGIN) ??
        this.stringOrNull(stored?.apiOrigin) ??
        undefined,
    };
  },

  archbeeCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): ArchbeeCredentials {
    return {
      docSpaceId:
        this.stringOrNull(stored?.ARCHBEE_DOC_SPACE_ID) ??
        this.stringOrNull(stored?.docSpaceId) ??
        "",
      apiKey:
        this.stringOrNull(stored?.ARCHBEE_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
    };
  },

  tettraCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): TettraCredentials {
    return {
      teamId:
        this.stringOrNull(stored?.TETTRA_TEAM_ID) ??
        this.stringOrNull(stored?.teamId) ??
        "",
      apiKey:
        this.stringOrNull(stored?.TETTRA_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
    };
  },

  knowledgeOwlCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): KnowledgeOwlCredentials {
    return {
      projectId:
        this.stringOrNull(stored?.KNOWLEDGEOWL_PROJECT_ID) ??
        this.stringOrNull(stored?.projectId) ??
        "",
      apiKey:
        this.stringOrNull(stored?.KNOWLEDGEOWL_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
    };
  },

  freshserviceCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): FreshserviceCredentials {
    return {
      domain:
        this.stringOrNull(stored?.FRESHSERVICE_DOMAIN) ??
        this.stringOrNull(stored?.domain) ??
        "",
      apiKey:
        this.stringOrNull(stored?.FRESHSERVICE_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
    };
  },

  freshchatCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): FreshchatCredentials {
    return {
      accountUrl:
        this.stringOrNull(stored?.FRESHCHAT_ACCOUNT_URL) ??
        this.stringOrNull(stored?.accountUrl) ??
        "",
      apiKey:
        this.stringOrNull(stored?.FRESHCHAT_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
    };
  },

  freshmarketerCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): FreshmarketerCredentials {
    return {
      bundleUrl:
        this.stringOrNull(stored?.FRESHMARKETER_BUNDLE_URL) ??
        this.stringOrNull(stored?.bundleUrl) ??
        "",
      apiKey:
        this.stringOrNull(stored?.FRESHMARKETER_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
    };
  },

  freshcallerCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): FreshcallerCredentials {
    return {
      domain:
        this.stringOrNull(stored?.FRESHCALLER_DOMAIN) ??
        this.stringOrNull(stored?.domain) ??
        "",
      apiKey:
        this.stringOrNull(stored?.FRESHCALLER_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
    };
  },

  liveChatCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): LiveChatCredentials {
    return {
      personalAccessToken:
        this.stringOrNull(stored?.LIVECHAT_PERSONAL_ACCESS_TOKEN) ??
        this.stringOrNull(stored?.personalAccessToken) ??
        "",
    };
  },

  liveAgentCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): LiveAgentCredentials {
    return {
      domain:
        this.stringOrNull(stored?.LIVEAGENT_DOMAIN) ??
        this.stringOrNull(stored?.domain) ??
        "",
      apiKey:
        this.stringOrNull(stored?.LIVEAGENT_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
    };
  },

  crispCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): CrispCredentials {
    return {
      websiteId:
        this.stringOrNull(stored?.CRISP_WEBSITE_ID) ??
        this.stringOrNull(stored?.websiteId) ??
        "",
      tokenIdentifier:
        this.stringOrNull(stored?.CRISP_TOKEN_IDENTIFIER) ??
        this.stringOrNull(stored?.tokenIdentifier) ??
        "",
      tokenKey:
        this.stringOrNull(stored?.CRISP_TOKEN_KEY) ??
        this.stringOrNull(stored?.tokenKey) ??
        "",
    };
  },

  tidioCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): TidioCredentials {
    return {
      clientId:
        this.stringOrNull(stored?.TIDIO_OPENAPI_CLIENT_ID) ??
        this.stringOrNull(stored?.clientId) ??
        "",
      clientSecret:
        this.stringOrNull(stored?.TIDIO_OPENAPI_CLIENT_SECRET) ??
        this.stringOrNull(stored?.clientSecret) ??
        "",
    };
  },

  olarkCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): OlarkCredentials {
    return {
      relayWebhookSecret:
        this.stringOrNull(stored?.OLARK_RELAY_WEBHOOK_SECRET) ??
        this.stringOrNull(stored?.relayWebhookSecret) ??
        "",
    };
  },

  userlikeCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): UserlikeCredentials {
    return {
      organizationToken:
        this.stringOrNull(stored?.USERLIKE_ORGANIZATION_TOKEN) ??
        this.stringOrNull(stored?.organizationToken) ??
        "",
    };
  },

  gladlyCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): GladlyCredentials {
    return {
      organization:
        this.stringOrNull(stored?.GLADLY_ORGANIZATION) ??
        this.stringOrNull(stored?.organization) ??
        "",
      agentEmail:
        this.stringOrNull(stored?.GLADLY_AGENT_EMAIL) ??
        this.stringOrNull(stored?.agentEmail) ??
        "",
      apiToken:
        this.stringOrNull(stored?.GLADLY_API_TOKEN) ??
        this.stringOrNull(stored?.apiToken) ??
        "",
    };
  },

  kustomerCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): KustomerCredentials {
    return {
      apiKey:
        this.stringOrNull(stored?.KUSTOMER_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
    };
  },
};
