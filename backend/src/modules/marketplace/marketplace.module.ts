import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import {
  AgentEntity,
  AgentDocumentationInstallEntity,
  AgentDocumentationVersionEntity,
  ApplicationDocumentationPackEntity,
  ApplicationDocumentationVersionEntity,
  DocumentationSyncMappingEntity,
  DocumentationGenerationProposalEntity,
  DocumentationProposalFileEntity,
  LinkedApplicationEntity,
  MarketplaceConnectionEntity,
  MarketplaceGeneratedPackEntity,
  MarketplaceInstallEntity,
  MarketplaceOAuthStateEntity,
  MarketplacePackGenerationJobEntity,
  MarketplacePackQualityScoreEntity,
  MarketplacePackReviewEntity,
  MarketplacePackSourceEntity,
  MessageEntity,
  ScheduledThreadMessageEntity,
  ThreadEntity,
  ToolRequestEntity,
  WorkspaceEntity,
  WorkspaceMemberEntity,
} from "../../entities";
import { ApprovalEntity } from "../../entities/approval.entity";
import { RuntimeDispatchEntity } from "../../entities/runtime-dispatch.entity";
import { AgentDocumentationModule } from "../agent-documentation/agent-documentation.module";
import { AgentModule } from "../agent/agent.module";
import { AuditLogModule } from "../audit-log/audit-log.module";
import { BridgeModule } from "../bridge/bridge.module";
import { MessageModule } from "../message/message.module";
import { RuntimeModule } from "../runtime/runtime.module";
import { SecurityModule } from "../security/security.module";
import { ToolRequestModule } from "../tool-request/tool-request.module";
import { WorkspaceMembershipModule } from "../workspace-membership/workspace-membership.module";
import {
  MarketplaceController,
  PublicMarketplaceController,
} from "./marketplace.controller";
import { MarketplaceService } from "./marketplace.service";
import {
  XMarketplaceController,
  XMarketplaceBridgeToolsController,
  XMarketplaceOAuthCallbackController,
} from "./x-marketplace.controller";
import {
  BridgeAgentMarketplaceToolsController,
  LocalAppConnectorAgentApiBridgeToolsController,
} from "./localappconnector-agent-api-tools.controller";
import { MarketplaceConnectorOAuthCallbackController } from "./connector-oauth-callback.controller";
import { XMarketplaceService } from "./x-marketplace.service";
import { MarketplaceConnectorCredentialService } from "./connectors/connector-credential.service";
import { MarketplaceConnectorExecutionService } from "./connectors/connector-execution.service";
import { MarketplaceConnectorOAuthService } from "./connectors/connector-oauth.service";
import { MarketplaceConnectorRegistry } from "./connectors/connector-registry";
import { DataForSeoApiAdapter } from "./connectors/dataforseo/dataforseo-api.adapter";
import { ExaApiAdapter } from "./connectors/exa/exa-api.adapter";
import { LinkedInApiAdapter } from "./connectors/linkedin/linkedin-api.adapter";
import { NextdoorApiAdapter } from "./connectors/nextdoor/nextdoor-api.adapter";
import { MeetupApiAdapter } from "./connectors/meetup/meetup-api.adapter";
import { EventbriteApiAdapter } from "./connectors/eventbrite/eventbrite-api.adapter";
import { WebexApiAdapter } from "./connectors/webex/webex-api.adapter";
import { GoToMeetingApiAdapter } from "./connectors/goto-meeting/goto-meeting-api.adapter";
import { RingCentralApiAdapter } from "./connectors/ringcentral/ringcentral-api.adapter";
import { DialpadApiAdapter } from "./connectors/dialpad/dialpad-api.adapter";
import { AircallApiAdapter } from "./connectors/aircall/aircall-api.adapter";
import { OpenPhoneApiAdapter } from "./connectors/openphone/openphone-api.adapter";
import { TwilioApiAdapter } from "./connectors/twilio/twilio-api.adapter";
import { VonageApiAdapter } from "./connectors/vonage/vonage-api.adapter";
import { MessageBirdApiAdapter } from "./connectors/messagebird/messagebird-api.adapter";
import { FredApiAdapter } from "./connectors/fred/fred-api.adapter";
import { ApolloGraphOsApiAdapter } from "./connectors/apollo-graphql-studio/apollo-graphos-api.adapter";
import { HunterApiAdapter } from "./connectors/hunter-io/hunter-api.adapter";
import { SnovApiAdapter } from "./connectors/snov-io/snov-api.adapter";
import { LushaApiAdapter } from "./connectors/lusha/lusha-api.adapter";
import { LeadIqApiAdapter } from "./connectors/leadiq/leadiq-api.adapter";
import { SeamlessAiApiAdapter } from "./connectors/seamless-ai/seamless-ai-api.adapter";
import { RocketReachApiAdapter } from "./connectors/rocketreach/rocketreach-api.adapter";
import { UpLeadApiAdapter } from "./connectors/uplead/uplead-api.adapter";
import { WizaApiAdapter } from "./connectors/wiza/wiza-api.adapter";
import { ThreadsApiAdapter } from "./connectors/threads/threads-api.adapter";
import { PinterestApiAdapter } from "./connectors/pinterest/pinterest-api.adapter";
import { TumblrApiAdapter } from "./connectors/tumblr/tumblr-api.adapter";
import { MastodonApiAdapter } from "./connectors/mastodon/mastodon-api.adapter";
import { TwistApiAdapter } from "./connectors/twist/twist-api.adapter";
import { ZohoMailApiAdapter } from "./connectors/zoho-mail/zoho-mail-api.adapter";
import { SlackApiAdapter } from "./connectors/slack/slack-api.adapter";
import { GitHubApiAdapter } from "./connectors/github/github-api.adapter";
import { GitLabApiAdapter } from "./connectors/gitlab/gitlab-api.adapter";
import { BitbucketApiAdapter } from "./connectors/bitbucket/bitbucket-api.adapter";
import { NotionApiAdapter } from "./connectors/notion/notion-api.adapter";
import { LinearApiAdapter } from "./connectors/linear/linear-api.adapter";
import { AsanaApiAdapter } from "./connectors/asana/asana-api.adapter";
import { TrelloApiAdapter } from "./connectors/trello/trello-api.adapter";
import { ClickUpApiAdapter } from "./connectors/clickup/clickup-api.adapter";
import { MondayComApiAdapter } from "./connectors/monday-com/monday-com-api.adapter";
import { AirtableApiAdapter } from "./connectors/airtable/airtable-api.adapter";
import { OutlookGraphAdapter } from "./connectors/outlook/outlook-graph.adapter";
import { MailgunApiAdapter } from "./connectors/mailgun/mailgun-api.adapter";
import { SendGridApiAdapter } from "./connectors/sendgrid/sendgrid-api.adapter";
import { PostmarkApiAdapter } from "./connectors/postmark/postmark-api.adapter";
import { ResendApiAdapter } from "./connectors/resend/resend-api.adapter";
import { SparkPostApiAdapter } from "./connectors/sparkpost/sparkpost-api.adapter";
import { BrevoApiAdapter } from "./connectors/brevo/brevo-api.adapter";
import { MailjetApiAdapter } from "./connectors/sinch-mailjet/sinch-mailjet-api.adapter";
import { EvernoteApiAdapter } from "./connectors/evernote/evernote-api.adapter";
import { FuseBaseMcpAdapter } from "./connectors/fusebase/fusebase-mcp.adapter";
import { AtlassianRovoMcpAdapter } from "./connectors/atlassian-rovo/atlassian-rovo-mcp.adapter";
import { OpsgenieCloudApiAdapter } from "./connectors/opsgenie-cloud/opsgenie-cloud-api.adapter";
import { StatuspageCloudApiAdapter } from "./connectors/statuspage-cloud/statuspage-cloud-api.adapter";
import { MemApiAdapter } from "./connectors/mem/mem-api.adapter";
import { ReflectApiAdapter } from "./connectors/reflect/reflect-api.adapter";
import { ReadwiseApiAdapter } from "./connectors/readwise/readwise-api.adapter";
import { CommonRoomApiAdapter } from "./connectors/common-room/common-room-api.adapter";
import { SlackEnterpriseGridApiAdapter } from "./connectors/slack-enterprise-grid/slack-enterprise-grid-api.adapter";
import { SlackCanvasApiAdapter } from "./connectors/slack-canvas/slack-canvas-api.adapter";
import { SlackListsApiAdapter } from "./connectors/slack-lists/slack-lists-api.adapter";
import { TeamsPhoneGraphAdapter } from "./connectors/teams-phone/teams-phone-graph.adapter";
import { ZoomPhoneApiAdapter } from "./connectors/zoom-phone/zoom-phone-api.adapter";
import { ZoomRoomsApiAdapter } from "./connectors/zoom-rooms/zoom-rooms-api.adapter";
import { ZoomWebinarsApiAdapter } from "./connectors/zoom-webinars/zoom-webinars-api.adapter";
import { ZoomEventsApiAdapter } from "./connectors/zoom-events/zoom-events-api.adapter";
import { WebexCallingApiAdapter } from "./connectors/webex-calling/webex-calling-api.adapter";
import { GoToWebinarApiAdapter } from "./connectors/goto-webinar/goto-webinar-api.adapter";
import { LivestormApiAdapter } from "./connectors/livestorm/livestorm-api.adapter";
import { DemioApiAdapter } from "./connectors/demio/demio-api.adapter";
import { BigMarkerApiAdapter } from "./connectors/bigmarker/bigmarker-api.adapter";
import { RaindropIoApiAdapter } from "./connectors/raindrop-io/raindrop-io-api.adapter";
import { InstapaperApiAdapter } from "./connectors/instapaper/instapaper-api.adapter";
import { FeedlyApiAdapter } from "./connectors/feedly/feedly-api.adapter";
import { InoreaderApiAdapter } from "./connectors/inoreader/inoreader-api.adapter";
import { ReadMeApiAdapter } from "./connectors/readme/readme-api.adapter";
import { GuruApiAdapter } from "./connectors/guru/guru-api.adapter";
import { GuruMcpAdapter } from "./connectors/guru/guru-mcp.adapter";
import { SliteMcpAdapter } from "./connectors/slite/slite-mcp.adapter";
import { SlabGraphqlAdapter } from "./connectors/slab/slab-graphql.adapter";
import { ConfluenceApiAdapter } from "./connectors/confluence/confluence-api.adapter";
import { QuipApiAdapter } from "./connectors/quip/quip-api.adapter";
import { NuclinoMcpAdapter } from "./connectors/nuclino/nuclino-mcp.adapter";
import { Document360ApiAdapter } from "./connectors/document360/document360-api.adapter";
import { ArchbeeApiAdapter } from "./connectors/archbee/archbee-api.adapter";
import { TettraApiAdapter } from "./connectors/tettra/tettra-api.adapter";
import { KnowledgeOwlApiAdapter } from "./connectors/knowledgeowl/knowledgeowl-api.adapter";
import { FreshdeskApiAdapter } from "./connectors/freshdesk/freshdesk-api.adapter";
import { CodaApiAdapter } from "./connectors/coda/coda-api.adapter";
import { CraftApiAdapter } from "./connectors/craft/craft-api.adapter";
import { TelegramPersonalBotsApiAdapter } from "./connectors/telegram-personal-bots/telegram-personal-bots-api.adapter";
import { LocalWordPressOrgCliAdapter } from "./connectors/local-wordpress-org/local-wordpress-org-cli.adapter";
import { MatomoSelfHostedApiAdapter } from "./connectors/matomo-self-hosted/matomo-self-hosted-api.adapter";
import { PlausibleSelfHostedApiAdapter } from "./connectors/plausible-self-hosted/plausible-self-hosted-api.adapter";
import { UmamiSelfHostedApiAdapter } from "./connectors/umami-self-hosted/umami-self-hosted-api.adapter";
import { GhostSelfHostedApiAdapter } from "./connectors/ghost-self-hosted/ghost-self-hosted-api.adapter";
import { XrayTestManagementApiAdapter } from "./connectors/xray-test-management/xray-test-management-api.adapter";
import { StructureForJiraApiAdapter } from "./connectors/structure-for-jira/structure-for-jira-api.adapter";
import { ProductPlanApiAdapter } from "./connectors/productplan/productplan-api.adapter";
import { CraftIoApiAdapter } from "./connectors/craft-io/craft-io-api.adapter";
import { AirfocusApiAdapter } from "./connectors/airfocus/airfocus-api.adapter";
import { FavroApiAdapter } from "./connectors/favro/favro-api.adapter";
import { PlanviewAgilePlaceApiAdapter } from "./connectors/planview-agileplace/planview-agileplace-api.adapter";
import { LiquidPlannerApiAdapter } from "./connectors/liquidplanner/liquidplanner-api.adapter";
import { WorkfrontPlanningApiAdapter } from "./connectors/workfront-planning/workfront-planning-api.adapter";
import { KantataOxApiAdapter } from "./connectors/kantata-ox/kantata-ox-api.adapter";
import { AcceloApiAdapter } from "./connectors/accelo/accelo-api.adapter";
import { AvazaApiAdapter } from "./connectors/avaza/avaza-api.adapter";
import { AnytypeLocalApiAdapter } from "./connectors/anytype/anytype-local-api.adapter";
import { DropboxApiAdapter } from "./connectors/dropbox/dropbox-api.adapter";
import { BoxApiAdapter } from "./connectors/box/box-api.adapter";
import { ScribeMcpAdapter } from "./connectors/scribe/scribe-mcp.adapter";
import { VidyardApiAdapter } from "./connectors/vidyard/vidyard-api.adapter";
import { VimeoApiAdapter } from "./connectors/vimeo/vimeo-api.adapter";
import { WistiaApiAdapter } from "./connectors/wistia/wistia-api.adapter";
import { FrameIoApiAdapter } from "./connectors/frame-io/frame-io-api.adapter";
import { DescriptApiAdapter } from "./connectors/descript/descript-api.adapter";
import { RevApiAdapter } from "./connectors/rev/rev-api.adapter";
import { BuzzsproutApiAdapter } from "./connectors/buzzsprout/buzzsprout-api.adapter";
import { CaptivateFmApiAdapter } from "./connectors/captivate-fm/captivate-fm-api.adapter";
import { TransistorFmApiAdapter } from "./connectors/transistor-fm/transistor-fm-api.adapter";
import { RiversideFmApiAdapter } from "./connectors/riverside-fm/riverside-fm-api.adapter";
import { RestreamApiAdapter } from "./connectors/restream/restream-api.adapter";
import { OtterAiMcpAdapter } from "./connectors/otter-ai/otter-ai-mcp.adapter";
import { FirefliesAiMcpAdapter } from "./connectors/fireflies-ai/fireflies-ai-mcp.adapter";
import { FathomMcpAdapter } from "./connectors/fathom/fathom-mcp.adapter";
import { BonsaiMcpAdapter } from "./connectors/bonsai/bonsai-mcp.adapter";
import { TlDvApiAdapter } from "./connectors/tl-dv/tl-dv-api.adapter";
import { GrainMcpAdapter } from "./connectors/grain/grain-mcp.adapter";
import { WhimsicalMcpAdapter } from "./connectors/whimsical/whimsical-mcp.adapter";
import { DrawIoMcpAdapter } from "./connectors/draw-io/draw-io-mcp.adapter";
import { MindMeisterApiAdapter } from "./connectors/mindmeister/mindmeister-api.adapter";
import { XMindMcpAdapter } from "./connectors/xmind/xmind-mcp.adapter";
import { AdobeAnalyticsMcpAdapter } from "./connectors/adobe-analytics/adobe-analytics-mcp.adapter";
import { AdobeMarketoEngageApiAdapter } from "./connectors/adobe-marketo-engage/adobe-marketo-engage-api.adapter";
import { AdobeTargetApiAdapter } from "./connectors/adobe-target/adobe-target-api.adapter";
import { OsanoApiAdapter } from "./connectors/osano/osano-api.adapter";
import { SecureframeApiAdapter } from "./connectors/secureframe/secureframe-api.adapter";
import { VantaApiAdapter } from "./connectors/vanta/vanta-api.adapter";
import { DrataApiAdapter } from "./connectors/drata/drata-api.adapter";
import { SprintoApiAdapter } from "./connectors/sprinto/sprinto-api.adapter";
import { HyperproofApiAdapter } from "./connectors/hyperproof/hyperproof-api.adapter";
import { WorkivaApiAdapter } from "./connectors/workiva/workiva-api.adapter";
import { CartaApiAdapter } from "./connectors/carta/carta-api.adapter";
import { ShareworksApiAdapter } from "./connectors/shareworks/shareworks-api.adapter";
import { LedgyApiAdapter } from "./connectors/ledgy/ledgy-api.adapter";
import { PadletApiAdapter } from "./connectors/padlet/padlet-api.adapter";
import { DropboxPaperApiAdapter } from "./connectors/dropbox-paper/dropbox-paper-api.adapter";
import { ZohoWorkDriveApiAdapter } from "./connectors/zoho-workdrive/zoho-workdrive-api.adapter";
import { EgnyteApiAdapter } from "./connectors/egnyte/egnyte-api.adapter";
import { ShareFileApiAdapter } from "./connectors/sharefile/sharefile-api.adapter";
import { DeputyApiAdapter } from "./connectors/deputy/deputy-api.adapter";
import { HomebaseApiAdapter } from "./connectors/homebase/homebase-api.adapter";
import { SevenShiftsApiAdapter } from "./connectors/seven-shifts/seven-shifts-api.adapter";
import { ResourceGuruApiAdapter } from "./connectors/resource-guru/resource-guru-api.adapter";
import { RunnApiAdapter } from "./connectors/runn/runn-api.adapter";
import { EverhourApiAdapter } from "./connectors/everhour/everhour-api.adapter";
import { TimelyTimeTrackingApiAdapter } from "./connectors/timely-time-tracking/timely-time-tracking-api.adapter";
import { RescueTimeApiAdapter } from "./connectors/rescuetime/rescuetime-api.adapter";
import { TimeDoctorApiAdapter } from "./connectors/time-doctor/time-doctor-api.adapter";
import { HubstaffApiAdapter } from "./connectors/hubstaff/hubstaff-api.adapter";
import { QuickBooksTimeApiAdapter } from "./connectors/quickbooks-time/quickbooks-time-api.adapter";
import { RepliconApiAdapter } from "./connectors/replicon/replicon-api.adapter";
import { ActiTimeApiAdapter } from "./connectors/actitime/actitime-api.adapter";
import { TrackingTimeMcpAdapter } from "./connectors/trackingtime/trackingtime-mcp.adapter";
import { OntraportMcpAdapter } from "./connectors/ontraport/ontraport-mcp.adapter";
import { Bitrix24ApiAdapter } from "./connectors/bitrix24/bitrix24-api.adapter";
import { AgileCrmApiAdapter } from "./connectors/agile-crm/agile-crm-api.adapter";
import { StreakApiAdapter } from "./connectors/streak/streak-api.adapter";
import { LessAnnoyingCrmApiAdapter } from "./connectors/less-annoying-crm/less-annoying-crm-api.adapter";
import { NutshellApiAdapter } from "./connectors/nutshell/nutshell-api.adapter";
import { TeamleaderApiAdapter } from "./connectors/teamleader/teamleader-api.adapter";
import { ScoroApiAdapter } from "./connectors/scoro/scoro-api.adapter";
import { OdooApiAdapter } from "./connectors/odoo/odoo-api.adapter";
import { NetSuiteApiAdapter } from "./connectors/netsuite/netsuite-api.adapter";
import { SageAccountingApiAdapter } from "./connectors/sage-accounting/sage-accounting-api.adapter";
import { SageIntacctApiAdapter } from "./connectors/sage-intacct/sage-intacct-api.adapter";
import { MyobApiAdapter } from "./connectors/myob/myob-api.adapter";
import { KashFlowSoapAdapter } from "./connectors/kashflow/kashflow-soap.adapter";
import { ZohoBooksApiAdapter } from "./connectors/zoho-books/zoho-books-api.adapter";
import { ZohoInvoiceApiAdapter } from "./connectors/zoho-invoice/zoho-invoice-api.adapter";
import { ZohoExpenseApiAdapter } from "./connectors/zoho-expense/zoho-expense-api.adapter";
import { ZohoDeskApiAdapter } from "./connectors/zoho-desk/zoho-desk-api.adapter";
import { ZohoProjectsApiAdapter } from "./connectors/zoho-projects/zoho-projects-api.adapter";
import { ClayApiAdapter } from "./connectors/clay/clay-api.adapter";
import { PhantomBusterApiAdapter } from "./connectors/phantombuster/phantombuster-api.adapter";
import { TexAuApiAdapter } from "./connectors/texau/texau-api.adapter";
import { EvabootApiAdapter } from "./connectors/evaboot/evaboot-api.adapter";
import { LemlistApiAdapter } from "./connectors/lemlist/lemlist-api.adapter";
import { MailshakeApiAdapter } from "./connectors/mailshake/mailshake-api.adapter";
import { WoodpeckerApiAdapter } from "./connectors/woodpecker/woodpecker-api.adapter";
import { ReplyIoApiAdapter } from "./connectors/reply-io/reply-io-api.adapter";
import { MixmaxApiAdapter } from "./connectors/mixmax/mixmax-api.adapter";
import { CirrusInsightApiAdapter } from "./connectors/cirrus-insight/cirrus-insight-api.adapter";
import { SpotioApiAdapter } from "./connectors/spotio/spotio-api.adapter";
import { MyHoursApiAdapter } from "./connectors/my-hours/my-hours-api.adapter";
import { PaperformApiAdapter } from "./connectors/paperform/paperform-api.adapter";
import { JotformApiAdapter } from "./connectors/jotform/jotform-api.adapter";
import { FormstackApiAdapter } from "./connectors/formstack/formstack-api.adapter";
import { SurveyMonkeyApiAdapter } from "./connectors/surveymonkey/surveymonkey-api.adapter";
import { FilloutApiAdapter } from "./connectors/fillout/fillout-api.adapter";
import { TallyApiAdapter } from "./connectors/tally/tally-api.adapter";
import { MailchimpApiAdapter } from "./connectors/mailchimp/mailchimp-api.adapter";
import { KlaviyoApiAdapter } from "./connectors/klaviyo/klaviyo-api.adapter";
import { ConvertKitApiAdapter } from "./connectors/convertkit/convertkit-api.adapter";
import { CampaignMonitorApiAdapter } from "./connectors/campaign-monitor/campaign-monitor-api.adapter";
import { ConstantContactApiAdapter } from "./connectors/constant-contact/constant-contact-api.adapter";
import { ActiveCampaignApiAdapter } from "./connectors/activecampaign/activecampaign-api.adapter";
import { CustomerIoApiAdapter } from "./connectors/customer-io/customer-io-api.adapter";
import { BrazeApiAdapter } from "./connectors/braze/braze-api.adapter";
import { SegmentApiAdapter } from "./connectors/segment/segment-api.adapter";
import { MixpanelApiAdapter } from "./connectors/mixpanel/mixpanel-api.adapter";
import { AmplitudeApiAdapter } from "./connectors/amplitude/amplitude-api.adapter";
import { PendoApiAdapter } from "./connectors/pendo/pendo-api.adapter";
import { PostHogApiAdapter } from "./connectors/posthog/posthog-api.adapter";
import { SentryApiAdapter } from "./connectors/sentry/sentry-api.adapter";
import { CognitoFormsMcpAdapter } from "./connectors/cognito-forms/cognito-forms-mcp.adapter";
import { WufooApiAdapter } from "./connectors/wufoo/wufoo-api.adapter";
import { GravityFormsApiAdapter } from "./connectors/gravity-forms/gravity-forms-api.adapter";
import { NinjaFormsApiAdapter } from "./connectors/ninja-forms/ninja-forms-api.adapter";
import { WpFormsApiAdapter } from "./connectors/wpforms/wpforms-api.adapter";
import { AlchemerApiAdapter } from "./connectors/alchemer/alchemer-api.adapter";
import { QualtricsApiAdapter } from "./connectors/qualtrics/qualtrics-api.adapter";
import { AskNicelyApiAdapter } from "./connectors/asknicely/asknicely-api.adapter";
import { DelightedApiAdapter } from "./connectors/delighted/delighted-api.adapter";
import { RefinerApiAdapter } from "./connectors/refiner/refiner-api.adapter";
import { HotjarApiAdapter } from "./connectors/hotjar/hotjar-api.adapter";
import { UserTestingApiAdapter } from "./connectors/usertesting/usertesting-api.adapter";
import { MazeMcpAdapter } from "./connectors/maze/maze-mcp.adapter";
import { LookbackMcpAdapter } from "./connectors/lookback/lookback-mcp.adapter";
import { UserInterviewsApiAdapter } from "./connectors/user-interviews/user-interviews-api.adapter";
import { RespondentApiAdapter } from "./connectors/respondent/respondent-api.adapter";
import { DovetailApiAdapter } from "./connectors/dovetail/dovetail-api.adapter";
import { SprigApiAdapter } from "./connectors/sprig/sprig-api.adapter";
import { AirtableFormsApiAdapter } from "./connectors/airtable-forms/airtable-forms-api.adapter";
import { DocuSignClmApiAdapter } from "./connectors/docusign-clm/docusign-clm-api.adapter";
import { RewardfulApiAdapter } from "./connectors/rewardful/rewardful-api.adapter";
import { FirstPromoterMcpAdapter } from "./connectors/firstpromoter/firstpromoter-mcp.adapter";
import { ApolloIoApiAdapter } from "./connectors/apollo-io/apollo-io-api.adapter";
import { OutreachApiAdapter } from "./connectors/outreach/outreach-api.adapter";
import { SalesloftApiAdapter } from "./connectors/salesloft/salesloft-api.adapter";
import { GongApiAdapter } from "./connectors/gong/gong-api.adapter";
import { ChorusAiApiAdapter } from "./connectors/chorus-ai/chorus-ai-api.adapter";
import { ClariCopilotApiAdapter } from "./connectors/clari/clari-copilot-api.adapter";
import { PeopleAiMcpAdapter } from "./connectors/people-ai/people-ai-mcp.adapter";
import { CognismApiAdapter } from "./connectors/cognism/cognism-api.adapter";
import { ZoomInfoApiAdapter } from "./connectors/zoominfo/zoominfo-api.adapter";
import { ClearbitApiAdapter } from "./connectors/clearbit/clearbit-api.adapter";
import { LeadfeederApiAdapter } from "./connectors/leadfeeder/leadfeeder-api.adapter";
import { UnbounceApiAdapter } from "./connectors/unbounce/unbounce-api.adapter";
import { InstapageApiAdapter } from "./connectors/instapage/instapage-api.adapter";
import { OptimizelyApiAdapter } from "./connectors/optimizely/optimizely-api.adapter";
import { VwoApiAdapter } from "./connectors/vwo/vwo-api.adapter";
import { AbTastyApiAdapter } from "./connectors/ab-tasty/ab-tasty-api.adapter";
import { FullstoryApiAdapter } from "./connectors/fullstory/fullstory-api.adapter";
import { PCloudApiAdapter } from "./connectors/pcloud/pcloud-api.adapter";
import { TresoritS3Adapter } from "./connectors/tresorit/tresorit-s3.adapter";
import { HightailApiAdapter } from "./connectors/hightail/hightail-api.adapter";
import { FilestackApiAdapter } from "./connectors/filestack/filestack-api.adapter";
import { ImgixApiAdapter } from "./connectors/imgix/imgix-api.adapter";
import { BynderApiAdapter } from "./connectors/bynder/bynder-api.adapter";
import { BrandfolderApiAdapter } from "./connectors/brandfolder/brandfolder-api.adapter";
import { CantoApiAdapter } from "./connectors/canto/canto-api.adapter";
import { FrontifyApiAdapter } from "./connectors/frontify/frontify-api.adapter";
import { AssetBankApiAdapter } from "./connectors/asset-bank/asset-bank-api.adapter";
import { WidenCollectiveApiAdapter } from "./connectors/widen-collective/widen-collective-api.adapter";
import { KontainerApiAdapter } from "./connectors/kontainer/kontainer-api.adapter";
import { JiraAlignApiAdapter } from "./connectors/jira-align/jira-align-api.adapter";
import { AtlassianCompassApiAdapter } from "./connectors/atlassian-compass/atlassian-compass-api.adapter";
import { DaminionApiAdapter } from "./connectors/daminion/daminion-api.adapter";
import { MsProjectApiAdapter } from "./connectors/ms-project/ms-project-api.adapter";
import { MicrosoftDynamics365SalesApiAdapter } from "./connectors/microsoft-dynamics-365-sales/microsoft-dynamics-365-sales-api.adapter";
import { MicrosoftDynamics365CustomerServiceApiAdapter } from "./connectors/microsoft-dynamics-365-customer-service/microsoft-dynamics-365-customer-service-api.adapter";
import { MicrosoftDynamics365BusinessCentralApiAdapter } from "./connectors/microsoft-dynamics-365-business-central/microsoft-dynamics-365-business-central-api.adapter";
import { MicrosoftEntraIdGraphAdapter } from "./connectors/microsoft-entra-id/microsoft-entra-id-graph.adapter";
import { YammerApiAdapter } from "./connectors/yammer/yammer-api.adapter";
import { VivaLearningGraphAdapter } from "./connectors/viva-learning/viva-learning-graph.adapter";
import { JiraApiAdapter } from "./connectors/jira/jira-api.adapter";
import { JiraServiceManagementApiAdapter } from "./connectors/jira-service-management/jira-service-management-api.adapter";
import { ProductboardApiAdapter } from "./connectors/productboard/productboard-api.adapter";
import { AhaApiAdapter } from "./connectors/aha/aha-api.adapter";
import { RoadmunkGraphqlAdapter } from "./connectors/roadmunk/roadmunk-graphql.adapter";
import { ShortcutApiAdapter } from "./connectors/shortcut/shortcut-api.adapter";
import { HiveApiAdapter } from "./connectors/hive/hive-api.adapter";
import { NiftyApiAdapter } from "./connectors/nifty/nifty-api.adapter";
import { PaymoApiAdapter } from "./connectors/paymo/paymo-api.adapter";
import { ProofHubApiAdapter } from "./connectors/proofhub/proofhub-api.adapter";
import { ProofApiAdapter } from "./connectors/proof/proof-api.adapter";
import { TermlyApiAdapter } from "./connectors/termly/termly-api.adapter";
import { CookiebotApiAdapter } from "./connectors/cookiebot/cookiebot-api.adapter";
import { OneTrustApiAdapter } from "./connectors/onetrust/onetrust-api.adapter";
import { SalesforceMarketingCloudApiAdapter } from "./connectors/salesforce-marketing-cloud/salesforce-marketing-cloud-api.adapter";
import { SalesforceCommerceCloudApiAdapter } from "./connectors/salesforce-commerce-cloud/salesforce-commerce-cloud-api.adapter";
import { MarketoApiAdapter } from "./connectors/marketo/marketo-api.adapter";
import { PardotApiAdapter } from "./connectors/pardot/pardot-api.adapter";
import { EloquaApiAdapter } from "./connectors/eloqua/eloqua-api.adapter";
import { DripApiAdapter } from "./connectors/drip/drip-api.adapter";
import { MailerLiteApiAdapter } from "./connectors/mailerlite/mailerlite-api.adapter";
import { AWeberApiAdapter } from "./connectors/aweber/aweber-api.adapter";
import { GetResponseApiAdapter } from "./connectors/getresponse/getresponse-api.adapter";
import { MoosendApiAdapter } from "./connectors/moosend/moosend-api.adapter";
import { OmnisendApiAdapter } from "./connectors/omnisend/omnisend-api.adapter";
import { MailercloudApiAdapter } from "./connectors/mailercloud/mailercloud-api.adapter";
import { BenchmarkEmailApiAdapter } from "./connectors/benchmark-email/benchmark-email-api.adapter";
import { EmmaApiAdapter } from "./connectors/emma/emma-api.adapter";
import { FlodeskApiAdapter } from "./connectors/flodesk/flodesk-api.adapter";
import { HomebrewApiAdapter } from "./connectors/homebrew/homebrew-api.adapter";
import { CalibreApiAdapter } from "./connectors/calibre/calibre-api.adapter";
import { PlexPersonalMediaServerApiAdapter } from "./connectors/plex-personal-media-server/plex-personal-media-server-api.adapter";
import { JellyfinApiAdapter } from "./connectors/jellyfin/jellyfin-api.adapter";
import { SynologyDsmApiAdapter } from "./connectors/synology-dsm/synology-dsm-api.adapter";
import { WordPressWooCommerceSelfHostedApiAdapter } from "./connectors/wordpress-woocommerce-self-hosted/wordpress-woocommerce-self-hosted-api.adapter";
import { MagentoSelfHostedApiAdapter } from "./connectors/magento-self-hosted/magento-self-hosted-api.adapter";
import { PrestaShopSelfHostedApiAdapter } from "./connectors/prestashop-self-hosted/prestashop-self-hosted-api.adapter";
import { DrupalApiAdapter } from "./connectors/drupal/drupal-api.adapter";
import { JoomlaApiAdapter } from "./connectors/joomla/joomla-api.adapter";
import { ConcreteCmsApiAdapter } from "./connectors/concrete-cms/concrete-cms-api.adapter";
import { CraftCmsApiAdapter } from "./connectors/craft-cms/craft-cms-api.adapter";
import { StatamicApiAdapter } from "./connectors/statamic/statamic-api.adapter";
import { KirbyCmsApiAdapter } from "./connectors/kirby-cms/kirby-cms-api.adapter";
import { DirectusSelfHostedApiAdapter } from "./connectors/directus-self-hosted/directus-self-hosted-api.adapter";
import { StrapiSelfHostedApiAdapter } from "./connectors/strapi-self-hosted/strapi-self-hosted-api.adapter";
import { SupabaseSelfHostedApiAdapter } from "./connectors/supabase-self-hosted/supabase-self-hosted-api.adapter";
import { MeisterTaskApiAdapter } from "./connectors/meistertask/meistertask-api.adapter";
import { NozbeApiAdapter } from "./connectors/nozbe/nozbe-api.adapter";
import { AnyDoMcpAdapter } from "./connectors/any-do/any-do-mcp.adapter";
import { RememberTheMilkMcpAdapter } from "./connectors/remember-the-milk/remember-the-milk-mcp.adapter";
import { HabiticaApiAdapter } from "./connectors/habitica/habitica-api.adapter";
import { AmazingMarvinApiAdapter } from "./connectors/amazing-marvin/amazing-marvin-api.adapter";
import { AkiflowMcpAdapter } from "./connectors/akiflow/akiflow-mcp.adapter";
import { SunsamaMcpAdapter } from "./connectors/sunsama/sunsama-mcp.adapter";
import { MotionApiAdapter } from "./connectors/motion/motion-api.adapter";
import { ReclaimAiApiAdapter } from "./connectors/reclaim-ai/reclaim-ai-api.adapter";
import { SavvyCalApiAdapter } from "./connectors/savvycal/savvycal-api.adapter";
import { YouCanBookMeApiAdapter } from "./connectors/youcanbookme/youcanbookme-api.adapter";
import { AcuitySchedulingApiAdapter } from "./connectors/acuity-scheduling/acuity-scheduling-api.adapter";
import { SimplyBookMeApiAdapter } from "./connectors/simplybook-me/simplybook-me-api.adapter";
import { OnceHubApiAdapter } from "./connectors/oncehub/oncehub-api.adapter";
import { SalesflareApiAdapter } from "./connectors/salesflare/salesflare-api.adapter";
import { FolkCrmApiAdapter } from "./connectors/folk-crm/folk-crm-api.adapter";
import { OnePageCrmApiAdapter } from "./connectors/onepagecrm/onepagecrm-api.adapter";
import { FollowUpBossApiAdapter } from "./connectors/follow-up-boss/follow-up-boss-api.adapter";
import { ChimeCrmApiAdapter } from "./connectors/chime-crm/chime-crm-api.adapter";
import { ReallySimpleSystemsApiAdapter } from "./connectors/really-simple-systems/really-simple-systems-api.adapter";
import { VtigerCrmApiAdapter } from "./connectors/vtiger-crm/vtiger-crm-api.adapter";
import { SuiteCrmCloudApiAdapter } from "./connectors/suitecrm-cloud/suitecrm-cloud-api.adapter";
import { SugarCrmApiAdapter } from "./connectors/sugarcrm/sugarcrm-api.adapter";
import { CreatioApiAdapter } from "./connectors/creatio/creatio-api.adapter";
import { AttioApiAdapter } from "./connectors/attio/attio-api.adapter";
import { SetmoreApiAdapter } from "./connectors/setmore/setmore-api.adapter";
import { PlutioApiAdapter } from "./connectors/plutio/plutio-api.adapter";
import { ShootProofApiAdapter } from "./connectors/shootproof/shootproof-api.adapter";
import { SmugMugApiAdapter } from "./connectors/smugmug/smugmug-api.adapter";
import { FlickrApiAdapter } from "./connectors/flickr/flickr-api.adapter";
import { DribbbleApiAdapter } from "./connectors/dribbble/dribbble-api.adapter";
import { DeviantArtApiAdapter } from "./connectors/deviantart/deviantart-api.adapter";
import { BandcampApiAdapter } from "./connectors/bandcamp/bandcamp-api.adapter";
import { MixcloudApiAdapter } from "./connectors/mixcloud/mixcloud-api.adapter";
import { AudiomackApiAdapter } from "./connectors/audiomack/audiomack-api.adapter";
import { AudiusApiAdapter } from "./connectors/audius/audius-api.adapter";
import { PodbeanApiAdapter } from "./connectors/podbean/podbean-api.adapter";
import { MailchimpTransactionalApiAdapter } from "./connectors/mailchimp-transactional/mailchimp-transactional-api.adapter";
import { MailchimpSurveysApiAdapter } from "./connectors/mailchimp-surveys/mailchimp-surveys-api.adapter";
import { KlaviyoSmsApiAdapter } from "./connectors/klaviyo-sms/klaviyo-sms-api.adapter";
import { AttentiveApiAdapter } from "./connectors/attentive/attentive-api.adapter";
import { PostscriptApiAdapter } from "./connectors/postscript/postscript-api.adapter";
import { SendlaneApiAdapter } from "./connectors/sendlane/sendlane-api.adapter";
import { IterableApiAdapter } from "./connectors/iterable/iterable-api.adapter";
import { IterableSmsApiAdapter } from "./connectors/iterable-sms/iterable-sms-api.adapter";
import { OrttoApiAdapter } from "./connectors/ortto/ortto-api.adapter";
import { VeroApiAdapter } from "./connectors/vero/vero-api.adapter";
import { MessageGearsApiAdapter } from "./connectors/messagegears/messagegears-api.adapter";
import { MaropostApiAdapter } from "./connectors/maropost/maropost-api.adapter";
import { EmarsysApiAdapter } from "./connectors/emarsys/emarsys-api.adapter";
import { SailthruApiAdapter } from "./connectors/sailthru/sailthru-api.adapter";
import { ListrakApiAdapter } from "./connectors/listrak/listrak-api.adapter";
import { DotdigitalApiAdapter } from "./connectors/dotdigital/dotdigital-api.adapter";
import { AcousticCampaignApiAdapter } from "./connectors/acoustic-campaign/acoustic-campaign-api.adapter";
import { BloomreachEngagementApiAdapter } from "./connectors/bloomreach-engagement/bloomreach-engagement-api.adapter";
import { MoEngageApiAdapter } from "./connectors/moengage/moengage-api.adapter";
import { SalesforceDataCloudApiAdapter } from "./connectors/salesforce-data-cloud/salesforce-data-cloud-api.adapter";
import { AdobeRealTimeCdpApiAdapter } from "./connectors/adobe-real-time-cdp/adobe-real-time-cdp-api.adapter";
import { TwilioSegmentEngageApiAdapter } from "./connectors/twilio-segment-engage/twilio-segment-engage-api.adapter";
import { AmplitudeExperimentApiAdapter } from "./connectors/amplitude-experiment/amplitude-experiment-api.adapter";
import { MixpanelCohortsApiAdapter } from "./connectors/mixpanel-cohorts/mixpanel-cohorts-api.adapter";
import { PostHogFeatureFlagsApiAdapter } from "./connectors/posthog-feature-flags/posthog-feature-flags-api.adapter";
import { StatsigApiAdapter } from "./connectors/statsig/statsig-api.adapter";
import { LaunchDarklyApiAdapter } from "./connectors/launchdarkly/launchdarkly-api.adapter";
import { SplitIoApiAdapter } from "./connectors/split-io/split-io-api.adapter";
import { FlagsmithCloudApiAdapter } from "./connectors/flagsmith-cloud/flagsmith-cloud-api.adapter";
import { ConfigCatApiAdapter } from "./connectors/configcat/configcat-api.adapter";
import { GrowthBookCloudApiAdapter } from "./connectors/growthbook-cloud/growthbook-cloud-api.adapter";
import { UnleashCloudApiAdapter } from "./connectors/unleash-cloud/unleash-cloud-api.adapter";
import { OptimizelyRolloutsApiAdapter } from "./connectors/optimizely-rollouts/optimizely-rollouts-api.adapter";
import { VwoTestingApiAdapter } from "./connectors/vwo-testing/vwo-testing-api.adapter";
import { AbTastyFeatureExperimentationApiAdapter } from "./connectors/ab-tasty-feature-experimentation/ab-tasty-feature-experimentation-api.adapter";
import { SquareAppointmentsApiAdapter } from "./connectors/square-appointments/square-appointments-api.adapter";
import { VagaroApiAdapter } from "./connectors/vagaro/vagaro-api.adapter";
import { MindbodyApiAdapter } from "./connectors/mindbody/mindbody-api.adapter";
import { JaneAppApiAdapter } from "./connectors/jane-app/jane-app-api.adapter";
import { ClinikoApiAdapter } from "./connectors/cliniko/cliniko-api.adapter";
import { PracticeBetterApiAdapter } from "./connectors/practice-better/practice-better-api.adapter";
import { HealthieGraphqlAdapter } from "./connectors/healthie/healthie-graphql.adapter";
import { CloudinaryMcpAdapter } from "./connectors/cloudinary/cloudinary-mcp.adapter";
import { MuralApiAdapter } from "./connectors/mural/mural-api.adapter";
import { FigJamApiAdapter } from "./connectors/figjam/figjam-api.adapter";
import { FigmaApiAdapter } from "./connectors/figma/figma-api.adapter";
import { MiroApiAdapter } from "./connectors/miro/miro-api.adapter";
import { CanvaApiAdapter } from "./connectors/canva/canva-api.adapter";
import { WebflowApiAdapter } from "./connectors/webflow/webflow-api.adapter";
import { WordPressComApiAdapter } from "./connectors/wordpress-com/wordpress-com-api.adapter";
import { GhostApiAdapter } from "./connectors/ghost/ghost-api.adapter";
import { ContentfulApiAdapter } from "./connectors/contentful/contentful-api.adapter";
import { SanityApiAdapter } from "./connectors/sanity/sanity-api.adapter";
import { StrapiCloudApiAdapter } from "./connectors/strapi-cloud/strapi-cloud-api.adapter";
import { ShopifyApiAdapter } from "./connectors/shopify/shopify-api.adapter";
import { WooCommerceApiAdapter } from "./connectors/woocommerce/woocommerce-api.adapter";
import { StripeApiAdapter } from "./connectors/stripe/stripe-api.adapter";
import { PayPalApiAdapter } from "./connectors/paypal/paypal-api.adapter";
import { KajabiCommunitiesApiAdapter } from "./connectors/kajabi-communities/kajabi-communities-api.adapter";
import { CircleApiAdapter } from "./connectors/circle/circle-api.adapter";
import { MightyNetworksApiAdapter } from "./connectors/mighty-networks/mighty-networks-api.adapter";
import { DiscourseApiAdapter } from "./connectors/discourse/discourse-api.adapter";
import { VanillaForumsApiAdapter } from "./connectors/vanilla-forums/vanilla-forums-api.adapter";
import { BettermodeApiAdapter } from "./connectors/bettermode/bettermode-api.adapter";
import { HigherLogicApiAdapter } from "./connectors/higher-logic/higher-logic-api.adapter";
import { HivebriteApiAdapter } from "./connectors/hivebrite/hivebrite-api.adapter";
import { XeroApiAdapter } from "./connectors/xero/xero-api.adapter";
import { QuickBooksApiAdapter } from "./connectors/quickbooks/quickbooks-api.adapter";
import { FreshBooksApiAdapter } from "./connectors/freshbooks/freshbooks-api.adapter";
import { WaveApiAdapter } from "./connectors/wave/wave-api.adapter";
import { FreeAgentApiAdapter } from "./connectors/freeagent/freeagent-api.adapter";
import { SalesforceApiAdapter } from "./connectors/salesforce/salesforce-api.adapter";
import { HubSpotApiAdapter } from "./connectors/hubspot/hubspot-api.adapter";
import { LucidsparkApiAdapter } from "./connectors/lucidspark/lucidspark-api.adapter";
import { LucidchartApiAdapter } from "./connectors/lucidchart/lucidchart-api.adapter";
import { ObsidianCliAdapter } from "./connectors/obsidian/obsidian-cli.adapter";
import { RoamResearchCliAdapter } from "./connectors/roam-research/roam-research-cli.adapter";
import { LogseqCliAdapter } from "./connectors/logseq/logseq-cli.adapter";
import { BlueskyOAuthSecurity } from "./bluesky/bluesky-oauth-security";
import { BlueskyOAuthDiscovery } from "./bluesky/bluesky-oauth-discovery";
import { BlueskyMarketplaceOAuthController } from "./bluesky/bluesky-marketplace.controller";
import { BlueskyOAuthService } from "./bluesky/bluesky-oauth.service";
import { BlueskyActionService } from "./bluesky/bluesky-action.service";

@Module({
  imports: [
    SecurityModule,
    AuditLogModule,
    WorkspaceMembershipModule,
    AgentDocumentationModule,
    AgentModule,
    BridgeModule,
    MessageModule,
    RuntimeModule,
    ToolRequestModule,
    TypeOrmModule.forFeature([
      MarketplaceConnectionEntity,
      MarketplaceOAuthStateEntity,
      ApprovalEntity,
      MarketplaceInstallEntity,
      MarketplacePackGenerationJobEntity,
      MarketplaceGeneratedPackEntity,
      MarketplacePackSourceEntity,
      MarketplacePackQualityScoreEntity,
      MarketplacePackReviewEntity,
      LinkedApplicationEntity,
      ApplicationDocumentationPackEntity,
      ApplicationDocumentationVersionEntity,
      DocumentationSyncMappingEntity,
      DocumentationGenerationProposalEntity,
      DocumentationProposalFileEntity,
      AgentDocumentationInstallEntity,
      AgentDocumentationVersionEntity,
      AgentEntity,
      MessageEntity,
      ScheduledThreadMessageEntity,
      ThreadEntity,
      RuntimeDispatchEntity,
      ToolRequestEntity,
      WorkspaceEntity,
      WorkspaceMemberEntity,
    ]),
  ],
  controllers: [
    PublicMarketplaceController,
    MarketplaceController,
    BlueskyMarketplaceOAuthController,
    XMarketplaceController,
    XMarketplaceBridgeToolsController,
    XMarketplaceOAuthCallbackController,
    MarketplaceConnectorOAuthCallbackController,
    LocalAppConnectorAgentApiBridgeToolsController,
    BridgeAgentMarketplaceToolsController,
  ],
  providers: [
    MarketplaceService,
    XMarketplaceService,
    MarketplaceConnectorRegistry,
    MarketplaceConnectorCredentialService,
    MarketplaceConnectorOAuthService,
    MarketplaceConnectorExecutionService,
    ExaApiAdapter,
    DataForSeoApiAdapter,
    {
      provide: LinkedInApiAdapter,
      useFactory: () => new LinkedInApiAdapter(),
    },
    NextdoorApiAdapter,
    MeetupApiAdapter,
    EventbriteApiAdapter,
    WebexApiAdapter,
    GoToMeetingApiAdapter,
    RingCentralApiAdapter,
    DialpadApiAdapter,
    AircallApiAdapter,
    OpenPhoneApiAdapter,
    TwilioApiAdapter,
    VonageApiAdapter,
    MessageBirdApiAdapter,
    FredApiAdapter,
    ApolloGraphOsApiAdapter,
    HunterApiAdapter,
    SnovApiAdapter,
    LushaApiAdapter,
    LeadIqApiAdapter,
    SeamlessAiApiAdapter,
    RocketReachApiAdapter,
    UpLeadApiAdapter,
    WizaApiAdapter,
    ClayApiAdapter,
    PhantomBusterApiAdapter,
    TexAuApiAdapter,
    EvabootApiAdapter,
    LemlistApiAdapter,
    MailshakeApiAdapter,
    WoodpeckerApiAdapter,
    ReplyIoApiAdapter,
    MixmaxApiAdapter,
    CirrusInsightApiAdapter,
    SpotioApiAdapter,
    ThreadsApiAdapter,
    PinterestApiAdapter,
    TumblrApiAdapter,
    MastodonApiAdapter,
    TwistApiAdapter,
    ZohoMailApiAdapter,
    SlackApiAdapter,
    GitHubApiAdapter,
    GitLabApiAdapter,
    BitbucketApiAdapter,
    NotionApiAdapter,
    LinearApiAdapter,
    AsanaApiAdapter,
    TrelloApiAdapter,
    ClickUpApiAdapter,
    MondayComApiAdapter,
    AirtableApiAdapter,
    OutlookGraphAdapter,
    MailgunApiAdapter,
    SendGridApiAdapter,
    PostmarkApiAdapter,
    ResendApiAdapter,
    SparkPostApiAdapter,
    BrevoApiAdapter,
    MailjetApiAdapter,
    EvernoteApiAdapter,
    FuseBaseMcpAdapter,
    AtlassianRovoMcpAdapter,
    OpsgenieCloudApiAdapter,
    StatuspageCloudApiAdapter,
    MemApiAdapter,
    ReflectApiAdapter,
    ReadwiseApiAdapter,
    CommonRoomApiAdapter,
    SlackEnterpriseGridApiAdapter,
    SlackCanvasApiAdapter,
    SlackListsApiAdapter,
    TeamsPhoneGraphAdapter,
    ZoomPhoneApiAdapter,
    ZoomRoomsApiAdapter,
    ZoomWebinarsApiAdapter,
    ZoomEventsApiAdapter,
    WebexCallingApiAdapter,
    GoToWebinarApiAdapter,
    LivestormApiAdapter,
    DemioApiAdapter,
    BigMarkerApiAdapter,
    RaindropIoApiAdapter,
    InstapaperApiAdapter,
    FeedlyApiAdapter,
    InoreaderApiAdapter,
    ReadMeApiAdapter,
    GuruApiAdapter,
    GuruMcpAdapter,
    SliteMcpAdapter,
    SlabGraphqlAdapter,
    ConfluenceApiAdapter,
    QuipApiAdapter,
    NuclinoMcpAdapter,
    Document360ApiAdapter,
    ArchbeeApiAdapter,
    TettraApiAdapter,
    KnowledgeOwlApiAdapter,
    FreshdeskApiAdapter,
    CodaApiAdapter,
    CraftApiAdapter,
    TelegramPersonalBotsApiAdapter,
    LocalWordPressOrgCliAdapter,
    MatomoSelfHostedApiAdapter,
    PlausibleSelfHostedApiAdapter,
    UmamiSelfHostedApiAdapter,
    GhostSelfHostedApiAdapter,
    XrayTestManagementApiAdapter,
    StructureForJiraApiAdapter,
    ProductPlanApiAdapter,
    CraftIoApiAdapter,
    AirfocusApiAdapter,
    FavroApiAdapter,
    PlanviewAgilePlaceApiAdapter,
    LiquidPlannerApiAdapter,
    WorkfrontPlanningApiAdapter,
    KantataOxApiAdapter,
    AcceloApiAdapter,
    AvazaApiAdapter,
    AnytypeLocalApiAdapter,
    DropboxApiAdapter,
    BoxApiAdapter,
    ScribeMcpAdapter,
    VidyardApiAdapter,
    VimeoApiAdapter,
    WistiaApiAdapter,
    FrameIoApiAdapter,
    DescriptApiAdapter,
    RevApiAdapter,
    {
      provide: BuzzsproutApiAdapter,
      useFactory: () => new BuzzsproutApiAdapter(),
    },
    {
      provide: CaptivateFmApiAdapter,
      useFactory: () => new CaptivateFmApiAdapter(),
    },
    {
      provide: TransistorFmApiAdapter,
      useFactory: () => new TransistorFmApiAdapter(),
    },
    {
      provide: RiversideFmApiAdapter,
      useFactory: () => new RiversideFmApiAdapter(),
    },
    {
      provide: RestreamApiAdapter,
      useFactory: () => new RestreamApiAdapter(),
    },
    OtterAiMcpAdapter,
    FirefliesAiMcpAdapter,
    FathomMcpAdapter,
    BonsaiMcpAdapter,
    TlDvApiAdapter,
    GrainMcpAdapter,
    WhimsicalMcpAdapter,
    DrawIoMcpAdapter,
    MindMeisterApiAdapter,
    XMindMcpAdapter,
    AdobeAnalyticsMcpAdapter,
    AdobeMarketoEngageApiAdapter,
    AdobeTargetApiAdapter,
    OsanoApiAdapter,
    SecureframeApiAdapter,
    VantaApiAdapter,
    DrataApiAdapter,
    SprintoApiAdapter,
    HyperproofApiAdapter,
    WorkivaApiAdapter,
    CartaApiAdapter,
    ShareworksApiAdapter,
    LedgyApiAdapter,
    PadletApiAdapter,
    DropboxPaperApiAdapter,
    ZohoWorkDriveApiAdapter,
    EgnyteApiAdapter,
    ShareFileApiAdapter,
    DeputyApiAdapter,
    HomebaseApiAdapter,
    SevenShiftsApiAdapter,
    ResourceGuruApiAdapter,
    RunnApiAdapter,
    EverhourApiAdapter,
    TimelyTimeTrackingApiAdapter,
    RescueTimeApiAdapter,
    TimeDoctorApiAdapter,
    HubstaffApiAdapter,
    QuickBooksTimeApiAdapter,
    RepliconApiAdapter,
    ActiTimeApiAdapter,
    TrackingTimeMcpAdapter,
    OntraportMcpAdapter,
    { provide: Bitrix24ApiAdapter, useFactory: () => new Bitrix24ApiAdapter() },
    { provide: AgileCrmApiAdapter, useFactory: () => new AgileCrmApiAdapter() },
    { provide: StreakApiAdapter, useFactory: () => new StreakApiAdapter() },
    {
      provide: LessAnnoyingCrmApiAdapter,
      useFactory: () => new LessAnnoyingCrmApiAdapter(),
    },
    { provide: NutshellApiAdapter, useFactory: () => new NutshellApiAdapter() },
    {
      provide: TeamleaderApiAdapter,
      useFactory: () => new TeamleaderApiAdapter(),
    },
    { provide: ScoroApiAdapter, useFactory: () => new ScoroApiAdapter() },
    { provide: OdooApiAdapter, useFactory: () => new OdooApiAdapter() },
    { provide: NetSuiteApiAdapter, useFactory: () => new NetSuiteApiAdapter() },
    {
      provide: SageAccountingApiAdapter,
      useFactory: () => new SageAccountingApiAdapter(),
    },
    {
      provide: SageIntacctApiAdapter,
      useFactory: () => new SageIntacctApiAdapter(),
    },
    { provide: MyobApiAdapter, useFactory: () => new MyobApiAdapter() },
    {
      provide: KashFlowSoapAdapter,
      useFactory: () => new KashFlowSoapAdapter(),
    },
    {
      provide: ZohoBooksApiAdapter,
      useFactory: () => new ZohoBooksApiAdapter(),
    },
    {
      provide: ZohoInvoiceApiAdapter,
      useFactory: () => new ZohoInvoiceApiAdapter(),
    },
    {
      provide: ZohoExpenseApiAdapter,
      useFactory: () => new ZohoExpenseApiAdapter(),
    },
    { provide: ZohoDeskApiAdapter, useFactory: () => new ZohoDeskApiAdapter() },
    {
      provide: ZohoProjectsApiAdapter,
      useFactory: () => new ZohoProjectsApiAdapter(),
    },
    MyHoursApiAdapter,
    PaperformApiAdapter,
    JotformApiAdapter,
    FormstackApiAdapter,
    {
      provide: SurveyMonkeyApiAdapter,
      useFactory: () => new SurveyMonkeyApiAdapter(),
    },
    { provide: FilloutApiAdapter, useFactory: () => new FilloutApiAdapter() },
    { provide: TallyApiAdapter, useFactory: () => new TallyApiAdapter() },
    {
      provide: MailchimpApiAdapter,
      useFactory: () => new MailchimpApiAdapter(),
    },
    { provide: KlaviyoApiAdapter, useFactory: () => new KlaviyoApiAdapter() },
    {
      provide: ConvertKitApiAdapter,
      useFactory: () => new ConvertKitApiAdapter(),
    },
    {
      provide: CampaignMonitorApiAdapter,
      useFactory: () => new CampaignMonitorApiAdapter(),
    },
    {
      provide: ConstantContactApiAdapter,
      useFactory: () => new ConstantContactApiAdapter(),
    },
    {
      provide: ActiveCampaignApiAdapter,
      useFactory: () => new ActiveCampaignApiAdapter(),
    },
    {
      provide: CustomerIoApiAdapter,
      useFactory: () => new CustomerIoApiAdapter(),
    },
    { provide: BrazeApiAdapter, useFactory: () => new BrazeApiAdapter() },
    { provide: SegmentApiAdapter, useFactory: () => new SegmentApiAdapter() },
    {
      provide: MixpanelApiAdapter,
      useFactory: () => new MixpanelApiAdapter(),
    },
    {
      provide: AmplitudeApiAdapter,
      useFactory: () => new AmplitudeApiAdapter(),
    },
    { provide: PendoApiAdapter, useFactory: () => new PendoApiAdapter() },
    { provide: PostHogApiAdapter, useFactory: () => new PostHogApiAdapter() },
    { provide: SentryApiAdapter, useFactory: () => new SentryApiAdapter() },
    CognitoFormsMcpAdapter,
    WufooApiAdapter,
    GravityFormsApiAdapter,
    NinjaFormsApiAdapter,
    WpFormsApiAdapter,
    AlchemerApiAdapter,
    QualtricsApiAdapter,
    AskNicelyApiAdapter,
    DelightedApiAdapter,
    RefinerApiAdapter,
    HotjarApiAdapter,
    UserTestingApiAdapter,
    MazeMcpAdapter,
    LookbackMcpAdapter,
    UserInterviewsApiAdapter,
    RespondentApiAdapter,
    DovetailApiAdapter,
    SprigApiAdapter,
    AirtableFormsApiAdapter,
    DocuSignClmApiAdapter,
    RewardfulApiAdapter,
    FirstPromoterMcpAdapter,
    ApolloIoApiAdapter,
    OutreachApiAdapter,
    SalesloftApiAdapter,
    GongApiAdapter,
    ChorusAiApiAdapter,
    ClariCopilotApiAdapter,
    PeopleAiMcpAdapter,
    CognismApiAdapter,
    ZoomInfoApiAdapter,
    ClearbitApiAdapter,
    LeadfeederApiAdapter,
    UnbounceApiAdapter,
    InstapageApiAdapter,
    OptimizelyApiAdapter,
    VwoApiAdapter,
    AbTastyApiAdapter,
    FullstoryApiAdapter,
    PCloudApiAdapter,
    TresoritS3Adapter,
    HightailApiAdapter,
    FilestackApiAdapter,
    ImgixApiAdapter,
    BynderApiAdapter,
    BrandfolderApiAdapter,
    CantoApiAdapter,
    FrontifyApiAdapter,
    AssetBankApiAdapter,
    WidenCollectiveApiAdapter,
    KontainerApiAdapter,
    JiraAlignApiAdapter,
    AtlassianCompassApiAdapter,
    DaminionApiAdapter,
    MsProjectApiAdapter,
    MicrosoftDynamics365SalesApiAdapter,
    MicrosoftDynamics365CustomerServiceApiAdapter,
    MicrosoftDynamics365BusinessCentralApiAdapter,
    MicrosoftEntraIdGraphAdapter,
    YammerApiAdapter,
    VivaLearningGraphAdapter,
    JiraApiAdapter,
    JiraServiceManagementApiAdapter,
    ProductboardApiAdapter,
    AhaApiAdapter,
    RoadmunkGraphqlAdapter,
    ShortcutApiAdapter,
    HiveApiAdapter,
    NiftyApiAdapter,
    PaymoApiAdapter,
    ProofHubApiAdapter,
    ProofApiAdapter,
    TermlyApiAdapter,
    CookiebotApiAdapter,
    OneTrustApiAdapter,
    SalesforceMarketingCloudApiAdapter,
    SalesforceCommerceCloudApiAdapter,
    MarketoApiAdapter,
    PardotApiAdapter,
    EloquaApiAdapter,
    DripApiAdapter,
    MailerLiteApiAdapter,
    AWeberApiAdapter,
    GetResponseApiAdapter,
    MoosendApiAdapter,
    OmnisendApiAdapter,
    MailercloudApiAdapter,
    BenchmarkEmailApiAdapter,
    EmmaApiAdapter,
    FlodeskApiAdapter,
    HomebrewApiAdapter,
    CalibreApiAdapter,
    PlexPersonalMediaServerApiAdapter,
    JellyfinApiAdapter,
    SynologyDsmApiAdapter,
    WordPressWooCommerceSelfHostedApiAdapter,
    MagentoSelfHostedApiAdapter,
    PrestaShopSelfHostedApiAdapter,
    DrupalApiAdapter,
    JoomlaApiAdapter,
    ConcreteCmsApiAdapter,
    CraftCmsApiAdapter,
    StatamicApiAdapter,
    KirbyCmsApiAdapter,
    DirectusSelfHostedApiAdapter,
    StrapiSelfHostedApiAdapter,
    SupabaseSelfHostedApiAdapter,
    MeisterTaskApiAdapter,
    NozbeApiAdapter,
    AnyDoMcpAdapter,
    RememberTheMilkMcpAdapter,
    HabiticaApiAdapter,
    AmazingMarvinApiAdapter,
    AkiflowMcpAdapter,
    SunsamaMcpAdapter,
    MotionApiAdapter,
    ReclaimAiApiAdapter,
    SavvyCalApiAdapter,
    YouCanBookMeApiAdapter,
    AcuitySchedulingApiAdapter,
    SimplyBookMeApiAdapter,
    OnceHubApiAdapter,
    SalesflareApiAdapter,
    FolkCrmApiAdapter,
    OnePageCrmApiAdapter,
    FollowUpBossApiAdapter,
    ChimeCrmApiAdapter,
    ReallySimpleSystemsApiAdapter,
    VtigerCrmApiAdapter,
    SuiteCrmCloudApiAdapter,
    SugarCrmApiAdapter,
    CreatioApiAdapter,
    AttioApiAdapter,
    SetmoreApiAdapter,
    PlutioApiAdapter,
    ShootProofApiAdapter,
    SmugMugApiAdapter,
    FlickrApiAdapter,
    DribbbleApiAdapter,
    DeviantArtApiAdapter,
    BandcampApiAdapter,
    MixcloudApiAdapter,
    AudiomackApiAdapter,
    AudiusApiAdapter,
    PodbeanApiAdapter,
    MailchimpTransactionalApiAdapter,
    MailchimpSurveysApiAdapter,
    KlaviyoSmsApiAdapter,
    AttentiveApiAdapter,
    PostscriptApiAdapter,
    SendlaneApiAdapter,
    IterableApiAdapter,
    IterableSmsApiAdapter,
    OrttoApiAdapter,
    VeroApiAdapter,
    MessageGearsApiAdapter,
    MaropostApiAdapter,
    EmarsysApiAdapter,
    SailthruApiAdapter,
    ListrakApiAdapter,
    DotdigitalApiAdapter,
    AcousticCampaignApiAdapter,
    BloomreachEngagementApiAdapter,
    MoEngageApiAdapter,
    SalesforceDataCloudApiAdapter,
    AdobeRealTimeCdpApiAdapter,
    TwilioSegmentEngageApiAdapter,
    AmplitudeExperimentApiAdapter,
    MixpanelCohortsApiAdapter,
    PostHogFeatureFlagsApiAdapter,
    StatsigApiAdapter,
    LaunchDarklyApiAdapter,
    SplitIoApiAdapter,
    FlagsmithCloudApiAdapter,
    ConfigCatApiAdapter,
    GrowthBookCloudApiAdapter,
    UnleashCloudApiAdapter,
    OptimizelyRolloutsApiAdapter,
    VwoTestingApiAdapter,
    AbTastyFeatureExperimentationApiAdapter,
    SquareAppointmentsApiAdapter,
    VagaroApiAdapter,
    MindbodyApiAdapter,
    JaneAppApiAdapter,
    ClinikoApiAdapter,
    PracticeBetterApiAdapter,
    HealthieGraphqlAdapter,
    CloudinaryMcpAdapter,
    MuralApiAdapter,
    FigJamApiAdapter,
    FigmaApiAdapter,
    MiroApiAdapter,
    CanvaApiAdapter,
    WebflowApiAdapter,
    WordPressComApiAdapter,
    GhostApiAdapter,
    ContentfulApiAdapter,
    SanityApiAdapter,
    StrapiCloudApiAdapter,
    ShopifyApiAdapter,
    WooCommerceApiAdapter,
    StripeApiAdapter,
    XeroApiAdapter,
    QuickBooksApiAdapter,
    FreshBooksApiAdapter,
    WaveApiAdapter,
    FreeAgentApiAdapter,
    SalesforceApiAdapter,
    HubSpotApiAdapter,
    PayPalApiAdapter,
    KajabiCommunitiesApiAdapter,
    CircleApiAdapter,
    MightyNetworksApiAdapter,
    DiscourseApiAdapter,
    VanillaForumsApiAdapter,
    BettermodeApiAdapter,
    HigherLogicApiAdapter,
    HivebriteApiAdapter,
    LucidsparkApiAdapter,
    LucidchartApiAdapter,
    ObsidianCliAdapter,
    RoamResearchCliAdapter,
    LogseqCliAdapter,
    BlueskyOAuthSecurity,
    BlueskyOAuthDiscovery,
    BlueskyOAuthService,
    BlueskyActionService,
  ],
  exports: [
    MarketplaceService,
    XMarketplaceService,
    MarketplaceConnectorRegistry,
    MarketplaceConnectorExecutionService,
  ],
})
export class MarketplaceModule {}
