import type {
  MarketplaceConnectorExecutorResult,
  MarketplaceConnectorSafeErrorCode,
} from "../../types";
import { AdobeAcrobatSignApiError } from "../../adobe-acrobat-sign/adobe-acrobat-sign-api.adapter";
import { AircallApiError } from "../../aircall/aircall-api.adapter";
import { AirtableApiError } from "../../airtable/airtable-api.adapter";
import { ApolloGraphOsApiError } from "../../apollo-graphql-studio/apollo-graphos-api.adapter";
import { AppcuesApiError } from "../../appcues/appcues-api.adapter";
import { AsanaApiError } from "../../asana/asana-api.adapter";
import { AttioApiError } from "../../attio/attio-api.adapter";
import { AWeberApiError } from "../../aweber/aweber-api.adapter";
import { BandcampApiError } from "../../bandcamp/bandcamp-api.adapter";
import { BenchmarkEmailApiError } from "../../benchmark-email/benchmark-email-api.adapter";
import { BetterProposalsApiError } from "../../better-proposals/better-proposals-api.adapter";
import { BitbucketApiError } from "../../bitbucket/bitbucket-api.adapter";
import { CapsuleCrmApiError } from "../../capsule-crm/capsule-crm-api.adapter";
import { ChameleonApiError } from "../../chameleon/chameleon-api.adapter";
import { ChimeCrmApiError } from "../../chime-crm/chime-crm-api.adapter";
import { ClickUpApiError } from "../../clickup/clickup-api.adapter";
import { ClientSuccessApiError } from "../../clientsuccess/clientsuccess-api.adapter";
import { ClinikoApiError } from "../../cliniko/cliniko-api.adapter";
import { ConcordApiError } from "../../concord/concord-api.adapter";
import { ConfluenceApiError } from "../../confluence/confluence-api.adapter";
import { ContractbookApiError } from "../../contractbook/contractbook-api.adapter";
import { CookiebotApiError } from "../../cookiebot/cookiebot-api.adapter";
import { CrazyEggApiError } from "../../crazy-egg/crazy-egg-api.adapter";
import { CreatioApiError } from "../../creatio/creatio-api.adapter";
import { CustifyApiError } from "../../custify/custify-api.adapter";
import { DeviantArtApiError } from "../../deviantart/deviantart-api.adapter";
import { DialpadApiError } from "../../dialpad/dialpad-api.adapter";
import { DiscordApiError } from "../../discord/discord-api.adapter";
import { DribbbleApiError } from "../../dribbble/dribbble-api.adapter";
import { DripApiError } from "../../drip/drip-api.adapter";
import { EloquaApiError } from "../../eloqua/eloqua-api.adapter";
import { EmmaApiError } from "../../emma/emma-api.adapter";
import { EventbriteApiError } from "../../eventbrite/eventbrite-api.adapter";
import { FlickrApiError } from "../../flickr/flickr-api.adapter";
import { FlodeskApiError } from "../../flodesk/flodesk-api.adapter";
import { FollowUpBossApiError } from "../../follow-up-boss/follow-up-boss-api.adapter";
import { FredApiError } from "../../fred/fred-api.adapter";
import { FreshsalesApiError } from "../../freshsales/freshsales-api.adapter";
import { GainsightApiError } from "../../gainsight/gainsight-api.adapter";
import { GetAcceptApiError } from "../../getaccept/getaccept-api.adapter";
import { GetResponseApiError } from "../../getresponse/getresponse-api.adapter";
import { GitHubApiError } from "../../github/github-api.adapter";
import { GitLabApiError } from "../../gitlab/gitlab-api.adapter";
import { GoogleBusinessProfileApiError } from "../../google-business-profile/google-business-profile-api.adapter";
import { GoogleClassroomApiError } from "../../google-classroom/google-classroom-api.adapter";
import { GoogleMapsPlatformApiError } from "../../google-maps-platform/google-maps-platform-api.adapter";
import { GoogleMerchantCenterApiError } from "../../google-merchant-center/google-merchant-center-api.adapter";
import { GoogleSearchConsoleApiError } from "../../google-search-console/google-search-console-api.adapter";
import { GoToMeetingApiError } from "../../goto-meeting/goto-meeting-api.adapter";
import { HopinApiError } from "../../hopin/hopin-api.adapter";
import { HunterApiError } from "../../hunter-io/hunter-api.adapter";
import { InsightlyApiError } from "../../insightly/insightly-api.adapter";
import { IroncladApiError } from "../../ironclad/ironclad-api.adapter";
import { JaneAppApiError } from "../../jane-app/jane-app-api.adapter";
import { JuroApiError } from "../../juro/juro-api.adapter";
import { KeapApiError } from "../../keap/keap-api.adapter";
import { LeadIqApiError } from "../../leadiq/leadiq-api.adapter";
import { LinearApiError } from "../../linear/linear-api.adapter";
import { LinkedInApiError } from "../../linkedin/linkedin-api.adapter";
import { LinkSquaresApiError } from "../../linksquares/linksquares-api.adapter";
import { LogRocketMcpError } from "../../logrocket/logrocket-mcp.adapter";
import { LumaApiError } from "../../luma/luma-api.adapter";
import { LushaApiError } from "../../lusha/lusha-api.adapter";
import { MailercloudApiError } from "../../mailercloud/mailercloud-api.adapter";
import { MailerLiteApiError } from "../../mailerlite/mailerlite-api.adapter";
import { MarketoApiError } from "../../marketo/marketo-api.adapter";
import { MastodonApiError } from "../../mastodon/mastodon-api.adapter";
import { MeetupApiError } from "../../meetup/meetup-api.adapter";
import { MessageBirdApiError } from "../../messagebird/messagebird-api.adapter";
import { MicrosoftBookingsApiError } from "../../microsoft-bookings/microsoft-bookings-api.adapter";
import { MicrosoftDynamics365ApiError } from "../../microsoft-dynamics-365/microsoft-dynamics-365-api.adapter";
import { MicrosoftListsApiError } from "../../microsoft-lists/microsoft-lists-api.adapter";
import { MicrosoftPlannerApiError } from "../../microsoft-planner/microsoft-planner-api.adapter";
import { MicrosoftPowerBIApiError } from "../../microsoft-power-bi/microsoft-power-bi-api.adapter";
import { MicrosoftTeamsGraphError } from "../../microsoft-teams/microsoft-teams-graph.adapter";
import { MicrosoftToDoApiError } from "../../microsoft-to-do/microsoft-to-do-api.adapter";
import { MicrosoftVivaEngageApiError } from "../../microsoft-viva-engage/microsoft-viva-engage-api.adapter";
import { MindbodyApiError } from "../../mindbody/mindbody-api.adapter";
import { MondayComApiError } from "../../monday-com/monday-com-api.adapter";
import { MoosendApiError } from "../../moosend/moosend-api.adapter";
import { NextdoorApiError } from "../../nextdoor/nextdoor-api.adapter";
import { NimbleApiError } from "../../nimble/nimble-api.adapter";
import { NotionApiError } from "../../notion/notion-api.adapter";
import { OmnisendApiError } from "../../omnisend/omnisend-api.adapter";
import { OneDriveApiError } from "../../onedrive/onedrive-api.adapter";
import { OneNoteApiError } from "../../onenote/onenote-api.adapter";
import { OneSpanSignApiError } from "../../onespan-sign/onespan-sign-api.adapter";
import { OneTrustApiError } from "../../onetrust/onetrust-api.adapter";
import { OpenPhoneApiError } from "../../openphone/openphone-api.adapter";
import { OutlookGraphError } from "../../outlook/outlook-graph.adapter";
import { PardotApiError } from "../../pardot/pardot-api.adapter";
import { PinterestApiError } from "../../pinterest/pinterest-api.adapter";
import { PlanhatApiError } from "../../planhat/planhat-api.adapter";
import { PlutioApiError } from "../../plutio/plutio-api.adapter";
import { PracticeBetterApiError } from "../../practice-better/practice-better-api.adapter";
import { ProofApiError } from "../../proof/proof-api.adapter";
import { ProposifyApiError } from "../../proposify/proposify-api.adapter";
import { QuipApiError } from "../../quip/quip-api.adapter";
import { QwilrApiError } from "../../qwilr/qwilr-api.adapter";
import { ReallySimpleSystemsApiError } from "../../really-simple-systems/really-simple-systems-api.adapter";
import { RightSignatureApiError } from "../../rightsignature/rightsignature-api.adapter";
import { RingCentralApiError } from "../../ringcentral/ringcentral-api.adapter";
import { RocketReachApiError } from "../../rocketreach/rocketreach-api.adapter";
import { SalesforceCommerceCloudApiError } from "../../salesforce-commerce-cloud/salesforce-commerce-cloud-api.adapter";
import { SalesforceMarketingCloudApiError } from "../../salesforce-marketing-cloud/salesforce-marketing-cloud-api.adapter";
import { SeamlessAiApiError } from "../../seamless-ai/seamless-ai-api.adapter";
import { SetmoreApiError } from "../../setmore/setmore-api.adapter";
import { SharePointApiError } from "../../sharepoint/sharepoint-api.adapter";
import { ShootProofApiError } from "../../shootproof/shootproof-api.adapter";
import { SigneasyApiError } from "../../signeasy/signeasy-api.adapter";
import { SignNowApiError } from "../../signnow/signnow-api.adapter";
import { SignRequestApiError } from "../../signrequest/signrequest-api.adapter";
import { SlackApiError } from "../../slack/slack-api.adapter";
import { SmartlookApiError } from "../../smartlook/smartlook-api.adapter";
import { SmugMugApiError } from "../../smugmug/smugmug-api.adapter";
import { SnovApiError } from "../../snov-io/snov-api.adapter";
import { SpotDraftApiError } from "../../spotdraft/spotdraft-api.adapter";
import { SquareAppointmentsApiError } from "../../square-appointments/square-appointments-api.adapter";
import { SugarCrmApiError } from "../../sugarcrm/sugarcrm-api.adapter";
import { SuiteCrmCloudApiError } from "../../suitecrm-cloud/suitecrm-cloud-api.adapter";
import { TermlyApiError } from "../../termly/termly-api.adapter";
import { ThreadsApiError } from "../../threads/threads-api.adapter";
import { TotangoApiError } from "../../totango/totango-api.adapter";
import { TrelloApiError } from "../../trello/trello-api.adapter";
import { TumblrApiError } from "../../tumblr/tumblr-api.adapter";
import { TwilioApiError } from "../../twilio/twilio-api.adapter";
import { TwistApiError } from "../../twist/twist-api.adapter";
import { UpLeadApiError } from "../../uplead/uplead-api.adapter";
import { UserflowApiError } from "../../userflow/userflow-api.adapter";
import { UserpilotApiError } from "../../userpilot/userpilot-api.adapter";
import { VagaroApiError } from "../../vagaro/vagaro-api.adapter";
import { VitallyApiError } from "../../vitally/vitally-api.adapter";
import { VonageApiError } from "../../vonage/vonage-api.adapter";
import { VtigerCrmApiError } from "../../vtiger-crm/vtiger-crm-api.adapter";
import { WebexApiError } from "../../webex/webex-api.adapter";
import { WizaApiError } from "../../wiza/wiza-api.adapter";
import { YouTubeApiError } from "../../youtube/youtube-api.adapter";
import { ZohoMailApiError } from "../../zoho-mail/zoho-mail-api.adapter";
import { ZoomApiError } from "../../zoom/zoom-api.adapter";

function safeError(
  code: MarketplaceConnectorSafeErrorCode,
  message: string,
  statusCode = 400,
): MarketplaceConnectorExecutorResult {
  return { ok: false, statusCode, error: { code, message } };
}

export function mapKnownConnectorErrorChunk4(
  error: unknown,
): MarketplaceConnectorExecutorResult | null {
  if (error instanceof FollowUpBossApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof ChimeCrmApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof ReallySimpleSystemsApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof VtigerCrmApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof SuiteCrmCloudApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof SugarCrmApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof CreatioApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof AttioApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof SetmoreApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof PlutioApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof ShootProofApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof SmugMugApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof FlickrApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof DribbbleApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof DeviantArtApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof BandcampApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof SquareAppointmentsApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof VagaroApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof MindbodyApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof JaneAppApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof ClinikoApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof PracticeBetterApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof ConfluenceApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof QuipApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof LinkedInApiError)
    return safeError(
      error.code === "linkedin_rate_limited"
        ? "provider_rate_limited"
        : error.code === "linkedin_token_invalid"
          ? "token_expired"
          : error.code === "linkedin_permission_denied"
            ? "insufficient_scope"
            : error.code.includes("invalid") || error.code.includes("blocked")
              ? "provider_validation_error"
              : "provider_unavailable",
      error.message,
      error.statusCode,
    );
  if (error instanceof NextdoorApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof MeetupApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof EventbriteApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof LumaApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof HopinApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof ThreadsApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof PinterestApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof TumblrApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof MastodonApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof WebexApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof GoToMeetingApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof RingCentralApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof DialpadApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof AircallApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof OpenPhoneApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof TwilioApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof VonageApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof MessageBirdApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof FredApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof ApolloGraphOsApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof HunterApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof SnovApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof LushaApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof LeadIqApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof SeamlessAiApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof RocketReachApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof UpLeadApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof WizaApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof TwistApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof ZohoMailApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof SlackApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof GitHubApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof GitLabApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof BitbucketApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof NotionApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof LinearApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof AsanaApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof TrelloApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof ClickUpApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof MondayComApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof AirtableApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof OutlookGraphError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof MicrosoftTeamsGraphError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof Error && error.message === "credential_missing")
    return safeError("credential_missing", "Connector credential is missing");
  if (error instanceof GoogleSearchConsoleApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof Error && error.message === "credential_decrypt_failed")
    return safeError(
      "credential_decrypt_failed",
      "Connector credential could not be decrypted",
    );
  if (error instanceof GoogleBusinessProfileApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof GoogleMerchantCenterApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof YouTubeApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof GoogleClassroomApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof GoogleMapsPlatformApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof OneDriveApiError)
    return safeError(
      error.code === "onedrive_rate_limited"
        ? "provider_rate_limited"
        : error.code === "onedrive_token_invalid"
          ? "token_expired"
          : error.code === "onedrive_permission_denied"
            ? "insufficient_scope"
            : error.code.includes("invalid") ||
                error.code.includes("blocked") ||
                error.code.includes("not_found")
              ? "provider_validation_error"
              : "provider_unavailable",
      error.message,
      error.statusCode,
    );
  if (error instanceof SharePointApiError)
    return safeError(
      error.code === "sharepoint_rate_limited"
        ? "provider_rate_limited"
        : error.code === "sharepoint_token_invalid"
          ? "token_expired"
          : error.code === "sharepoint_permission_denied"
            ? "insufficient_scope"
            : error.code.includes("invalid") ||
                error.code.includes("blocked") ||
                error.code.includes("not_found")
              ? "provider_validation_error"
              : "provider_unavailable",
      error.message,
      error.statusCode,
    );
  if (error instanceof MicrosoftPlannerApiError)
    return safeError(
      error.code === "microsoft_planner_rate_limited"
        ? "provider_rate_limited"
        : error.code === "microsoft_planner_token_invalid"
          ? "token_expired"
          : error.code === "microsoft_planner_permission_denied"
            ? "insufficient_scope"
            : error.code.includes("invalid") ||
                error.code.includes("blocked") ||
                error.code.includes("not_found")
              ? "provider_validation_error"
              : "provider_unavailable",
      error.message,
      error.statusCode,
    );
  if (error instanceof MicrosoftToDoApiError)
    return safeError(
      error.code === "microsoft_todo_rate_limited"
        ? "provider_rate_limited"
        : error.code === "microsoft_todo_token_invalid"
          ? "token_expired"
          : error.code === "microsoft_todo_permission_denied"
            ? "insufficient_scope"
            : error.code.includes("invalid") ||
                error.code.includes("blocked") ||
                error.code.includes("not_found")
              ? "provider_validation_error"
              : "provider_unavailable",
      error.message,
      error.statusCode,
    );
  if (error instanceof MicrosoftListsApiError)
    return safeError(
      error.code === "microsoft_lists_rate_limited"
        ? "provider_rate_limited"
        : error.code === "microsoft_lists_token_invalid"
          ? "token_expired"
          : error.code === "microsoft_lists_permission_denied"
            ? "insufficient_scope"
            : error.code.includes("invalid") ||
                error.code.includes("blocked") ||
                error.code.includes("not_found")
              ? "provider_validation_error"
              : "provider_unavailable",
      error.message,
      error.statusCode,
    );
  if (error instanceof OneNoteApiError)
    return safeError(
      error.code === "onenote_rate_limited"
        ? "provider_rate_limited"
        : error.code === "onenote_token_invalid"
          ? "token_expired"
          : error.code === "onenote_permission_denied"
            ? "insufficient_scope"
            : error.code.includes("invalid") ||
                error.code.includes("blocked") ||
                error.code.includes("not_found")
              ? "provider_validation_error"
              : "provider_unavailable",
      error.message,
      error.statusCode,
    );
  if (error instanceof MicrosoftBookingsApiError)
    return safeError(
      error.code === "microsoft_bookings_rate_limited"
        ? "provider_rate_limited"
        : error.code === "microsoft_bookings_token_invalid"
          ? "token_expired"
          : error.code === "microsoft_bookings_permission_denied"
            ? "insufficient_scope"
            : error.code.includes("invalid") ||
                error.code.includes("blocked") ||
                error.code.includes("not_found")
              ? "provider_validation_error"
              : "provider_unavailable",
      error.message,
      error.statusCode,
    );
  if (error instanceof MicrosoftPowerBIApiError)
    return safeError(
      error.code === "microsoft_power_bi_rate_limited"
        ? "provider_rate_limited"
        : error.code === "microsoft_power_bi_token_invalid"
          ? "token_expired"
          : error.code === "microsoft_power_bi_permission_denied"
            ? "insufficient_scope"
            : error.code.includes("invalid") ||
                error.code.includes("blocked") ||
                error.code.includes("not_found")
              ? "provider_validation_error"
              : "provider_unavailable",
      error.message,
      error.statusCode,
    );
  if (error instanceof MicrosoftDynamics365ApiError)
    return safeError(
      error.code === "microsoft_dynamics_365_rate_limited"
        ? "provider_rate_limited"
        : error.code === "microsoft_dynamics_365_token_invalid"
          ? "token_expired"
          : error.code === "microsoft_dynamics_365_permission_denied"
            ? "insufficient_scope"
            : error.code.includes("invalid") ||
                error.code.includes("blocked") ||
                error.code.includes("not_found")
              ? "provider_validation_error"
              : "provider_unavailable",
      error.message,
      error.statusCode,
    );
  if (error instanceof MicrosoftVivaEngageApiError)
    return safeError(
      error.code === "microsoft_viva_engage_rate_limited"
        ? "provider_rate_limited"
        : error.code === "microsoft_viva_engage_token_invalid"
          ? "token_expired"
          : error.code === "microsoft_viva_engage_permission_denied"
            ? "insufficient_scope"
            : error.code.includes("invalid") ||
                error.code.includes("blocked") ||
                error.code.includes("not_found") ||
                error.code.includes("mismatch")
              ? "provider_validation_error"
              : "provider_unavailable",
      error.message,
      error.statusCode,
    );
  if (error instanceof ZoomApiError)
    return safeError(
      error.code === "zoom_rate_limited"
        ? "provider_rate_limited"
        : error.code === "zoom_token_invalid"
          ? "token_expired"
          : error.code === "zoom_permission_denied"
            ? "insufficient_scope"
            : error.code.includes("invalid") ||
                error.code.includes("blocked") ||
                error.code.includes("not_found")
              ? "provider_validation_error"
              : "provider_unavailable",
      error.message,
      error.statusCode,
    );
  if (error instanceof DiscordApiError)
    return safeError(
      error.code === "discord_rate_limited"
        ? "provider_rate_limited"
        : error.code === "discord_token_invalid"
          ? "token_expired"
          : error.code === "discord_permission_denied"
            ? "insufficient_scope"
            : error.code.includes("invalid") ||
                error.code.includes("blocked") ||
                error.code.includes("not_found") ||
                error.code.includes("mismatch") ||
                error.code.includes("required") ||
                error.code.includes("available")
              ? "provider_validation_error"
              : "provider_unavailable",
      error.message,
      error.statusCode,
    );
  if (error instanceof ProofApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof TermlyApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof CookiebotApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof OneTrustApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof SalesforceMarketingCloudApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof SalesforceCommerceCloudApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof MarketoApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof PardotApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof EloquaApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof DripApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof MailerLiteApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof AWeberApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof GetResponseApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof MoosendApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof OmnisendApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof MailercloudApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof BenchmarkEmailApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof EmmaApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof FlodeskApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof AdobeAcrobatSignApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof SignNowApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof SignRequestApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof SigneasyApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof OneSpanSignApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof RightSignatureApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof GetAcceptApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof QwilrApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof ProposifyApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof BetterProposalsApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof ConcordApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof JuroApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof IroncladApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof LinkSquaresApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof SpotDraftApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof ContractbookApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof LogRocketMcpError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof SmartlookApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof CrazyEggApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof AppcuesApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof UserflowApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof UserpilotApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof ChameleonApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof VitallyApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof GainsightApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof TotangoApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof CustifyApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof PlanhatApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof ClientSuccessApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof FreshsalesApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof InsightlyApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof NimbleApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof CapsuleCrmApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof KeapApiError)
    return safeError(error.code, error.message, error.statusCode);
  return null;
}
