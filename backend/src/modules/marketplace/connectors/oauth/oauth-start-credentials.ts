import { COGNITO_FORMS_MCP_CLIENT_ID } from "../cognito-forms/cognito-forms-mcp.adapter";
import type { MarketplaceConnectorOAuthService } from "../connector-oauth.service";

type OAuthStartClientIdInput = {
  slug: string;
  explicitClientId?: string;
  mastodonClientId?: string | null;
  googleClientId?: string | null;
  boxClientId?: string | null;
  dropboxClientId?: string | null;
  signNowClientId?: string | null;
  signRequestClientId?: string | null;
  signeasyClientId?: string | null;
  rightSignatureClientId?: string | null;
  restreamClientId?: string | null;
  storedClientId?: unknown;
  metadataClientId?: unknown;
};

function resolvePrimaryConfiguredClientId(
  service: MarketplaceConnectorOAuthService,
  slug: string,
  explicitClientId?: string,
) {
  if (slug === "jotform") {
    return (
      service.configService.get<string>("JOTFORM_MCP_CLIENT_ID")?.trim() ??
      explicitClientId?.trim()
    );
  }
  return slug === "dropbox-paper"
    ? service.configService.get<string>("DROPBOX_PAPER_CLIENT_ID")?.trim()
    : slug === "adobe-acrobat-sign"
      ? service.configService
          .get<string>("ADOBE_ACROBAT_SIGN_CLIENT_ID")
          ?.trim()
      : slug === "pcloud"
        ? service.configService.get<string>("PCLOUD_CLIENT_ID")?.trim()
        : slug === "sharefile"
          ? service.configService.get<string>("SHAREFILE_CLIENT_ID")?.trim()
          : slug === "deputy"
            ? service.configService.get<string>("DEPUTY_CLIENT_ID")?.trim()
            : slug === "egnyte"
              ? service.configService.get<string>("EGNYTE_CLIENT_ID")?.trim()
              : slug === "inoreader"
                ? service.configService
                    .get<string>("INOREADER_CLIENT_ID")
                    ?.trim()
                : slug === "guru"
                  ? service.configService.get<string>("GURU_CLIENT_ID")?.trim()
                  : slug === "slite"
                    ? service.configService
                        .get<string>("SLITE_CLIENT_ID")
                        ?.trim()
                    : slug === "nuclino"
                      ? service.configService
                          .get<string>("NUCLINO_CLIENT_ID")
                          ?.trim()
                      : slug === "scribe"
                        ? service.configService
                            .get<string>("SCRIBE_CLIENT_ID")
                            ?.trim()
                        : slug === "otter-ai"
                          ? service.configService
                              .get<string>("OTTER_CLIENT_ID")
                              ?.trim()
                          : slug === "fireflies-ai"
                            ? service.configService
                                .get<string>("FIREFLIES_CLIENT_ID")
                                ?.trim()
                            : slug === "any-do"
                              ? service.configService
                                  .get<string>("ANY_DO_CLIENT_ID")
                                  ?.trim()
                              : slug === "remember-the-milk"
                                ? service.configService
                                    .get<string>("REMEMBER_THE_MILK_CLIENT_ID")
                                    ?.trim()
                                : slug === "akiflow"
                                  ? service.configService
                                      .get<string>("AKIFLOW_CLIENT_ID")
                                      ?.trim()
                                  : slug === "bonsai"
                                    ? service.configService
                                        .get<string>("BONSAI_MCP_CLIENT_ID")
                                        ?.trim()
                                    : slug === "sunsama"
                                      ? service.configService
                                          .get<string>("SUNSAMA_CLIENT_ID")
                                          ?.trim()
                                      : slug === "fathom"
                                        ? service.configService
                                            .get<string>("FATHOM_MCP_CLIENT_ID")
                                            ?.trim()
                                        : slug === "grain"
                                          ? service.configService
                                              .get<string>(
                                                "GRAIN_MCP_CLIENT_ID",
                                              )
                                              ?.trim()
                                          : slug === "whimsical"
                                            ? service.configService
                                                .get<string>(
                                                  "WHIMSICAL_MCP_CLIENT_ID",
                                                )
                                                ?.trim()
                                            : slug === "cognito-forms"
                                              ? (service.configService
                                                  .get<string>(
                                                    "COGNITO_FORMS_MCP_CLIENT_ID",
                                                  )
                                                  ?.trim() ??
                                                COGNITO_FORMS_MCP_CLIENT_ID)
                                              : slug === "xmind"
                                                ? service.configService
                                                    .get<string>(
                                                      "XMIND_MCP_CLIENT_ID",
                                                    )
                                                    ?.trim()
                                                : slug === "cloudinary"
                                                  ? service.configService
                                                      .get<string>(
                                                        "CLOUDINARY_MCP_CLIENT_ID",
                                                      )
                                                      ?.trim()
                                                  : slug === "mindmeister"
                                                    ? service.configService
                                                        .get<string>(
                                                          "MINDMEISTER_CLIENT_ID",
                                                        )
                                                        ?.trim()
                                                    : slug === "vimeo"
                                                      ? service.configService
                                                          .get<string>(
                                                            "VIMEO_CLIENT_ID",
                                                          )
                                                          ?.trim()
                                                      : slug === "wistia"
                                                        ? service.configService
                                                            .get<string>(
                                                              "WISTIA_CLIENT_ID",
                                                            )
                                                            ?.trim()
                                                        : slug === "mural"
                                                          ? service.configService
                                                              .get<string>(
                                                                "MURAL_CLIENT_ID",
                                                              )
                                                              ?.trim()
                                                          : slug === "miro"
                                                            ? service.configService
                                                                .get<string>(
                                                                  "MIRO_CLIENT_ID",
                                                                )
                                                                ?.trim()
                                                            : slug === "canva"
                                                              ? service.configService
                                                                  .get<string>(
                                                                    "CANVA_CLIENT_ID",
                                                                  )
                                                                  ?.trim()
                                                              : slug ===
                                                                  "webflow"
                                                                ? service.configService
                                                                    .get<string>(
                                                                      "WEBFLOW_CLIENT_ID",
                                                                    )
                                                                    ?.trim()
                                                                : slug ===
                                                                    "wordpress-com"
                                                                  ? service.configService
                                                                      .get<string>(
                                                                        "WORDPRESS_COM_CLIENT_ID",
                                                                      )
                                                                      ?.trim()
                                                                  : slug ===
                                                                      "contentful"
                                                                    ? service.configService
                                                                        .get<string>(
                                                                          "CONTENTFUL_CLIENT_ID",
                                                                        )
                                                                        ?.trim()
                                                                    : [
                                                                          "figjam",
                                                                          "figma",
                                                                        ].includes(
                                                                          slug,
                                                                        )
                                                                      ? service.configService
                                                                          .get<string>(
                                                                            "FIGMA_CLIENT_ID",
                                                                          )
                                                                          ?.trim()
                                                                      : [
                                                                            "lucidspark",
                                                                            "lucidchart",
                                                                          ].includes(
                                                                            slug,
                                                                          )
                                                                        ? service.configService
                                                                            .get<string>(
                                                                              "LUCID_CLIENT_ID",
                                                                            )
                                                                            ?.trim()
                                                                        : slug ===
                                                                            "frame-io"
                                                                          ? service.configService
                                                                              .get<string>(
                                                                                "FRAME_IO_CLIENT_ID",
                                                                              )
                                                                              ?.trim()
                                                                          : [
                                                                                "microsoft-teams",
                                                                                "onedrive",
                                                                                "sharepoint",
                                                                                "microsoft-planner",
                                                                                "microsoft-to-do",
                                                                                "microsoft-lists",
                                                                                "onenote",
                                                                                "microsoft-bookings",
                                                                                "microsoft-power-bi",
                                                                                "microsoft-dynamics-365",
                                                                                "microsoft-viva-engage",
                                                                              ].includes(
                                                                                slug,
                                                                              )
                                                                            ? service.configService
                                                                                .get<string>(
                                                                                  "MICROSOFT_CLIENT_ID",
                                                                                )
                                                                                ?.trim()
                                                                            : slug ===
                                                                                "ms-project"
                                                                              ? (service.configService
                                                                                  .get<string>(
                                                                                    "MICROSOFT_PROJECT_CLIENT_ID",
                                                                                  )
                                                                                  ?.trim() ??
                                                                                service.configService
                                                                                  .get<string>(
                                                                                    "MICROSOFT_CLIENT_ID",
                                                                                  )
                                                                                  ?.trim())
                                                                              : slug ===
                                                                                  "confluence"
                                                                                ? service.configService
                                                                                    .get<string>(
                                                                                      "CONFLUENCE_CLIENT_ID",
                                                                                    )
                                                                                    ?.trim()
                                                                                : slug ===
                                                                                    "jira"
                                                                                  ? service.configService
                                                                                      .get<string>(
                                                                                        "JIRA_CLIENT_ID",
                                                                                      )
                                                                                      ?.trim()
                                                                                  : slug ===
                                                                                      "jira-service-management"
                                                                                    ? service.configService
                                                                                        .get<string>(
                                                                                          "JIRA_SERVICE_MANAGEMENT_CLIENT_ID",
                                                                                        )
                                                                                        ?.trim()
                                                                                    : slug ===
                                                                                        "atlassian-compass"
                                                                                      ? service.configService
                                                                                          .get<string>(
                                                                                            "ATLASSIAN_COMPASS_CLIENT_ID",
                                                                                          )
                                                                                          ?.trim()
                                                                                      : slug ===
                                                                                          "productboard"
                                                                                        ? service.configService
                                                                                            .get<string>(
                                                                                              "PRODUCTBOARD_CLIENT_ID",
                                                                                            )
                                                                                            ?.trim()
                                                                                        : slug ===
                                                                                            "nifty"
                                                                                          ? service.configService
                                                                                              .get<string>(
                                                                                                "NIFTY_CLIENT_ID",
                                                                                              )
                                                                                              ?.trim()
                                                                                          : slug ===
                                                                                              "meistertask"
                                                                                            ? service.configService
                                                                                                .get<string>(
                                                                                                  "MEISTERTASK_CLIENT_ID",
                                                                                                )
                                                                                                ?.trim()
                                                                                            : slug ===
                                                                                                "aha"
                                                                                              ? service.configService
                                                                                                  .get<string>(
                                                                                                    "AHA_CLIENT_ID",
                                                                                                  )
                                                                                                  ?.trim()
                                                                                              : explicitClientId?.trim();
}

function resolveProviderConfiguredClientId(
  service: MarketplaceConnectorOAuthService,
  slug: string,
) {
  return (
    (slug === "nextdoor"
      ? service.configService.get<string>("NEXTDOOR_CLIENT_ID")?.trim()
      : "") ||
    (slug === "zoom"
      ? service.configService.get<string>("ZOOM_CLIENT_ID")?.trim()
      : "") ||
    (slug === "linkedin"
      ? service.configService.get<string>("LINKEDIN_CLIENT_ID")?.trim()
      : "") ||
    (slug === "shopify"
      ? service.configService.get<string>("SHOPIFY_CLIENT_ID")?.trim()
      : "") ||
    (slug === "stripe"
      ? service.configService.get<string>("STRIPE_APPS_CLIENT_ID")?.trim()
      : "") ||
    (slug === "quickbooks"
      ? service.configService.get<string>("QUICKBOOKS_CLIENT_ID")?.trim()
      : "") ||
    (slug === "freshbooks"
      ? service.configService.get<string>("FRESHBOOKS_CLIENT_ID")?.trim()
      : "") ||
    (slug === "wave"
      ? service.configService.get<string>("WAVE_CLIENT_ID")?.trim()
      : "") ||
    (slug === "freeagent"
      ? service.configService.get<string>("FREEAGENT_CLIENT_ID")?.trim()
      : "") ||
    (slug === "salesforce"
      ? service.configService.get<string>("SALESFORCE_CLIENT_ID")?.trim()
      : "") ||
    (slug === "hubspot"
      ? service.configService.get<string>("HUBSPOT_CLIENT_ID")?.trim()
      : "") ||
    (slug === "pipedrive"
      ? service.configService.get<string>("PIPEDRIVE_CLIENT_ID")?.trim()
      : "") ||
    (slug === "zoho"
      ? service.configService.get<string>("ZOHO_CLIENT_ID")?.trim()
      : "") ||
    (slug === "zoho-desk"
      ? service.configService.get<string>("ZOHO_CLIENT_ID")?.trim()
      : "") ||
    (slug === "zoho-projects"
      ? service.configService.get<string>("ZOHO_CLIENT_ID")?.trim()
      : "") ||
    (slug === "copper"
      ? service.configService.get<string>("COPPER_CLIENT_ID")?.trim()
      : "") ||
    (slug === "surveymonkey"
      ? service.configService.get<string>("SURVEYMONKEY_CLIENT_ID")?.trim()
      : "") ||
    (slug === "fillout"
      ? service.configService.get<string>("FILLOUT_CLIENT_ID")?.trim()
      : "") ||
    (slug === "mailchimp"
      ? service.configService.get<string>("MAILCHIMP_CLIENT_ID")?.trim()
      : "") ||
    (slug === "mailchimp-surveys"
      ? service.configService.get<string>("MAILCHIMP_SURVEYS_CLIENT_ID")?.trim()
      : "") ||
    (slug === "klaviyo-sms"
      ? service.configService.get<string>("KLAVIYO_SMS_CLIENT_ID")?.trim()
      : "") ||
    (slug === "klaviyo"
      ? service.configService.get<string>("KLAVIYO_CLIENT_ID")?.trim()
      : "") ||
    (slug === "convertkit"
      ? service.configService.get<string>("CONVERTKIT_CLIENT_ID")?.trim()
      : "") ||
    (slug === "campaign-monitor"
      ? service.configService.get<string>("CAMPAIGN_MONITOR_CLIENT_ID")?.trim()
      : "") ||
    (slug === "constant-contact"
      ? service.configService.get<string>("CONSTANT_CONTACT_CLIENT_ID")?.trim()
      : "") ||
    (slug === "close"
      ? service.configService.get<string>("CLOSE_CLIENT_ID")?.trim()
      : "") ||
    (slug === "attio"
      ? service.configService.get<string>("ATTIO_CLIENT_ID")?.trim()
      : "") ||
    (slug === "zendesk-sell"
      ? service.configService.get<string>("ZENDESK_SELL_CLIENT_ID")?.trim()
      : "") ||
    (slug === "keap-max-classic"
      ? service.configService.get<string>("KEAP_MAX_CLASSIC_CLIENT_ID")?.trim()
      : "") ||
    (slug === "zendesk"
      ? service.configService.get<string>("ZENDESK_CLIENT_ID")?.trim()
      : "") ||
    (slug === "intercom"
      ? service.configService.get<string>("INTERCOM_CLIENT_ID")?.trim()
      : "") ||
    (slug === "help-scout"
      ? service.configService.get<string>("HELP_SCOUT_CLIENT_ID")?.trim()
      : "") ||
    (slug === "front"
      ? service.configService.get<string>("FRONT_CLIENT_ID")?.trim()
      : "") ||
    (slug === "teamwork"
      ? service.configService.get<string>("TEAMWORK_CLIENT_ID")?.trim()
      : "") ||
    (slug === "basecamp"
      ? service.configService.get<string>("BASECAMP_CLIENT_ID")?.trim()
      : "") ||
    (slug === "wrike"
      ? service.configService.get<string>("WRIKE_CLIENT_ID")?.trim()
      : "") ||
    (slug === "smartsheet"
      ? service.configService.get<string>("SMARTSHEET_CLIENT_ID")?.trim()
      : "") ||
    (slug === "todoist"
      ? service.configService.get<string>("TODOIST_CLIENT_ID")?.trim()
      : "") ||
    (slug === "ticktick"
      ? service.configService.get<string>("TICKTICK_CLIENT_ID")?.trim()
      : "") ||
    (slug === "harvest"
      ? service.configService.get<string>("HARVEST_CLIENT_ID")?.trim()
      : "") ||
    (slug === "calendly"
      ? service.configService.get<string>("CALENDLY_CLIENT_ID")?.trim()
      : "") ||
    (slug === "threads"
      ? service.configService.get<string>("THREADS_APP_ID")?.trim()
      : "") ||
    (slug === "pinterest"
      ? service.configService.get<string>("PINTEREST_APP_ID")?.trim()
      : "") ||
    (slug === "tumblr"
      ? service.configService.get<string>("TUMBLR_CONSUMER_KEY")?.trim()
      : "") ||
    (slug === "cal-com"
      ? service.configService.get<string>("CAL_COM_CLIENT_ID")?.trim()
      : "") ||
    (slug === "docusign"
      ? service.configService.get<string>("DOCUSIGN_CLIENT_ID")?.trim()
      : "") ||
    (slug === "dropbox-sign"
      ? service.configService.get<string>("DROPBOX_SIGN_CLIENT_ID")?.trim()
      : "") ||
    (slug === "pandadoc"
      ? service.configService.get<string>("PANDADOC_CLIENT_ID")?.trim()
      : "") ||
    (slug === "typeform"
      ? service.configService.get<string>("TYPEFORM_CLIENT_ID")?.trim()
      : "") ||
    (slug === "sendfox"
      ? service.configService.get<string>("SENDFOX_CLIENT_ID")?.trim()
      : "") ||
    (slug === "beehiiv"
      ? service.configService.get<string>("BEEHIIV_CLIENT_ID")?.trim()
      : "") ||
    (slug === "hootsuite"
      ? service.configService.get<string>("HOOTSUITE_CLIENT_ID")?.trim()
      : "") ||
    (slug === "buffer"
      ? service.configService.get<string>("BUFFER_CLIENT_ID")?.trim()
      : "") ||
    (slug === "datadog"
      ? service.configService.get<string>("DATADOG_CLIENT_ID")?.trim()
      : "") ||
    (slug === "pagerduty"
      ? service.configService.get<string>("PAGERDUTY_CLIENT_ID")?.trim()
      : "") ||
    (slug === "cloudflare"
      ? service.configService.get<string>("CLOUDFLARE_CLIENT_ID")?.trim()
      : "") ||
    (slug === "vercel"
      ? service.configService.get<string>("VERCEL_CLIENT_ID")?.trim()
      : "") ||
    (slug === "heroku"
      ? service.configService.get<string>("HEROKU_CLIENT_ID")?.trim()
      : "") ||
    (slug === "digitalocean"
      ? service.configService.get<string>("DIGITALOCEAN_CLIENT_ID")?.trim()
      : "") ||
    (slug === "firebase"
      ? service.configService.get<string>("FIREBASE_CLIENT_ID")?.trim()
      : "") ||
    (slug === "supabase"
      ? service.configService.get<string>("SUPABASE_CLIENT_ID")?.trim()
      : "") ||
    (slug === "bamboohr"
      ? service.configService.get<string>("BAMBOOHR_CLIENT_ID")?.trim()
      : "") ||
    (slug === "greenhouse"
      ? service.configService.get<string>("GREENHOUSE_CLIENT_ID")?.trim()
      : "") ||
    (slug === "lever"
      ? service.configService.get<string>("LEVER_CLIENT_ID")?.trim()
      : "") ||
    (slug === "gmail"
      ? service.configService.get<string>("GMAIL_CLIENT_ID")?.trim()
      : "") ||
    (slug === "google-calendar"
      ? service.configService.get<string>("GOOGLE_CALENDAR_CLIENT_ID")?.trim()
      : "") ||
    (slug === "nationbuilder"
      ? service.configService.get<string>("NATIONBUILDER_CLIENT_ID")?.trim()
      : "") ||
    (slug === "meetup"
      ? service.configService.get<string>("MEETUP_CLIENT_ID")?.trim()
      : "") ||
    (slug === "eventbrite"
      ? service.configService.get<string>("EVENTBRITE_API_KEY")?.trim()
      : "") ||
    (slug === "7shifts"
      ? service.configService.get<string>("SEVEN_SHIFTS_CLIENT_ID")?.trim()
      : "") ||
    (slug === "resource-guru"
      ? service.configService.get<string>("RESOURCE_GURU_CLIENT_ID")?.trim()
      : "") ||
    (slug === "timely-time-tracking"
      ? service.configService
          .get<string>("TIMELY_TIME_TRACKING_CLIENT_ID")
          ?.trim()
      : "") ||
    (slug === "rescuetime"
      ? service.configService.get<string>("RESCUETIME_CLIENT_ID")?.trim()
      : "") ||
    (slug === "hubstaff"
      ? service.configService.get<string>("HUBSTAFF_CLIENT_ID")?.trim()
      : "") ||
    (["webex", "webex-calling"].includes(slug)
      ? service.configService.get<string>("WEBEX_CLIENT_ID")?.trim()
      : "") ||
    (slug === "goto-meeting"
      ? service.configService.get<string>("GOTO_MEETING_CLIENT_ID")?.trim()
      : "") ||
    (slug === "goto-webinar"
      ? service.configService.get<string>("GOTO_WEBINAR_CLIENT_ID")?.trim()
      : "") ||
    (slug === "livestorm"
      ? service.configService.get<string>("LIVESTORM_CLIENT_ID")?.trim()
      : "") ||
    (slug === "ringcentral"
      ? service.configService.get<string>("RINGCENTRAL_CLIENT_ID")?.trim()
      : "") ||
    (slug === "dialpad"
      ? service.configService.get<string>("DIALPAD_CLIENT_ID")?.trim()
      : "") ||
    (slug === "aircall"
      ? service.configService.get<string>("AIRCALL_CLIENT_ID")?.trim()
      : "") ||
    (slug === "line"
      ? service.configService.get<string>("LINE_CLIENT_ID")?.trim()
      : "") ||
    (slug === "twist"
      ? service.configService.get<string>("TWIST_CLIENT_ID")?.trim()
      : "") ||
    (slug === "zoho-mail"
      ? service.configService.get<string>("ZOHO_MAIL_CLIENT_ID")?.trim()
      : "") ||
    (slug === "zoho-workdrive"
      ? service.configService.get<string>("ZOHO_WORKDRIVE_CLIENT_ID")?.trim()
      : "") ||
    (slug === "zoho-people"
      ? service.configService.get<string>("ZOHO_PEOPLE_CLIENT_ID")?.trim()
      : "") ||
    (slug === "zoho-campaigns"
      ? service.configService.get<string>("ZOHO_CAMPAIGNS_CLIENT_ID")?.trim()
      : "") ||
    (slug === "zoho-analytics"
      ? service.configService.get<string>("ZOHO_ANALYTICS_CLIENT_ID")?.trim()
      : "") ||
    (slug === "slack"
      ? service.configService.get<string>("SLACK_CLIENT_ID")?.trim()
      : "") ||
    (slug === "github"
      ? service.configService.get<string>("GITHUB_CLIENT_ID")?.trim()
      : "") ||
    (slug === "gitlab"
      ? service.configService.get<string>("GITLAB_CLIENT_ID")?.trim()
      : "") ||
    (slug === "bitbucket"
      ? service.configService.get<string>("BITBUCKET_CLIENT_ID")?.trim()
      : "") ||
    (slug === "notion"
      ? service.configService.get<string>("NOTION_CLIENT_ID")?.trim()
      : "") ||
    (slug === "linear"
      ? service.configService.get<string>("LINEAR_CLIENT_ID")?.trim()
      : "") ||
    (slug === "asana"
      ? service.configService.get<string>("ASANA_CLIENT_ID")?.trim()
      : "") ||
    (slug === "shootproof"
      ? service.configService.get<string>("SHOOTPROOF_CLIENT_ID")?.trim()
      : "") ||
    (slug === "clickup"
      ? service.configService.get<string>("CLICKUP_CLIENT_ID")?.trim()
      : "") ||
    (slug === "monday-com"
      ? service.configService.get<string>("MONDAY_CLIENT_ID")?.trim()
      : "") ||
    (slug === "airtable"
      ? service.configService.get<string>("AIRTABLE_CLIENT_ID")?.trim()
      : "") ||
    (slug === "reflect"
      ? service.configService.get<string>("REFLECT_CLIENT_ID")?.trim()
      : "") ||
    (slug === "raindrop-io"
      ? service.configService.get<string>("RAINDROP_CLIENT_ID")?.trim()
      : "") ||
    (slug === "savvycal"
      ? service.configService.get<string>("SAVVYCAL_CLIENT_ID")?.trim()
      : "") ||
    (slug === "acuity-scheduling"
      ? service.configService.get<string>("ACUITY_SCHEDULING_CLIENT_ID")?.trim()
      : "") ||
    (slug === "square-appointments"
      ? service.configService
          .get<string>("SQUARE_APPOINTMENTS_CLIENT_ID")
          ?.trim()
      : "") ||
    (slug === "jane-app"
      ? service.configService.get<string>("JANE_APP_CLIENT_ID")?.trim()
      : "") ||
    (slug === "dribbble"
      ? service.configService.get<string>("DRIBBBLE_CLIENT_ID")?.trim()
      : "") ||
    (slug === "mixcloud"
      ? service.configService.get<string>("MIXCLOUD_CLIENT_ID")?.trim()
      : "") ||
    (slug === "audius"
      ? service.configService.get<string>("AUDIUS_API_KEY")?.trim()
      : "") ||
    (slug === "podbean"
      ? service.configService.get<string>("PODBEAN_CLIENT_ID")?.trim()
      : "") ||
    (slug === "deviantart"
      ? service.configService.get<string>("DEVIANTART_CLIENT_ID")?.trim()
      : "") ||
    (slug === "posthog"
      ? service.configService
          .get<string>("RELAY_POSTHOG_OAUTH_CLIENT_METADATA_URL")
          ?.trim()
      : "") ||
    (slug === "sentry"
      ? service.configService
          .get<string>("RELAY_SENTRY_OAUTH_CLIENT_ID")
          ?.trim()
      : "") ||
    (slug === "optimizely"
      ? service.configService.get<string>("OPTIMIZELY_CLIENT_ID")?.trim()
      : "")
  );
}

export function resolveOAuthStartClientId(
  service: MarketplaceConnectorOAuthService,
  {
    slug,
    explicitClientId,
    mastodonClientId,
    googleClientId,
    boxClientId,
    dropboxClientId,
    signNowClientId,
    signRequestClientId,
    signeasyClientId,
    rightSignatureClientId,
    restreamClientId,
    storedClientId,
    metadataClientId,
  }: OAuthStartClientIdInput,
): string {
  return (
    service.resolveBatch23OAuthClientId(slug) ||
    mastodonClientId ||
    googleClientId ||
    boxClientId ||
    dropboxClientId ||
    signNowClientId ||
    signRequestClientId ||
    signeasyClientId ||
    rightSignatureClientId ||
    restreamClientId ||
    resolvePrimaryConfiguredClientId(service, slug, explicitClientId) ||
    resolveProviderConfiguredClientId(service, slug) ||
    service.stringOrNull(storedClientId) ||
    service.stringOrNull(metadataClientId) ||
    ""
  );
}

type OAuthStartClientSecretInput = {
  slug: string;
  explicitClientSecret?: string;
  mastodonClientSecret?: string | null;
  googleClientSecret?: string | null;
  boxClientSecret?: string | null;
  dropboxClientSecret?: string | null;
  restreamClientSecret?: string | null;
  storedClientSecret?: unknown;
};

function resolvePrimaryConfiguredClientSecret(
  service: MarketplaceConnectorOAuthService,
  slug: string,
  explicitClientSecret?: string,
) {
  return (
    (slug === "dropbox-paper"
      ? service.configService.get<string>("DROPBOX_PAPER_CLIENT_SECRET")?.trim()
      : slug === "inoreader"
        ? service.configService.get<string>("INOREADER_CLIENT_SECRET")?.trim()
        : slug === "guru"
          ? service.configService.get<string>("GURU_CLIENT_SECRET")?.trim()
          : slug === "confluence"
            ? service.configService
                .get<string>("CONFLUENCE_CLIENT_SECRET")
                ?.trim()
            : slug === "jira"
              ? service.configService.get<string>("JIRA_CLIENT_SECRET")?.trim()
              : slug === "jira-service-management"
                ? service.configService
                    .get<string>("JIRA_SERVICE_MANAGEMENT_CLIENT_SECRET")
                    ?.trim()
                : slug === "atlassian-compass"
                  ? service.configService
                      .get<string>("ATLASSIAN_COMPASS_CLIENT_SECRET")
                      ?.trim()
                  : slug === "productboard"
                    ? service.configService
                        .get<string>("PRODUCTBOARD_CLIENT_SECRET")
                        ?.trim()
                    : slug === "nifty"
                      ? service.configService
                          .get<string>("NIFTY_CLIENT_SECRET")
                          ?.trim()
                      : slug === "meistertask"
                        ? service.configService
                            .get<string>("MEISTERTASK_CLIENT_SECRET")
                            ?.trim()
                        : slug === "aha"
                          ? service.configService
                              .get<string>("AHA_CLIENT_SECRET")
                              ?.trim()
                          : slug === "savvycal"
                            ? service.configService
                                .get<string>("SAVVYCAL_CLIENT_SECRET")
                                ?.trim()
                            : slug === "acuity-scheduling"
                              ? service.configService
                                  .get<string>(
                                    "ACUITY_SCHEDULING_CLIENT_SECRET",
                                  )
                                  ?.trim()
                              : slug === "square-appointments"
                                ? service.configService
                                    .get<string>(
                                      "SQUARE_APPOINTMENTS_CLIENT_SECRET",
                                    )
                                    ?.trim()
                                : slug === "scribe"
                                  ? service.configService
                                      .get<string>("SCRIBE_CLIENT_SECRET")
                                      ?.trim()
                                  : slug === "any-do"
                                    ? service.configService
                                        .get<string>("ANY_DO_CLIENT_SECRET")
                                        ?.trim()
                                    : slug === "remember-the-milk"
                                      ? service.configService
                                          .get<string>(
                                            "REMEMBER_THE_MILK_CLIENT_SECRET",
                                          )
                                          ?.trim()
                                      : slug === "vimeo"
                                        ? service.configService
                                            .get<string>("VIMEO_CLIENT_SECRET")
                                            ?.trim()
                                        : slug === "wistia"
                                          ? service.configService
                                              .get<string>(
                                                "WISTIA_CLIENT_SECRET",
                                              )
                                              ?.trim()
                                          : slug === "mural"
                                            ? service.configService
                                                .get<string>(
                                                  "MURAL_CLIENT_SECRET",
                                                )
                                                ?.trim()
                                            : slug === "miro"
                                              ? service.configService
                                                  .get<string>(
                                                    "MIRO_CLIENT_SECRET",
                                                  )
                                                  ?.trim()
                                              : slug === "canva"
                                                ? service.configService
                                                    .get<string>(
                                                      "CANVA_CLIENT_SECRET",
                                                    )
                                                    ?.trim()
                                                : slug === "webflow"
                                                  ? service.configService
                                                      .get<string>(
                                                        "WEBFLOW_CLIENT_SECRET",
                                                      )
                                                      ?.trim()
                                                  : slug === "wordpress-com"
                                                    ? service.configService
                                                        .get<string>(
                                                          "WORDPRESS_COM_CLIENT_SECRET",
                                                        )
                                                        ?.trim()
                                                    : [
                                                          "figjam",
                                                          "figma",
                                                        ].includes(slug)
                                                      ? service.configService
                                                          .get<string>(
                                                            "FIGMA_CLIENT_SECRET",
                                                          )
                                                          ?.trim()
                                                      : slug === "mindmeister"
                                                        ? service.configService
                                                            .get<string>(
                                                              "MINDMEISTER_CLIENT_SECRET",
                                                            )
                                                            ?.trim()
                                                        : [
                                                              "lucidspark",
                                                              "lucidchart",
                                                            ].includes(slug)
                                                          ? service.configService
                                                              .get<string>(
                                                                "LUCID_CLIENT_SECRET",
                                                              )
                                                              ?.trim()
                                                          : [
                                                                "microsoft-teams",
                                                                "onedrive",
                                                                "sharepoint",
                                                                "microsoft-planner",
                                                                "microsoft-to-do",
                                                                "microsoft-lists",
                                                                "onenote",
                                                                "microsoft-bookings",
                                                                "microsoft-power-bi",
                                                                "microsoft-dynamics-365",
                                                                "microsoft-viva-engage",
                                                              ].includes(slug)
                                                            ? service.configService
                                                                .get<string>(
                                                                  "MICROSOFT_CLIENT_SECRET",
                                                                )
                                                                ?.trim()
                                                            : slug ===
                                                                "frame-io"
                                                              ? service.configService
                                                                  .get<string>(
                                                                    "FRAME_IO_CLIENT_SECRET",
                                                                  )
                                                                  ?.trim()
                                                              : slug ===
                                                                  "ms-project"
                                                                ? (service.configService
                                                                    .get<string>(
                                                                      "MICROSOFT_PROJECT_CLIENT_SECRET",
                                                                    )
                                                                    ?.trim() ??
                                                                  service.configService
                                                                    .get<string>(
                                                                      "MICROSOFT_CLIENT_SECRET",
                                                                    )
                                                                    ?.trim())
                                                                : explicitClientSecret?.trim()) ||
    (slug === "jane-app"
      ? service.configService.get<string>("JANE_APP_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "dribbble"
      ? service.configService.get<string>("DRIBBBLE_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "mixcloud"
      ? service.configService.get<string>("MIXCLOUD_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "podbean"
      ? service.configService.get<string>("PODBEAN_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "deviantart"
      ? service.configService.get<string>("DEVIANTART_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "nextdoor"
      ? service.configService.get<string>("NEXTDOOR_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "zoom"
      ? service.configService.get<string>("ZOOM_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "linkedin"
      ? service.configService.get<string>("LINKEDIN_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "meetup"
      ? service.configService.get<string>("MEETUP_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "eventbrite"
      ? service.configService.get<string>("EVENTBRITE_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "shopify"
      ? service.configService.get<string>("SHOPIFY_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "stripe"
      ? service.configService
          .get<string>("STRIPE_APPS_DEVELOPER_SECRET_KEY")
          ?.trim()
      : "") ||
    (["webex", "webex-calling"].includes(slug)
      ? service.configService.get<string>("WEBEX_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "goto-meeting"
      ? service.configService.get<string>("GOTO_MEETING_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "goto-webinar"
      ? service.configService.get<string>("GOTO_WEBINAR_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "livestorm"
      ? service.configService.get<string>("LIVESTORM_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "ringcentral"
      ? service.configService.get<string>("RINGCENTRAL_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "dialpad"
      ? service.configService.get<string>("DIALPAD_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "aircall"
      ? service.configService.get<string>("AIRCALL_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "line"
      ? service.configService.get<string>("LINE_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "twist"
      ? service.configService.get<string>("TWIST_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "zoho-mail"
      ? service.configService.get<string>("ZOHO_MAIL_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "zoho-workdrive"
      ? service.configService
          .get<string>("ZOHO_WORKDRIVE_CLIENT_SECRET")
          ?.trim()
      : "") ||
    (slug === "zoho-people"
      ? service.configService.get<string>("ZOHO_PEOPLE_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "zoho-campaigns"
      ? service.configService
          .get<string>("ZOHO_CAMPAIGNS_CLIENT_SECRET")
          ?.trim()
      : "") ||
    (slug === "zoho-analytics"
      ? service.configService
          .get<string>("ZOHO_ANALYTICS_CLIENT_SECRET")
          ?.trim()
      : "")
  );
}

function resolveProviderConfiguredClientSecret(
  service: MarketplaceConnectorOAuthService,
  slug: string,
) {
  return (
    (slug === "sharefile"
      ? service.configService.get<string>("SHAREFILE_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "deputy"
      ? service.configService.get<string>("DEPUTY_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "7shifts"
      ? service.configService.get<string>("SEVEN_SHIFTS_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "resource-guru"
      ? service.configService.get<string>("RESOURCE_GURU_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "timely-time-tracking"
      ? service.configService
          .get<string>("TIMELY_TIME_TRACKING_CLIENT_SECRET")
          ?.trim()
      : "") ||
    (slug === "rescuetime"
      ? service.configService.get<string>("RESCUETIME_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "hubstaff"
      ? service.configService.get<string>("HUBSTAFF_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "pcloud"
      ? service.configService.get<string>("PCLOUD_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "slack"
      ? service.configService.get<string>("SLACK_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "github"
      ? service.configService.get<string>("GITHUB_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "gitlab"
      ? service.configService.get<string>("GITLAB_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "bitbucket"
      ? service.configService.get<string>("BITBUCKET_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "notion"
      ? service.configService.get<string>("NOTION_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "linear"
      ? service.configService.get<string>("LINEAR_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "asana"
      ? service.configService.get<string>("ASANA_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "clickup"
      ? service.configService.get<string>("CLICKUP_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "monday-com"
      ? service.configService.get<string>("MONDAY_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "airtable"
      ? service.configService.get<string>("AIRTABLE_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "reflect"
      ? service.configService.get<string>("REFLECT_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "raindrop-io"
      ? service.configService.get<string>("RAINDROP_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "freeagent"
      ? service.configService.get<string>("FREEAGENT_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "salesforce"
      ? service.configService.get<string>("SALESFORCE_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "hubspot"
      ? service.configService.get<string>("HUBSPOT_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "pipedrive"
      ? service.configService.get<string>("PIPEDRIVE_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "zoho"
      ? service.configService.get<string>("ZOHO_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "zoho-desk"
      ? service.configService.get<string>("ZOHO_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "zoho-projects"
      ? service.configService.get<string>("ZOHO_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "copper"
      ? service.configService.get<string>("COPPER_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "surveymonkey"
      ? service.configService.get<string>("SURVEYMONKEY_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "fillout"
      ? service.configService.get<string>("FILLOUT_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "mailchimp"
      ? service.configService.get<string>("MAILCHIMP_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "mailchimp-surveys"
      ? service.configService
          .get<string>("MAILCHIMP_SURVEYS_CLIENT_SECRET")
          ?.trim()
      : "") ||
    (slug === "klaviyo-sms"
      ? service.configService.get<string>("KLAVIYO_SMS_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "klaviyo"
      ? service.configService.get<string>("KLAVIYO_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "convertkit"
      ? service.configService.get<string>("CONVERTKIT_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "campaign-monitor"
      ? service.configService
          .get<string>("CAMPAIGN_MONITOR_CLIENT_SECRET")
          ?.trim()
      : "") ||
    (slug === "constant-contact"
      ? service.configService
          .get<string>("CONSTANT_CONTACT_CLIENT_SECRET")
          ?.trim()
      : "") ||
    (slug === "close"
      ? service.configService.get<string>("CLOSE_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "attio"
      ? service.configService.get<string>("ATTIO_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "zendesk-sell"
      ? service.configService.get<string>("ZENDESK_SELL_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "keap-max-classic"
      ? service.configService
          .get<string>("KEAP_MAX_CLASSIC_CLIENT_SECRET")
          ?.trim()
      : "") ||
    (slug === "zendesk"
      ? service.configService.get<string>("ZENDESK_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "intercom"
      ? service.configService.get<string>("INTERCOM_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "help-scout"
      ? service.configService.get<string>("HELP_SCOUT_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "front"
      ? service.configService.get<string>("FRONT_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "teamwork"
      ? service.configService.get<string>("TEAMWORK_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "basecamp"
      ? service.configService.get<string>("BASECAMP_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "wrike"
      ? service.configService.get<string>("WRIKE_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "smartsheet"
      ? service.configService.get<string>("SMARTSHEET_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "todoist"
      ? service.configService.get<string>("TODOIST_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "ticktick"
      ? service.configService.get<string>("TICKTICK_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "harvest"
      ? service.configService.get<string>("HARVEST_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "calendly"
      ? service.configService.get<string>("CALENDLY_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "cal-com"
      ? service.configService.get<string>("CAL_COM_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "docusign"
      ? service.configService.get<string>("DOCUSIGN_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "dropbox-sign"
      ? service.configService.get<string>("DROPBOX_SIGN_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "pandadoc"
      ? service.configService.get<string>("PANDADOC_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "typeform"
      ? service.configService.get<string>("TYPEFORM_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "sendfox"
      ? service.configService.get<string>("SENDFOX_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "beehiiv"
      ? service.configService.get<string>("BEEHIIV_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "hootsuite"
      ? service.configService.get<string>("HOOTSUITE_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "buffer"
      ? service.configService.get<string>("BUFFER_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "datadog"
      ? service.configService.get<string>("DATADOG_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "pagerduty"
      ? service.configService.get<string>("PAGERDUTY_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "cloudflare"
      ? service.configService.get<string>("CLOUDFLARE_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "vercel"
      ? service.configService.get<string>("VERCEL_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "heroku"
      ? service.configService.get<string>("HEROKU_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "digitalocean"
      ? service.configService.get<string>("DIGITALOCEAN_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "firebase"
      ? service.configService.get<string>("FIREBASE_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "supabase"
      ? service.configService.get<string>("SUPABASE_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "bamboohr"
      ? service.configService.get<string>("BAMBOOHR_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "greenhouse"
      ? service.configService.get<string>("GREENHOUSE_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "lever"
      ? service.configService.get<string>("LEVER_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "gmail"
      ? service.configService.get<string>("GMAIL_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "google-calendar"
      ? service.configService
          .get<string>("GOOGLE_CALENDAR_CLIENT_SECRET")
          ?.trim()
      : "") ||
    (slug === "threads"
      ? service.configService.get<string>("THREADS_APP_SECRET")?.trim()
      : "") ||
    (slug === "pinterest"
      ? service.configService.get<string>("PINTEREST_APP_SECRET")?.trim()
      : "") ||
    (slug === "tumblr"
      ? service.configService.get<string>("TUMBLR_CONSUMER_SECRET")?.trim()
      : "") ||
    (slug === "optimizely"
      ? service.configService.get<string>("OPTIMIZELY_CLIENT_SECRET")?.trim()
      : "") ||
    (slug === "nationbuilder"
      ? service.configService.get<string>("NATIONBUILDER_CLIENT_SECRET")?.trim()
      : "")
  );
}

export function resolveOAuthStartClientSecret(
  service: MarketplaceConnectorOAuthService,
  {
    slug,
    explicitClientSecret,
    mastodonClientSecret,
    googleClientSecret,
    boxClientSecret,
    dropboxClientSecret,
    restreamClientSecret,
    storedClientSecret,
  }: OAuthStartClientSecretInput,
): string | undefined {
  return (
    service.resolveBatch23OAuthClientSecret(slug) ||
    mastodonClientSecret ||
    googleClientSecret ||
    boxClientSecret ||
    dropboxClientSecret ||
    restreamClientSecret ||
    resolvePrimaryConfiguredClientSecret(service, slug, explicitClientSecret) ||
    resolveProviderConfiguredClientSecret(service, slug) ||
    service.stringOrNull(storedClientSecret)
  );
}
