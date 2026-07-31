import { Injectable, Logger, Optional } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ConfigService } from "@nestjs/config";
import { Repository } from "typeorm";
import {
  ApprovalEntity,
  MarketplaceConnectionEntity,
  MarketplaceInstallEntity,
  MessageEntity,
} from "../../../entities";
import { RuntimeDispatchEntity } from "../../../entities/runtime-dispatch.entity";
import { AuditLogService } from "../../audit-log/audit-log.service";
import { ToolRequestService } from "../../tool-request/tool-request.service";
import { MarketplaceConnectorCredentialService } from "./connector-credential.service";
import { MarketplaceConnectorOAuthService } from "./connector-oauth.service";
import { MarketplaceConnectorRegistry } from "./connector-registry";
import { MarketplaceConnectorHandlerRegistry } from "./execution/connector-handler.registry";

import { EVENT_TICKETING_EXECUTORS } from "./execution/provider-handlers/event-ticketing.executors";
import { NATIVE_PROVIDER_EXECUTORS } from "./execution/provider-handlers/native/native-provider-executors.index";
import {
  CONNECTOR_EXECUTION_EXTENSIONS,
  type ConnectorExecutionExtensionMethods,
} from "./execution/service-extensions/connector-execution-extensions.index";
import { ConnectorExecutionAuditService } from "./execution/connector-execution-audit.service";
import { ConnectorExecutionApprovalService } from "./execution/connector-execution-approval.service";
import { installConnectorMethodModules } from "./execution/connector-method-module";

import { DataForSeoApiAdapter } from "./dataforseo/dataforseo-api.adapter";
import { ExaApiAdapter } from "./exa/exa-api.adapter";
import { MailgunApiAdapter } from "./mailgun/mailgun-api.adapter";
import { SendGridApiAdapter } from "./sendgrid/sendgrid-api.adapter";
import { PostmarkApiAdapter } from "./postmark/postmark-api.adapter";
import { ResendApiAdapter } from "./resend/resend-api.adapter";
import { SparkPostApiAdapter } from "./sparkpost/sparkpost-api.adapter";
import { BrevoApiAdapter } from "./brevo/brevo-api.adapter";
import { MailjetApiAdapter } from "./sinch-mailjet/sinch-mailjet-api.adapter";
import { EvernoteApiAdapter } from "./evernote/evernote-api.adapter";
import { FuseBaseMcpAdapter } from "./fusebase/fusebase-mcp.adapter";
import { AtlassianRovoMcpAdapter } from "./atlassian-rovo/atlassian-rovo-mcp.adapter";
import { OpsgenieCloudApiAdapter } from "./opsgenie-cloud/opsgenie-cloud-api.adapter";
import { StatuspageCloudApiAdapter } from "./statuspage-cloud/statuspage-cloud-api.adapter";
import { MemApiAdapter } from "./mem/mem-api.adapter";
import { ReflectApiAdapter } from "./reflect/reflect-api.adapter";
import { ReadwiseApiAdapter } from "./readwise/readwise-api.adapter";
import { CommonRoomApiAdapter } from "./common-room/common-room-api.adapter";
import { SlackEnterpriseGridApiAdapter } from "./slack-enterprise-grid/slack-enterprise-grid-api.adapter";
import { SlackCanvasApiAdapter } from "./slack-canvas/slack-canvas-api.adapter";
import { SlackListsApiAdapter } from "./slack-lists/slack-lists-api.adapter";
import { TeamsPhoneGraphAdapter } from "./teams-phone/teams-phone-graph.adapter";
import { ZoomPhoneApiAdapter } from "./zoom-phone/zoom-phone-api.adapter";
import { ZoomRoomsApiAdapter } from "./zoom-rooms/zoom-rooms-api.adapter";
import { ZoomWebinarsApiAdapter } from "./zoom-webinars/zoom-webinars-api.adapter";
import { ZoomEventsApiAdapter } from "./zoom-events/zoom-events-api.adapter";
import { WebexCallingApiAdapter } from "./webex-calling/webex-calling-api.adapter";
import { GoToWebinarApiAdapter } from "./goto-webinar/goto-webinar-api.adapter";
import { LivestormApiAdapter } from "./livestorm/livestorm-api.adapter";
import { DemioApiAdapter } from "./demio/demio-api.adapter";
import { BigMarkerApiAdapter } from "./bigmarker/bigmarker-api.adapter";
import { RaindropIoApiAdapter } from "./raindrop-io/raindrop-io-api.adapter";
import { InstapaperApiAdapter } from "./instapaper/instapaper-api.adapter";
import { FeedlyApiAdapter } from "./feedly/feedly-api.adapter";
import { InoreaderApiAdapter } from "./inoreader/inoreader-api.adapter";
import { DropboxPaperApiAdapter } from "./dropbox-paper/dropbox-paper-api.adapter";
import { ZohoWorkDriveApiAdapter } from "./zoho-workdrive/zoho-workdrive-api.adapter";
import { EgnyteApiAdapter } from "./egnyte/egnyte-api.adapter";
import { ShareFileApiAdapter } from "./sharefile/sharefile-api.adapter";
import { DeputyApiAdapter } from "./deputy/deputy-api.adapter";
import { HomebaseApiAdapter } from "./homebase/homebase-api.adapter";
import { SevenShiftsApiAdapter } from "./seven-shifts/seven-shifts-api.adapter";
import { ResourceGuruApiAdapter } from "./resource-guru/resource-guru-api.adapter";
import { TimelyTimeTrackingApiAdapter } from "./timely-time-tracking/timely-time-tracking-api.adapter";
import { RescueTimeApiAdapter } from "./rescuetime/rescuetime-api.adapter";
import { HubstaffApiAdapter } from "./hubstaff/hubstaff-api.adapter";
import { TimeDoctorApiAdapter } from "./time-doctor/time-doctor-api.adapter";
import { QuickBooksTimeApiAdapter } from "./quickbooks-time/quickbooks-time-api.adapter";
import { RepliconApiAdapter } from "./replicon/replicon-api.adapter";
import { ActiTimeApiAdapter } from "./actitime/actitime-api.adapter";
import { TrackingTimeMcpAdapter } from "./trackingtime/trackingtime-mcp.adapter";
import { OntraportMcpAdapter } from "./ontraport/ontraport-mcp.adapter";
import { Bitrix24ApiAdapter } from "./bitrix24/bitrix24-api.adapter";
import { AgileCrmApiAdapter } from "./agile-crm/agile-crm-api.adapter";
import { StreakApiAdapter } from "./streak/streak-api.adapter";
import { LessAnnoyingCrmApiAdapter } from "./less-annoying-crm/less-annoying-crm-api.adapter";
import { NutshellApiAdapter } from "./nutshell/nutshell-api.adapter";
import { TeamleaderApiAdapter } from "./teamleader/teamleader-api.adapter";
import { ScoroApiAdapter } from "./scoro/scoro-api.adapter";
import { OdooApiAdapter } from "./odoo/odoo-api.adapter";
import { NetSuiteApiAdapter } from "./netsuite/netsuite-api.adapter";
import { SageAccountingApiAdapter } from "./sage-accounting/sage-accounting-api.adapter";
import { SageIntacctApiAdapter } from "./sage-intacct/sage-intacct-api.adapter";
import { MyobApiAdapter } from "./myob/myob-api.adapter";
import { KashFlowSoapAdapter } from "./kashflow/kashflow-soap.adapter";
import { ZohoBooksApiAdapter } from "./zoho-books/zoho-books-api.adapter";
import { ZohoInvoiceApiAdapter } from "./zoho-invoice/zoho-invoice-api.adapter";
import { ZohoExpenseApiAdapter } from "./zoho-expense/zoho-expense-api.adapter";
import { ZohoDeskApiAdapter } from "./zoho-desk/zoho-desk-api.adapter";
import { ZohoProjectsApiAdapter } from "./zoho-projects/zoho-projects-api.adapter";
import { ClayApiAdapter } from "./clay/clay-api.adapter";
import { PhantomBusterApiAdapter } from "./phantombuster/phantombuster-api.adapter";
import { TexAuApiAdapter } from "./texau/texau-api.adapter";
import { EvabootApiAdapter } from "./evaboot/evaboot-api.adapter";
import { LemlistApiAdapter } from "./lemlist/lemlist-api.adapter";
import { MailshakeApiAdapter } from "./mailshake/mailshake-api.adapter";
import { WoodpeckerApiAdapter } from "./woodpecker/woodpecker-api.adapter";
import { ReplyIoApiAdapter } from "./reply-io/reply-io-api.adapter";
import { MixmaxApiAdapter } from "./mixmax/mixmax-api.adapter";
import { CirrusInsightApiAdapter } from "./cirrus-insight/cirrus-insight-api.adapter";
import { SpotioApiAdapter } from "./spotio/spotio-api.adapter";
import { MyHoursApiAdapter } from "./my-hours/my-hours-api.adapter";
import { PaperformApiAdapter } from "./paperform/paperform-api.adapter";
import { JotformApiAdapter } from "./jotform/jotform-api.adapter";
import { FormstackApiAdapter } from "./formstack/formstack-api.adapter";
import { SurveyMonkeyApiAdapter } from "./surveymonkey/surveymonkey-api.adapter";
import { FilloutApiAdapter } from "./fillout/fillout-api.adapter";
import { TallyApiAdapter } from "./tally/tally-api.adapter";
import { MailchimpApiAdapter } from "./mailchimp/mailchimp-api.adapter";
import { KlaviyoApiAdapter } from "./klaviyo/klaviyo-api.adapter";
import { ConvertKitApiAdapter } from "./convertkit/convertkit-api.adapter";
import { CampaignMonitorApiAdapter } from "./campaign-monitor/campaign-monitor-api.adapter";
import { ConstantContactApiAdapter } from "./constant-contact/constant-contact-api.adapter";
import { ActiveCampaignApiAdapter } from "./activecampaign/activecampaign-api.adapter";
import { CustomerIoApiAdapter } from "./customer-io/customer-io-api.adapter";
import { BrazeApiAdapter } from "./braze/braze-api.adapter";
import { SegmentApiAdapter } from "./segment/segment-api.adapter";
import { MixpanelApiAdapter } from "./mixpanel/mixpanel-api.adapter";
import { AmplitudeApiAdapter } from "./amplitude/amplitude-api.adapter";
import { PendoApiAdapter } from "./pendo/pendo-api.adapter";
import { PostHogApiAdapter } from "./posthog/posthog-api.adapter";
import { SentryApiAdapter } from "./sentry/sentry-api.adapter";
import { WufooApiAdapter } from "./wufoo/wufoo-api.adapter";
import { GravityFormsApiAdapter } from "./gravity-forms/gravity-forms-api.adapter";
import { NinjaFormsApiAdapter } from "./ninja-forms/ninja-forms-api.adapter";
import { WpFormsApiAdapter } from "./wpforms/wpforms-api.adapter";
import { AlchemerApiAdapter } from "./alchemer/alchemer-api.adapter";
import { QualtricsApiAdapter } from "./qualtrics/qualtrics-api.adapter";
import { AskNicelyApiAdapter } from "./asknicely/asknicely-api.adapter";
import { DelightedApiAdapter } from "./delighted/delighted-api.adapter";
import { RefinerApiAdapter } from "./refiner/refiner-api.adapter";
import { HotjarApiAdapter } from "./hotjar/hotjar-api.adapter";
import { UserTestingApiAdapter } from "./usertesting/usertesting-api.adapter";
import { MazeMcpAdapter } from "./maze/maze-mcp.adapter";
import { LookbackMcpAdapter } from "./lookback/lookback-mcp.adapter";
import { UserInterviewsApiAdapter } from "./user-interviews/user-interviews-api.adapter";
import { RespondentApiAdapter } from "./respondent/respondent-api.adapter";
import { DovetailApiAdapter } from "./dovetail/dovetail-api.adapter";
import { SprigApiAdapter } from "./sprig/sprig-api.adapter";
import { AirtableFormsApiAdapter } from "./airtable-forms/airtable-forms-api.adapter";
import { DocuSignClmApiAdapter } from "./docusign-clm/docusign-clm-api.adapter";
import { RewardfulApiAdapter } from "./rewardful/rewardful-api.adapter";
import { FirstPromoterMcpAdapter } from "./firstpromoter/firstpromoter-mcp.adapter";
import { ApolloIoApiAdapter } from "./apollo-io/apollo-io-api.adapter";
import { OutreachApiAdapter } from "./outreach/outreach-api.adapter";
import { SalesloftApiAdapter } from "./salesloft/salesloft-api.adapter";
import { GongApiAdapter } from "./gong/gong-api.adapter";
import { ChorusAiApiAdapter } from "./chorus-ai/chorus-ai-api.adapter";
import { ClariCopilotApiAdapter } from "./clari/clari-copilot-api.adapter";
import { PeopleAiMcpAdapter } from "./people-ai/people-ai-mcp.adapter";
import { CognismApiAdapter } from "./cognism/cognism-api.adapter";
import { ZoomInfoApiAdapter } from "./zoominfo/zoominfo-api.adapter";
import { ClearbitApiAdapter } from "./clearbit/clearbit-api.adapter";
import { LeadfeederApiAdapter } from "./leadfeeder/leadfeeder-api.adapter";
import { UnbounceApiAdapter } from "./unbounce/unbounce-api.adapter";
import { InstapageApiAdapter } from "./instapage/instapage-api.adapter";
import { OptimizelyApiAdapter } from "./optimizely/optimizely-api.adapter";
import { VwoApiAdapter } from "./vwo/vwo-api.adapter";
import { AbTastyApiAdapter } from "./ab-tasty/ab-tasty-api.adapter";
import { FullstoryApiAdapter } from "./fullstory/fullstory-api.adapter";
import { RunnApiAdapter } from "./runn/runn-api.adapter";
import { EverhourApiAdapter } from "./everhour/everhour-api.adapter";
import { PCloudApiAdapter } from "./pcloud/pcloud-api.adapter";
import { TresoritS3Adapter } from "./tresorit/tresorit-s3.adapter";
import { HightailApiAdapter } from "./hightail/hightail-api.adapter";
import { FilestackApiAdapter } from "./filestack/filestack-api.adapter";
import { ImgixApiAdapter } from "./imgix/imgix-api.adapter";
import { BynderApiAdapter } from "./bynder/bynder-api.adapter";
import { CantoApiAdapter } from "./canto/canto-api.adapter";
import { FrontifyApiAdapter } from "./frontify/frontify-api.adapter";
import { AssetBankApiAdapter } from "./asset-bank/asset-bank-api.adapter";
import { BrandfolderApiAdapter } from "./brandfolder/brandfolder-api.adapter";
import { WidenCollectiveApiAdapter } from "./widen-collective/widen-collective-api.adapter";
import { KontainerApiAdapter } from "./kontainer/kontainer-api.adapter";
import { JiraAlignApiAdapter } from "./jira-align/jira-align-api.adapter";
import { AtlassianCompassApiAdapter } from "./atlassian-compass/atlassian-compass-api.adapter";
import { DaminionApiAdapter } from "./daminion/daminion-api.adapter";
import { MsProjectApiAdapter } from "./ms-project/ms-project-api.adapter";
import { MicrosoftDynamics365SalesApiAdapter } from "./microsoft-dynamics-365-sales/microsoft-dynamics-365-sales-api.adapter";
import { MicrosoftDynamics365CustomerServiceApiAdapter } from "./microsoft-dynamics-365-customer-service/microsoft-dynamics-365-customer-service-api.adapter";
import { MicrosoftDynamics365BusinessCentralApiAdapter } from "./microsoft-dynamics-365-business-central/microsoft-dynamics-365-business-central-api.adapter";
import { MicrosoftEntraIdGraphAdapter } from "./microsoft-entra-id/microsoft-entra-id-graph.adapter";
import { YammerApiAdapter } from "./yammer/yammer-api.adapter";
import { VivaLearningGraphAdapter } from "./viva-learning/viva-learning-graph.adapter";
import { JiraApiAdapter } from "./jira/jira-api.adapter";
import { JiraServiceManagementApiAdapter } from "./jira-service-management/jira-service-management-api.adapter";
import { ProductboardApiAdapter } from "./productboard/productboard-api.adapter";
import { AhaApiAdapter } from "./aha/aha-api.adapter";
import { PartnerFinanceApiAdapter } from "./partner-finance/partner-finance-api.adapter";
import { RoadmunkGraphqlAdapter } from "./roadmunk/roadmunk-graphql.adapter";
import { ShortcutApiAdapter } from "./shortcut/shortcut-api.adapter";
import { HiveApiAdapter } from "./hive/hive-api.adapter";
import { NiftyApiAdapter } from "./nifty/nifty-api.adapter";
import { PaymoApiAdapter } from "./paymo/paymo-api.adapter";
import { KrakenApiAdapter } from "./kraken/kraken-api.adapter";
import { BinanceApiAdapter } from "./binance/binance-api.adapter";
import { GeminiApiAdapter } from "./gemini/gemini-api.adapter";
import { ProofHubApiAdapter } from "./proofhub/proofhub-api.adapter";
import { ProofApiAdapter } from "./proof/proof-api.adapter";
import { TermlyApiAdapter } from "./termly/termly-api.adapter";
import { CookiebotApiAdapter } from "./cookiebot/cookiebot-api.adapter";
import { OneTrustApiAdapter } from "./onetrust/onetrust-api.adapter";
import { SalesforceMarketingCloudApiAdapter } from "./salesforce-marketing-cloud/salesforce-marketing-cloud-api.adapter";
import { SalesforceCommerceCloudApiAdapter } from "./salesforce-commerce-cloud/salesforce-commerce-cloud-api.adapter";
import { MarketoApiAdapter } from "./marketo/marketo-api.adapter";
import { PardotApiAdapter } from "./pardot/pardot-api.adapter";
import { EloquaApiAdapter } from "./eloqua/eloqua-api.adapter";
import { DripApiAdapter } from "./drip/drip-api.adapter";
import { CleverTapApiAdapter } from "./clevertap/clevertap-api.adapter";
import { OneSignalApiAdapter } from "./onesignal/onesignal-api.adapter";
import { AirshipApiAdapter } from "./airship/airship-api.adapter";
import { PushwooshApiAdapter } from "./pushwoosh/pushwoosh-api.adapter";
import { PusherBeamsApiAdapter } from "./pusher-beams/pusher-beams-api.adapter";
import { FirebaseCloudMessagingApiAdapter } from "./firebase-cloud-messaging/firebase-cloud-messaging-api.adapter";
import { AppsFlyerApiAdapter } from "./appsflyer/appsflyer-api.adapter";
import { AdjustApiAdapter } from "./adjust/adjust-api.adapter";
import { BranchApiAdapter } from "./branch/branch-api.adapter";
import { SingularApiAdapter } from "./singular/singular-api.adapter";
import { KochavaApiAdapter } from "./kochava/kochava-api.adapter";
import { MParticleApiAdapter } from "./mparticle/mparticle-api.adapter";
import { TealiumApiAdapter } from "./tealium/tealium-api.adapter";
import { LyticsApiAdapter } from "./lytics/lytics-api.adapter";
import { BlueConicApiAdapter } from "./blueconic/blueconic-api.adapter";
import { TreasureDataApiAdapter } from "./treasure-data/treasure-data-api.adapter";
import { HightouchApiAdapter } from "./hightouch/hightouch-api.adapter";
import { CensusApiAdapter } from "./census/census-api.adapter";
import { ClioManageApiAdapter } from "./clio-manage/clio-manage-api.adapter";
import { ClioGrowApiAdapter } from "./clio-grow/clio-grow-api.adapter";
import { MyCaseApiAdapter } from "./mycase/mycase-api.adapter";
import { PracticePantherApiAdapter } from "./practicepanther/practicepanther-api.adapter";
import { SmokeballApiAdapter } from "./smokeball/smokeball-api.adapter";
import { LawPayApiAdapter } from "./lawpay/lawpay-api.adapter";
import { FilevineApiAdapter } from "./filevine/filevine-api.adapter";
import { DiscoEdiscoveryApiAdapter } from "./disco-ediscovery/disco-ediscovery-api.adapter";
import { Microsoft365EdiscoveryGraphAdapter } from "./microsoft-365-ediscovery/microsoft-365-ediscovery-graph.adapter";
import { GoogleVaultApiAdapter } from "./google-vault/google-vault-api.adapter";
import { MailerLiteApiAdapter } from "./mailerlite/mailerlite-api.adapter";
import { AWeberApiAdapter } from "./aweber/aweber-api.adapter";
import { GetResponseApiAdapter } from "./getresponse/getresponse-api.adapter";
import { MoosendApiAdapter } from "./moosend/moosend-api.adapter";
import { OmnisendApiAdapter } from "./omnisend/omnisend-api.adapter";
import { MailercloudApiAdapter } from "./mailercloud/mailercloud-api.adapter";
import { BenchmarkEmailApiAdapter } from "./benchmark-email/benchmark-email-api.adapter";
import { EmmaApiAdapter } from "./emma/emma-api.adapter";
import { FlodeskApiAdapter } from "./flodesk/flodesk-api.adapter";
import { MeisterTaskApiAdapter } from "./meistertask/meistertask-api.adapter";
import { NozbeApiAdapter } from "./nozbe/nozbe-api.adapter";
import { HabiticaApiAdapter } from "./habitica/habitica-api.adapter";
import { AmazingMarvinApiAdapter } from "./amazing-marvin/amazing-marvin-api.adapter";
import { MotionApiAdapter } from "./motion/motion-api.adapter";
import { ReclaimAiApiAdapter } from "./reclaim-ai/reclaim-ai-api.adapter";
import { SavvyCalApiAdapter } from "./savvycal/savvycal-api.adapter";
import { YouCanBookMeApiAdapter } from "./youcanbookme/youcanbookme-api.adapter";
import { AcuitySchedulingApiAdapter } from "./acuity-scheduling/acuity-scheduling-api.adapter";
import { SimplyBookMeApiAdapter } from "./simplybook-me/simplybook-me-api.adapter";
import { OnceHubApiAdapter } from "./oncehub/oncehub-api.adapter";
import { SalesflareApiAdapter } from "./salesflare/salesflare-api.adapter";
import { ZendeskSellApiAdapter } from "./zendesk-sell/zendesk-sell-api.adapter";
import { KeapMaxClassicApiAdapter } from "./keap-max-classic/keap-max-classic-api.adapter";
import { FolkCrmApiAdapter } from "./folk-crm/folk-crm-api.adapter";
import { OnePageCrmApiAdapter } from "./onepagecrm/onepagecrm-api.adapter";
import { FollowUpBossApiAdapter } from "./follow-up-boss/follow-up-boss-api.adapter";
import { ChimeCrmApiAdapter } from "./chime-crm/chime-crm-api.adapter";
import { ReallySimpleSystemsApiAdapter } from "./really-simple-systems/really-simple-systems-api.adapter";
import { VtigerCrmApiAdapter } from "./vtiger-crm/vtiger-crm-api.adapter";
import { SuiteCrmCloudApiAdapter } from "./suitecrm-cloud/suitecrm-cloud-api.adapter";
import { SugarCrmApiAdapter } from "./sugarcrm/sugarcrm-api.adapter";
import { CreatioApiAdapter } from "./creatio/creatio-api.adapter";
import { AttioApiAdapter } from "./attio/attio-api.adapter";
import { SetmoreApiAdapter } from "./setmore/setmore-api.adapter";
import { PlutioApiAdapter } from "./plutio/plutio-api.adapter";
import { ShootProofApiAdapter } from "./shootproof/shootproof-api.adapter";
import { SmugMugApiAdapter } from "./smugmug/smugmug-api.adapter";
import { FlickrApiAdapter } from "./flickr/flickr-api.adapter";
import { DribbbleApiAdapter } from "./dribbble/dribbble-api.adapter";
import { DeviantArtApiAdapter } from "./deviantart/deviantart-api.adapter";
import { BandcampApiAdapter } from "./bandcamp/bandcamp-api.adapter";
import { MixcloudApiAdapter } from "./mixcloud/mixcloud-api.adapter";
import { AudiomackApiAdapter } from "./audiomack/audiomack-api.adapter";
import { AudiusApiAdapter } from "./audius/audius-api.adapter";
import { PodbeanApiAdapter } from "./podbean/podbean-api.adapter";
import { MailchimpTransactionalApiAdapter } from "./mailchimp-transactional/mailchimp-transactional-api.adapter";
import { MailchimpSurveysApiAdapter } from "./mailchimp-surveys/mailchimp-surveys-api.adapter";
import { KlaviyoSmsApiAdapter } from "./klaviyo-sms/klaviyo-sms-api.adapter";
import { AttentiveApiAdapter } from "./attentive/attentive-api.adapter";
import { PostscriptApiAdapter } from "./postscript/postscript-api.adapter";
import { SendlaneApiAdapter } from "./sendlane/sendlane-api.adapter";
import { IterableApiAdapter } from "./iterable/iterable-api.adapter";
import { IterableSmsApiAdapter } from "./iterable-sms/iterable-sms-api.adapter";
import { OrttoApiAdapter } from "./ortto/ortto-api.adapter";
import { VeroApiAdapter } from "./vero/vero-api.adapter";
import { MessageGearsApiAdapter } from "./messagegears/messagegears-api.adapter";
import { MaropostApiAdapter } from "./maropost/maropost-api.adapter";
import { EmarsysApiAdapter } from "./emarsys/emarsys-api.adapter";
import { SailthruApiAdapter } from "./sailthru/sailthru-api.adapter";
import { ListrakApiAdapter } from "./listrak/listrak-api.adapter";
import { DotdigitalApiAdapter } from "./dotdigital/dotdigital-api.adapter";
import { AcousticCampaignApiAdapter } from "./acoustic-campaign/acoustic-campaign-api.adapter";
import { BloomreachEngagementApiAdapter } from "./bloomreach-engagement/bloomreach-engagement-api.adapter";
import { MoEngageApiAdapter } from "./moengage/moengage-api.adapter";
import { SalesforceDataCloudApiAdapter } from "./salesforce-data-cloud/salesforce-data-cloud-api.adapter";
import { AdobeRealTimeCdpApiAdapter } from "./adobe-real-time-cdp/adobe-real-time-cdp-api.adapter";
import { TwilioSegmentEngageApiAdapter } from "./twilio-segment-engage/twilio-segment-engage-api.adapter";
import { AmplitudeExperimentApiAdapter } from "./amplitude-experiment/amplitude-experiment-api.adapter";
import { MixpanelCohortsApiAdapter } from "./mixpanel-cohorts/mixpanel-cohorts-api.adapter";
import { PostHogFeatureFlagsApiAdapter } from "./posthog-feature-flags/posthog-feature-flags-api.adapter";
import { StatsigApiAdapter } from "./statsig/statsig-api.adapter";
import { LaunchDarklyApiAdapter } from "./launchdarkly/launchdarkly-api.adapter";
import { SplitIoApiAdapter } from "./split-io/split-io-api.adapter";
import { FlagsmithCloudApiAdapter } from "./flagsmith-cloud/flagsmith-cloud-api.adapter";
import { ConfigCatApiAdapter } from "./configcat/configcat-api.adapter";
import { GrowthBookCloudApiAdapter } from "./growthbook-cloud/growthbook-cloud-api.adapter";
import { UnleashCloudApiAdapter } from "./unleash-cloud/unleash-cloud-api.adapter";
import { OptimizelyRolloutsApiAdapter } from "./optimizely-rollouts/optimizely-rollouts-api.adapter";
import { VwoTestingApiAdapter } from "./vwo-testing/vwo-testing-api.adapter";
import { AbTastyFeatureExperimentationApiAdapter } from "./ab-tasty-feature-experimentation/ab-tasty-feature-experimentation-api.adapter";
import { SquareAppointmentsApiAdapter } from "./square-appointments/square-appointments-api.adapter";
import { VagaroApiAdapter } from "./vagaro/vagaro-api.adapter";
import { MindbodyApiAdapter } from "./mindbody/mindbody-api.adapter";
import { JaneAppApiAdapter } from "./jane-app/jane-app-api.adapter";
import { ClinikoApiAdapter } from "./cliniko/cliniko-api.adapter";
import { PracticeBetterApiAdapter } from "./practice-better/practice-better-api.adapter";
import { HealthieGraphqlAdapter } from "./healthie/healthie-graphql.adapter";
import { ReadMeApiAdapter } from "./readme/readme-api.adapter";
import { Document360ApiAdapter } from "./document360/document360-api.adapter";
import { ArchbeeApiAdapter } from "./archbee/archbee-api.adapter";
import { TettraApiAdapter } from "./tettra/tettra-api.adapter";
import { KnowledgeOwlApiAdapter } from "./knowledgeowl/knowledgeowl-api.adapter";
import { CodaApiAdapter } from "./coda/coda-api.adapter";
import { CraftApiAdapter } from "./craft/craft-api.adapter";
import { TelegramPersonalBotsApiAdapter } from "./telegram-personal-bots/telegram-personal-bots-api.adapter";
import { MatomoSelfHostedApiAdapter } from "./matomo-self-hosted/matomo-self-hosted-api.adapter";
import { PlausibleSelfHostedApiAdapter } from "./plausible-self-hosted/plausible-self-hosted-api.adapter";
import { UmamiSelfHostedApiAdapter } from "./umami-self-hosted/umami-self-hosted-api.adapter";
import { GhostSelfHostedApiAdapter } from "./ghost-self-hosted/ghost-self-hosted-api.adapter";
import { XrayTestManagementApiAdapter } from "./xray-test-management/xray-test-management-api.adapter";
import { StructureForJiraApiAdapter } from "./structure-for-jira/structure-for-jira-api.adapter";
import { ProductPlanApiAdapter } from "./productplan/productplan-api.adapter";
import { CraftIoApiAdapter } from "./craft-io/craft-io-api.adapter";
import { AirfocusApiAdapter } from "./airfocus/airfocus-api.adapter";
import { FavroApiAdapter } from "./favro/favro-api.adapter";
import { PlanviewAgilePlaceApiAdapter } from "./planview-agileplace/planview-agileplace-api.adapter";
import { LiquidPlannerApiAdapter } from "./liquidplanner/liquidplanner-api.adapter";
import { WorkfrontPlanningApiAdapter } from "./workfront-planning/workfront-planning-api.adapter";
import { KantataOxApiAdapter } from "./kantata-ox/kantata-ox-api.adapter";
import { AcceloApiAdapter } from "./accelo/accelo-api.adapter";
import { AvazaApiAdapter } from "./avaza/avaza-api.adapter";
import { HomebrewApiAdapter } from "./homebrew/homebrew-api.adapter";
import { CalibreApiAdapter } from "./calibre/calibre-api.adapter";
import { PlexPersonalMediaServerApiAdapter } from "./plex-personal-media-server/plex-personal-media-server-api.adapter";
import { JellyfinApiAdapter } from "./jellyfin/jellyfin-api.adapter";
import { SynologyDsmApiAdapter } from "./synology-dsm/synology-dsm-api.adapter";
import { WordPressWooCommerceSelfHostedApiAdapter } from "./wordpress-woocommerce-self-hosted/wordpress-woocommerce-self-hosted-api.adapter";
import { MagentoSelfHostedApiAdapter } from "./magento-self-hosted/magento-self-hosted-api.adapter";
import { PrestaShopSelfHostedApiAdapter } from "./prestashop-self-hosted/prestashop-self-hosted-api.adapter";
import { DrupalApiAdapter } from "./drupal/drupal-api.adapter";
import { JoomlaApiAdapter } from "./joomla/joomla-api.adapter";
import { ConcreteCmsApiAdapter } from "./concrete-cms/concrete-cms-api.adapter";
import { CraftCmsApiAdapter } from "./craft-cms/craft-cms-api.adapter";
import { StatamicApiAdapter } from "./statamic/statamic-api.adapter";
import { KirbyCmsApiAdapter } from "./kirby-cms/kirby-cms-api.adapter";
import { DirectusSelfHostedApiAdapter } from "./directus-self-hosted/directus-self-hosted-api.adapter";
import { StrapiSelfHostedApiAdapter } from "./strapi-self-hosted/strapi-self-hosted-api.adapter";
import { SupabaseSelfHostedApiAdapter } from "./supabase-self-hosted/supabase-self-hosted-api.adapter";
import { AnytypeLocalApiAdapter } from "./anytype/anytype-local-api.adapter";
import { DropboxApiAdapter } from "./dropbox/dropbox-api.adapter";
import { BoxApiAdapter } from "./box/box-api.adapter";
import { GuruApiAdapter } from "./guru/guru-api.adapter";
import { GuruMcpAdapter } from "./guru/guru-mcp.adapter";
import { SliteMcpAdapter } from "./slite/slite-mcp.adapter";
import { NuclinoMcpAdapter } from "./nuclino/nuclino-mcp.adapter";
import { ScribeMcpAdapter } from "./scribe/scribe-mcp.adapter";
import { VidyardApiAdapter } from "./vidyard/vidyard-api.adapter";
import { VimeoApiAdapter } from "./vimeo/vimeo-api.adapter";
import { WistiaApiAdapter } from "./wistia/wistia-api.adapter";
import { FrameIoApiAdapter } from "./frame-io/frame-io-api.adapter";
import { DescriptApiAdapter } from "./descript/descript-api.adapter";
import { RevApiAdapter } from "./rev/rev-api.adapter";
import { BuzzsproutApiAdapter } from "./buzzsprout/buzzsprout-api.adapter";
import { CaptivateFmApiAdapter } from "./captivate-fm/captivate-fm-api.adapter";
import { TransistorFmApiAdapter } from "./transistor-fm/transistor-fm-api.adapter";
import { RiversideFmApiAdapter } from "./riverside-fm/riverside-fm-api.adapter";
import { RestreamApiAdapter } from "./restream/restream-api.adapter";
import { OtterAiMcpAdapter } from "./otter-ai/otter-ai-mcp.adapter";
import { FirefliesAiMcpAdapter } from "./fireflies-ai/fireflies-ai-mcp.adapter";
import { AnyDoMcpAdapter } from "./any-do/any-do-mcp.adapter";
import { AkiflowMcpAdapter } from "./akiflow/akiflow-mcp.adapter";
import { SunsamaMcpAdapter } from "./sunsama/sunsama-mcp.adapter";
import { RememberTheMilkMcpAdapter } from "./remember-the-milk/remember-the-milk-mcp.adapter";
import { FathomMcpAdapter } from "./fathom/fathom-mcp.adapter";
import { BonsaiMcpAdapter } from "./bonsai/bonsai-mcp.adapter";
import { TlDvApiAdapter } from "./tl-dv/tl-dv-api.adapter";
import { GrainMcpAdapter } from "./grain/grain-mcp.adapter";
import { WhimsicalMcpAdapter } from "./whimsical/whimsical-mcp.adapter";
import { CognitoFormsMcpAdapter } from "./cognito-forms/cognito-forms-mcp.adapter";
import { JotformMcpAdapter } from "./jotform/jotform-mcp.adapter";
import { XMindMcpAdapter } from "./xmind/xmind-mcp.adapter";
import { AdobeAnalyticsMcpAdapter } from "./adobe-analytics/adobe-analytics-mcp.adapter";
import { AdobeMarketoEngageApiAdapter } from "./adobe-marketo-engage/adobe-marketo-engage-api.adapter";
import { AdobeTargetApiAdapter } from "./adobe-target/adobe-target-api.adapter";
import { OsanoApiAdapter } from "./osano/osano-api.adapter";
import { SecureframeApiAdapter } from "./secureframe/secureframe-api.adapter";
import { VantaApiAdapter } from "./vanta/vanta-api.adapter";
import { CartaApiAdapter } from "./carta/carta-api.adapter";
import { ShareworksApiAdapter } from "./shareworks/shareworks-api.adapter";
import { LedgyApiAdapter } from "./ledgy/ledgy-api.adapter";
import { DrataApiAdapter } from "./drata/drata-api.adapter";
import { SprintoApiAdapter } from "./sprinto/sprinto-api.adapter";
import { HyperproofApiAdapter } from "./hyperproof/hyperproof-api.adapter";
import { WorkivaApiAdapter } from "./workiva/workiva-api.adapter";
import { CloudinaryMcpAdapter } from "./cloudinary/cloudinary-mcp.adapter";
import { PadletApiAdapter } from "./padlet/padlet-api.adapter";
import { DrawIoMcpAdapter } from "./draw-io/draw-io-mcp.adapter";
import { MindMeisterApiAdapter } from "./mindmeister/mindmeister-api.adapter";
import { MuralApiAdapter } from "./mural/mural-api.adapter";
import { FigJamApiAdapter } from "./figjam/figjam-api.adapter";
import { FigmaApiAdapter } from "./figma/figma-api.adapter";
import { MiroApiAdapter } from "./miro/miro-api.adapter";
import { CanvaApiAdapter } from "./canva/canva-api.adapter";
import { WebflowApiAdapter } from "./webflow/webflow-api.adapter";
import { WordPressComApiAdapter } from "./wordpress-com/wordpress-com-api.adapter";
import { GhostApiAdapter } from "./ghost/ghost-api.adapter";
import { ContentfulApiAdapter } from "./contentful/contentful-api.adapter";
import { SanityApiAdapter } from "./sanity/sanity-api.adapter";
import { StrapiCloudApiAdapter } from "./strapi-cloud/strapi-cloud-api.adapter";
import { ShopifyApiAdapter } from "./shopify/shopify-api.adapter";
import { WooCommerceApiAdapter } from "./woocommerce/woocommerce-api.adapter";
import { StripeApiAdapter } from "./stripe/stripe-api.adapter";
import { PayPalApiAdapter } from "./paypal/paypal-api.adapter";
import { KajabiCommunitiesApiAdapter } from "./kajabi-communities/kajabi-communities-api.adapter";
import { CircleApiAdapter } from "./circle/circle-api.adapter";
import { MightyNetworksApiAdapter } from "./mighty-networks/mighty-networks-api.adapter";
import { DiscourseApiAdapter } from "./discourse/discourse-api.adapter";
import { VanillaForumsApiAdapter } from "./vanilla-forums/vanilla-forums-api.adapter";
import { BettermodeApiAdapter } from "./bettermode/bettermode-api.adapter";
import { HigherLogicApiAdapter } from "./higher-logic/higher-logic-api.adapter";
import { HivebriteApiAdapter } from "./hivebrite/hivebrite-api.adapter";
import { XeroApiAdapter } from "./xero/xero-api.adapter";
import { QuickBooksApiAdapter } from "./quickbooks/quickbooks-api.adapter";
import { FreshBooksApiAdapter } from "./freshbooks/freshbooks-api.adapter";
import { WaveApiAdapter } from "./wave/wave-api.adapter";
import { FreeAgentApiAdapter } from "./freeagent/freeagent-api.adapter";
import { SalesforceApiAdapter } from "./salesforce/salesforce-api.adapter";
import { HubSpotApiAdapter } from "./hubspot/hubspot-api.adapter";
import { PipedriveApiAdapter } from "./pipedrive/pipedrive-api.adapter";
import { ZohoApiAdapter } from "./zoho/zoho-api.adapter";
import { ZohoPeopleApiAdapter } from "./zoho-people/zoho-people-api.adapter";
import { ZohoCampaignsApiAdapter } from "./zoho-campaigns/zoho-campaigns-api.adapter";
import { ZohoAnalyticsApiAdapter } from "./zoho-analytics/zoho-analytics-api.adapter";
import { CopperApiAdapter } from "./copper/copper-api.adapter";
import { CloseApiAdapter } from "./close/close-api.adapter";
import { ZendeskApiAdapter } from "./zendesk/zendesk-api.adapter";
import { IntercomApiAdapter } from "./intercom/intercom-api.adapter";
import { FreshserviceApiAdapter } from "./freshservice/freshservice-api.adapter";
import { FreshchatApiAdapter } from "./freshchat/freshchat-api.adapter";
import { FreshmarketerApiAdapter } from "./freshmarketer/freshmarketer-api.adapter";
import { FreshcallerApiAdapter } from "./freshcaller/freshcaller-api.adapter";
import { LiveChatApiAdapter } from "./livechat/livechat-api.adapter";
import { LiveAgentApiAdapter } from "./liveagent/liveagent-api.adapter";
import { CrispApiAdapter } from "./crisp/crisp-api.adapter";
import { TidioApiAdapter } from "./tidio/tidio-api.adapter";
import { OlarkWebhookAdapter } from "./olark/olark-webhook.adapter";
import { UserlikeApiAdapter } from "./userlike/userlike-api.adapter";
import { GladlyApiAdapter } from "./gladly/gladly-api.adapter";
import { KustomerApiAdapter } from "./kustomer/kustomer-api.adapter";
import { GorgiasApiAdapter } from "./gorgias/gorgias-api.adapter";
import { ReAmazeApiAdapter } from "./re-amaze/re-amaze-api.adapter";
import { EDeskApiAdapter } from "./edesk/edesk-api.adapter";
import { KayakoApiAdapter } from "./kayako/kayako-api.adapter";
import { AcquireApiAdapter } from "./acquire/acquire-api.adapter";
import { FreshdeskApiAdapter } from "./freshdesk/freshdesk-api.adapter";
import { HelpScoutApiAdapter } from "./help-scout/help-scout-api.adapter";
import { FrontApiAdapter } from "./front/front-api.adapter";
import { GrooveApiAdapter } from "./groove/groove-api.adapter";
import { TeamworkApiAdapter } from "./teamwork/teamwork-api.adapter";
import { BasecampApiAdapter } from "./basecamp/basecamp-api.adapter";
import { WrikeApiAdapter } from "./wrike/wrike-api.adapter";
import { SmartsheetApiAdapter } from "./smartsheet/smartsheet-api.adapter";
import { TodoistApiAdapter } from "./todoist/todoist-api.adapter";
import { TickTickApiAdapter } from "./ticktick/ticktick-api.adapter";
import { TogglTrackApiAdapter } from "./toggl-track/toggl-track-api.adapter";
import { HarvestApiAdapter } from "./harvest/harvest-api.adapter";
import { ClockifyApiAdapter } from "./clockify/clockify-api.adapter";
import { BoundedRestApiAdapter } from "./bounded-rest/bounded-rest-api.adapter";

import { EhrFhirApiAdapter } from "./ehr-fhir/ehr-fhir-api.adapter";

import { TempoTimesheetsApiAdapter } from "./tempo-timesheets/tempo-timesheets-api.adapter";
import { ZephyrScaleApiAdapter } from "./zephyr-scale/zephyr-scale-api.adapter";
import { CalendlyApiAdapter } from "./calendly/calendly-api.adapter";
import { CalComApiAdapter } from "./cal-com/cal-com-api.adapter";
import { DocusignApiAdapter } from "./docusign/docusign-api.adapter";
import { DropboxSignApiAdapter } from "./dropbox-sign/dropbox-sign-api.adapter";
import { PandaDocApiAdapter } from "./pandadoc/pandadoc-api.adapter";
import { TypeformApiAdapter } from "./typeform/typeform-api.adapter";
import { DatadogApiAdapter } from "./datadog/datadog-api.adapter";
import { NewRelicApiAdapter } from "./new-relic/new-relic-api.adapter";
import { PagerDutyApiAdapter } from "./pagerduty/pagerduty-api.adapter";
import { StatuspagePublicApiAdapter } from "./statuspage/statuspage-public-api.adapter";
import { CloudflareApiAdapter } from "./cloudflare/cloudflare-api.adapter";
import { VercelApiAdapter } from "./vercel/vercel-api.adapter";
import { NetlifyApiAdapter } from "./netlify/netlify-api.adapter";
import { HerokuApiAdapter } from "./heroku/heroku-api.adapter";
import { DigitalOceanApiAdapter } from "./digitalocean/digitalocean-api.adapter";
import { FirebaseApiAdapter } from "./firebase/firebase-api.adapter";
import { SupabaseApiAdapter } from "./supabase/supabase-api.adapter";
import { OktaApiAdapter } from "./okta/okta-api.adapter";
import { BambooHRApiAdapter } from "./bamboohr/bamboohr-api.adapter";
import { GreenhouseApiAdapter } from "./greenhouse/greenhouse-api.adapter";
import { LeverApiAdapter } from "./lever/lever-api.adapter";
import { GmailApiAdapter } from "./gmail/gmail-api.adapter";
import { GoogleCalendarApiAdapter } from "./google-calendar/google-calendar-api.adapter";
import { IroncladClickwrapApiAdapter } from "./ironclad-clickwrap/ironclad-clickwrap-api.adapter";
import { DocusignIdentifyApiAdapter } from "./docusign-identify/docusign-identify-api.adapter";
import { LucidsparkApiAdapter } from "./lucidspark/lucidspark-api.adapter";
import { LucidchartApiAdapter } from "./lucidchart/lucidchart-api.adapter";
import { SlabGraphqlAdapter } from "./slab/slab-graphql.adapter";
import { ConfluenceApiAdapter } from "./confluence/confluence-api.adapter";
import { QuipApiAdapter } from "./quip/quip-api.adapter";
import { LinkedInApiAdapter } from "./linkedin/linkedin-api.adapter";
import { NextdoorApiAdapter } from "./nextdoor/nextdoor-api.adapter";
import { MeetupApiAdapter } from "./meetup/meetup-api.adapter";
import { EventbriteApiAdapter } from "./eventbrite/eventbrite-api.adapter";

import { GoldcastApiAdapter } from "./goldcast/goldcast-api.adapter";
import { AirmeetApiAdapter } from "./airmeet/airmeet-api.adapter";
import { SplashApiAdapter } from "./splash/splash-api.adapter";
import { CventApiAdapter } from "./cvent/cvent-api.adapter";
import { BizzaboApiAdapter } from "./bizzabo/bizzabo-api.adapter";
import { EventzillaApiAdapter } from "./eventzilla/eventzilla-api.adapter";
import { TicketTailorApiAdapter } from "./ticket-tailor/ticket-tailor-api.adapter";
import { HumanitixApiAdapter } from "./humanitix/humanitix-api.adapter";
import { BuildiumApiAdapter } from "./buildium/buildium-api.adapter";
import { SessionizeApiAdapter } from "./sessionize/sessionize-api.adapter";
import { PretixApiAdapter } from "./pretix/pretix-api.adapter";
import { DonorboxApiAdapter } from "./donorbox/donorbox-api.adapter";
import { LumaApiAdapter } from "./luma/luma-api.adapter";
import { HopinApiAdapter } from "./hopin/hopin-api.adapter";
import { WebexApiAdapter } from "./webex/webex-api.adapter";
import { GoToMeetingApiAdapter } from "./goto-meeting/goto-meeting-api.adapter";
import { RingCentralApiAdapter } from "./ringcentral/ringcentral-api.adapter";
import { DialpadApiAdapter } from "./dialpad/dialpad-api.adapter";
import { AircallApiAdapter } from "./aircall/aircall-api.adapter";
import { OpenPhoneApiAdapter } from "./openphone/openphone-api.adapter";
import { TwilioApiAdapter } from "./twilio/twilio-api.adapter";
import { VonageApiAdapter } from "./vonage/vonage-api.adapter";
import { MessageBirdApiAdapter } from "./messagebird/messagebird-api.adapter";
import { FredApiAdapter } from "./fred/fred-api.adapter";
import { ApolloGraphOsApiAdapter } from "./apollo-graphql-studio/apollo-graphos-api.adapter";
import { HunterApiAdapter } from "./hunter-io/hunter-api.adapter";
import { SnovApiAdapter } from "./snov-io/snov-api.adapter";
import { LushaApiAdapter } from "./lusha/lusha-api.adapter";
import { LeadIqApiAdapter } from "./leadiq/leadiq-api.adapter";
import { SeamlessAiApiAdapter } from "./seamless-ai/seamless-ai-api.adapter";
import { RocketReachApiAdapter } from "./rocketreach/rocketreach-api.adapter";
import { UpLeadApiAdapter } from "./uplead/uplead-api.adapter";
import { WizaApiAdapter } from "./wiza/wiza-api.adapter";
import { ThreadsApiAdapter } from "./threads/threads-api.adapter";
import { PinterestApiAdapter } from "./pinterest/pinterest-api.adapter";
import { TumblrApiAdapter } from "./tumblr/tumblr-api.adapter";
import { MastodonApiAdapter } from "./mastodon/mastodon-api.adapter";
import { TwistApiAdapter } from "./twist/twist-api.adapter";
import { ZohoMailApiAdapter } from "./zoho-mail/zoho-mail-api.adapter";
import { SlackApiAdapter } from "./slack/slack-api.adapter";
import { GitHubApiAdapter } from "./github/github-api.adapter";
import { GitLabApiAdapter } from "./gitlab/gitlab-api.adapter";
import { BitbucketApiAdapter } from "./bitbucket/bitbucket-api.adapter";
import { NotionApiAdapter } from "./notion/notion-api.adapter";
import { LinearApiAdapter } from "./linear/linear-api.adapter";
import { AsanaApiAdapter } from "./asana/asana-api.adapter";
import { TrelloApiAdapter } from "./trello/trello-api.adapter";
import { ClickUpApiAdapter } from "./clickup/clickup-api.adapter";
import { MondayComApiAdapter } from "./monday-com/monday-com-api.adapter";
import { AirtableApiAdapter } from "./airtable/airtable-api.adapter";
import { OutlookGraphAdapter } from "./outlook/outlook-graph.adapter";
import { MicrosoftTeamsGraphAdapter } from "./microsoft-teams/microsoft-teams-graph.adapter";
import { GoogleDriveApiAdapter } from "./google-drive/google-drive-api.adapter";
import { GoogleDocsApiAdapter } from "./google-docs/google-docs-api.adapter";
import { GoogleSheetsApiAdapter } from "./google-sheets/google-sheets-api.adapter";
import { GoogleSlidesApiAdapter } from "./google-slides/google-slides-api.adapter";
import { GoogleFormsApiAdapter } from "./google-forms/google-forms-api.adapter";
import { GoogleTasksApiAdapter } from "./google-tasks/google-tasks-api.adapter";
import { GoogleContactsApiAdapter } from "./google-contacts/google-contacts-api.adapter";
import { GooglePhotosApiAdapter } from "./google-photos/google-photos-api.adapter";
import { GoogleMeetApiAdapter } from "./google-meet/google-meet-api.adapter";
import { GoogleChatApiAdapter } from "./google-chat/google-chat-api.adapter";
import { GoogleAdsApiAdapter } from "./google-ads/google-ads-api.adapter";
import { GoogleAnalyticsApiAdapter } from "./google-analytics/google-analytics-api.adapter";
import { GoogleSearchConsoleApiAdapter } from "./google-search-console/google-search-console-api.adapter";
import { GoogleBusinessProfileApiAdapter } from "./google-business-profile/google-business-profile-api.adapter";
import { GoogleMerchantCenterApiAdapter } from "./google-merchant-center/google-merchant-center-api.adapter";
import { YouTubeApiAdapter } from "./youtube/youtube-api.adapter";
import { GoogleClassroomApiAdapter } from "./google-classroom/google-classroom-api.adapter";
import { GoogleMapsPlatformApiAdapter } from "./google-maps-platform/google-maps-platform-api.adapter";
import { OneDriveApiAdapter } from "./onedrive/onedrive-api.adapter";
import { SharePointApiAdapter } from "./sharepoint/sharepoint-api.adapter";
import { MicrosoftPlannerApiAdapter } from "./microsoft-planner/microsoft-planner-api.adapter";
import { MicrosoftToDoApiAdapter } from "./microsoft-to-do/microsoft-to-do-api.adapter";
import { MicrosoftListsApiAdapter } from "./microsoft-lists/microsoft-lists-api.adapter";
import { OneNoteApiAdapter } from "./onenote/onenote-api.adapter";
import { MicrosoftBookingsApiAdapter } from "./microsoft-bookings/microsoft-bookings-api.adapter";
import { MicrosoftPowerBIApiAdapter } from "./microsoft-power-bi/microsoft-power-bi-api.adapter";
import { MicrosoftDynamics365ApiAdapter } from "./microsoft-dynamics-365/microsoft-dynamics-365-api.adapter";
import { MicrosoftVivaEngageApiAdapter } from "./microsoft-viva-engage/microsoft-viva-engage-api.adapter";
import { ZoomApiAdapter } from "./zoom/zoom-api.adapter";
import { DiscordApiAdapter } from "./discord/discord-api.adapter";
import { AdobeAcrobatSignApiAdapter } from "./adobe-acrobat-sign/adobe-acrobat-sign-api.adapter";
import { SignNowApiAdapter } from "./signnow/signnow-api.adapter";
import { SignRequestApiAdapter } from "./signrequest/signrequest-api.adapter";
import { SigneasyApiAdapter } from "./signeasy/signeasy-api.adapter";
import { OneSpanSignApiAdapter } from "./onespan-sign/onespan-sign-api.adapter";
import { RightSignatureApiAdapter } from "./rightsignature/rightsignature-api.adapter";
import { GetAcceptApiAdapter } from "./getaccept/getaccept-api.adapter";
import { QwilrApiAdapter } from "./qwilr/qwilr-api.adapter";
import { ProposifyApiAdapter } from "./proposify/proposify-api.adapter";
import { BetterProposalsApiAdapter } from "./better-proposals/better-proposals-api.adapter";
import { ConcordApiAdapter } from "./concord/concord-api.adapter";
import { JuroApiAdapter } from "./juro/juro-api.adapter";
import { IroncladApiAdapter } from "./ironclad/ironclad-api.adapter";
import { LinkSquaresApiAdapter } from "./linksquares/linksquares-api.adapter";
import { SpotDraftApiAdapter } from "./spotdraft/spotdraft-api.adapter";
import { ContractbookApiAdapter } from "./contractbook/contractbook-api.adapter";
import { LogRocketMcpAdapter } from "./logrocket/logrocket-mcp.adapter";
import { SmartlookApiAdapter } from "./smartlook/smartlook-api.adapter";
import { CrazyEggApiAdapter } from "./crazy-egg/crazy-egg-api.adapter";
import { AppcuesApiAdapter } from "./appcues/appcues-api.adapter";
import { UserflowApiAdapter } from "./userflow/userflow-api.adapter";
import { UserpilotApiAdapter } from "./userpilot/userpilot-api.adapter";
import { ChameleonApiAdapter } from "./chameleon/chameleon-api.adapter";
import { VitallyApiAdapter } from "./vitally/vitally-api.adapter";
import { GainsightApiAdapter } from "./gainsight/gainsight-api.adapter";
import { TotangoApiAdapter } from "./totango/totango-api.adapter";
import { CustifyApiAdapter } from "./custify/custify-api.adapter";
import { PlanhatApiAdapter } from "./planhat/planhat-api.adapter";
import { ClientSuccessApiAdapter } from "./clientsuccess/clientsuccess-api.adapter";
import { FreshsalesApiAdapter } from "./freshsales/freshsales-api.adapter";
import { InsightlyApiAdapter } from "./insightly/insightly-api.adapter";
import { NimbleApiAdapter } from "./nimble/nimble-api.adapter";
import { CapsuleCrmApiAdapter } from "./capsule-crm/capsule-crm-api.adapter";
import { KeapApiAdapter } from "./keap/keap-api.adapter";

import { BlueskyActionService } from "../bluesky/bluesky-action.service";
import { ObsidianCliAdapter } from "./obsidian/obsidian-cli.adapter";
import { RoamResearchCliAdapter } from "./roam-research/roam-research-cli.adapter";
import { LogseqCliAdapter } from "./logseq/logseq-cli.adapter";
import { LocalWordPressOrgCliAdapter } from "./local-wordpress-org/local-wordpress-org-cli.adapter";

import { SendFoxApiAdapter } from "./sendfox/sendfox-api.adapter";
import { BeehiivApiAdapter } from "./beehiiv/beehiiv-api.adapter";
import { SubstackApiAdapter } from "./substack/substack-api.adapter";
import { HootsuiteApiAdapter } from "./hootsuite/hootsuite-api.adapter";
import { BufferApiAdapter } from "./buffer/buffer-api.adapter";
import { SproutSocialApiAdapter } from "./sprout-social/sprout-social-api.adapter";
import { LaterApiAdapter } from "./later/later-api.adapter";
import { AgorapulseApiAdapter } from "./agorapulse/agorapulse-api.adapter";
import { MetricoolApiAdapter } from "./metricool/metricool-api.adapter";
import { PublerApiAdapter } from "./publer/publer-api.adapter";
import { BrandwatchApiAdapter } from "./brandwatch/brandwatch-api.adapter";
import { MentionApiAdapter } from "./mention/mention-api.adapter";
import { MeltwaterApiAdapter } from "./meltwater/meltwater-api.adapter";
import { SprinklrApiAdapter } from "./sprinklr/sprinklr-api.adapter";
import { KhorosApiAdapter } from "./khoros/khoros-api.adapter";
@Injectable()
export class MarketplaceConnectorExecutionService {
  readonly logger = new Logger(MarketplaceConnectorExecutionService.name);
  readonly goldcastApi = new GoldcastApiAdapter();
  readonly airmeetApi = new AirmeetApiAdapter();
  readonly splashApi = new SplashApiAdapter();
  readonly cventApi = new CventApiAdapter();
  readonly bizzaboApi = new BizzaboApiAdapter();
  readonly eventzillaApi = new EventzillaApiAdapter();
  readonly ticketTailorApi = new TicketTailorApiAdapter();
  readonly humanitixApi = new HumanitixApiAdapter();
  readonly buildiumApi = new BuildiumApiAdapter();
  readonly sessionizeApi = new SessionizeApiAdapter();
  readonly pretixApi = new PretixApiAdapter();
  readonly donorboxApi = new DonorboxApiAdapter();

  constructor(
    readonly registry: MarketplaceConnectorRegistry,
    readonly credentials: MarketplaceConnectorCredentialService,
    readonly oauth: MarketplaceConnectorOAuthService,
    readonly exaApi: ExaApiAdapter,
    readonly dataForSeoApi: DataForSeoApiAdapter,
    readonly outlookGraph: OutlookGraphAdapter,
    readonly auditLogService: AuditLogService,
    _toolRequestService: ToolRequestService,
    @InjectRepository(RuntimeDispatchEntity)
    readonly runtimeDispatchRepo: Repository<RuntimeDispatchEntity>,
    @InjectRepository(MessageEntity)
    readonly messageRepo: Repository<MessageEntity>,
    @InjectRepository(MarketplaceInstallEntity)
    readonly installRepo: Repository<MarketplaceInstallEntity>,
    @InjectRepository(MarketplaceConnectionEntity)
    readonly connectionRepo: Repository<MarketplaceConnectionEntity>,
    @InjectRepository(ApprovalEntity)
    readonly approvalRepo: Repository<ApprovalEntity>,
    @Optional()
    readonly linkedInApi: LinkedInApiAdapter = new LinkedInApiAdapter(),
    @Optional()
    readonly blueskyActions?: BlueskyActionService,
    @Optional()
    readonly nextdoorApi: NextdoorApiAdapter = new NextdoorApiAdapter(),
    @Optional()
    readonly meetupApi: MeetupApiAdapter = new MeetupApiAdapter(),
    @Optional()
    readonly eventbriteApi: EventbriteApiAdapter = new EventbriteApiAdapter(),
    @Optional()
    readonly webexApi: WebexApiAdapter = new WebexApiAdapter(),
    @Optional()
    readonly goToMeetingApi: GoToMeetingApiAdapter = new GoToMeetingApiAdapter(),
    @Optional()
    readonly ringCentralApi: RingCentralApiAdapter = new RingCentralApiAdapter(),
    @Optional()
    readonly dialpadApi: DialpadApiAdapter = new DialpadApiAdapter(),
    @Optional()
    readonly aircallApi: AircallApiAdapter = new AircallApiAdapter(),
    @Optional()
    readonly openPhoneApi: OpenPhoneApiAdapter = new OpenPhoneApiAdapter(),
    @Optional()
    readonly twilioApi: TwilioApiAdapter = new TwilioApiAdapter(),
    @Optional()
    readonly vonageApi: VonageApiAdapter = new VonageApiAdapter(),
    @Optional()
    readonly messageBirdApi: MessageBirdApiAdapter = new MessageBirdApiAdapter(),
    @Optional()
    readonly fredApi: FredApiAdapter = new FredApiAdapter(),
    @Optional()
    readonly apolloGraphOsApi: ApolloGraphOsApiAdapter = new ApolloGraphOsApiAdapter(),
    @Optional()
    readonly hunterApi: HunterApiAdapter = new HunterApiAdapter(),
    @Optional()
    readonly snovApi: SnovApiAdapter = new SnovApiAdapter(),
    @Optional()
    readonly lushaApi: LushaApiAdapter = new LushaApiAdapter(),
    @Optional()
    readonly leadIqApi: LeadIqApiAdapter = new LeadIqApiAdapter(),
    @Optional()
    readonly seamlessAiApi: SeamlessAiApiAdapter = new SeamlessAiApiAdapter(),
    @Optional()
    readonly rocketReachApi: RocketReachApiAdapter = new RocketReachApiAdapter(),
    @Optional()
    readonly upLeadApi: UpLeadApiAdapter = new UpLeadApiAdapter(),
    @Optional()
    readonly wizaApi: WizaApiAdapter = new WizaApiAdapter(),
    @Optional()
    readonly threadsApi: ThreadsApiAdapter = new ThreadsApiAdapter(),
    @Optional()
    readonly pinterestApi: PinterestApiAdapter = new PinterestApiAdapter(),
    @Optional()
    readonly tumblrApi: TumblrApiAdapter = new TumblrApiAdapter(),
    @Optional()
    readonly mastodonApi: MastodonApiAdapter = new MastodonApiAdapter(),
    @Optional()
    readonly twistApi: TwistApiAdapter = new TwistApiAdapter(),
    @Optional()
    readonly zohoMailApi: ZohoMailApiAdapter = new ZohoMailApiAdapter(),
    @Optional()
    readonly slackApi: SlackApiAdapter = new SlackApiAdapter(),
    @Optional()
    readonly githubApi: GitHubApiAdapter = new GitHubApiAdapter(),
    @Optional()
    readonly gitlabApi: GitLabApiAdapter = new GitLabApiAdapter(),
    @Optional()
    readonly bitbucketApi: BitbucketApiAdapter = new BitbucketApiAdapter(),
    @Optional()
    readonly notionApi: NotionApiAdapter = new NotionApiAdapter(),
    @Optional()
    readonly linearApi: LinearApiAdapter = new LinearApiAdapter(),
    @Optional()
    readonly asanaApi: AsanaApiAdapter = new AsanaApiAdapter(),
    @Optional()
    readonly trelloApi: TrelloApiAdapter = new TrelloApiAdapter(),
    @Optional()
    readonly clickUpApi: ClickUpApiAdapter = new ClickUpApiAdapter(),
    @Optional()
    readonly mondayApi: MondayComApiAdapter = new MondayComApiAdapter(),
    @Optional()
    readonly airtableApi: AirtableApiAdapter = new AirtableApiAdapter(),
    @Optional()
    readonly mailgunApi: MailgunApiAdapter = new MailgunApiAdapter(),
    @Optional()
    readonly sendGridApi: SendGridApiAdapter = new SendGridApiAdapter(),
    @Optional()
    readonly postmarkApi: PostmarkApiAdapter = new PostmarkApiAdapter(),
    @Optional()
    readonly resendApi: ResendApiAdapter = new ResendApiAdapter(),
    @Optional()
    readonly sparkPostApi: SparkPostApiAdapter = new SparkPostApiAdapter(),
    @Optional()
    readonly brevoApi: BrevoApiAdapter = new BrevoApiAdapter(),
    @Optional()
    readonly mailjetApi: MailjetApiAdapter = new MailjetApiAdapter(),
    @Optional()
    readonly evernoteApi: EvernoteApiAdapter = new EvernoteApiAdapter(),
    @Optional()
    readonly fuseBaseMcp: FuseBaseMcpAdapter = new FuseBaseMcpAdapter(),
    @Optional()
    readonly atlassianRovoMcp: AtlassianRovoMcpAdapter = new AtlassianRovoMcpAdapter(),
    @Optional()
    readonly opsgenieCloudApi: OpsgenieCloudApiAdapter = new OpsgenieCloudApiAdapter(),
    @Optional()
    readonly statuspageCloudApi: StatuspageCloudApiAdapter = new StatuspageCloudApiAdapter(),
    @Optional()
    readonly memApi: MemApiAdapter = new MemApiAdapter(),
    @Optional()
    readonly reflectApi: ReflectApiAdapter = new ReflectApiAdapter(),
    @Optional()
    readonly readwiseApi: ReadwiseApiAdapter = new ReadwiseApiAdapter(),
    @Optional()
    readonly commonRoomApi: CommonRoomApiAdapter = new CommonRoomApiAdapter(),
    @Optional()
    readonly slackEnterpriseGridApi: SlackEnterpriseGridApiAdapter = new SlackEnterpriseGridApiAdapter(),
    @Optional()
    readonly slackCanvasApi: SlackCanvasApiAdapter = new SlackCanvasApiAdapter(),
    @Optional()
    readonly slackListsApi: SlackListsApiAdapter = new SlackListsApiAdapter(),
    @Optional()
    readonly teamsPhoneGraph: TeamsPhoneGraphAdapter = new TeamsPhoneGraphAdapter(),
    @Optional()
    readonly zoomPhoneApi: ZoomPhoneApiAdapter = new ZoomPhoneApiAdapter(),
    @Optional()
    readonly zoomRoomsApi: ZoomRoomsApiAdapter = new ZoomRoomsApiAdapter(),
    @Optional()
    readonly zoomWebinarsApi: ZoomWebinarsApiAdapter = new ZoomWebinarsApiAdapter(),
    @Optional()
    readonly zoomEventsApi: ZoomEventsApiAdapter = new ZoomEventsApiAdapter(),
    readonly webexCallingApi: WebexCallingApiAdapter = new WebexCallingApiAdapter(),
    readonly goToWebinarApi: GoToWebinarApiAdapter = new GoToWebinarApiAdapter(),
    readonly livestormApi: LivestormApiAdapter = new LivestormApiAdapter(),
    readonly demioApi: DemioApiAdapter = new DemioApiAdapter(),
    readonly bigMarkerApi: BigMarkerApiAdapter = new BigMarkerApiAdapter(),
    @Optional()
    readonly raindropApi: RaindropIoApiAdapter = new RaindropIoApiAdapter(),
    @Optional()
    readonly instapaperApi: InstapaperApiAdapter = new InstapaperApiAdapter(),
    @Optional()
    readonly feedlyApi: FeedlyApiAdapter = new FeedlyApiAdapter(),
    @Optional()
    readonly inoreaderApi: InoreaderApiAdapter = new InoreaderApiAdapter(),
    @Optional()
    readonly dropboxPaperApi: DropboxPaperApiAdapter = new DropboxPaperApiAdapter(),
    @Optional()
    readonly zohoWorkDriveApi: ZohoWorkDriveApiAdapter = new ZohoWorkDriveApiAdapter(),
    readonly egnyteApi: EgnyteApiAdapter = new EgnyteApiAdapter(),
    readonly shareFileApi: ShareFileApiAdapter = new ShareFileApiAdapter(),
    readonly deputyApi: DeputyApiAdapter = new DeputyApiAdapter(),
    readonly homebaseApi: HomebaseApiAdapter = new HomebaseApiAdapter(),
    readonly sevenShiftsApi: SevenShiftsApiAdapter = new SevenShiftsApiAdapter(),
    readonly resourceGuruApi: ResourceGuruApiAdapter = new ResourceGuruApiAdapter(),
    readonly runnApi: RunnApiAdapter = new RunnApiAdapter(),
    readonly shootProofApi: ShootProofApiAdapter = new ShootProofApiAdapter(),
    readonly smugMugApi: SmugMugApiAdapter = new SmugMugApiAdapter(),
    readonly flickrApi: FlickrApiAdapter = new FlickrApiAdapter(),
    readonly dribbbleApi: DribbbleApiAdapter = new DribbbleApiAdapter(),
    readonly deviantArtApi: DeviantArtApiAdapter = new DeviantArtApiAdapter(),
    readonly bandcampApi: BandcampApiAdapter = new BandcampApiAdapter(),
    readonly mixcloudApi: MixcloudApiAdapter = new MixcloudApiAdapter(),
    readonly audiomackApi: AudiomackApiAdapter = new AudiomackApiAdapter(),
    readonly audiusApi: AudiusApiAdapter = new AudiusApiAdapter(),
    readonly podbeanApi: PodbeanApiAdapter = new PodbeanApiAdapter(),
    readonly mailchimpTransactionalApi: MailchimpTransactionalApiAdapter = new MailchimpTransactionalApiAdapter(),
    readonly mailchimpSurveysApi: MailchimpSurveysApiAdapter = new MailchimpSurveysApiAdapter(),
    readonly klaviyoSmsApi: KlaviyoSmsApiAdapter = new KlaviyoSmsApiAdapter(),
    readonly attentiveApi: AttentiveApiAdapter = new AttentiveApiAdapter(),
    readonly postscriptApi: PostscriptApiAdapter = new PostscriptApiAdapter(),
    readonly sendlaneApi: SendlaneApiAdapter = new SendlaneApiAdapter(),
    readonly iterableApi: IterableApiAdapter = new IterableApiAdapter(),
    readonly iterableSmsApi: IterableSmsApiAdapter = new IterableSmsApiAdapter(),
    readonly orttoApi: OrttoApiAdapter = new OrttoApiAdapter(),
    readonly veroApi: VeroApiAdapter = new VeroApiAdapter(),
    readonly messageGearsApi: MessageGearsApiAdapter = new MessageGearsApiAdapter(),
    readonly maropostApi: MaropostApiAdapter = new MaropostApiAdapter(),
    readonly emarsysApi: EmarsysApiAdapter = new EmarsysApiAdapter(),
    readonly sailthruApi: SailthruApiAdapter = new SailthruApiAdapter(),
    readonly listrakApi: ListrakApiAdapter = new ListrakApiAdapter(),
    readonly dotdigitalApi: DotdigitalApiAdapter = new DotdigitalApiAdapter(),
    readonly acousticCampaignApi: AcousticCampaignApiAdapter = new AcousticCampaignApiAdapter(),
    readonly bloomreachEngagementApi: BloomreachEngagementApiAdapter = new BloomreachEngagementApiAdapter(),
    readonly moEngageApi: MoEngageApiAdapter = new MoEngageApiAdapter(),
    readonly salesforceDataCloudApi: SalesforceDataCloudApiAdapter = new SalesforceDataCloudApiAdapter(),
    readonly adobeRealTimeCdpApi: AdobeRealTimeCdpApiAdapter = new AdobeRealTimeCdpApiAdapter(),
    readonly twilioSegmentEngageApi: TwilioSegmentEngageApiAdapter = new TwilioSegmentEngageApiAdapter(),
    readonly amplitudeExperimentApi: AmplitudeExperimentApiAdapter = new AmplitudeExperimentApiAdapter(),
    readonly mixpanelCohortsApi: MixpanelCohortsApiAdapter = new MixpanelCohortsApiAdapter(),
    readonly postHogFeatureFlagsApi: PostHogFeatureFlagsApiAdapter = new PostHogFeatureFlagsApiAdapter(),
    readonly statsigApi: StatsigApiAdapter = new StatsigApiAdapter(),
    readonly launchDarklyApi: LaunchDarklyApiAdapter = new LaunchDarklyApiAdapter(),
    readonly splitIoApi: SplitIoApiAdapter = new SplitIoApiAdapter(),
    readonly flagsmithCloudApi: FlagsmithCloudApiAdapter = new FlagsmithCloudApiAdapter(),
    readonly configCatApi: ConfigCatApiAdapter = new ConfigCatApiAdapter(),
    readonly growthBookCloudApi: GrowthBookCloudApiAdapter = new GrowthBookCloudApiAdapter(),
    readonly unleashCloudApi: UnleashCloudApiAdapter = new UnleashCloudApiAdapter(),
    readonly optimizelyRolloutsApi: OptimizelyRolloutsApiAdapter = new OptimizelyRolloutsApiAdapter(),
    readonly vwoTestingApi: VwoTestingApiAdapter = new VwoTestingApiAdapter(),
    readonly abTastyFeatureExperimentationApi: AbTastyFeatureExperimentationApiAdapter = new AbTastyFeatureExperimentationApiAdapter(),
    readonly everhourApi: EverhourApiAdapter = new EverhourApiAdapter(),
    readonly timelyTimeTrackingApi: TimelyTimeTrackingApiAdapter = new TimelyTimeTrackingApiAdapter(),
    readonly rescueTimeApi: RescueTimeApiAdapter = new RescueTimeApiAdapter(),
    readonly hubstaffApi: HubstaffApiAdapter = new HubstaffApiAdapter(),
    readonly timeDoctorApi: TimeDoctorApiAdapter = new TimeDoctorApiAdapter(),
    readonly quickBooksTimeApi: QuickBooksTimeApiAdapter = new QuickBooksTimeApiAdapter(),
    readonly repliconApi: RepliconApiAdapter = new RepliconApiAdapter(),
    readonly actiTimeApi: ActiTimeApiAdapter = new ActiTimeApiAdapter(),
    readonly trackingTimeMcp: TrackingTimeMcpAdapter = new TrackingTimeMcpAdapter(),
    readonly ontraportMcp: OntraportMcpAdapter = new OntraportMcpAdapter(),
    readonly bitrix24Api: Bitrix24ApiAdapter = new Bitrix24ApiAdapter(),
    readonly agileCrmApi: AgileCrmApiAdapter = new AgileCrmApiAdapter(),
    readonly streakApi: StreakApiAdapter = new StreakApiAdapter(),
    readonly lessAnnoyingCrmApi: LessAnnoyingCrmApiAdapter = new LessAnnoyingCrmApiAdapter(),
    readonly nutshellApi: NutshellApiAdapter = new NutshellApiAdapter(),
    readonly teamleaderApi: TeamleaderApiAdapter = new TeamleaderApiAdapter(),
    readonly scoroApi: ScoroApiAdapter = new ScoroApiAdapter(),
    readonly odooApi: OdooApiAdapter = new OdooApiAdapter(),
    readonly netSuiteApi: NetSuiteApiAdapter = new NetSuiteApiAdapter(),
    readonly sageAccountingApi: SageAccountingApiAdapter = new SageAccountingApiAdapter(),
    readonly sageIntacctApi: SageIntacctApiAdapter = new SageIntacctApiAdapter(),
    readonly myobApi: MyobApiAdapter = new MyobApiAdapter(),
    readonly kashFlowSoap: KashFlowSoapAdapter = new KashFlowSoapAdapter(),
    readonly zohoBooksApi: ZohoBooksApiAdapter = new ZohoBooksApiAdapter(),
    readonly zohoInvoiceApi: ZohoInvoiceApiAdapter = new ZohoInvoiceApiAdapter(),
    readonly zohoExpenseApi: ZohoExpenseApiAdapter = new ZohoExpenseApiAdapter(),
    readonly zohoDeskApi: ZohoDeskApiAdapter = new ZohoDeskApiAdapter(),
    readonly zohoProjectsApi: ZohoProjectsApiAdapter = new ZohoProjectsApiAdapter(),
    readonly clayApi: ClayApiAdapter = new ClayApiAdapter(),
    readonly phantomBusterApi: PhantomBusterApiAdapter = new PhantomBusterApiAdapter(),
    readonly texAuApi: TexAuApiAdapter = new TexAuApiAdapter(),
    readonly evabootApi: EvabootApiAdapter = new EvabootApiAdapter(),
    readonly lemlistApi: LemlistApiAdapter = new LemlistApiAdapter(),
    readonly mailshakeApi: MailshakeApiAdapter = new MailshakeApiAdapter(),
    readonly woodpeckerApi: WoodpeckerApiAdapter = new WoodpeckerApiAdapter(),
    readonly replyIoApi: ReplyIoApiAdapter = new ReplyIoApiAdapter(),
    readonly mixmaxApi: MixmaxApiAdapter = new MixmaxApiAdapter(),
    readonly cirrusInsightApi: CirrusInsightApiAdapter = new CirrusInsightApiAdapter(),
    readonly spotioApi: SpotioApiAdapter = new SpotioApiAdapter(),
    readonly myHoursApi: MyHoursApiAdapter = new MyHoursApiAdapter(),
    readonly paperformApi: PaperformApiAdapter = new PaperformApiAdapter(),
    readonly jotformApi: JotformApiAdapter = new JotformApiAdapter(),
    readonly formstackApi: FormstackApiAdapter = new FormstackApiAdapter(),
    readonly surveyMonkeyApi: SurveyMonkeyApiAdapter = new SurveyMonkeyApiAdapter(),
    readonly filloutApi: FilloutApiAdapter = new FilloutApiAdapter(),
    readonly tallyApi: TallyApiAdapter = new TallyApiAdapter(),
    readonly mailchimpApi: MailchimpApiAdapter = new MailchimpApiAdapter(),
    readonly klaviyoApi: KlaviyoApiAdapter = new KlaviyoApiAdapter(),
    readonly convertKitApi: ConvertKitApiAdapter = new ConvertKitApiAdapter(),
    readonly campaignMonitorApi: CampaignMonitorApiAdapter = new CampaignMonitorApiAdapter(),
    readonly constantContactApi: ConstantContactApiAdapter = new ConstantContactApiAdapter(),
    readonly activeCampaignApi: ActiveCampaignApiAdapter = new ActiveCampaignApiAdapter(),
    readonly customerIoApi: CustomerIoApiAdapter = new CustomerIoApiAdapter(),
    readonly brazeApi: BrazeApiAdapter = new BrazeApiAdapter(),
    readonly segmentApi: SegmentApiAdapter = new SegmentApiAdapter(),
    readonly mixpanelApi: MixpanelApiAdapter = new MixpanelApiAdapter(),
    readonly amplitudeApi: AmplitudeApiAdapter = new AmplitudeApiAdapter(),
    readonly pendoApi: PendoApiAdapter = new PendoApiAdapter(),
    readonly postHogApi: PostHogApiAdapter = new PostHogApiAdapter(),
    readonly sentryApi: SentryApiAdapter = new SentryApiAdapter(),
    readonly wufooApi: WufooApiAdapter = new WufooApiAdapter(),
    readonly gravityFormsApi: GravityFormsApiAdapter = new GravityFormsApiAdapter(),
    readonly ninjaFormsApi: NinjaFormsApiAdapter = new NinjaFormsApiAdapter(),
    readonly wpFormsApi: WpFormsApiAdapter = new WpFormsApiAdapter(),
    readonly alchemerApi: AlchemerApiAdapter = new AlchemerApiAdapter(),
    readonly qualtricsApi: QualtricsApiAdapter = new QualtricsApiAdapter(),
    readonly askNicelyApi: AskNicelyApiAdapter = new AskNicelyApiAdapter(),
    readonly delightedApi: DelightedApiAdapter = new DelightedApiAdapter(),
    readonly refinerApi: RefinerApiAdapter = new RefinerApiAdapter(),
    readonly hotjarApi: HotjarApiAdapter = new HotjarApiAdapter(),
    readonly userTestingApi: UserTestingApiAdapter = new UserTestingApiAdapter(),
    readonly mazeMcp: MazeMcpAdapter = new MazeMcpAdapter(),
    readonly lookbackMcp: LookbackMcpAdapter = new LookbackMcpAdapter(),
    readonly userInterviewsApi: UserInterviewsApiAdapter = new UserInterviewsApiAdapter(),
    readonly respondentApi: RespondentApiAdapter = new RespondentApiAdapter(),
    readonly dovetailApi: DovetailApiAdapter = new DovetailApiAdapter(),
    readonly sprigApi: SprigApiAdapter = new SprigApiAdapter(),
    readonly airtableFormsApi: AirtableFormsApiAdapter = new AirtableFormsApiAdapter(),
    readonly docuSignClmApi: DocuSignClmApiAdapter = new DocuSignClmApiAdapter(),
    readonly rewardfulApi: RewardfulApiAdapter = new RewardfulApiAdapter(),
    readonly firstPromoterMcp: FirstPromoterMcpAdapter = new FirstPromoterMcpAdapter(),
    readonly apolloIoApi: ApolloIoApiAdapter = new ApolloIoApiAdapter(),
    readonly outreachApi: OutreachApiAdapter = new OutreachApiAdapter(),
    readonly salesloftApi: SalesloftApiAdapter = new SalesloftApiAdapter(),
    readonly gongApi: GongApiAdapter = new GongApiAdapter(),
    readonly chorusAiApi: ChorusAiApiAdapter = new ChorusAiApiAdapter(),
    readonly clariCopilotApi: ClariCopilotApiAdapter = new ClariCopilotApiAdapter(),
    readonly peopleAiMcp: PeopleAiMcpAdapter = new PeopleAiMcpAdapter(),
    readonly cognismApi: CognismApiAdapter = new CognismApiAdapter(),
    readonly zoomInfoApi: ZoomInfoApiAdapter = new ZoomInfoApiAdapter(),
    readonly clearbitApi: ClearbitApiAdapter = new ClearbitApiAdapter(),
    readonly leadfeederApi: LeadfeederApiAdapter = new LeadfeederApiAdapter(),
    readonly unbounceApi: UnbounceApiAdapter = new UnbounceApiAdapter(),
    readonly instapageApi: InstapageApiAdapter = new InstapageApiAdapter(),
    readonly optimizelyApi: OptimizelyApiAdapter = new OptimizelyApiAdapter(),
    readonly vwoApi: VwoApiAdapter = new VwoApiAdapter(),
    readonly abTastyApi: AbTastyApiAdapter = new AbTastyApiAdapter(),
    readonly fullstoryApi: FullstoryApiAdapter = new FullstoryApiAdapter(),
    readonly pCloudApi: PCloudApiAdapter = new PCloudApiAdapter(),
    @Optional()
    readonly tresoritS3: TresoritS3Adapter = new TresoritS3Adapter(),
    @Optional()
    readonly hightailApi: HightailApiAdapter = new HightailApiAdapter(),
    @Optional()
    readonly filestackApi: FilestackApiAdapter = new FilestackApiAdapter(),
    @Optional()
    readonly imgixApi: ImgixApiAdapter = new ImgixApiAdapter(),
    @Optional()
    readonly bynderApi: BynderApiAdapter = new BynderApiAdapter(),
    @Optional()
    readonly cantoApi: CantoApiAdapter = new CantoApiAdapter(),
    @Optional()
    readonly frontifyApi: FrontifyApiAdapter = new FrontifyApiAdapter(),
    @Optional()
    readonly assetBankApi: AssetBankApiAdapter = new AssetBankApiAdapter(),
    @Optional()
    readonly brandfolderApi: BrandfolderApiAdapter = new BrandfolderApiAdapter(),
    @Optional()
    readonly widenCollectiveApi: WidenCollectiveApiAdapter = new WidenCollectiveApiAdapter(),
    @Optional()
    readonly kontainerApi: KontainerApiAdapter = new KontainerApiAdapter(),
    @Optional()
    readonly jiraAlignApi: JiraAlignApiAdapter = new JiraAlignApiAdapter(),
    @Optional()
    readonly atlassianCompassApi: AtlassianCompassApiAdapter = new AtlassianCompassApiAdapter(),
    @Optional()
    readonly daminionApi: DaminionApiAdapter = new DaminionApiAdapter(),
    @Optional()
    readonly msProjectApi: MsProjectApiAdapter = new MsProjectApiAdapter(),
    @Optional()
    readonly microsoftDynamics365SalesApi: MicrosoftDynamics365SalesApiAdapter = new MicrosoftDynamics365SalesApiAdapter(),
    @Optional()
    readonly microsoftDynamics365CustomerServiceApi: MicrosoftDynamics365CustomerServiceApiAdapter = new MicrosoftDynamics365CustomerServiceApiAdapter(),
    @Optional()
    readonly microsoftDynamics365BusinessCentralApi: MicrosoftDynamics365BusinessCentralApiAdapter = new MicrosoftDynamics365BusinessCentralApiAdapter(),
    @Optional()
    readonly microsoftEntraIdGraph: MicrosoftEntraIdGraphAdapter = new MicrosoftEntraIdGraphAdapter(),
    @Optional()
    readonly yammerApi: YammerApiAdapter = new YammerApiAdapter(),
    @Optional()
    readonly vivaLearningGraph: VivaLearningGraphAdapter = new VivaLearningGraphAdapter(),
    @Optional()
    readonly jiraApi: JiraApiAdapter = new JiraApiAdapter(),
    @Optional()
    readonly jiraServiceManagementApi: JiraServiceManagementApiAdapter = new JiraServiceManagementApiAdapter(),
    @Optional()
    readonly productboardApi: ProductboardApiAdapter = new ProductboardApiAdapter(),
    @Optional()
    readonly ahaApi: AhaApiAdapter = new AhaApiAdapter(),
    @Optional()
    readonly partnerFinanceApi: PartnerFinanceApiAdapter = new PartnerFinanceApiAdapter(),
    @Optional()
    readonly roadmunkGraphql: RoadmunkGraphqlAdapter = new RoadmunkGraphqlAdapter(),
    @Optional()
    readonly shortcutApi: ShortcutApiAdapter = new ShortcutApiAdapter(),
    @Optional()
    readonly hiveApi: HiveApiAdapter = new HiveApiAdapter(),
    @Optional()
    readonly niftyApi: NiftyApiAdapter = new NiftyApiAdapter(),
    @Optional()
    readonly paymoApi: PaymoApiAdapter = new PaymoApiAdapter(),
    @Optional()
    readonly krakenApi: KrakenApiAdapter = new KrakenApiAdapter(),
    @Optional()
    readonly binanceApi: BinanceApiAdapter = new BinanceApiAdapter(),
    @Optional()
    readonly geminiApi: GeminiApiAdapter = new GeminiApiAdapter(),
    @Optional()
    readonly proofHubApi: ProofHubApiAdapter = new ProofHubApiAdapter(),
    @Optional()
    readonly proofApi: ProofApiAdapter = new ProofApiAdapter(),
    @Optional()
    readonly termlyApi: TermlyApiAdapter = new TermlyApiAdapter(),
    @Optional()
    readonly cookiebotApi: CookiebotApiAdapter = new CookiebotApiAdapter(),
    @Optional()
    readonly oneTrustApi: OneTrustApiAdapter = new OneTrustApiAdapter(),
    @Optional()
    readonly salesforceMarketingCloudApi: SalesforceMarketingCloudApiAdapter = new SalesforceMarketingCloudApiAdapter(),
    @Optional()
    readonly salesforceCommerceCloudApi: SalesforceCommerceCloudApiAdapter = new SalesforceCommerceCloudApiAdapter(),
    @Optional()
    readonly marketoApi: MarketoApiAdapter = new MarketoApiAdapter(),
    @Optional()
    readonly pardotApi: PardotApiAdapter = new PardotApiAdapter(),
    @Optional()
    readonly eloquaApi: EloquaApiAdapter = new EloquaApiAdapter(),
    @Optional()
    readonly dripApi: DripApiAdapter = new DripApiAdapter(),
    @Optional()
    readonly mailerLiteApi: MailerLiteApiAdapter = new MailerLiteApiAdapter(),
    @Optional()
    readonly aweberApi: AWeberApiAdapter = new AWeberApiAdapter(),
    @Optional()
    readonly getResponseApi: GetResponseApiAdapter = new GetResponseApiAdapter(),
    @Optional()
    readonly moosendApi: MoosendApiAdapter = new MoosendApiAdapter(),
    @Optional()
    readonly omnisendApi: OmnisendApiAdapter = new OmnisendApiAdapter(),
    @Optional()
    readonly mailercloudApi: MailercloudApiAdapter = new MailercloudApiAdapter(),
    @Optional()
    readonly benchmarkEmailApi: BenchmarkEmailApiAdapter = new BenchmarkEmailApiAdapter(),
    @Optional()
    readonly emmaApi: EmmaApiAdapter = new EmmaApiAdapter(),
    @Optional()
    readonly flodeskApi: FlodeskApiAdapter = new FlodeskApiAdapter(),
    @Optional()
    readonly meisterTaskApi: MeisterTaskApiAdapter = new MeisterTaskApiAdapter(),
    @Optional()
    readonly nozbeApi: NozbeApiAdapter = new NozbeApiAdapter(),
    @Optional()
    readonly habiticaApi: HabiticaApiAdapter = new HabiticaApiAdapter(),
    @Optional()
    readonly amazingMarvinApi: AmazingMarvinApiAdapter = new AmazingMarvinApiAdapter(),
    @Optional()
    readonly motionApi: MotionApiAdapter = new MotionApiAdapter(),
    @Optional()
    readonly reclaimAiApi: ReclaimAiApiAdapter = new ReclaimAiApiAdapter(),
    @Optional()
    readonly savvyCalApi: SavvyCalApiAdapter = new SavvyCalApiAdapter(),
    @Optional()
    readonly youCanBookMeApi: YouCanBookMeApiAdapter = new YouCanBookMeApiAdapter(),
    @Optional()
    readonly acuitySchedulingApi: AcuitySchedulingApiAdapter = new AcuitySchedulingApiAdapter(),
    @Optional()
    readonly simplyBookMeApi: SimplyBookMeApiAdapter = new SimplyBookMeApiAdapter(),
    @Optional()
    readonly onceHubApi: OnceHubApiAdapter = new OnceHubApiAdapter(),
    @Optional()
    readonly salesflareApi: SalesflareApiAdapter = new SalesflareApiAdapter(),
    @Optional()
    readonly zendeskSellApi: ZendeskSellApiAdapter = new ZendeskSellApiAdapter(),
    @Optional()
    readonly keapMaxClassicApi: KeapMaxClassicApiAdapter = new KeapMaxClassicApiAdapter(),
    @Optional()
    readonly folkCrmApi: FolkCrmApiAdapter = new FolkCrmApiAdapter(),
    @Optional()
    readonly onePageCrmApi: OnePageCrmApiAdapter = new OnePageCrmApiAdapter(),
    @Optional()
    readonly followUpBossApi: FollowUpBossApiAdapter = new FollowUpBossApiAdapter(),
    @Optional()
    readonly chimeCrmApi: ChimeCrmApiAdapter = new ChimeCrmApiAdapter(),
    @Optional()
    readonly reallySimpleSystemsApi: ReallySimpleSystemsApiAdapter = new ReallySimpleSystemsApiAdapter(),
    @Optional()
    readonly vtigerCrmApi: VtigerCrmApiAdapter = new VtigerCrmApiAdapter(),
    @Optional()
    readonly suiteCrmCloudApi: SuiteCrmCloudApiAdapter = new SuiteCrmCloudApiAdapter(),
    @Optional()
    readonly sugarCrmApi: SugarCrmApiAdapter = new SugarCrmApiAdapter(),
    @Optional()
    readonly creatioApi: CreatioApiAdapter = new CreatioApiAdapter(),
    @Optional()
    readonly attioApi: AttioApiAdapter = new AttioApiAdapter(),
    @Optional()
    readonly setmoreApi: SetmoreApiAdapter = new SetmoreApiAdapter(),
    @Optional()
    readonly plutioApi: PlutioApiAdapter = new PlutioApiAdapter(),
    @Optional()
    readonly squareAppointmentsApi: SquareAppointmentsApiAdapter = new SquareAppointmentsApiAdapter(),
    @Optional()
    readonly vagaroApi: VagaroApiAdapter = new VagaroApiAdapter(),
    @Optional()
    readonly mindbodyApi: MindbodyApiAdapter = new MindbodyApiAdapter(),
    @Optional()
    readonly janeAppApi: JaneAppApiAdapter = new JaneAppApiAdapter(),
    @Optional()
    readonly clinikoApi: ClinikoApiAdapter = new ClinikoApiAdapter(),
    @Optional()
    readonly practiceBetterApi: PracticeBetterApiAdapter = new PracticeBetterApiAdapter(),
    @Optional()
    readonly healthieGraphql: HealthieGraphqlAdapter = new HealthieGraphqlAdapter(),
    @Optional()
    readonly akiflowMcp: AkiflowMcpAdapter = new AkiflowMcpAdapter(),
    @Optional()
    readonly sunsamaMcp: SunsamaMcpAdapter = new SunsamaMcpAdapter(),
    @Optional()
    readonly anyDoMcp: AnyDoMcpAdapter = new AnyDoMcpAdapter(),
    @Optional()
    readonly rememberTheMilkMcp: RememberTheMilkMcpAdapter = new RememberTheMilkMcpAdapter(),
    @Optional()
    readonly readMeApi: ReadMeApiAdapter = new ReadMeApiAdapter(),
    @Optional()
    readonly guruApi: GuruApiAdapter = new GuruApiAdapter(),
    @Optional()
    readonly guruMcp: GuruMcpAdapter = new GuruMcpAdapter(),
    @Optional()
    readonly sliteMcp: SliteMcpAdapter = new SliteMcpAdapter(),
    @Optional()
    readonly slabGraphql: SlabGraphqlAdapter = new SlabGraphqlAdapter(),
    @Optional()
    readonly confluenceApi: ConfluenceApiAdapter = new ConfluenceApiAdapter(),
    @Optional()
    readonly quipApi: QuipApiAdapter = new QuipApiAdapter(),
    @Optional()
    readonly configService?: ConfigService,
    @Optional()
    readonly obsidianCli?: ObsidianCliAdapter,
    @Optional()
    readonly roamResearchCli?: RoamResearchCliAdapter,
    @Optional()
    readonly logseqCli?: LogseqCliAdapter,
    @Optional()
    readonly localWordPressOrgCli?: LocalWordPressOrgCliAdapter,
    @Optional()
    readonly anytypeLocalApi?: AnytypeLocalApiAdapter,
  ) {}

  executionHandlers: MarketplaceConnectorHandlerRegistry | null = null;
  executionAudit: ConnectorExecutionAuditService | null = null;
  executionApprovals: ConnectorExecutionApprovalService | null = null;

  readonly nuclinoMcp = new NuclinoMcpAdapter();
  readonly scribeMcp = new ScribeMcpAdapter();
  readonly document360Api = new Document360ApiAdapter();
  readonly archbeeApi = new ArchbeeApiAdapter();
  readonly tettraApi = new TettraApiAdapter();
  readonly knowledgeOwlApi = new KnowledgeOwlApiAdapter();
  readonly codaApi = new CodaApiAdapter();
  readonly craftApi = new CraftApiAdapter();
  readonly telegramPersonalBotsApi = new TelegramPersonalBotsApiAdapter();
  readonly matomoSelfHostedApi = new MatomoSelfHostedApiAdapter();
  readonly plausibleSelfHostedApi = new PlausibleSelfHostedApiAdapter();
  readonly umamiSelfHostedApi = new UmamiSelfHostedApiAdapter();
  readonly ghostSelfHostedApi = new GhostSelfHostedApiAdapter();
  readonly xrayTestManagementApi = new XrayTestManagementApiAdapter();
  readonly structureForJiraApi = new StructureForJiraApiAdapter();
  readonly productPlanApi = new ProductPlanApiAdapter();
  readonly craftIoApi = new CraftIoApiAdapter();
  readonly airfocusApi = new AirfocusApiAdapter();
  readonly favroApi = new FavroApiAdapter();
  readonly planviewAgilePlaceApi = new PlanviewAgilePlaceApiAdapter();
  readonly liquidPlannerApi = new LiquidPlannerApiAdapter();
  readonly workfrontPlanningApi = new WorkfrontPlanningApiAdapter();
  readonly kantataOxApi = new KantataOxApiAdapter();
  readonly acceloApi = new AcceloApiAdapter();
  readonly avazaApi = new AvazaApiAdapter();
  readonly homebrewApi = new HomebrewApiAdapter();
  readonly calibreApi = new CalibreApiAdapter();
  readonly plexPersonalMediaServerApi = new PlexPersonalMediaServerApiAdapter();
  readonly jellyfinApi = new JellyfinApiAdapter();
  readonly synologyDsmApi = new SynologyDsmApiAdapter();
  readonly wordpressWooCommerceSelfHostedApi =
    new WordPressWooCommerceSelfHostedApiAdapter();
  readonly magentoSelfHostedApi = new MagentoSelfHostedApiAdapter();
  readonly prestashopSelfHostedApi = new PrestaShopSelfHostedApiAdapter();
  readonly drupalApi = new DrupalApiAdapter();
  readonly joomlaApi = new JoomlaApiAdapter();
  readonly concreteCmsApi = new ConcreteCmsApiAdapter();
  readonly craftCmsApi = new CraftCmsApiAdapter();
  readonly statamicApi = new StatamicApiAdapter();
  readonly kirbyCmsApi = new KirbyCmsApiAdapter();
  readonly directusSelfHostedApi = new DirectusSelfHostedApiAdapter();
  readonly strapiSelfHostedApi = new StrapiSelfHostedApiAdapter();
  readonly supabaseSelfHostedApi = new SupabaseSelfHostedApiAdapter();
  readonly dropboxApi = new DropboxApiAdapter();
  readonly boxApi = new BoxApiAdapter();
  readonly vidyardApi = new VidyardApiAdapter();
  readonly vimeoApi = new VimeoApiAdapter();
  readonly wistiaApi = new WistiaApiAdapter();
  readonly frameIoApi = new FrameIoApiAdapter();
  readonly descriptApi = new DescriptApiAdapter();
  readonly revApi = new RevApiAdapter();
  readonly buzzsproutApi = new BuzzsproutApiAdapter();
  readonly captivateFmApi = new CaptivateFmApiAdapter();
  readonly transistorFmApi = new TransistorFmApiAdapter();
  readonly riversideFmApi = new RiversideFmApiAdapter();
  readonly restreamApi = new RestreamApiAdapter();
  readonly otterAiMcp = new OtterAiMcpAdapter();
  readonly firefliesAiMcp = new FirefliesAiMcpAdapter();
  readonly fathomMcp = new FathomMcpAdapter();
  readonly bonsaiMcp = new BonsaiMcpAdapter();
  readonly tlDvApi = new TlDvApiAdapter();
  readonly grainMcp = new GrainMcpAdapter();
  readonly whimsicalMcp = new WhimsicalMcpAdapter();
  readonly cognitoFormsMcp = new CognitoFormsMcpAdapter();
  readonly jotformMcp = new JotformMcpAdapter();
  readonly xmindMcp = new XMindMcpAdapter();
  readonly adobeAnalyticsMcp = new AdobeAnalyticsMcpAdapter();
  readonly adobeMarketoEngageApi = new AdobeMarketoEngageApiAdapter();
  readonly adobeTargetApi = new AdobeTargetApiAdapter();
  readonly osanoApi = new OsanoApiAdapter();
  readonly secureframeApi = new SecureframeApiAdapter();
  readonly vantaApi = new VantaApiAdapter();
  readonly drataApi = new DrataApiAdapter();
  readonly sprintoApi = new SprintoApiAdapter();
  readonly hyperproofApi = new HyperproofApiAdapter();
  readonly workivaApi = new WorkivaApiAdapter();
  readonly cartaApi = new CartaApiAdapter();
  readonly shareworksApi = new ShareworksApiAdapter();
  readonly ledgyApi = new LedgyApiAdapter();
  readonly cloudinaryMcp = new CloudinaryMcpAdapter();
  readonly padletApi = new PadletApiAdapter();
  readonly drawIoMcp = new DrawIoMcpAdapter();
  readonly mindMeisterApi = new MindMeisterApiAdapter();
  readonly muralApi = new MuralApiAdapter();
  readonly figJamApi = new FigJamApiAdapter();
  readonly figmaApi = new FigmaApiAdapter();
  readonly miroApi = new MiroApiAdapter();
  readonly canvaApi = new CanvaApiAdapter();
  readonly webflowApi = new WebflowApiAdapter();
  readonly wordpressComApi = new WordPressComApiAdapter();
  readonly ghostApi = new GhostApiAdapter();
  readonly contentfulApi = new ContentfulApiAdapter();
  readonly sanityApi = new SanityApiAdapter();
  readonly strapiCloudApi = new StrapiCloudApiAdapter();
  readonly shopifyApi = new ShopifyApiAdapter();
  readonly wooCommerceApi = new WooCommerceApiAdapter();
  readonly stripeApi = new StripeApiAdapter();
  readonly paypalApi = new PayPalApiAdapter();
  readonly kajabiCommunitiesApi = new KajabiCommunitiesApiAdapter();
  readonly circleApi = new CircleApiAdapter();
  readonly mightyNetworksApi = new MightyNetworksApiAdapter();
  readonly discourseApi = new DiscourseApiAdapter();
  readonly vanillaForumsApi = new VanillaForumsApiAdapter();
  readonly bettermodeApi = new BettermodeApiAdapter();
  readonly higherLogicApi = new HigherLogicApiAdapter();
  readonly hivebriteApi = new HivebriteApiAdapter();
  readonly xeroApi = new XeroApiAdapter();
  readonly quickBooksApi = new QuickBooksApiAdapter();
  readonly freshBooksApi = new FreshBooksApiAdapter();
  readonly waveApi = new WaveApiAdapter();
  readonly freeAgentApi = new FreeAgentApiAdapter();
  readonly salesforceApi = new SalesforceApiAdapter();
  readonly hubSpotApi = new HubSpotApiAdapter();
  readonly pipedriveApi = new PipedriveApiAdapter();
  readonly zohoApi = new ZohoApiAdapter();
  readonly zohoPeopleApi = new ZohoPeopleApiAdapter();
  readonly zohoCampaignsApi = new ZohoCampaignsApiAdapter();
  readonly zohoAnalyticsApi = new ZohoAnalyticsApiAdapter();
  readonly copperApi = new CopperApiAdapter();
  readonly closeApi = new CloseApiAdapter();
  readonly zendeskApi = new ZendeskApiAdapter();
  readonly intercomApi = new IntercomApiAdapter();
  readonly freshserviceApi = new FreshserviceApiAdapter();
  readonly freshchatApi = new FreshchatApiAdapter();
  readonly freshmarketerApi = new FreshmarketerApiAdapter();
  readonly freshcallerApi = new FreshcallerApiAdapter();
  readonly liveChatApi = new LiveChatApiAdapter();
  readonly liveAgentApi = new LiveAgentApiAdapter();
  readonly crispApi = new CrispApiAdapter();
  readonly tidioApi = new TidioApiAdapter();
  readonly olarkWebhook = new OlarkWebhookAdapter();
  readonly userlikeApi = new UserlikeApiAdapter();
  readonly gladlyApi = new GladlyApiAdapter();
  readonly kustomerApi = new KustomerApiAdapter();
  readonly gorgiasApi = new GorgiasApiAdapter();
  readonly reAmazeApi = new ReAmazeApiAdapter();
  readonly edeskApi = new EDeskApiAdapter();
  readonly kayakoApi = new KayakoApiAdapter();
  readonly acquireApi = new AcquireApiAdapter();
  readonly freshdeskApi = new FreshdeskApiAdapter();
  readonly helpScoutApi = new HelpScoutApiAdapter();
  readonly frontApi = new FrontApiAdapter();
  readonly grooveApi = new GrooveApiAdapter();
  readonly teamworkApi = new TeamworkApiAdapter();
  readonly basecampApi = new BasecampApiAdapter();
  readonly wrikeApi = new WrikeApiAdapter();
  readonly smartsheetApi = new SmartsheetApiAdapter();
  readonly todoistApi = new TodoistApiAdapter();
  readonly ticktickApi = new TickTickApiAdapter();
  readonly togglTrackApi = new TogglTrackApiAdapter();
  readonly lumaApi = new LumaApiAdapter();
  readonly hopinApi = new HopinApiAdapter();
  readonly harvestApi = new HarvestApiAdapter();
  readonly clockifyApi = new ClockifyApiAdapter();
  readonly boundedRestApi = new BoundedRestApiAdapter();
  readonly ehrFhirApi = new EhrFhirApiAdapter();
  readonly tempoTimesheetsApi = new TempoTimesheetsApiAdapter();
  readonly zephyrScaleApi = new ZephyrScaleApiAdapter();
  readonly calendlyApi = new CalendlyApiAdapter();
  readonly calComApi = new CalComApiAdapter();
  readonly ironcladClickwrapApi = new IroncladClickwrapApiAdapter();
  readonly docusignIdentifyApi = new DocusignIdentifyApiAdapter();
  readonly docusignApi = new DocusignApiAdapter();
  readonly dropboxSignApi = new DropboxSignApiAdapter();
  readonly pandaDocApi = new PandaDocApiAdapter();
  readonly typeformApi = new TypeformApiAdapter();
  readonly datadogApi = new DatadogApiAdapter();
  readonly newRelicApi = new NewRelicApiAdapter();
  readonly pagerDutyApi = new PagerDutyApiAdapter();
  readonly statuspageApi = new StatuspagePublicApiAdapter();
  readonly cloudflareApi = new CloudflareApiAdapter();
  readonly vercelApi = new VercelApiAdapter();
  readonly netlifyApi = new NetlifyApiAdapter();
  readonly herokuApi = new HerokuApiAdapter();
  readonly digitalOceanApi = new DigitalOceanApiAdapter();
  readonly firebaseApi = new FirebaseApiAdapter();
  readonly supabaseApi = new SupabaseApiAdapter();
  readonly oktaApi = new OktaApiAdapter();
  readonly bambooHRApi = new BambooHRApiAdapter();
  readonly greenhouseApi = new GreenhouseApiAdapter();
  readonly leverApi = new LeverApiAdapter();
  readonly sendFoxApi = new SendFoxApiAdapter();
  readonly beehiivApi = new BeehiivApiAdapter();
  readonly substackApi = new SubstackApiAdapter();
  readonly hootsuiteApi = new HootsuiteApiAdapter();
  readonly bufferApi = new BufferApiAdapter();
  readonly sproutSocialApi = new SproutSocialApiAdapter();
  readonly laterApi = new LaterApiAdapter();
  readonly agorapulseApi = new AgorapulseApiAdapter();
  readonly metricoolApi = new MetricoolApiAdapter();
  readonly publerApi = new PublerApiAdapter();
  readonly brandwatchApi = new BrandwatchApiAdapter();
  readonly mentionApi = new MentionApiAdapter();
  readonly meltwaterApi = new MeltwaterApiAdapter();
  readonly sprinklrApi = new SprinklrApiAdapter();
  readonly khorosApi = new KhorosApiAdapter();
  readonly cleverTapApi = new CleverTapApiAdapter();
  readonly oneSignalApi = new OneSignalApiAdapter();
  readonly airshipApi = new AirshipApiAdapter();
  readonly pushwooshApi = new PushwooshApiAdapter();
  readonly pusherBeamsApi = new PusherBeamsApiAdapter();
  readonly firebaseCloudMessagingApi = new FirebaseCloudMessagingApiAdapter();
  readonly appsFlyerApi = new AppsFlyerApiAdapter();
  readonly adjustApi = new AdjustApiAdapter();
  readonly branchApi = new BranchApiAdapter();
  readonly singularApi = new SingularApiAdapter();
  readonly kochavaApi = new KochavaApiAdapter();
  readonly mParticleApi = new MParticleApiAdapter();
  readonly tealiumApi = new TealiumApiAdapter();
  readonly lyticsApi = new LyticsApiAdapter();
  readonly blueConicApi = new BlueConicApiAdapter();
  readonly treasureDataApi = new TreasureDataApiAdapter();
  readonly hightouchApi = new HightouchApiAdapter();
  readonly censusApi = new CensusApiAdapter();
  readonly clioManageApi = new ClioManageApiAdapter();
  readonly clioGrowApi = new ClioGrowApiAdapter();
  readonly myCaseApi = new MyCaseApiAdapter();
  readonly practicePantherApi = new PracticePantherApiAdapter();
  readonly smokeballApi = new SmokeballApiAdapter();
  readonly lawPayApi = new LawPayApiAdapter();
  readonly filevineApi = new FilevineApiAdapter();
  readonly discoEdiscoveryApi = new DiscoEdiscoveryApiAdapter();
  readonly microsoft365EdiscoveryGraph =
    new Microsoft365EdiscoveryGraphAdapter();
  readonly googleVaultApi = new GoogleVaultApiAdapter();
  readonly gmailApi = new GmailApiAdapter();
  readonly googleCalendarApi = new GoogleCalendarApiAdapter();
  readonly googleDriveApi = new GoogleDriveApiAdapter();
  readonly googleDocsApi = new GoogleDocsApiAdapter();
  readonly googleSheetsApi = new GoogleSheetsApiAdapter();
  readonly googleSlidesApi = new GoogleSlidesApiAdapter();
  readonly googleFormsApi = new GoogleFormsApiAdapter();
  readonly googleTasksApi = new GoogleTasksApiAdapter();
  readonly googleContactsApi = new GoogleContactsApiAdapter();
  readonly googlePhotosApi = new GooglePhotosApiAdapter();
  readonly googleMeetApi = new GoogleMeetApiAdapter();
  readonly googleChatApi = new GoogleChatApiAdapter();
  readonly googleAdsApi = new GoogleAdsApiAdapter();
  readonly googleAnalyticsApi = new GoogleAnalyticsApiAdapter();
  readonly googleSearchConsoleApi = new GoogleSearchConsoleApiAdapter();
  readonly googleBusinessProfileApi = new GoogleBusinessProfileApiAdapter();
  readonly googleMerchantCenterApi = new GoogleMerchantCenterApiAdapter();
  readonly youtubeApi = new YouTubeApiAdapter();
  readonly googleClassroomApi = new GoogleClassroomApiAdapter();
  readonly googleMapsPlatformApi = new GoogleMapsPlatformApiAdapter();
  readonly adobeAcrobatSignApi = new AdobeAcrobatSignApiAdapter();
  readonly signNowApi = new SignNowApiAdapter();
  readonly signRequestApi = new SignRequestApiAdapter();
  readonly signeasyApi = new SigneasyApiAdapter();
  readonly oneSpanSignApi = new OneSpanSignApiAdapter();
  readonly rightSignatureApi = new RightSignatureApiAdapter();
  readonly getAcceptApi = new GetAcceptApiAdapter();
  readonly qwilrApi = new QwilrApiAdapter();
  readonly proposifyApi = new ProposifyApiAdapter();
  readonly betterProposalsApi = new BetterProposalsApiAdapter();
  readonly concordApi = new ConcordApiAdapter();
  readonly juroApi = new JuroApiAdapter();
  readonly ironcladApi = new IroncladApiAdapter();
  readonly linkSquaresApi = new LinkSquaresApiAdapter();
  readonly spotDraftApi = new SpotDraftApiAdapter();
  readonly contractbookApi = new ContractbookApiAdapter();
  readonly logRocketMcp = new LogRocketMcpAdapter();
  readonly smartlookApi = new SmartlookApiAdapter();
  readonly crazyEggApi = new CrazyEggApiAdapter();
  readonly appcuesApi = new AppcuesApiAdapter();
  readonly userflowApi = new UserflowApiAdapter();
  readonly userpilotApi = new UserpilotApiAdapter();
  readonly chameleonApi = new ChameleonApiAdapter();
  readonly vitallyApi = new VitallyApiAdapter();
  readonly gainsightApi = new GainsightApiAdapter();
  readonly totangoApi = new TotangoApiAdapter();
  readonly custifyApi = new CustifyApiAdapter();
  readonly planhatApi = new PlanhatApiAdapter();
  readonly clientSuccessApi = new ClientSuccessApiAdapter();
  readonly freshsalesApi = new FreshsalesApiAdapter();
  readonly insightlyApi = new InsightlyApiAdapter();
  readonly nimbleApi = new NimbleApiAdapter();
  readonly capsuleCrmApi = new CapsuleCrmApiAdapter();
  readonly keapApi = new KeapApiAdapter();
  readonly microsoftTeamsGraph = new MicrosoftTeamsGraphAdapter();
  readonly oneDriveApi = new OneDriveApiAdapter();
  readonly sharePointApi = new SharePointApiAdapter();
  readonly microsoftPlannerApi = new MicrosoftPlannerApiAdapter();
  readonly microsoftToDoApi = new MicrosoftToDoApiAdapter();
  readonly microsoftListsApi = new MicrosoftListsApiAdapter();
  readonly oneNoteApi = new OneNoteApiAdapter();
  readonly microsoftBookingsApi = new MicrosoftBookingsApiAdapter();
  readonly microsoftPowerBIApi = new MicrosoftPowerBIApiAdapter();
  readonly microsoftDynamics365Api = new MicrosoftDynamics365ApiAdapter();
  readonly microsoftVivaEngageApi = new MicrosoftVivaEngageApiAdapter();
  readonly zoomApi = new ZoomApiAdapter();
  readonly discordApi = new DiscordApiAdapter();
  readonly lucidsparkApi = new LucidsparkApiAdapter();
  readonly lucidchartApi = new LucidchartApiAdapter();
}

export interface MarketplaceConnectorExecutionService extends ConnectorExecutionExtensionMethods {}

installConnectorMethodModules(
  MarketplaceConnectorExecutionService.prototype,
  EVENT_TICKETING_EXECUTORS,
  NATIVE_PROVIDER_EXECUTORS,
  CONNECTOR_EXECUTION_EXTENSIONS,
);

export { ConnectorExecutionError } from "./execution/connector-execution.error";
