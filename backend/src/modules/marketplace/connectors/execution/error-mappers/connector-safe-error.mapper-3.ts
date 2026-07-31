import type {
  MarketplaceConnectorExecutorResult,
  MarketplaceConnectorSafeErrorCode,
} from "../../types";
import { AcuitySchedulingApiError } from "../../acuity-scheduling/acuity-scheduling-api.adapter";
import { AdobeAnalyticsMcpError } from "../../adobe-analytics/adobe-analytics-mcp.adapter";
import { AdobeMarketoEngageApiError } from "../../adobe-marketo-engage/adobe-marketo-engage-api.adapter";
import { AdobeTargetApiError } from "../../adobe-target/adobe-target-api.adapter";
import { AkiflowMcpError } from "../../akiflow/akiflow-mcp.adapter";
import { AmazingMarvinApiError } from "../../amazing-marvin/amazing-marvin-api.adapter";
import { AnyDoMcpError } from "../../any-do/any-do-mcp.adapter";
import { BambooHRApiError } from "../../bamboohr/bamboohr-api.adapter";
import { BettermodeApiError } from "../../bettermode/bettermode-api.adapter";
import { BinanceApiError } from "../../binance/binance-api.adapter";
import { BonsaiMcpError } from "../../bonsai/bonsai-mcp.adapter";
import { BuzzsproutApiError } from "../../buzzsprout/buzzsprout-api.adapter";
import { CanvaApiError } from "../../canva/canva-api.adapter";
import { CaptivateFmApiError } from "../../captivate-fm/captivate-fm-api.adapter";
import { CartaApiError } from "../../carta/carta-api.adapter";
import { CircleApiError } from "../../circle/circle-api.adapter";
import { CloseApiError } from "../../close/close-api.adapter";
import { CloudflareApiError } from "../../cloudflare/cloudflare-api.adapter";
import { CloudinaryMcpError } from "../../cloudinary/cloudinary-mcp.adapter";
import { CognitoFormsMcpError } from "../../cognito-forms/cognito-forms-mcp.adapter";
import { ContentfulApiError } from "../../contentful/contentful-api.adapter";
import { CopperApiError } from "../../copper/copper-api.adapter";
import { DatadogApiError } from "../../datadog/datadog-api.adapter";
import { DescriptApiError } from "../../descript/descript-api.adapter";
import { DigitalOceanApiError } from "../../digitalocean/digitalocean-api.adapter";
import { DiscourseApiError } from "../../discourse/discourse-api.adapter";
import { DrataApiError } from "../../drata/drata-api.adapter";
import { DrawIoMcpError } from "../../draw-io/draw-io-mcp.adapter";
import { FathomMcpError } from "../../fathom/fathom-mcp.adapter";
import { FigJamApiError } from "../../figjam/figjam-api.adapter";
import { FigmaApiError } from "../../figma/figma-api.adapter";
import { FirebaseApiError } from "../../firebase/firebase-api.adapter";
import { FirefliesAiMcpError } from "../../fireflies-ai/fireflies-ai-mcp.adapter";
import { FolkCrmApiError } from "../../folk-crm/folk-crm-api.adapter";
import { FrameIoApiError } from "../../frame-io/frame-io-api.adapter";
import { FreeAgentApiError } from "../../freeagent/freeagent-api.adapter";
import { FreshBooksApiError } from "../../freshbooks/freshbooks-api.adapter";
import { GeminiApiError } from "../../gemini/gemini-api.adapter";
import { GhostApiError } from "../../ghost/ghost-api.adapter";
import { GmailApiError } from "../../gmail/gmail-api.adapter";
import { GoogleAdsApiError } from "../../google-ads/google-ads-api.adapter";
import { GoogleAnalyticsApiError } from "../../google-analytics/google-analytics-api.adapter";
import { GoogleCalendarApiError } from "../../google-calendar/google-calendar-api.adapter";
import { GoogleChatApiError } from "../../google-chat/google-chat-api.adapter";
import { GoogleContactsApiError } from "../../google-contacts/google-contacts-api.adapter";
import { GoogleDocsApiError } from "../../google-docs/google-docs-api.adapter";
import { GoogleDriveApiError } from "../../google-drive/google-drive-api.adapter";
import { GoogleFormsApiError } from "../../google-forms/google-forms-api.adapter";
import { GoogleMeetApiError } from "../../google-meet/google-meet-api.adapter";
import { GooglePhotosApiError } from "../../google-photos/google-photos-api.adapter";
import { GoogleSheetsApiError } from "../../google-sheets/google-sheets-api.adapter";
import { GoogleSlidesApiError } from "../../google-slides/google-slides-api.adapter";
import { GoogleTasksApiError } from "../../google-tasks/google-tasks-api.adapter";
import { GrainMcpError } from "../../grain/grain-mcp.adapter";
import { GreenhouseApiError } from "../../greenhouse/greenhouse-api.adapter";
import { GuruApiError } from "../../guru/guru-api.adapter";
import { GuruMcpError } from "../../guru/guru-mcp.adapter";
import { HabiticaApiError } from "../../habitica/habitica-api.adapter";
import { HealthieGraphqlError } from "../../healthie/healthie-graphql.adapter";
import { HerokuApiError } from "../../heroku/heroku-api.adapter";
import { HigherLogicApiError } from "../../higher-logic/higher-logic-api.adapter";
import { HiveApiError } from "../../hive/hive-api.adapter";
import { HivebriteApiError } from "../../hivebrite/hivebrite-api.adapter";
import { HubSpotApiError } from "../../hubspot/hubspot-api.adapter";
import { HyperproofApiError } from "../../hyperproof/hyperproof-api.adapter";
import { IntercomApiError } from "../../intercom/intercom-api.adapter";
import { KajabiCommunitiesApiError } from "../../kajabi-communities/kajabi-communities-api.adapter";
import { KeapMaxClassicApiError } from "../../keap-max-classic/keap-max-classic-api.adapter";
import { KrakenApiError } from "../../kraken/kraken-api.adapter";
import { LedgyApiError } from "../../ledgy/ledgy-api.adapter";
import { LeverApiError } from "../../lever/lever-api.adapter";
import { LucidchartApiError } from "../../lucidchart/lucidchart-api.adapter";
import { LucidsparkApiError } from "../../lucidspark/lucidspark-api.adapter";
import { MeisterTaskApiError } from "../../meistertask/meistertask-api.adapter";
import { MightyNetworksApiError } from "../../mighty-networks/mighty-networks-api.adapter";
import { MindMeisterApiError } from "../../mindmeister/mindmeister-api.adapter";
import { MiroApiError } from "../../miro/miro-api.adapter";
import { MotionApiError } from "../../motion/motion-api.adapter";
import { MuralApiError } from "../../mural/mural-api.adapter";
import { NetlifyApiError } from "../../netlify/netlify-api.adapter";
import { NewRelicApiError } from "../../new-relic/new-relic-api.adapter";
import { NiftyApiError } from "../../nifty/nifty-api.adapter";
import { NozbeApiError } from "../../nozbe/nozbe-api.adapter";
import { NuclinoMcpError } from "../../nuclino/nuclino-mcp.adapter";
import { OktaApiError } from "../../okta/okta-api.adapter";
import { OnceHubApiError } from "../../oncehub/oncehub-api.adapter";
import { OnePageCrmApiError } from "../../onepagecrm/onepagecrm-api.adapter";
import { OsanoApiError } from "../../osano/osano-api.adapter";
import { OtterAiMcpError } from "../../otter-ai/otter-ai-mcp.adapter";
import { PagerDutyApiError } from "../../pagerduty/pagerduty-api.adapter";
import { PaymoApiError } from "../../paymo/paymo-api.adapter";
import { PayPalApiError } from "../../paypal/paypal-api.adapter";
import { PipedriveApiError } from "../../pipedrive/pipedrive-api.adapter";
import { ProofHubApiError } from "../../proofhub/proofhub-api.adapter";
import { QuickBooksApiError } from "../../quickbooks/quickbooks-api.adapter";
import { ReclaimAiApiError } from "../../reclaim-ai/reclaim-ai-api.adapter";
import { RememberTheMilkMcpError } from "../../remember-the-milk/remember-the-milk-mcp.adapter";
import { RestreamApiError } from "../../restream/restream-api.adapter";
import { RevApiError } from "../../rev/rev-api.adapter";
import { RiversideFmApiError } from "../../riverside-fm/riverside-fm-api.adapter";
import { RoadmunkGraphqlError } from "../../roadmunk/roadmunk-graphql.adapter";
import { SalesflareApiError } from "../../salesflare/salesflare-api.adapter";
import { SalesforceApiError } from "../../salesforce/salesforce-api.adapter";
import { SanityApiError } from "../../sanity/sanity-api.adapter";
import { SavvyCalApiError } from "../../savvycal/savvycal-api.adapter";
import { ScribeMcpError } from "../../scribe/scribe-mcp.adapter";
import { SecureframeApiError } from "../../secureframe/secureframe-api.adapter";
import { ShareworksApiError } from "../../shareworks/shareworks-api.adapter";
import { ShopifyApiError } from "../../shopify/shopify-api.adapter";
import { ShortcutApiError } from "../../shortcut/shortcut-api.adapter";
import { SimplyBookMeApiError } from "../../simplybook-me/simplybook-me-api.adapter";
import { SlabGraphqlError } from "../../slab/slab-graphql.adapter";
import { SliteMcpError } from "../../slite/slite-mcp.adapter";
import { SprintoApiError } from "../../sprinto/sprinto-api.adapter";
import { StatuspagePublicApiError } from "../../statuspage/statuspage-public-api.adapter";
import { StrapiCloudApiError } from "../../strapi-cloud/strapi-cloud-api.adapter";
import { StripeApiError } from "../../stripe/stripe-api.adapter";
import { SunsamaMcpError } from "../../sunsama/sunsama-mcp.adapter";
import { SupabaseApiError } from "../../supabase/supabase-api.adapter";
import { TlDvApiError } from "../../tl-dv/tl-dv-api.adapter";
import { TransistorFmApiError } from "../../transistor-fm/transistor-fm-api.adapter";
import { VanillaForumsApiError } from "../../vanilla-forums/vanilla-forums-api.adapter";
import { VantaApiError } from "../../vanta/vanta-api.adapter";
import { VercelApiError } from "../../vercel/vercel-api.adapter";
import { VimeoApiError } from "../../vimeo/vimeo-api.adapter";
import { WaveApiError } from "../../wave/wave-api.adapter";
import { WebflowApiError } from "../../webflow/webflow-api.adapter";
import { WhimsicalMcpError } from "../../whimsical/whimsical-mcp.adapter";
import { WistiaApiError } from "../../wistia/wistia-api.adapter";
import { WooCommerceApiError } from "../../woocommerce/woocommerce-api.adapter";
import { WordPressComApiError } from "../../wordpress-com/wordpress-com-api.adapter";
import { WorkivaApiError } from "../../workiva/workiva-api.adapter";
import { XeroApiError } from "../../xero/xero-api.adapter";
import { XMindMcpError } from "../../xmind/xmind-mcp.adapter";
import { YouCanBookMeApiError } from "../../youcanbookme/youcanbookme-api.adapter";
import { ZendeskSellApiError } from "../../zendesk-sell/zendesk-sell-api.adapter";
import { ZendeskApiError } from "../../zendesk/zendesk-api.adapter";
import { ZohoAnalyticsApiError } from "../../zoho-analytics/zoho-analytics-api.adapter";
import { ZohoCampaignsApiError } from "../../zoho-campaigns/zoho-campaigns-api.adapter";
import { ZohoPeopleApiError } from "../../zoho-people/zoho-people-api.adapter";
import { ZohoApiError } from "../../zoho/zoho-api.adapter";

function safeError(
  code: MarketplaceConnectorSafeErrorCode,
  message: string,
  statusCode = 400,
): MarketplaceConnectorExecutorResult {
  return { ok: false, statusCode, error: { code, message } };
}
function mapKnownConnectorErrorChunk3Part1(
  error: unknown,
): MarketplaceConnectorExecutorResult | null {
  if (error instanceof VimeoApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof WistiaApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof FrameIoApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof DescriptApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof RevApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof BuzzsproutApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof CaptivateFmApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof TransistorFmApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof RiversideFmApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof RestreamApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof OtterAiMcpError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof FirefliesAiMcpError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof AnyDoMcpError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof AkiflowMcpError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof SunsamaMcpError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof RememberTheMilkMcpError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof FathomMcpError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof BonsaiMcpError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof TlDvApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof GrainMcpError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof WhimsicalMcpError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof CognitoFormsMcpError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof XMindMcpError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof AdobeAnalyticsMcpError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof AdobeMarketoEngageApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof AdobeTargetApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof OsanoApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof SecureframeApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof VantaApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof CartaApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof ShareworksApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof LedgyApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof DrataApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof SprintoApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof HyperproofApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof WorkivaApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof CloudinaryMcpError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof DrawIoMcpError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof MindMeisterApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof MuralApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof FigJamApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof FigmaApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof MiroApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof CanvaApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof WebflowApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof WordPressComApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof GhostApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof ContentfulApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof SanityApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof StrapiCloudApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof ShopifyApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof WooCommerceApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof StripeApiError)
    return safeError(
      error.code === "stripe_rate_limited"
        ? "provider_rate_limited"
        : error.code === "stripe_token_invalid"
          ? "token_expired"
          : error.code === "stripe_permission_denied"
            ? "insufficient_scope"
            : error.code.includes("invalid")
              ? "provider_validation_error"
              : "provider_unavailable",
      error.message,
      error.statusCode,
    );
  if (error instanceof XeroApiError)
    return safeError(
      error.code === "xero_rate_limited"
        ? "provider_rate_limited"
        : error.code === "xero_token_invalid"
          ? "token_expired"
          : error.code === "xero_permission_denied"
            ? "insufficient_scope"
            : error.code.includes("invalid")
              ? "provider_validation_error"
              : "provider_unavailable",
      error.message,
      error.statusCode,
    );
  if (error instanceof QuickBooksApiError)
    return safeError(
      error.code === "quickbooks_rate_limited"
        ? "provider_rate_limited"
        : error.code === "quickbooks_token_invalid"
          ? "token_expired"
          : error.code === "quickbooks_permission_denied"
            ? "insufficient_scope"
            : error.code.includes("invalid")
              ? "provider_validation_error"
              : "provider_unavailable",
      error.message,
      error.statusCode,
    );
  if (error instanceof FreshBooksApiError)
    return safeError(
      error.code === "freshbooks_rate_limited"
        ? "provider_rate_limited"
        : error.code === "freshbooks_token_invalid"
          ? "token_expired"
          : error.code === "freshbooks_permission_denied"
            ? "insufficient_scope"
            : error.code.includes("invalid") || error.code.includes("mismatch")
              ? "provider_validation_error"
              : "provider_unavailable",
      error.message,
      error.statusCode,
    );
  if (error instanceof WaveApiError)
    return safeError(
      error.code === "wave_rate_limited"
        ? "provider_rate_limited"
        : error.code === "wave_token_invalid"
          ? "token_expired"
          : error.code === "wave_permission_or_subscription_denied"
            ? "insufficient_scope"
            : error.code.includes("invalid") || error.code.includes("mismatch")
              ? "provider_validation_error"
              : "provider_unavailable",
      error.message,
      error.statusCode,
    );
  if (error instanceof FreeAgentApiError)
    return safeError(
      error.code === "freeagent_rate_limited"
        ? "provider_rate_limited"
        : error.code === "freeagent_token_invalid"
          ? "token_expired"
          : error.code === "freeagent_permission_denied"
            ? "insufficient_scope"
            : error.code.includes("invalid") || error.code.includes("mismatch")
              ? "provider_validation_error"
              : "provider_unavailable",
      error.message,
      error.statusCode,
    );
  if (error instanceof SalesforceApiError)
    return safeError(
      error.code === "salesforce_rate_limited"
        ? "provider_rate_limited"
        : error.code === "salesforce_token_invalid"
          ? "token_expired"
          : error.code === "salesforce_permission_denied"
            ? "insufficient_scope"
            : error.code.includes("invalid") || error.code.includes("mismatch")
              ? "provider_validation_error"
              : "provider_unavailable",
      error.message,
      error.statusCode,
    );
  if (error instanceof HubSpotApiError)
    return safeError(
      error.code === "hubspot_rate_limited"
        ? "provider_rate_limited"
        : error.code === "hubspot_token_invalid"
          ? "token_expired"
          : error.code === "hubspot_permission_denied"
            ? "insufficient_scope"
            : error.code.includes("invalid") || error.code.includes("mismatch")
              ? "provider_validation_error"
              : "provider_unavailable",
      error.message,
      error.statusCode,
    );
  if (error instanceof PipedriveApiError)
    return safeError(
      error.code === "pipedrive_rate_limited"
        ? "provider_rate_limited"
        : error.code === "pipedrive_token_invalid"
          ? "token_expired"
          : error.code === "pipedrive_permission_denied"
            ? "insufficient_scope"
            : error.code.includes("invalid") || error.code.includes("mismatch")
              ? "provider_validation_error"
              : "provider_unavailable",
      error.message,
      error.statusCode,
    );
  if (error instanceof ZohoApiError)
    return safeError(
      error.code === "zoho_rate_limited"
        ? "provider_rate_limited"
        : error.code === "zoho_token_invalid"
          ? "token_expired"
          : error.code === "zoho_permission_denied"
            ? "insufficient_scope"
            : error.code.includes("invalid") || error.code.includes("mismatch")
              ? "provider_validation_error"
              : "provider_unavailable",
      error.message,
      error.statusCode,
    );
  if (error instanceof ZohoPeopleApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof ZohoCampaignsApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof ZohoAnalyticsApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof CopperApiError)
    return safeError(
      error.code === "copper_rate_limited"
        ? "provider_rate_limited"
        : error.code === "copper_token_invalid"
          ? "token_expired"
          : error.code === "copper_permission_denied"
            ? "insufficient_scope"
            : error.code.includes("invalid") || error.code.includes("mismatch")
              ? "provider_validation_error"
              : "provider_unavailable",
      error.message,
      error.statusCode,
    );
  if (error instanceof CloseApiError)
    return safeError(
      error.code === "close_rate_limited"
        ? "provider_rate_limited"
        : error.code === "close_token_invalid"
          ? "token_expired"
          : error.code === "close_permission_denied"
            ? "insufficient_scope"
            : error.code === "close_record_not_found"
              ? "provider_validation_error"
              : error.code.includes("invalid") ||
                  error.code.includes("mismatch")
                ? "provider_validation_error"
                : "provider_unavailable",
      error.message,
      error.statusCode,
    );
  if (error instanceof ZendeskApiError)
    return safeError(
      error.code === "zendesk_rate_limited"
        ? "provider_rate_limited"
        : error.code === "zendesk_token_invalid"
          ? "token_expired"
          : error.code === "zendesk_permission_denied"
            ? "insufficient_scope"
            : error.code === "zendesk_record_not_found"
              ? "provider_validation_error"
              : error.code.includes("invalid") ||
                  error.code.includes("mismatch")
                ? "provider_validation_error"
                : "provider_unavailable",
      error.message,
      error.statusCode,
    );
  if (error instanceof IntercomApiError)
    return safeError(
      error.code === "intercom_rate_limited"
        ? "provider_rate_limited"
        : error.code === "intercom_token_invalid"
          ? "token_expired"
          : error.code === "intercom_permission_denied"
            ? "insufficient_scope"
            : error.code === "intercom_record_not_found"
              ? "provider_validation_error"
              : error.code.includes("invalid") ||
                  error.code.includes("mismatch")
                ? "provider_validation_error"
                : "provider_unavailable",
      error.message,
      error.statusCode,
    );
  if (error instanceof DatadogApiError)
    return safeError(
      error.code === "datadog_rate_limited"
        ? "provider_rate_limited"
        : error.code === "datadog_token_invalid"
          ? "token_expired"
          : error.code === "datadog_scope_denied"
            ? "insufficient_scope"
            : error.code.includes("invalid")
              ? "provider_validation_error"
              : "provider_unavailable",
      error.message,
      error.statusCode,
    );
  if (error instanceof NewRelicApiError)
    return safeError(
      error.code === "new_relic_rate_limited"
        ? "provider_rate_limited"
        : error.code === "new_relic_key_invalid"
          ? "token_expired"
          : error.code === "new_relic_permission_denied"
            ? "insufficient_scope"
            : error.code.includes("invalid") ||
                error.code.includes("mismatch") ||
                error.code === "new_relic_graphql_error"
              ? "provider_validation_error"
              : "provider_unavailable",
      error.message,
      error.statusCode,
    );
  return null;
}

function mapKnownConnectorErrorChunk3Part2(
  error: unknown,
): MarketplaceConnectorExecutorResult | null {
  if (error instanceof PagerDutyApiError)
    return safeError(
      error.code === "pagerduty_rate_limited"
        ? "provider_rate_limited"
        : error.code === "pagerduty_token_invalid"
          ? "token_expired"
          : error.code === "pagerduty_scope_denied"
            ? "insufficient_scope"
            : error.code === "pagerduty_not_found"
              ? "provider_validation_error"
              : error.code.includes("invalid")
                ? "provider_validation_error"
                : "provider_unavailable",
      error.message,
      error.statusCode,
    );
  if (error instanceof StatuspagePublicApiError)
    return safeError(
      error.code === "statuspage_rate_limited"
        ? "provider_rate_limited"
        : error.code.includes("invalid") ||
            error.code === "statuspage_page_not_found"
          ? "provider_validation_error"
          : "provider_unavailable",
      error.message,
      error.statusCode,
    );
  if (error instanceof CloudflareApiError)
    return safeError(
      error.code === "cloudflare_rate_limited"
        ? "provider_rate_limited"
        : error.code === "cloudflare_token_invalid"
          ? "token_expired"
          : error.code === "cloudflare_scope_denied"
            ? "insufficient_scope"
            : error.code.includes("invalid") ||
                error.code.includes("mismatch") ||
                error.code === "cloudflare_not_found" ||
                error.code === "cloudflare_graphql_error"
              ? "provider_validation_error"
              : "provider_unavailable",
      error.message,
      error.statusCode,
    );
  if (error instanceof VercelApiError)
    return safeError(
      error.code === "vercel_rate_limited"
        ? "provider_rate_limited"
        : error.code === "vercel_token_invalid"
          ? "token_expired"
          : error.code === "vercel_scope_or_configuration_denied"
            ? "insufficient_scope"
            : error.code.includes("invalid") ||
                error.code.includes("mismatch") ||
                error.code === "vercel_not_found"
              ? "provider_validation_error"
              : "provider_unavailable",
      error.message,
      error.statusCode,
    );
  if (error instanceof NetlifyApiError)
    return safeError(
      error.code === "netlify_rate_limited"
        ? "provider_rate_limited"
        : error.code === "netlify_token_invalid"
          ? "token_expired"
          : error.code === "netlify_team_access_denied"
            ? "insufficient_scope"
            : error.code.includes("invalid") ||
                error.code.includes("mismatch") ||
                error.code === "netlify_not_found"
              ? "provider_validation_error"
              : "provider_unavailable",
      error.message,
      error.statusCode,
    );
  if (error instanceof HerokuApiError)
    return safeError(
      error.code === "heroku_rate_limited"
        ? "provider_rate_limited"
        : error.code === "heroku_token_invalid"
          ? "token_expired"
          : error.code === "heroku_scope_or_team_denied"
            ? "insufficient_scope"
            : error.code.includes("invalid") ||
                error.code.includes("mismatch") ||
                error.code === "heroku_not_found"
              ? "provider_validation_error"
              : "provider_unavailable",
      error.message,
      error.statusCode,
    );
  if (error instanceof DigitalOceanApiError)
    return safeError(
      error.code === "digitalocean_rate_limited"
        ? "provider_rate_limited"
        : error.code === "digitalocean_token_invalid"
          ? "token_expired"
          : error.code === "digitalocean_scope_or_team_denied"
            ? "insufficient_scope"
            : error.code.includes("invalid") ||
                error.code.includes("mismatch") ||
                error.code.includes("unverified") ||
                error.code === "digitalocean_not_found"
              ? "provider_validation_error"
              : "provider_unavailable",
      error.message,
      error.statusCode,
    );
  if (error instanceof FirebaseApiError)
    return safeError(
      error.code === "firebase_rate_limited"
        ? "provider_rate_limited"
        : error.code === "firebase_token_invalid"
          ? "token_expired"
          : error.code === "firebase_scope_or_iam_denied"
            ? "insufficient_scope"
            : error.code.includes("invalid") ||
                error.code.includes("mismatch") ||
                error.code === "firebase_project_not_found"
              ? "provider_validation_error"
              : "provider_unavailable",
      error.message,
      error.statusCode,
    );
  if (error instanceof SupabaseApiError)
    return safeError(
      error.code === "supabase_rate_limited"
        ? "provider_rate_limited"
        : error.code === "supabase_token_invalid"
          ? "token_expired"
          : error.code === "supabase_scope_or_membership_denied"
            ? "insufficient_scope"
            : error.code.includes("invalid") ||
                error.code.includes("mismatch") ||
                error.code === "supabase_resource_not_found"
              ? "provider_validation_error"
              : "provider_unavailable",
      error.message,
      error.statusCode,
    );
  if (error instanceof OktaApiError)
    return safeError(
      error.code === "okta_rate_limited"
        ? "provider_rate_limited"
        : error.code === "okta_credentials_invalid"
          ? "token_expired"
          : error.code === "okta_scope_denied"
            ? "insufficient_scope"
            : error.code.includes("invalid") ||
                error.code.includes("mismatch") ||
                error.code === "okta_resource_not_found"
              ? "provider_validation_error"
              : "provider_unavailable",
      error.message,
      error.statusCode,
    );
  if (error instanceof BambooHRApiError)
    return safeError(
      error.code === "bamboohr_rate_limited"
        ? "provider_rate_limited"
        : error.code === "bamboohr_token_invalid"
          ? "token_expired"
          : error.code === "bamboohr_scope_denied"
            ? "insufficient_scope"
            : error.code.includes("invalid") ||
                error.code.includes("mismatch") ||
                error.code === "bamboohr_resource_not_found"
              ? "provider_validation_error"
              : "provider_unavailable",
      error.message,
      error.statusCode,
    );
  if (error instanceof GreenhouseApiError)
    return safeError(
      error.code === "greenhouse_rate_limited"
        ? "provider_rate_limited"
        : error.code === "greenhouse_token_invalid"
          ? "token_expired"
          : error.code === "greenhouse_scope_or_admin_denied"
            ? "insufficient_scope"
            : error.code.includes("invalid") ||
                error.code === "greenhouse_resource_not_found"
              ? "provider_validation_error"
              : "provider_unavailable",
      error.message,
      error.statusCode,
    );
  if (error instanceof LeverApiError)
    return safeError(
      error.code === "lever_rate_limited"
        ? "provider_rate_limited"
        : error.code === "lever_token_invalid"
          ? "token_expired"
          : error.code === "lever_scope_or_admin_denied"
            ? "insufficient_scope"
            : error.code.includes("invalid") ||
                error.code === "lever_resource_not_found"
              ? "provider_validation_error"
              : "provider_unavailable",
      error.message,
      error.statusCode,
    );
  if (error instanceof GmailApiError)
    return safeError(
      error.code === "gmail_rate_limited"
        ? "provider_rate_limited"
        : error.code === "gmail_token_invalid"
          ? "token_expired"
          : error.code === "gmail_scope_or_policy_denied"
            ? "insufficient_scope"
            : error.code.includes("invalid") ||
                error.code.includes("mismatch") ||
                error.code === "gmail_resource_not_found"
              ? "provider_validation_error"
              : "provider_unavailable",
      error.message,
      error.statusCode,
    );
  if (error instanceof GoogleCalendarApiError)
    return safeError(
      error.code === "google_calendar_rate_limited"
        ? "provider_rate_limited"
        : error.code === "google_calendar_token_invalid"
          ? "token_expired"
          : error.code === "google_calendar_scope_or_acl_denied"
            ? "insufficient_scope"
            : error.code.includes("invalid") ||
                error.code.includes("mismatch") ||
                error.code === "google_calendar_resource_not_found" ||
                error.code === "google_calendar_conflict"
              ? "provider_validation_error"
              : "provider_unavailable",
      error.message,
      error.statusCode,
    );
  if (error instanceof GoogleDriveApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof GoogleDocsApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof GoogleSheetsApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof GoogleSlidesApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof GoogleFormsApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof GoogleTasksApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof GoogleContactsApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof GooglePhotosApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof GoogleMeetApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof GoogleChatApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof GoogleAdsApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof GoogleAnalyticsApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof PayPalApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof KajabiCommunitiesApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof CircleApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof MightyNetworksApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof DiscourseApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof VanillaForumsApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof BettermodeApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof HigherLogicApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof HivebriteApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof LucidsparkApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof LucidchartApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof GuruApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof GuruMcpError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof SliteMcpError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof NuclinoMcpError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof ScribeMcpError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof SlabGraphqlError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof HealthieGraphqlError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof RoadmunkGraphqlError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof ShortcutApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof HiveApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof NiftyApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof PaymoApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof KrakenApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof BinanceApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof GeminiApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof ProofHubApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof MeisterTaskApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof NozbeApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof HabiticaApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof AmazingMarvinApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof MotionApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof ReclaimAiApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof SavvyCalApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof YouCanBookMeApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof AcuitySchedulingApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof SimplyBookMeApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof OnceHubApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof SalesflareApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof ZendeskSellApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof KeapMaxClassicApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof FolkCrmApiError)
    return safeError(error.code, error.message, error.statusCode);
  if (error instanceof OnePageCrmApiError)
    return safeError(error.code, error.message, error.statusCode);
  return null;
}

export function mapKnownConnectorErrorChunk3(
  error: unknown,
): MarketplaceConnectorExecutorResult | null {
  return (
    mapKnownConnectorErrorChunk3Part1(error) ??
    mapKnownConnectorErrorChunk3Part2(error)
  );
}
