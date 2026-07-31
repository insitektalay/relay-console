import type {
  MarketplaceConnectorExecutorResult,
  MarketplaceConnectorSafeErrorCode,
} from "../../types";
import { AcceloApiError } from "../../accelo/accelo-api.adapter";
import { AcquireApiError } from "../../acquire/acquire-api.adapter";
import { AdjustApiError } from "../../adjust/adjust-api.adapter";
import { AgorapulseApiError } from "../../agorapulse/agorapulse-api.adapter";
import { AhaApiError } from "../../aha/aha-api.adapter";
import { AirfocusApiError } from "../../airfocus/airfocus-api.adapter";
import { AirmeetApiError } from "../../airmeet/airmeet-api.adapter";
import { AirshipApiError } from "../../airship/airship-api.adapter";
import { AnytypeApiError } from "../../anytype/anytype-local-api.adapter";
import { AppsFlyerApiError } from "../../appsflyer/appsflyer-api.adapter";
import { ArchbeeApiError } from "../../archbee/archbee-api.adapter";
import { AvazaApiError } from "../../avaza/avaza-api.adapter";
import { BasecampApiError } from "../../basecamp/basecamp-api.adapter";
import { BeehiivApiError } from "../../beehiiv/beehiiv-api.adapter";
import { BlueConicApiError } from "../../blueconic/blueconic-api.adapter";
import { BoxApiError } from "../../box/box-api.adapter";
import { BranchApiError } from "../../branch/branch-api.adapter";
import { BrandwatchApiError } from "../../brandwatch/brandwatch-api.adapter";
import { BufferApiError } from "../../buffer/buffer-api.adapter";
import { CalComApiError } from "../../cal-com/cal-com-api.adapter";
import { CalendlyApiError } from "../../calendly/calendly-api.adapter";
import { CalibreApiError } from "../../calibre/calibre-api.adapter";
import { CensusApiError } from "../../census/census-api.adapter";
import { CleverTapApiError } from "../../clevertap/clevertap-api.adapter";
import { ClioGrowApiError } from "../../clio-grow/clio-grow-api.adapter";
import { ClioManageApiError } from "../../clio-manage/clio-manage-api.adapter";
import { ClockifyApiError } from "../../clockify/clockify-api.adapter";
import { CodaApiError } from "../../coda/coda-api.adapter";
import { ConcreteCmsApiError } from "../../concrete-cms/concrete-cms-api.adapter";
import { CraftCmsApiError } from "../../craft-cms/craft-cms-api.adapter";
import { CraftIoApiError } from "../../craft-io/craft-io-api.adapter";
import { CraftApiError } from "../../craft/craft-api.adapter";
import { CrispApiError } from "../../crisp/crisp-api.adapter";
import { CventApiError } from "../../cvent/cvent-api.adapter";
import { DirectusSelfHostedApiError } from "../../directus-self-hosted/directus-self-hosted-api.adapter";
import { DiscoEdiscoveryApiError } from "../../disco-ediscovery/disco-ediscovery-api.adapter";
import { Document360ApiError } from "../../document360/document360-api.adapter";
import { DocusignIdentifyApiError } from "../../docusign-identify/docusign-identify-api.adapter";
import { DocusignApiError } from "../../docusign/docusign-api.adapter";
import { DropboxSignApiError } from "../../dropbox-sign/dropbox-sign-api.adapter";
import { DropboxApiError } from "../../dropbox/dropbox-api.adapter";
import { DrupalApiError } from "../../drupal/drupal-api.adapter";
import { EDeskApiError } from "../../edesk/edesk-api.adapter";
import { EventPlatformApiError } from "../../event-platform/event-platform-read-api.adapter";
import { FavroApiError } from "../../favro/favro-api.adapter";
import { FilevineApiError } from "../../filevine/filevine-api.adapter";
import { FirebaseCloudMessagingApiError } from "../../firebase-cloud-messaging/firebase-cloud-messaging-api.adapter";
import { FreshcallerApiError } from "../../freshcaller/freshcaller-api.adapter";
import { FreshchatApiError } from "../../freshchat/freshchat-api.adapter";
import { FreshdeskApiError } from "../../freshdesk/freshdesk-api.adapter";
import { FreshmarketerApiError } from "../../freshmarketer/freshmarketer-api.adapter";
import { FreshserviceApiError } from "../../freshservice/freshservice-api.adapter";
import { FrontApiError } from "../../front/front-api.adapter";
import { GhostSelfHostedApiError } from "../../ghost-self-hosted/ghost-self-hosted-api.adapter";
import { GladlyApiError } from "../../gladly/gladly-api.adapter";
import { GoogleVaultApiError } from "../../google-vault/google-vault-api.adapter";
import { GorgiasApiError } from "../../gorgias/gorgias-api.adapter";
import { GrooveApiError } from "../../groove/groove-api.adapter";
import { HarvestApiError } from "../../harvest/harvest-api.adapter";
import { HelpScoutApiError } from "../../help-scout/help-scout-api.adapter";
import { HightouchApiError } from "../../hightouch/hightouch-api.adapter";
import { HomebrewApiError } from "../../homebrew/homebrew-api.adapter";
import { HootsuiteApiError } from "../../hootsuite/hootsuite-api.adapter";
import { IroncladClickwrapApiError } from "../../ironclad-clickwrap/ironclad-clickwrap-api.adapter";
import { JellyfinApiError } from "../../jellyfin/jellyfin-api.adapter";
import { JiraServiceManagementApiError } from "../../jira-service-management/jira-service-management-api.adapter";
import { JiraApiError } from "../../jira/jira-api.adapter";
import { JoomlaApiError } from "../../joomla/joomla-api.adapter";
import { KantataOxApiError } from "../../kantata-ox/kantata-ox-api.adapter";
import { KayakoApiError } from "../../kayako/kayako-api.adapter";
import { KhorosApiError } from "../../khoros/khoros-api.adapter";
import { KirbyCmsApiError } from "../../kirby-cms/kirby-cms-api.adapter";
import { KnowledgeOwlApiError } from "../../knowledgeowl/knowledgeowl-api.adapter";
import { KochavaApiError } from "../../kochava/kochava-api.adapter";
import { KustomerApiError } from "../../kustomer/kustomer-api.adapter";
import { LaterApiError } from "../../later/later-api.adapter";
import { LawPayApiError } from "../../lawpay/lawpay-api.adapter";
import { LiquidPlannerApiError } from "../../liquidplanner/liquidplanner-api.adapter";
import { LiveAgentApiError } from "../../liveagent/liveagent-api.adapter";
import { LiveChatApiError } from "../../livechat/livechat-api.adapter";
import { LyticsApiError } from "../../lytics/lytics-api.adapter";
import { MagentoSelfHostedApiError } from "../../magento-self-hosted/magento-self-hosted-api.adapter";
import { MatomoSelfHostedApiError } from "../../matomo-self-hosted/matomo-self-hosted-api.adapter";
import { MeltwaterApiError } from "../../meltwater/meltwater-api.adapter";
import { MentionApiError } from "../../mention/mention-api.adapter";
import { MetricoolApiError } from "../../metricool/metricool-api.adapter";
import { Microsoft365EdiscoveryGraphError } from "../../microsoft-365-ediscovery/microsoft-365-ediscovery-graph.adapter";
import { MParticleApiError } from "../../mparticle/mparticle-api.adapter";
import { MyCaseApiError } from "../../mycase/mycase-api.adapter";
import { OlarkWebhookError } from "../../olark/olark-webhook.adapter";
import { OneSignalApiError } from "../../onesignal/onesignal-api.adapter";
import { PadletApiError } from "../../padlet/padlet-api.adapter";
import { PandaDocApiError } from "../../pandadoc/pandadoc-api.adapter";
import { PartnerFinanceApiError } from "../../partner-finance/partner-finance-api.adapter";
import { PlanviewAgilePlaceApiError } from "../../planview-agileplace/planview-agileplace-api.adapter";
import { PlausibleSelfHostedApiError } from "../../plausible-self-hosted/plausible-self-hosted-api.adapter";
import { PlexPersonalMediaServerApiError } from "../../plex-personal-media-server/plex-personal-media-server-api.adapter";
import { PracticePantherApiError } from "../../practicepanther/practicepanther-api.adapter";
import { PrestaShopSelfHostedApiError } from "../../prestashop-self-hosted/prestashop-self-hosted-api.adapter";
import { ProductboardApiError } from "../../productboard/productboard-api.adapter";
import { ProductPlanApiError } from "../../productplan/productplan-api.adapter";
import { PublerApiError } from "../../publer/publer-api.adapter";
import { PusherBeamsApiError } from "../../pusher-beams/pusher-beams-api.adapter";
import { PushwooshApiError } from "../../pushwoosh/pushwoosh-api.adapter";
import { ReAmazeApiError } from "../../re-amaze/re-amaze-api.adapter";
import { ReadMeApiError } from "../../readme/readme-api.adapter";
import { SendFoxApiError } from "../../sendfox/sendfox-api.adapter";
import { SessionizeApiError } from "../../sessionize/sessionize-api.adapter";
import { SingularApiError } from "../../singular/singular-api.adapter";
import { SmartsheetApiError } from "../../smartsheet/smartsheet-api.adapter";
import { SmokeballApiError } from "../../smokeball/smokeball-api.adapter";
import { SplashApiError } from "../../splash/splash-api.adapter";
import { SprinklrApiError } from "../../sprinklr/sprinklr-api.adapter";
import { SproutSocialApiError } from "../../sprout-social/sprout-social-api.adapter";
import { StatamicApiError } from "../../statamic/statamic-api.adapter";
import { StrapiSelfHostedApiError } from "../../strapi-self-hosted/strapi-self-hosted-api.adapter";
import { StructureForJiraApiError } from "../../structure-for-jira/structure-for-jira-api.adapter";
import { SubstackApiError } from "../../substack/substack-api.adapter";
import { SupabaseSelfHostedApiError } from "../../supabase-self-hosted/supabase-self-hosted-api.adapter";
import { SynologyDsmApiError } from "../../synology-dsm/synology-dsm-api.adapter";
import { TealiumApiError } from "../../tealium/tealium-api.adapter";
import { TeamworkApiError } from "../../teamwork/teamwork-api.adapter";
import { TelegramPersonalBotsApiError } from "../../telegram-personal-bots/telegram-personal-bots-api.adapter";
import { TempoTimesheetsApiError } from "../../tempo-timesheets/tempo-timesheets-api.adapter";
import { TettraApiError } from "../../tettra/tettra-api.adapter";
import { TickTickApiError } from "../../ticktick/ticktick-api.adapter";
import { TidioApiError } from "../../tidio/tidio-api.adapter";
import { TodoistApiError } from "../../todoist/todoist-api.adapter";
import { TogglTrackApiError } from "../../toggl-track/toggl-track-api.adapter";
import { TreasureDataApiError } from "../../treasure-data/treasure-data-api.adapter";
import { TypeformApiError } from "../../typeform/typeform-api.adapter";
import { UmamiSelfHostedApiError } from "../../umami-self-hosted/umami-self-hosted-api.adapter";
import { UserlikeApiError } from "../../userlike/userlike-api.adapter";
import { VidyardApiError } from "../../vidyard/vidyard-api.adapter";
import { VivaLearningGraphError } from "../../viva-learning/viva-learning-graph.adapter";
import { WordPressWooCommerceSelfHostedApiError } from "../../wordpress-woocommerce-self-hosted/wordpress-woocommerce-self-hosted-api.adapter";
import { WorkfrontPlanningApiError } from "../../workfront-planning/workfront-planning-api.adapter";
import { WrikeApiError } from "../../wrike/wrike-api.adapter";
import { XrayTestManagementApiError } from "../../xray-test-management/xray-test-management-api.adapter";
import { ZephyrScaleApiError } from "../../zephyr-scale/zephyr-scale-api.adapter";

function safeError(
  code: MarketplaceConnectorSafeErrorCode,
  message: string,
  statusCode = 400,
): MarketplaceConnectorExecutorResult {
  return { ok: false, statusCode, error: { code, message } };
}

export function mapKnownConnectorErrorChunk2(
  error: unknown,
): MarketplaceConnectorExecutorResult | null {
  if (error instanceof VivaLearningGraphError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof JiraApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof JiraServiceManagementApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof ProductboardApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof AhaApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof PartnerFinanceApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof ReadMeApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof Document360ApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof ArchbeeApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof EventPlatformApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof SessionizeApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof AirmeetApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof SplashApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof CventApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof TettraApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof KnowledgeOwlApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof FreshserviceApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof FreshchatApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof FreshmarketerApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof FreshcallerApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof LiveChatApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof LiveAgentApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof CrispApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof TidioApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof OlarkWebhookError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof UserlikeApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof GladlyApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof KustomerApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof GorgiasApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof ReAmazeApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof EDeskApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof KayakoApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof AcquireApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof FreshdeskApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof HelpScoutApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof FrontApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof GrooveApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof TeamworkApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof BasecampApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof WrikeApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof SmartsheetApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof TodoistApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof TickTickApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof TogglTrackApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof HarvestApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof ClockifyApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof TempoTimesheetsApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof ZephyrScaleApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof CalendlyApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof CalComApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof IroncladClickwrapApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof DocusignIdentifyApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof DocusignApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof DropboxSignApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof PandaDocApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof TypeformApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof SendFoxApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof BeehiivApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof SubstackApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof HootsuiteApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof BufferApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof SproutSocialApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof LaterApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof AgorapulseApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof MetricoolApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof PublerApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof BrandwatchApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof MentionApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof MeltwaterApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof SprinklrApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof KhorosApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof CleverTapApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof OneSignalApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof AirshipApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof PushwooshApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof PusherBeamsApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof FirebaseCloudMessagingApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof AppsFlyerApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof AdjustApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof BranchApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof SingularApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof KochavaApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof MParticleApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof TealiumApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof LyticsApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof BlueConicApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof TreasureDataApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof HightouchApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof CensusApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof ClioManageApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof ClioGrowApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof MyCaseApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof PracticePantherApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof SmokeballApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof LawPayApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof FilevineApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof DiscoEdiscoveryApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof Microsoft365EdiscoveryGraphError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof GoogleVaultApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof DocusignIdentifyApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof CodaApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof CraftApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof TelegramPersonalBotsApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof MatomoSelfHostedApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof PlausibleSelfHostedApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof UmamiSelfHostedApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof GhostSelfHostedApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof XrayTestManagementApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof StructureForJiraApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof ProductPlanApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof CraftIoApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof AirfocusApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof FavroApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof PlanviewAgilePlaceApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof LiquidPlannerApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof WorkfrontPlanningApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof KantataOxApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof AcceloApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof AvazaApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof HomebrewApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof CalibreApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof PlexPersonalMediaServerApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof JellyfinApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof SynologyDsmApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof WordPressWooCommerceSelfHostedApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof MagentoSelfHostedApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof PrestaShopSelfHostedApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof DrupalApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof JoomlaApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof ConcreteCmsApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof CraftCmsApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof StatamicApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof KirbyCmsApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof DirectusSelfHostedApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof StrapiSelfHostedApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof SupabaseSelfHostedApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof AnytypeApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof DropboxApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof BoxApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof VidyardApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof PadletApiError)
    return safeError(error.code, error.message, error.statusCode);
  return null;
}
