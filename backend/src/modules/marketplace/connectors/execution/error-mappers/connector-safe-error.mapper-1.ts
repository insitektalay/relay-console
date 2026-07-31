import type {
  MarketplaceConnectorExecutorResult,
  MarketplaceConnectorSafeErrorCode,
} from "../../types";
import { AbTastyApiError } from "../../ab-tasty/ab-tasty-api.adapter";
import { ActiTimeApiError } from "../../actitime/actitime-api.adapter";
import { ActiveCampaignApiError } from "../../activecampaign/activecampaign-api.adapter";
import { AgileCrmApiError } from "../../agile-crm/agile-crm-api.adapter";
import { AirtableFormsApiError } from "../../airtable-forms/airtable-forms-api.adapter";
import { AlchemerApiError } from "../../alchemer/alchemer-api.adapter";
import { AmplitudeApiError } from "../../amplitude/amplitude-api.adapter";
import { ApolloIoApiError } from "../../apollo-io/apollo-io-api.adapter";
import { AskNicelyApiError } from "../../asknicely/asknicely-api.adapter";
import { AssetBankApiError } from "../../asset-bank/asset-bank-api.adapter";
import { AtlassianCompassApiError } from "../../atlassian-compass/atlassian-compass-api.adapter";
import { AtlassianRovoMcpError } from "../../atlassian-rovo/atlassian-rovo-mcp.adapter";
import { BigMarkerApiError } from "../../bigmarker/bigmarker-api.adapter";
import { Bitrix24ApiError } from "../../bitrix24/bitrix24-api.adapter";
import { BoundedRestApiError } from "../../bounded-rest/bounded-rest-api.adapter";
import { BrandfolderApiError } from "../../brandfolder/brandfolder-api.adapter";
import { BrazeApiError } from "../../braze/braze-api.adapter";
import { BrevoApiError } from "../../brevo/brevo-api.adapter";
import { BynderApiError } from "../../bynder/bynder-api.adapter";
import { CampaignMonitorApiError } from "../../campaign-monitor/campaign-monitor-api.adapter";
import { CantoApiError } from "../../canto/canto-api.adapter";
import { ChorusAiApiError } from "../../chorus-ai/chorus-ai-api.adapter";
import { ClariCopilotApiError } from "../../clari/clari-copilot-api.adapter";
import { ClearbitApiError } from "../../clearbit/clearbit-api.adapter";
import { CognismApiError } from "../../cognism/cognism-api.adapter";
import { CommonRoomApiError } from "../../common-room/common-room-api.adapter";
import { ConstantContactApiError } from "../../constant-contact/constant-contact-api.adapter";
import { ConvertKitApiError } from "../../convertkit/convertkit-api.adapter";
import { CustomerIoApiError } from "../../customer-io/customer-io-api.adapter";
import { DaminionApiError } from "../../daminion/daminion-api.adapter";
import { DataForSeoApiError } from "../../dataforseo/dataforseo-api.adapter";
import { DelightedApiError } from "../../delighted/delighted-api.adapter";
import { DemioApiError } from "../../demio/demio-api.adapter";
import { DeputyApiError } from "../../deputy/deputy-api.adapter";
import { DocuSignClmApiError } from "../../docusign-clm/docusign-clm-api.adapter";
import { DovetailApiError } from "../../dovetail/dovetail-api.adapter";
import { DropboxPaperApiError } from "../../dropbox-paper/dropbox-paper-api.adapter";
import { EgnyteApiError } from "../../egnyte/egnyte-api.adapter";
import { EvernoteApiError } from "../../evernote/evernote-api.adapter";
import { ExaApiError } from "../../exa/exa-api.adapter";
import { FeedlyApiError } from "../../feedly/feedly-api.adapter";
import { FilestackApiError } from "../../filestack/filestack-api.adapter";
import { FilloutApiError } from "../../fillout/fillout-api.adapter";
import { FirstPromoterMcpError } from "../../firstpromoter/firstpromoter-mcp.adapter";
import { FormstackApiError } from "../../formstack/formstack-api.adapter";
import { FrontifyApiError } from "../../frontify/frontify-api.adapter";
import { FullstoryApiError } from "../../fullstory/fullstory-api.adapter";
import { FuseBaseMcpError } from "../../fusebase/fusebase-mcp.adapter";
import { GongApiError } from "../../gong/gong-api.adapter";
import { GoToWebinarApiError } from "../../goto-webinar/goto-webinar-api.adapter";
import { GravityFormsApiError } from "../../gravity-forms/gravity-forms-api.adapter";
import { HightailApiError } from "../../hightail/hightail-api.adapter";
import { HomebaseApiError } from "../../homebase/homebase-api.adapter";
import { HotjarApiError } from "../../hotjar/hotjar-api.adapter";
import { ImgixApiError } from "../../imgix/imgix-api.adapter";
import { InoreaderApiError } from "../../inoreader/inoreader-api.adapter";
import { InstapageApiError } from "../../instapage/instapage-api.adapter";
import { InstapaperApiError } from "../../instapaper/instapaper-api.adapter";
import { JiraAlignApiError } from "../../jira-align/jira-align-api.adapter";
import { JotformApiError } from "../../jotform/jotform-api.adapter";
import { KashFlowSoapError } from "../../kashflow/kashflow-soap.adapter";
import { KlaviyoApiError } from "../../klaviyo/klaviyo-api.adapter";
import { KontainerApiError } from "../../kontainer/kontainer-api.adapter";
import { LeadfeederApiError } from "../../leadfeeder/leadfeeder-api.adapter";
import { LessAnnoyingCrmApiError } from "../../less-annoying-crm/less-annoying-crm-api.adapter";
import { LivestormApiError } from "../../livestorm/livestorm-api.adapter";
import { LookbackMcpError } from "../../lookback/lookback-mcp.adapter";
import { MailchimpApiError } from "../../mailchimp/mailchimp-api.adapter";
import { MailgunApiError } from "../../mailgun/mailgun-api.adapter";
import { MazeMcpError } from "../../maze/maze-mcp.adapter";
import { MemApiError } from "../../mem/mem-api.adapter";
import { MicrosoftDynamics365BusinessCentralApiError } from "../../microsoft-dynamics-365-business-central/microsoft-dynamics-365-business-central-api.adapter";
import { MicrosoftDynamics365CustomerServiceApiError } from "../../microsoft-dynamics-365-customer-service/microsoft-dynamics-365-customer-service-api.adapter";
import { MicrosoftDynamics365SalesApiError } from "../../microsoft-dynamics-365-sales/microsoft-dynamics-365-sales-api.adapter";
import { MicrosoftEntraIdGraphError } from "../../microsoft-entra-id/microsoft-entra-id-graph.adapter";
import { MixpanelApiError } from "../../mixpanel/mixpanel-api.adapter";
import { MsProjectApiError } from "../../ms-project/ms-project-api.adapter";
import { MyHoursApiError } from "../../my-hours/my-hours-api.adapter";
import { MyobApiError } from "../../myob/myob-api.adapter";
import { NetSuiteApiError } from "../../netsuite/netsuite-api.adapter";
import { NinjaFormsApiError } from "../../ninja-forms/ninja-forms-api.adapter";
import { NutshellApiError } from "../../nutshell/nutshell-api.adapter";
import { OdooApiError } from "../../odoo/odoo-api.adapter";
import { OntraportMcpError } from "../../ontraport/ontraport-mcp.adapter";
import { OpsgenieCloudApiError } from "../../opsgenie-cloud/opsgenie-cloud-api.adapter";
import { OptimizelyApiError } from "../../optimizely/optimizely-api.adapter";
import { OutreachApiError } from "../../outreach/outreach-api.adapter";
import { PaperformApiError } from "../../paperform/paperform-api.adapter";
import { PCloudApiError } from "../../pcloud/pcloud-api.adapter";
import { PendoApiError } from "../../pendo/pendo-api.adapter";
import { PeopleAiMcpError } from "../../people-ai/people-ai-mcp.adapter";
import { PostHogApiError } from "../../posthog/posthog-api.adapter";
import { PostmarkApiError } from "../../postmark/postmark-api.adapter";
import { QualtricsApiError } from "../../qualtrics/qualtrics-api.adapter";
import { QuickBooksTimeApiError } from "../../quickbooks-time/quickbooks-time-api.adapter";
import { RaindropIoApiError } from "../../raindrop-io/raindrop-io-api.adapter";
import { ReadwiseApiError } from "../../readwise/readwise-api.adapter";
import { RefinerApiError } from "../../refiner/refiner-api.adapter";
import { ReflectApiError } from "../../reflect/reflect-api.adapter";
import { RepliconApiError } from "../../replicon/replicon-api.adapter";
import { ResendApiError } from "../../resend/resend-api.adapter";
import { RespondentApiError } from "../../respondent/respondent-api.adapter";
import { RewardfulApiError } from "../../rewardful/rewardful-api.adapter";
import { SageAccountingApiError } from "../../sage-accounting/sage-accounting-api.adapter";
import { SageIntacctApiError } from "../../sage-intacct/sage-intacct-api.adapter";
import { SalesloftApiError } from "../../salesloft/salesloft-api.adapter";
import { ScoroApiError } from "../../scoro/scoro-api.adapter";
import { SegmentApiError } from "../../segment/segment-api.adapter";
import { SendGridApiError } from "../../sendgrid/sendgrid-api.adapter";
import { SentryApiError } from "../../sentry/sentry-api.adapter";
import { ShareFileApiError } from "../../sharefile/sharefile-api.adapter";
import { MailjetApiError } from "../../sinch-mailjet/sinch-mailjet-api.adapter";
import { SlackCanvasApiError } from "../../slack-canvas/slack-canvas-api.adapter";
import { SlackEnterpriseGridApiError } from "../../slack-enterprise-grid/slack-enterprise-grid-api.adapter";
import { SlackListsApiError } from "../../slack-lists/slack-lists-api.adapter";
import { SparkPostApiError } from "../../sparkpost/sparkpost-api.adapter";
import { SprigApiError } from "../../sprig/sprig-api.adapter";
import { StatuspageCloudApiError } from "../../statuspage-cloud/statuspage-cloud-api.adapter";
import { StreakApiError } from "../../streak/streak-api.adapter";
import { SurveyMonkeyApiError } from "../../surveymonkey/surveymonkey-api.adapter";
import { TallyApiError } from "../../tally/tally-api.adapter";
import { TeamleaderApiError } from "../../teamleader/teamleader-api.adapter";
import { TeamsPhoneGraphError } from "../../teams-phone/teams-phone-graph.adapter";
import { TimeDoctorApiError } from "../../time-doctor/time-doctor-api.adapter";
import { TrackingTimeMcpError } from "../../trackingtime/trackingtime-mcp.adapter";
import { TresoritS3Error } from "../../tresorit/tresorit-s3.adapter";
import { UnbounceApiError } from "../../unbounce/unbounce-api.adapter";
import { UserInterviewsApiError } from "../../user-interviews/user-interviews-api.adapter";
import { UserTestingApiError } from "../../usertesting/usertesting-api.adapter";
import { VwoApiError } from "../../vwo/vwo-api.adapter";
import { WebexCallingApiError } from "../../webex-calling/webex-calling-api.adapter";
import { WidenCollectiveApiError } from "../../widen-collective/widen-collective-api.adapter";
import { WpFormsApiError } from "../../wpforms/wpforms-api.adapter";
import { WufooApiError } from "../../wufoo/wufoo-api.adapter";
import { YammerApiError } from "../../yammer/yammer-api.adapter";
import { ZohoWorkDriveApiError } from "../../zoho-workdrive/zoho-workdrive-api.adapter";
import { ZoomEventsApiError } from "../../zoom-events/zoom-events-api.adapter";
import { ZoomPhoneApiError } from "../../zoom-phone/zoom-phone-api.adapter";
import { ZoomRoomsApiError } from "../../zoom-rooms/zoom-rooms-api.adapter";
import { ZoomWebinarsApiError } from "../../zoom-webinars/zoom-webinars-api.adapter";
import { ZoomInfoApiError } from "../../zoominfo/zoominfo-api.adapter";

function safeError(
  code: MarketplaceConnectorSafeErrorCode,
  message: string,
  statusCode = 400,
): MarketplaceConnectorExecutorResult {
  return { ok: false, statusCode, error: { code, message } };
}

export function mapKnownConnectorErrorChunk1(
  error: unknown,
): MarketplaceConnectorExecutorResult | null {
  if (error instanceof BoundedRestApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof TimeDoctorApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof QuickBooksTimeApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof RepliconApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof ActiTimeApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof TrackingTimeMcpError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof OntraportMcpError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof Bitrix24ApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof AgileCrmApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof StreakApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof LessAnnoyingCrmApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof NutshellApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof TeamleaderApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof ScoroApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof OdooApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof NetSuiteApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof SageAccountingApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof SageIntacctApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof MyobApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof KashFlowSoapError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof MyHoursApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof PaperformApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof JotformApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof FormstackApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof SurveyMonkeyApiError)
    return safeError(
      error.code === "surveymonkey_rate_limited"
        ? "provider_rate_limited"
        : error.code === "surveymonkey_token_invalid"
          ? "token_expired"
          : error.code === "surveymonkey_permission_denied"
            ? "insufficient_scope"
            : error.code.includes("invalid") || error.code.includes("mismatch")
              ? "provider_validation_error"
              : "provider_unavailable",
      error.message,
      error.statusCode,
    );
  if (error instanceof FilloutApiError)
    return safeError(
      error.code === "fillout_rate_limited"
        ? "provider_rate_limited"
        : error.code === "fillout_token_invalid"
          ? "token_expired"
          : error.code === "fillout_permission_denied"
            ? "insufficient_scope"
            : error.code.includes("invalid")
              ? "provider_validation_error"
              : "provider_unavailable",
      error.message,
      error.statusCode,
    );
  if (error instanceof TallyApiError)
    return safeError(
      error.code === "tally_rate_limited"
        ? "provider_rate_limited"
        : error.code === "tally_api_key_invalid"
          ? "token_expired"
          : error.code === "tally_permission_denied"
            ? "insufficient_scope"
            : error.code === "tally_not_found" || error.code.includes("invalid")
              ? "provider_validation_error"
              : "provider_unavailable",
      error.message,
      error.statusCode,
    );
  if (error instanceof MailchimpApiError)
    return safeError(
      error.code === "mailchimp_rate_limited"
        ? "provider_rate_limited"
        : error.code === "mailchimp_token_invalid"
          ? "token_expired"
          : error.code === "mailchimp_permission_denied"
            ? "insufficient_scope"
            : error.code.includes("invalid") || error.code.includes("mismatch")
              ? "provider_validation_error"
              : "provider_unavailable",
      error.message,
      error.statusCode,
    );
  if (error instanceof KlaviyoApiError)
    return safeError(
      error.code === "klaviyo_rate_limited"
        ? "provider_rate_limited"
        : error.code === "klaviyo_token_invalid"
          ? "token_expired"
          : error.code === "klaviyo_permission_denied"
            ? "insufficient_scope"
            : error.code.includes("invalid") || error.code.includes("mismatch")
              ? "provider_validation_error"
              : "provider_unavailable",
      error.message,
      error.statusCode,
    );
  if (error instanceof ConvertKitApiError)
    return safeError(
      error.code === "convertkit_rate_limited"
        ? "provider_rate_limited"
        : error.code === "convertkit_token_invalid"
          ? "token_expired"
          : error.code === "convertkit_permission_denied"
            ? "insufficient_scope"
            : error.code.includes("invalid") || error.code.includes("mismatch")
              ? "provider_validation_error"
              : "provider_unavailable",
      error.message,
      error.statusCode,
    );
  if (error instanceof CampaignMonitorApiError)
    return safeError(
      error.code === "campaign_monitor_rate_limited"
        ? "provider_rate_limited"
        : error.code === "campaign_monitor_token_invalid"
          ? "token_expired"
          : error.code === "campaign_monitor_permission_denied"
            ? "insufficient_scope"
            : error.code.includes("invalid") ||
                error.code.includes("mismatch") ||
                error.code.includes("not_bound")
              ? "provider_validation_error"
              : "provider_unavailable",
      error.message,
      error.statusCode,
    );
  if (error instanceof ConstantContactApiError)
    return safeError(
      error.code === "constant_contact_rate_limited"
        ? "provider_rate_limited"
        : error.code === "constant_contact_token_invalid"
          ? "token_expired"
          : error.code === "constant_contact_permission_denied"
            ? "insufficient_scope"
            : error.code.includes("invalid") || error.code.includes("mismatch")
              ? "provider_validation_error"
              : "provider_unavailable",
      error.message,
      error.statusCode,
    );
  if (error instanceof ActiveCampaignApiError)
    return safeError(
      error.code === "activecampaign_rate_limited"
        ? "provider_rate_limited"
        : error.code === "activecampaign_api_token_invalid"
          ? "token_expired"
          : error.code.includes("invalid")
            ? "provider_validation_error"
            : "provider_unavailable",
      error.message,
      error.statusCode,
    );
  if (error instanceof CustomerIoApiError)
    return safeError(
      error.code === "customer_io_rate_limited"
        ? "provider_rate_limited"
        : error.code === "customer_io_app_api_key_invalid"
          ? "token_expired"
          : error.code === "customer_io_permission_denied"
            ? "insufficient_scope"
            : error.code.includes("invalid") || error.code.includes("mismatch")
              ? "provider_validation_error"
              : "provider_unavailable",
      error.message,
      error.statusCode,
    );
  if (error instanceof BrazeApiError)
    return safeError(
      error.code === "braze_rate_limited"
        ? "provider_rate_limited"
        : error.code === "braze_rest_api_key_invalid"
          ? "token_expired"
          : error.code === "braze_permission_denied"
            ? "insufficient_scope"
            : error.code.includes("invalid") || error.code.includes("not_bound")
              ? "provider_validation_error"
              : "provider_unavailable",
      error.message,
      error.statusCode,
    );
  if (error instanceof SegmentApiError)
    return safeError(
      error.code === "segment_rate_limited"
        ? "provider_rate_limited"
        : error.code === "segment_public_api_token_invalid"
          ? "token_expired"
          : error.code === "segment_permission_denied"
            ? "insufficient_scope"
            : error.code.includes("invalid") || error.code.includes("mismatch")
              ? "provider_validation_error"
              : "provider_unavailable",
      error.message,
      error.statusCode,
    );
  if (error instanceof MixpanelApiError)
    return safeError(
      error.code === "mixpanel_rate_limited"
        ? "provider_rate_limited"
        : error.code === "mixpanel_service_account_invalid"
          ? "token_expired"
          : error.code === "mixpanel_permission_denied"
            ? "insufficient_scope"
            : error.code.includes("invalid")
              ? "provider_validation_error"
              : "provider_unavailable",
      error.message,
      error.statusCode,
    );
  if (error instanceof AmplitudeApiError)
    return safeError(
      error.code === "amplitude_rate_limited"
        ? "provider_rate_limited"
        : error.code === "amplitude_project_credentials_invalid"
          ? "token_expired"
          : error.code === "amplitude_permission_denied"
            ? "insufficient_scope"
            : error.code.includes("invalid")
              ? "provider_validation_error"
              : "provider_unavailable",
      error.message,
      error.statusCode,
    );
  if (error instanceof PendoApiError)
    return safeError(
      error.code === "pendo_rate_limited"
        ? "provider_rate_limited"
        : error.code === "pendo_integration_key_invalid"
          ? "token_expired"
          : error.code === "pendo_permission_denied"
            ? "insufficient_scope"
            : error.code.includes("invalid")
              ? "provider_validation_error"
              : "provider_unavailable",
      error.message,
      error.statusCode,
    );
  if (error instanceof PostHogApiError)
    return safeError(
      error.code === "posthog_rate_limited"
        ? "provider_rate_limited"
        : error.code === "posthog_access_token_invalid"
          ? "token_expired"
          : error.code === "posthog_permission_denied"
            ? "insufficient_scope"
            : error.code.includes("invalid") || error.code.includes("not_found")
              ? "provider_validation_error"
              : "provider_unavailable",
      error.message,
      error.statusCode,
    );
  if (error instanceof SentryApiError)
    return safeError(
      error.code === "sentry_rate_limited"
        ? "provider_rate_limited"
        : error.code === "sentry_access_token_invalid"
          ? "token_expired"
          : error.code === "sentry_permission_denied"
            ? "insufficient_scope"
            : error.code.includes("invalid") || error.code.includes("not_found")
              ? "provider_validation_error"
              : "provider_unavailable",
      error.message,
      error.status,
    );
  if (error instanceof WufooApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof GravityFormsApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof NinjaFormsApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof WpFormsApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof AlchemerApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof QualtricsApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof AskNicelyApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof DelightedApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof RefinerApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof HotjarApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof UserTestingApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof MazeMcpError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof LookbackMcpError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof UserInterviewsApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof RespondentApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof DovetailApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof SprigApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof AirtableFormsApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof DocuSignClmApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof RewardfulApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof FirstPromoterMcpError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof ApolloIoApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof OutreachApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof SalesloftApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof GongApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof ChorusAiApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof ClariCopilotApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof PeopleAiMcpError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof CognismApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof ZoomInfoApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof ClearbitApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof LeadfeederApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof UnbounceApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof InstapageApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof OptimizelyApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof VwoApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof AbTastyApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof FullstoryApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof DataForSeoApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof ExaApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof MailgunApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof SendGridApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof PostmarkApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof ResendApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof SparkPostApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof BrevoApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof MailjetApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof EvernoteApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof FuseBaseMcpError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof AtlassianRovoMcpError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof OpsgenieCloudApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof StatuspageCloudApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof MemApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof ReflectApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof ReadwiseApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof CommonRoomApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof SlackEnterpriseGridApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof SlackCanvasApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof SlackListsApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof TeamsPhoneGraphError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof ZoomPhoneApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof ZoomRoomsApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof ZoomWebinarsApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof ZoomEventsApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof WebexCallingApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof GoToWebinarApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof LivestormApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof DemioApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof BigMarkerApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof RaindropIoApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof InstapaperApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof FeedlyApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof InoreaderApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof DropboxPaperApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof ZohoWorkDriveApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof EgnyteApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof ShareFileApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof DeputyApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof HomebaseApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof PCloudApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof TresoritS3Error)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof HightailApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof FilestackApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof ImgixApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof BynderApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof CantoApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof FrontifyApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof AssetBankApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof BrandfolderApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof WidenCollectiveApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof KontainerApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof JiraAlignApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof AtlassianCompassApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof DaminionApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof MsProjectApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof MicrosoftDynamics365SalesApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof MicrosoftDynamics365CustomerServiceApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof MicrosoftDynamics365BusinessCentralApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof MicrosoftEntraIdGraphError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof YammerApiError)
    return safeError(error.code, error.message, error.statusCode);
  return null;
}
