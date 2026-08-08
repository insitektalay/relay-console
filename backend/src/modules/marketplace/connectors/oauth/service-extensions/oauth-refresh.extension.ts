import { MarketplaceConnectionEntity } from "../../../../../entities";
import { COGNITO_FORMS_MCP_RESOURCE } from "../../cognito-forms/cognito-forms-mcp.adapter";
import { JOTFORM_MCP_RESOURCE } from "../../jotform/jotform-mcp.adapter";
import { CRAFT_MCP_RESOURCE } from "../../craft/craft-mcp.adapter";
import { RELAY_GOOGLE_OAUTH_SLUGS } from "../google-oauth-providers";
import type {
  MarketplaceConnectorOAuthService,
  OAuthAccessTokenResult,
} from "../../connector-oauth.service";

async function runOAuthRefreshPhase1(
  service: MarketplaceConnectorOAuthService,
  context: { connection: MarketplaceConnectionEntity },
) {
  const manifest = service.requireOAuthManifest(context.connection.appSlug);
  const credentials = service.credentials.decrypt(context.connection);
  const refreshToken = service.stringOrNull(credentials.refreshToken);
  if (!refreshToken) throw new Error("token_refresh_failed");
  const dropboxRefreshClientSecret =
    manifest.slug === "dropbox"
      ? service.configService.get<string>("DROPBOX_CLIENT_SECRET")?.trim()
      : null;
  const boxRefreshClientSecret =
    manifest.slug === "box"
      ? service.configService.get<string>("BOX_CLIENT_SECRET")?.trim()
      : null;
  const googleRefreshClientSecret = RELAY_GOOGLE_OAUTH_SLUGS.has(manifest.slug)
    ? service.configService.get<string>("GOOGLE_OAUTH_CLIENT_SECRET")?.trim()
    : null;
  const signNowRefreshClientSecret =
    manifest.slug === "signnow"
      ? service.configService.get<string>("SIGNNOW_CLIENT_SECRET")?.trim()
      : null;
  const signRequestRefreshClientSecret =
    manifest.slug === "signrequest"
      ? service.configService.get<string>("SIGNREQUEST_CLIENT_SECRET")?.trim()
      : null;
  const signeasyRefreshClientSecret =
    manifest.slug === "signeasy"
      ? service.configService.get<string>("SIGNEASY_CLIENT_SECRET")?.trim()
      : null;
  const rightSignatureRefreshClientSecret =
    manifest.slug === "rightsignature"
      ? service.configService
          .get<string>("RIGHTSIGNATURE_CLIENT_SECRET")
          ?.trim()
      : null;
  return {
    ...context,
    manifest,
    credentials,
    refreshToken,
    dropboxRefreshClientSecret,
    boxRefreshClientSecret,
    googleRefreshClientSecret,
    signNowRefreshClientSecret,
    signRequestRefreshClientSecret,
    signeasyRefreshClientSecret,
    rightSignatureRefreshClientSecret,
  };
}

async function runOAuthRefreshPhase2(
  service: MarketplaceConnectorOAuthService,
  context: Awaited<ReturnType<typeof runOAuthRefreshPhase1>>,
) {
  const providerRefreshClientSecret =
    context.manifest.slug === "adobe-acrobat-sign"
      ? service.configService
          .get<string>("ADOBE_ACROBAT_SIGN_CLIENT_SECRET")
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
          ].includes(context.manifest.slug)
        ? service.configService.get<string>("MICROSOFT_CLIENT_SECRET")?.trim()
        : context.manifest.slug === "zoom"
          ? service.configService.get<string>("ZOOM_CLIENT_SECRET")?.trim()
          : context.manifest.slug === "linkedin"
            ? service.configService
                .get<string>("LINKEDIN_CLIENT_SECRET")
                ?.trim()
            : context.manifest.slug === "shopify"
              ? service.configService
                  .get<string>("SHOPIFY_CLIENT_SECRET")
                  ?.trim()
              : context.manifest.slug === "stripe"
                ? service.configService
                    .get<string>("STRIPE_APPS_DEVELOPER_SECRET_KEY")
                    ?.trim()
                : context.manifest.slug === "quickbooks"
                  ? service.configService
                      .get<string>("QUICKBOOKS_CLIENT_SECRET")
                      ?.trim()
                  : context.manifest.slug === "freshbooks"
                    ? service.configService
                        .get<string>("FRESHBOOKS_CLIENT_SECRET")
                        ?.trim()
                    : context.manifest.slug === "wave"
                      ? service.configService
                          .get<string>("WAVE_CLIENT_SECRET")
                          ?.trim()
                      : context.manifest.slug === "freeagent"
                        ? service.configService
                            .get<string>("FREEAGENT_CLIENT_SECRET")
                            ?.trim()
                        : context.manifest.slug === "salesforce"
                          ? service.configService
                              .get<string>("SALESFORCE_CLIENT_SECRET")
                              ?.trim()
                          : context.manifest.slug === "hubspot"
                            ? service.configService
                                .get<string>("HUBSPOT_CLIENT_SECRET")
                                ?.trim()
                            : context.manifest.slug === "pipedrive"
                              ? service.configService
                                  .get<string>("PIPEDRIVE_CLIENT_SECRET")
                                  ?.trim()
                              : context.manifest.slug === "zoho"
                                ? service.configService
                                    .get<string>("ZOHO_CLIENT_SECRET")
                                    ?.trim()
                                : context.manifest.slug === "close"
                                  ? service.configService
                                      .get<string>("CLOSE_CLIENT_SECRET")
                                      ?.trim()
                                  : context.manifest.slug === "klaviyo"
                                    ? service.configService
                                        .get<string>("KLAVIYO_CLIENT_SECRET")
                                        ?.trim()
                                    : context.manifest.slug === "convertkit"
                                      ? service.configService
                                          .get<string>(
                                            "CONVERTKIT_CLIENT_SECRET",
                                          )
                                          ?.trim()
                                      : context.manifest.slug ===
                                          "campaign-monitor"
                                        ? service.configService
                                            .get<string>(
                                              "CAMPAIGN_MONITOR_CLIENT_SECRET",
                                            )
                                            ?.trim()
                                        : context.manifest.slug ===
                                            "constant-contact"
                                          ? service.configService
                                              .get<string>(
                                                "CONSTANT_CONTACT_CLIENT_SECRET",
                                              )
                                              ?.trim()
                                          : context.manifest.slug === "zendesk"
                                            ? service.configService
                                                .get<string>(
                                                  "ZENDESK_CLIENT_SECRET",
                                                )
                                                ?.trim()
                                            : context.manifest.slug ===
                                                "help-scout"
                                              ? service.configService
                                                  .get<string>(
                                                    "HELP_SCOUT_CLIENT_SECRET",
                                                  )
                                                  ?.trim()
                                              : context.manifest.slug ===
                                                  "front"
                                                ? service.configService
                                                    .get<string>(
                                                      "FRONT_CLIENT_SECRET",
                                                    )
                                                    ?.trim()
                                                : context.manifest.slug ===
                                                    "basecamp"
                                                  ? service.configService
                                                      .get<string>(
                                                        "BASECAMP_CLIENT_SECRET",
                                                      )
                                                      ?.trim()
                                                  : context.manifest.slug ===
                                                      "wrike"
                                                    ? service.configService
                                                        .get<string>(
                                                          "WRIKE_CLIENT_SECRET",
                                                        )
                                                        ?.trim()
                                                    : context.manifest.slug ===
                                                        "smartsheet"
                                                      ? service.configService
                                                          .get<string>(
                                                            "SMARTSHEET_CLIENT_SECRET",
                                                          )
                                                          ?.trim()
                                                      : context.manifest
                                                            .slug === "todoist"
                                                        ? service.configService
                                                            .get<string>(
                                                              "TODOIST_CLIENT_SECRET",
                                                            )
                                                            ?.trim()
                                                        : context.manifest
                                                              .slug ===
                                                            "harvest"
                                                          ? service.configService
                                                              .get<string>(
                                                                "HARVEST_CLIENT_SECRET",
                                                              )
                                                              ?.trim()
                                                          : context.manifest
                                                                .slug ===
                                                              "calendly"
                                                            ? service.configService
                                                                .get<string>(
                                                                  "CALENDLY_CLIENT_SECRET",
                                                                )
                                                                ?.trim()
                                                            : context.manifest
                                                                  .slug ===
                                                                "cal-com"
                                                              ? service.configService
                                                                  .get<string>(
                                                                    "CAL_COM_CLIENT_SECRET",
                                                                  )
                                                                  ?.trim()
                                                              : context.manifest
                                                                    .slug ===
                                                                  "docusign"
                                                                ? service.configService
                                                                    .get<string>(
                                                                      "DOCUSIGN_CLIENT_SECRET",
                                                                    )
                                                                    ?.trim()
                                                                : context
                                                                      .manifest
                                                                      .slug ===
                                                                    "dropbox-sign"
                                                                  ? service.configService
                                                                      .get<string>(
                                                                        "DROPBOX_SIGN_CLIENT_SECRET",
                                                                      )
                                                                      ?.trim()
                                                                  : context
                                                                        .manifest
                                                                        .slug ===
                                                                      "pandadoc"
                                                                    ? service.configService
                                                                        .get<string>(
                                                                          "PANDADOC_CLIENT_SECRET",
                                                                        )
                                                                        ?.trim()
                                                                    : context
                                                                          .manifest
                                                                          .slug ===
                                                                        "typeform"
                                                                      ? service.configService
                                                                          .get<string>(
                                                                            "TYPEFORM_CLIENT_SECRET",
                                                                          )
                                                                          ?.trim()
                                                                      : context
                                                                            .manifest
                                                                            .slug ===
                                                                          "sharefile"
                                                                        ? service.configService
                                                                            .get<string>(
                                                                              "SHAREFILE_CLIENT_SECRET",
                                                                            )
                                                                            ?.trim()
                                                                        : context
                                                                              .manifest
                                                                              .slug ===
                                                                            "deputy"
                                                                          ? service.configService
                                                                              .get<string>(
                                                                                "DEPUTY_CLIENT_SECRET",
                                                                              )
                                                                              ?.trim()
                                                                          : context
                                                                                .manifest
                                                                                .slug ===
                                                                              "resource-guru"
                                                                            ? service.configService
                                                                                .get<string>(
                                                                                  "RESOURCE_GURU_CLIENT_SECRET",
                                                                                )
                                                                                ?.trim()
                                                                            : context
                                                                                  .manifest
                                                                                  .slug ===
                                                                                "timely-time-tracking"
                                                                              ? service.configService
                                                                                  .get<string>(
                                                                                    "TIMELY_TIME_TRACKING_CLIENT_SECRET",
                                                                                  )
                                                                                  ?.trim()
                                                                              : context
                                                                                    .manifest
                                                                                    .slug ===
                                                                                  "hubstaff"
                                                                                ? service.configService
                                                                                    .get<string>(
                                                                                      "HUBSTAFF_CLIENT_SECRET",
                                                                                    )
                                                                                    ?.trim()
                                                                                : context
                                                                                      .manifest
                                                                                      .slug ===
                                                                                    "zoho-workdrive"
                                                                                  ? service.configService
                                                                                      .get<string>(
                                                                                        "ZOHO_WORKDRIVE_CLIENT_SECRET",
                                                                                      )
                                                                                      ?.trim()
                                                                                  : context
                                                                                        .manifest
                                                                                        .slug ===
                                                                                      "dropbox-paper"
                                                                                    ? service.configService
                                                                                        .get<string>(
                                                                                          "DROPBOX_PAPER_CLIENT_SECRET",
                                                                                        )
                                                                                        ?.trim()
                                                                                    : context
                                                                                          .manifest
                                                                                          .slug ===
                                                                                        "inoreader"
                                                                                      ? service.configService
                                                                                          .get<string>(
                                                                                            "INOREADER_CLIENT_SECRET",
                                                                                          )
                                                                                          ?.trim()
                                                                                      : context
                                                                                            .manifest
                                                                                            .slug ===
                                                                                          "guru"
                                                                                        ? service.configService
                                                                                            .get<string>(
                                                                                              "GURU_CLIENT_SECRET",
                                                                                            )
                                                                                            ?.trim()
                                                                                        : context
                                                                                              .manifest
                                                                                              .slug ===
                                                                                            "vimeo"
                                                                                          ? service.configService
                                                                                              .get<string>(
                                                                                                "VIMEO_CLIENT_SECRET",
                                                                                              )
                                                                                              ?.trim()
                                                                                          : context
                                                                                                .manifest
                                                                                                .slug ===
                                                                                              "wistia"
                                                                                            ? service.configService
                                                                                                .get<string>(
                                                                                                  "WISTIA_CLIENT_SECRET",
                                                                                                )
                                                                                                ?.trim()
                                                                                            : context
                                                                                                  .manifest
                                                                                                  .slug ===
                                                                                                "mural"
                                                                                              ? service.configService
                                                                                                  .get<string>(
                                                                                                    "MURAL_CLIENT_SECRET",
                                                                                                  )
                                                                                                  ?.trim()
                                                                                              : context
                                                                                                    .manifest
                                                                                                    .slug ===
                                                                                                  "miro"
                                                                                                ? service.configService
                                                                                                    .get<string>(
                                                                                                      "MIRO_CLIENT_SECRET",
                                                                                                    )
                                                                                                    ?.trim()
                                                                                                : context
                                                                                                      .manifest
                                                                                                      .slug ===
                                                                                                    "canva"
                                                                                                  ? service.configService
                                                                                                      .get<string>(
                                                                                                        "CANVA_CLIENT_SECRET",
                                                                                                      )
                                                                                                      ?.trim()
                                                                                                  : [
                                                                                                        "figjam",
                                                                                                        "figma",
                                                                                                      ].includes(
                                                                                                        context
                                                                                                          .manifest
                                                                                                          .slug,
                                                                                                      )
                                                                                                    ? service.configService
                                                                                                        .get<string>(
                                                                                                          "FIGMA_CLIENT_SECRET",
                                                                                                        )
                                                                                                        ?.trim()
                                                                                                    : [
                                                                                                          "lucidspark",
                                                                                                          "lucidchart",
                                                                                                        ].includes(
                                                                                                          context
                                                                                                            .manifest
                                                                                                            .slug,
                                                                                                        )
                                                                                                      ? service.configService
                                                                                                          .get<string>(
                                                                                                            "LUCID_CLIENT_SECRET",
                                                                                                          )
                                                                                                          ?.trim()
                                                                                                      : context
                                                                                                            .manifest
                                                                                                            .slug ===
                                                                                                          "frame-io"
                                                                                                        ? service.configService
                                                                                                            .get<string>(
                                                                                                              "FRAME_IO_CLIENT_SECRET",
                                                                                                            )
                                                                                                            ?.trim()
                                                                                                        : context
                                                                                                              .manifest
                                                                                                              .slug ===
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
                                                                                                          : context
                                                                                                                .manifest
                                                                                                                .slug ===
                                                                                                              "jira"
                                                                                                            ? service.configService
                                                                                                                .get<string>(
                                                                                                                  "JIRA_CLIENT_SECRET",
                                                                                                                )
                                                                                                                ?.trim()
                                                                                                            : context
                                                                                                                  .manifest
                                                                                                                  .slug ===
                                                                                                                "jira-service-management"
                                                                                                              ? service.configService
                                                                                                                  .get<string>(
                                                                                                                    "JIRA_SERVICE_MANAGEMENT_CLIENT_SECRET",
                                                                                                                  )
                                                                                                                  ?.trim()
                                                                                                              : context
                                                                                                                    .manifest
                                                                                                                    .slug ===
                                                                                                                  "atlassian-compass"
                                                                                                                ? service.configService
                                                                                                                    .get<string>(
                                                                                                                      "ATLASSIAN_COMPASS_CLIENT_SECRET",
                                                                                                                    )
                                                                                                                    ?.trim()
                                                                                                                : context
                                                                                                                      .manifest
                                                                                                                      .slug ===
                                                                                                                    "productboard"
                                                                                                                  ? service.configService
                                                                                                                      .get<string>(
                                                                                                                        "PRODUCTBOARD_CLIENT_SECRET",
                                                                                                                      )
                                                                                                                      ?.trim()
                                                                                                                  : context
                                                                                                                        .manifest
                                                                                                                        .slug ===
                                                                                                                      "nifty"
                                                                                                                    ? service.configService
                                                                                                                        .get<string>(
                                                                                                                          "NIFTY_CLIENT_SECRET",
                                                                                                                        )
                                                                                                                        ?.trim()
                                                                                                                    : context
                                                                                                                          .manifest
                                                                                                                          .slug ===
                                                                                                                        "any-do"
                                                                                                                      ? service.configService
                                                                                                                          .get<string>(
                                                                                                                            "ANY_DO_CLIENT_SECRET",
                                                                                                                          )
                                                                                                                          ?.trim()
                                                                                                                      : context
                                                                                                                            .manifest
                                                                                                                            .slug ===
                                                                                                                          "remember-the-milk"
                                                                                                                        ? service.configService
                                                                                                                            .get<string>(
                                                                                                                              "REMEMBER_THE_MILK_CLIENT_SECRET",
                                                                                                                            )
                                                                                                                            ?.trim()
                                                                                                                        : context
                                                                                                                              .manifest
                                                                                                                              .slug ===
                                                                                                                            "jane-app"
                                                                                                                          ? service.configService
                                                                                                                              .get<string>(
                                                                                                                                "JANE_APP_CLIENT_SECRET",
                                                                                                                              )
                                                                                                                              ?.trim()
                                                                                                                          : service.stringOrNull(
                                                                                                                              context
                                                                                                                                .credentials
                                                                                                                                .clientSecret,
                                                                                                                            );
  const batch6RefreshClientSecret =
    context.manifest.slug === "pinterest"
      ? service.configService.get<string>("PINTEREST_APP_SECRET")?.trim()
      : context.manifest.slug === "tumblr"
        ? service.configService.get<string>("TUMBLR_CONSUMER_SECRET")?.trim()
        : null;
  return {
    ...context,
    providerRefreshClientSecret,
    batch6RefreshClientSecret,
  };
}

async function runOAuthRefreshPhase3(
  service: MarketplaceConnectorOAuthService,
  context: Awaited<ReturnType<typeof runOAuthRefreshPhase2>>,
) {
  const refreshClientSecret =
    context.batch6RefreshClientSecret ??
    context.googleRefreshClientSecret ??
    context.boxRefreshClientSecret ??
    context.dropboxRefreshClientSecret ??
    context.signNowRefreshClientSecret ??
    context.signRequestRefreshClientSecret ??
    context.signeasyRefreshClientSecret ??
    context.rightSignatureRefreshClientSecret ??
    context.providerRefreshClientSecret ??
    (context.manifest.slug === "zoho-projects"
      ? service.configService.get<string>("ZOHO_CLIENT_SECRET")?.trim()
      : null);
  if (context.manifest.slug === "adobe-acrobat-sign" && !refreshClientSecret)
    throw new Error("token_refresh_failed");
  if (context.manifest.slug === "signnow" && !refreshClientSecret)
    throw new Error("token_refresh_failed");
  if (context.manifest.slug === "signrequest" && !refreshClientSecret)
    throw new Error("token_refresh_failed");
  if (context.manifest.slug === "signeasy" && !refreshClientSecret)
    throw new Error("token_refresh_failed");
  if (context.manifest.slug === "rightsignature" && !refreshClientSecret)
    throw new Error("token_refresh_failed");
  if (context.manifest.slug === "pipedrive" && !refreshClientSecret)
    throw new Error("token_refresh_failed");
  if (context.manifest.slug === "zoho" && !refreshClientSecret)
    throw new Error("token_refresh_failed");
  if (context.manifest.slug === "zoho-desk" && !refreshClientSecret)
    throw new Error("token_refresh_failed");
  if (context.manifest.slug === "zoho-projects" && !refreshClientSecret)
    throw new Error("token_refresh_failed");
  if (context.manifest.slug === "close" && !refreshClientSecret)
    throw new Error("token_refresh_failed");
  if (context.manifest.slug === "klaviyo" && !refreshClientSecret)
    throw new Error("token_refresh_failed");
  if (context.manifest.slug === "klaviyo-sms" && !refreshClientSecret)
    throw new Error("token_refresh_failed");
  if (context.manifest.slug === "convertkit" && !refreshClientSecret)
    throw new Error("token_refresh_failed");
  if (context.manifest.slug === "campaign-monitor" && !refreshClientSecret)
    throw new Error("token_refresh_failed");
  if (context.manifest.slug === "constant-contact" && !refreshClientSecret)
    throw new Error("token_refresh_failed");
  if (context.manifest.slug === "zendesk" && !refreshClientSecret)
    throw new Error("token_refresh_failed");
  if (context.manifest.slug === "zoom" && !refreshClientSecret)
    throw new Error("token_refresh_failed");
  if (context.manifest.slug === "help-scout" && !refreshClientSecret)
    throw new Error("token_refresh_failed");
  if (context.manifest.slug === "front" && !refreshClientSecret)
    throw new Error("token_refresh_failed");
  if (context.manifest.slug === "basecamp" && !refreshClientSecret)
    throw new Error("token_refresh_failed");
  if (context.manifest.slug === "wrike" && !refreshClientSecret)
    throw new Error("token_refresh_failed");
  if (context.manifest.slug === "smartsheet" && !refreshClientSecret)
    throw new Error("token_refresh_failed");
  if (context.manifest.slug === "todoist" && !refreshClientSecret)
    throw new Error("token_refresh_failed");
  if (context.manifest.slug === "harvest" && !refreshClientSecret)
    throw new Error("token_refresh_failed");
  if (context.manifest.slug === "calendly" && !refreshClientSecret)
    throw new Error("token_refresh_failed");
  if (context.manifest.slug === "cal-com" && !refreshClientSecret)
    throw new Error("token_refresh_failed");
  if (context.manifest.slug === "docusign" && !refreshClientSecret)
    throw new Error("token_refresh_failed");
  if (context.manifest.slug === "dropbox-sign" && !refreshClientSecret)
    throw new Error("token_refresh_failed");
  if (context.manifest.slug === "pandadoc" && !refreshClientSecret)
    throw new Error("token_refresh_failed");
  if (context.manifest.slug === "typeform" && !refreshClientSecret)
    throw new Error("token_refresh_failed");
  if (context.manifest.slug === "pinterest" && !refreshClientSecret)
    throw new Error("token_refresh_failed");
  if (context.manifest.slug === "tumblr" && !refreshClientSecret)
    throw new Error("token_refresh_failed");
  if (context.manifest.slug === "buffer" && !refreshClientSecret)
    throw new Error("token_refresh_failed");
  const token = await service.exchangeToken(
    context.manifest.slug,
    {
      grant_type: "refresh_token",
      refresh_token: context.refreshToken,
      client_id: String(
        context.credentials.clientId ??
          context.connection.metadata?.clientId ??
          "",
      ),
      ...(refreshClientSecret ? { client_secret: refreshClientSecret } : {}),
      ...(context.manifest.slug === "zendesk"
        ? {
            expires_in: "1800",
            refresh_token_expires_in: "2592000",
          }
        : {}),
      ...(context.manifest.slug === "deputy"
        ? {
            redirect_uri: service.getCallbackUrl("deputy"),
            scope: "longlife_refresh_token",
          }
        : {}),
      ...(context.manifest.slug === "shootproof" ? { scope: "studio" } : {}),
      ...([
        "slite",
        "otter-ai",
        "fireflies-ai",
        "bonsai",
        "fathom",
        "grain",
        "whimsical",
        "cognito-forms",
        "jotform",
        "craft",
        "xmind",
        "adobe-analytics",
        "cloudinary",
        "remember-the-milk",
        "jane-app",
      ].includes(context.manifest.slug)
        ? {
            resource:
              context.manifest.slug === "otter-ai"
                ? "https://mcp.otter.ai/"
                : context.manifest.slug === "fireflies-ai"
                  ? "https://api.fireflies.ai/mcp"
                  : context.manifest.slug === "bonsai"
                    ? "https://mcp.hellobonsai.com"
                    : context.manifest.slug === "fathom"
                      ? "https://api.fathom.ai/mcp"
                      : context.manifest.slug === "grain"
                        ? "https://api.grain.com"
                        : context.manifest.slug === "whimsical"
                          ? "https://mcp.whimsical.com"
                          : context.manifest.slug === "cognito-forms"
                            ? COGNITO_FORMS_MCP_RESOURCE
                            : context.manifest.slug === "jotform"
                              ? JOTFORM_MCP_RESOURCE
                              : context.manifest.slug === "craft"
                                ? CRAFT_MCP_RESOURCE
                                : context.manifest.slug === "xmind"
                                  ? "https://app.xmind.com/api/mcp"
                                  : context.manifest.slug === "cloudinary"
                                    ? "https://asset-management.mcp.cloudinary.com"
                                    : context.manifest.slug ===
                                        "remember-the-milk"
                                      ? "https://www.rememberthemilk.com/mcp"
                                      : context.manifest.slug === "jane-app"
                                        ? service.normalizeJaneClinicOrigin(
                                            service.stringOrNull(
                                              context.credentials
                                                .janeClinicOrigin,
                                            ) ?? "",
                                          )
                                        : "https://api.slite.com/mcp",
          }
        : {}),
    },
    service.connectionAuthority(context.manifest.slug, context.connection),
  );
  if (context.manifest.slug === "tumblr" && !token.refresh_token)
    throw new Error("token_refresh_failed");
  if (context.manifest.slug === "meetup" && !token.refresh_token)
    throw new Error("token_refresh_failed");
  if (!token.access_token) throw new Error("token_refresh_failed");
  if (
    context.manifest.slug === "digitalocean" &&
    (!token.refresh_token ||
      service.stringOrNull(token.info?.team_uuid) !==
        service.stringOrNull(context.credentials.DIGITALOCEAN_TEAM_ID))
  )
    throw new Error("token_refresh_failed");
  if (context.manifest.slug === "audius" && !token.refresh_token)
    throw new Error("token_refresh_failed");
  if (context.manifest.slug === "monday-com" && !token.refresh_token)
    throw new Error("token_refresh_failed");
  if (context.manifest.slug === "airtable" && !token.refresh_token)
    throw new Error("token_refresh_failed");
  if (context.manifest.slug === "supabase" && !token.refresh_token)
    throw new Error("token_refresh_failed");
  if (context.manifest.slug === "bamboohr" && !token.refresh_token)
    throw new Error("token_refresh_failed");
  if (context.manifest.slug === "greenhouse" && !token.refresh_token)
    throw new Error("token_refresh_failed");
  if (context.manifest.slug === "lever" && !token.refresh_token)
    throw new Error("token_refresh_failed");
  if (context.manifest.slug === "shopify" && !token.refresh_token)
    throw new Error("token_refresh_failed");
  if (context.manifest.slug === "xero" && !token.refresh_token)
    throw new Error("token_refresh_failed");
  if (context.manifest.slug === "sentry" && !token.refresh_token)
    throw new Error("token_refresh_failed");
  if (context.manifest.slug === "quickbooks" && !token.refresh_token)
    throw new Error("token_refresh_failed");
  if (context.manifest.slug === "freshbooks" && !token.refresh_token)
    throw new Error("token_refresh_failed");
  if (context.manifest.slug === "sage-accounting" && !token.refresh_token)
    throw new Error("token_refresh_failed");
  if (context.manifest.slug === "myob" && !token.refresh_token)
    throw new Error("token_refresh_failed");
  if (context.manifest.slug === "zoho-people" && !token.api_domain)
    throw new Error("token_refresh_failed");
  if (context.manifest.slug === "zoho-campaigns" && !token.api_domain)
    throw new Error("token_refresh_failed");
  if (context.manifest.slug === "zoho-analytics" && !token.api_domain)
    throw new Error("token_refresh_failed");
  if (
    context.manifest.slug === "stripe" &&
    (!token.refresh_token || !token.expires_in || !token.account_id)
  )
    throw new Error("token_refresh_failed");
  if (context.manifest.slug === "canva" && !token.refresh_token)
    throw new Error("token_refresh_failed");
  if (
    context.manifest.slug === "monday-com" &&
    !token.expires_in &&
    !token.expires_at
  ) {
    const expiresAt = service.jwtExpiry(token.access_token);
    if (!expiresAt) throw new Error("token_refresh_failed");
    token.expires_at = expiresAt;
  }
  if (context.manifest.slug === "ringcentral" && !token.refresh_token)
    throw new Error("token_refresh_failed");
  if (
    context.manifest.slug === "restream" &&
    (!token.refresh_token || !token.expires_in)
  )
    throw new Error("token_refresh_failed");
  if (context.manifest.slug === "dialpad" && !token.refresh_token)
    throw new Error("token_refresh_failed");
  if (context.manifest.slug === "line" && !token.refresh_token)
    throw new Error("token_refresh_failed");
  if (context.manifest.slug === "productboard" && !token.refresh_token)
    throw new Error("token_refresh_failed");
  if (context.manifest.slug === "nifty" && !token.refresh_token)
    throw new Error("token_refresh_failed");
  if (context.manifest.slug === "square-appointments" && !token.refresh_token)
    throw new Error("token_refresh_failed");
  if (context.manifest.slug === "jane-app" && !token.refresh_token)
    throw new Error("token_refresh_failed");
  if (context.manifest.slug === "deputy" && !token.refresh_token)
    throw new Error("token_refresh_failed");
  if (context.manifest.slug === "resource-guru" && !token.refresh_token)
    throw new Error("token_refresh_failed");
  if (context.manifest.slug === "timely-time-tracking" && !token.refresh_token)
    throw new Error("token_refresh_failed");
  if (context.manifest.slug === "hubstaff" && !token.refresh_token)
    throw new Error("token_refresh_failed");
  if (context.manifest.slug === "bitbucket" && !token.refresh_token)
    throw new Error("token_refresh_failed");
  if (context.manifest.slug === "notion" && !token.refresh_token)
    throw new Error("token_refresh_failed");
  if (context.manifest.slug === "linear" && !token.refresh_token)
    throw new Error("token_refresh_failed");
  if (
    ["klaviyo", "klaviyo-sms"].includes(context.manifest.slug) &&
    !token.refresh_token
  )
    throw new Error("token_refresh_failed");
  if (
    context.manifest.slug === "convertkit" &&
    (!token.refresh_token || !token.expires_in || token.scope !== "public")
  )
    throw new Error("token_refresh_failed");
  if (
    context.manifest.slug === "campaign-monitor" &&
    (!token.refresh_token || token.expires_in !== 1_209_600)
  )
    throw new Error("token_refresh_failed");
  if (
    context.manifest.slug === "constant-contact" &&
    (!token.refresh_token || token.expires_in !== 86_400)
  )
    throw new Error("token_refresh_failed");
  if (
    context.manifest.slug === "pipedrive" &&
    (!token.refresh_token || !token.api_domain)
  )
    throw new Error("token_refresh_failed");
  if (context.manifest.slug === "zoho" && !token.api_domain)
    throw new Error("token_refresh_failed");
  if (context.manifest.slug === "zoho-desk" && !token.api_domain)
    throw new Error("token_refresh_failed");
  if (context.manifest.slug === "zoho-projects" && !token.api_domain)
    throw new Error("token_refresh_failed");
  if (context.manifest.slug === "zoho-projects") {
    const refreshed = service.zohoCrmAuthorityFromToken(
      token,
      service.connectionAuthority(context.manifest.slug, context.connection)
        .authorizationUrl,
    );
    if (
      refreshed.accountsOrigin !==
        context.connection.metadata?.zohoAccountsOrigin ||
      refreshed.apiOrigin !== context.connection.metadata?.zohoProjectsApiOrigin
    )
      throw new Error("token_refresh_failed");
  }
  if (context.manifest.slug === "zoho-books" && !token.api_domain)
    throw new Error("token_refresh_failed");
  if (context.manifest.slug === "zoho-invoice" && !token.api_domain)
    throw new Error("token_refresh_failed");
  if (context.manifest.slug === "zoho-expense" && !token.api_domain)
    throw new Error("token_refresh_failed");
  if (
    context.manifest.slug === "close" &&
    (!token.refresh_token ||
      !token.expires_in ||
      !/^orga_[A-Za-z0-9]+$/.test(
        service.stringOrNull(token.organization_id) ?? "",
      ) ||
      !/^user_[A-Za-z0-9]+$/.test(service.stringOrNull(token.user_id) ?? ""))
  )
    throw new Error("token_refresh_failed");
  if (
    context.manifest.slug === "zendesk" &&
    (!token.expires_in || !token.refresh_token_expires_in)
  )
    throw new Error("token_refresh_failed");
  if (
    context.manifest.slug === "help-scout" &&
    (!token.expires_in || !token.refresh_token)
  )
    throw new Error("token_refresh_failed");
  if (
    context.manifest.slug === "front" &&
    (!token.expires_in || !token.refresh_token)
  )
    throw new Error("token_refresh_failed");
  if (
    context.manifest.slug === "basecamp" &&
    (!token.expires_in || !token.refresh_token)
  )
    throw new Error("token_refresh_failed");
  if (
    context.manifest.slug === "wrike" &&
    (!token.expires_in || !token.refresh_token)
  )
    throw new Error("token_refresh_failed");
  if (
    context.manifest.slug === "smartsheet" &&
    (!token.expires_in || !token.refresh_token)
  )
    throw new Error("token_refresh_failed");
  // Todoist rotates refresh tokens. A retry inside its grace window may omit
  // refresh_token while returning the same replacement access token, so retain
  // the already stored token and require only the new access-token expiry here.
  if (context.manifest.slug === "todoist" && !token.expires_in)
    throw new Error("token_refresh_failed");
  if (
    context.manifest.slug === "harvest" &&
    (!token.expires_in || !token.refresh_token)
  )
    throw new Error("token_refresh_failed");
  if (context.manifest.slug === "calendly" && !token.refresh_token)
    throw new Error("token_refresh_failed");
  if (
    context.manifest.slug === "cal-com" &&
    (!token.refresh_token || token.expires_in !== 1_800)
  )
    throw new Error("token_refresh_failed");
  if (
    context.manifest.slug === "docusign" &&
    (!token.refresh_token || token.expires_in !== 28_800)
  )
    throw new Error("token_refresh_failed");
  if (
    context.manifest.slug === "dropbox-sign" &&
    (!token.refresh_token || !token.expires_in)
  )
    throw new Error("token_refresh_failed");
  if (
    context.manifest.slug === "pandadoc" &&
    (!token.refresh_token || token.expires_in !== 31_535_999)
  )
    throw new Error("token_refresh_failed");
  if (
    context.manifest.slug === "typeform" &&
    (!token.refresh_token || !token.expires_in)
  )
    throw new Error("token_refresh_failed");
  if (
    context.manifest.slug === "buffer" &&
    (!token.refresh_token || token.expires_in !== 3_600)
  )
    throw new Error("token_refresh_failed");
  if (
    context.manifest.slug === "clio-grow" &&
    (!token.refresh_token || token.expires_in !== 86_400)
  )
    throw new Error("token_refresh_failed");
  if (context.manifest.slug === "practicepanther" && !token.refresh_token)
    throw new Error("token_refresh_failed");
  if (context.manifest.slug === "smokeball" && token.expires_in !== 3_600)
    throw new Error("token_refresh_failed");
  if (context.manifest.slug === "filevine" && !token.refresh_token)
    throw new Error("token_refresh_failed");
  const wrikeRefreshHost = service.stringOrNull(
    (token as unknown as Record<string, unknown>).host,
  );
  return {
    ...context,
    refreshClientSecret,
    token,
    wrikeRefreshHost,
  };
}

async function runOAuthRefreshPhase4(
  service: MarketplaceConnectorOAuthService,
  context: Awaited<ReturnType<typeof runOAuthRefreshPhase3>>,
) {
  if (context.manifest.slug === "wrike" && context.wrikeRefreshHost) {
    const expectedHost = service.normalizeWrikeHost(
      service.stringOrNull(context.connection.metadata?.wrikeProviderHost) ??
        "",
    );
    if (service.normalizeWrikeHost(context.wrikeRefreshHost) !== expectedHost)
      throw new Error("token_refresh_failed");
  }
  if (context.manifest.slug === "deputy" && context.token.endpoint) {
    const expected = service.deputyAuthority(
      service.stringOrNull(context.connection.metadata?.deputyApiOrigin) ?? "",
    ).apiOrigin;
    if (
      service.deputyAuthority(context.token.endpoint).apiOrigin !== expected
    ) {
      throw new Error("token_refresh_failed");
    }
  }
  if (
    context.manifest.slug === "stripe" &&
    (service.stringOrNull(context.token.account_id) !==
      service.stringOrNull(context.connection.metadata?.stripeAccountId) ||
      (typeof context.token.livemode === "boolean" &&
        context.token.livemode !== context.connection.metadata?.stripeLivemode))
  ) {
    throw new Error("token_refresh_failed");
  }
  const grantedScopes =
    context.manifest.slug === "stripe"
      ? service.stringArray(context.credentials.grantedScopes)
      : service.normalizeScopeString(context.token.scope) ||
        service.stringArray(context.credentials.grantedScopes);
  if (
    context.manifest.slug === "klaviyo" &&
    (grantedScopes.length !== 3 ||
      !["accounts:read", "lists:read", "campaigns:read"].every((scope) =>
        grantedScopes.includes(scope),
      ))
  )
    throw new Error("token_refresh_failed");
  if (
    context.manifest.slug === "klaviyo-sms" &&
    (grantedScopes.length !== 3 ||
      !["accounts:read", "sender-config:read", "sender-config:write"].every(
        (scope) => grantedScopes.includes(scope),
      ))
  )
    throw new Error("token_refresh_failed");
  if (
    context.manifest.slug === "convertkit" &&
    (grantedScopes.length !== 1 || grantedScopes[0] !== "public")
  )
    throw new Error("token_refresh_failed");
  if (
    context.manifest.slug === "firebase" &&
    (grantedScopes.length !== 1 ||
      grantedScopes[0] !== "https://www.googleapis.com/auth/firebase.readonly")
  )
    throw new Error("token_refresh_failed");
  if (
    context.manifest.slug === "supabase" &&
    (grantedScopes.length !== 2 ||
      !grantedScopes.includes("organizations:read") ||
      !grantedScopes.includes("projects:read"))
  )
    throw new Error("token_refresh_failed");
  if (
    context.manifest.slug === "bamboohr" &&
    (grantedScopes.length !== 3 ||
      !["field", "meta", "offline_access"].every((scope) =>
        grantedScopes.includes(scope),
      ))
  )
    throw new Error("token_refresh_failed");
  if (
    context.manifest.slug === "greenhouse" &&
    (grantedScopes.length !== 3 ||
      ![
        "harvest:jobs:list",
        "harvest:offices:list",
        "harvest:departments:list",
      ].every((scope) => grantedScopes.includes(scope)))
  )
    throw new Error("token_refresh_failed");
  if (
    context.manifest.slug === "lever" &&
    (grantedScopes.length !== 3 ||
      !["offline_access", "postings:read:admin", "stages:read:admin"].every(
        (scope) => grantedScopes.includes(scope),
      ))
  )
    throw new Error("token_refresh_failed");
  if (
    context.manifest.slug === "gmail" &&
    (grantedScopes.length !== 2 ||
      ![
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/gmail.compose",
      ].every((scope) => grantedScopes.includes(scope)))
  )
    throw new Error("token_refresh_failed");
  if (
    context.manifest.slug === "google-calendar" &&
    (grantedScopes.length !== 3 ||
      ![
        "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
        "https://www.googleapis.com/auth/calendar.events.freebusy",
        "https://www.googleapis.com/auth/calendar.events",
      ].every((scope) => grantedScopes.includes(scope)))
  )
    throw new Error("token_refresh_failed");
  const pipedriveRefreshProfile =
    context.manifest.slug === "pipedrive"
      ? ((await service.fetchProviderProfile(
          "pipedrive",
          context.token.access_token,
          {
            pipedriveApiDomain: context.token.api_domain,
          },
        )) as Record<string, unknown>)
      : null;
  const zohoRefreshAuthority =
    context.manifest.slug === "zoho"
      ? service.zohoCrmAuthorityFromToken(
          context.token,
          service.connectionAuthority(context.manifest.slug, context.connection)
            .authorizationUrl,
        )
      : null;
  const zohoRefreshProfile = zohoRefreshAuthority
    ? ((await service.fetchProviderProfile("zoho", context.token.access_token, {
        zohoAccountsOrigin: zohoRefreshAuthority.accountsOrigin,
        zohoCrmApiOrigin: zohoRefreshAuthority.apiOrigin,
        zohoRegion: zohoRefreshAuthority.region,
      })) as Record<string, unknown>)
    : null;
  const zohoPeopleRefreshAuthority =
    context.manifest.slug === "zoho-people"
      ? service.zohoPeopleAuthorityFromToken(
          context.token,
          service.connectionAuthority(context.manifest.slug, context.connection)
            .authorizationUrl,
        )
      : null;
  const zohoPeopleRefreshProfile = zohoPeopleRefreshAuthority
    ? ((await service.fetchProviderProfile(
        "zoho-people",
        context.token.access_token,
        {
          zohoAccountsOrigin: zohoPeopleRefreshAuthority.accountsOrigin,
          zohoPeopleApiOrigin: zohoPeopleRefreshAuthority.apiOrigin,
          zohoRegion: zohoPeopleRefreshAuthority.region,
        },
      )) as Record<string, unknown>)
    : null;
  const zohoCampaignsRefreshAuthority =
    context.manifest.slug === "zoho-campaigns"
      ? service.zohoCampaignsAuthorityFromToken(
          context.token,
          service.connectionAuthority(context.manifest.slug, context.connection)
            .authorizationUrl,
        )
      : null;
  const zohoCampaignsRefreshProfile = zohoCampaignsRefreshAuthority
    ? ((await service.fetchProviderProfile(
        "zoho-campaigns",
        context.token.access_token,
        {
          zohoAccountsOrigin: zohoCampaignsRefreshAuthority.accountsOrigin,
          zohoCampaignsApiOrigin: zohoCampaignsRefreshAuthority.apiOrigin,
          zohoRegion: zohoCampaignsRefreshAuthority.region,
        },
      )) as Record<string, unknown>)
    : null;
  const zohoAnalyticsRefreshAuthority =
    context.manifest.slug === "zoho-analytics"
      ? service.zohoAnalyticsAuthorityFromToken(
          context.token,
          service.connectionAuthority(context.manifest.slug, context.connection)
            .authorizationUrl,
        )
      : null;
  const zohoAnalyticsRefreshProfile = zohoAnalyticsRefreshAuthority
    ? ((await service.fetchProviderProfile(
        "zoho-analytics",
        context.token.access_token,
        {
          zohoAccountsOrigin: zohoAnalyticsRefreshAuthority.accountsOrigin,
          zohoAnalyticsApiOrigin: zohoAnalyticsRefreshAuthority.apiOrigin,
          zohoRegion: zohoAnalyticsRefreshAuthority.region,
        },
      )) as Record<string, unknown>)
    : null;
  const zohoDeskRefreshAuthority =
    context.manifest.slug === "zoho-desk"
      ? service.zohoDeskAuthorityFromToken(
          context.token,
          service.connectionAuthority(context.manifest.slug, context.connection)
            .authorizationUrl,
        )
      : null;
  const zohoDeskRefreshProfile = zohoDeskRefreshAuthority
    ? ((await service.fetchProviderProfile(
        "zoho-desk",
        context.token.access_token,
        {
          zohoAccountsOrigin: zohoDeskRefreshAuthority.accountsOrigin,
          zohoDeskApiOrigin: zohoDeskRefreshAuthority.apiOrigin,
          zohoRegion: zohoDeskRefreshAuthority.region,
        },
      )) as Record<string, unknown>)
    : null;
  if (context.manifest.slug === "zoho-books") {
    const refreshed = service.zohoCrmAuthorityFromToken(
      context.token,
      service.connectionAuthority(context.manifest.slug, context.connection)
        .authorizationUrl,
    );
    if (
      refreshed.accountsOrigin !==
        context.connection.metadata?.zohoAccountsOrigin ||
      refreshed.apiOrigin !== context.connection.metadata?.zohoBooksApiOrigin
    )
      throw new Error("token_refresh_failed");
  }
  if (context.manifest.slug === "zoho-invoice") {
    const refreshed = service.zohoCrmAuthorityFromToken(
      context.token,
      service.connectionAuthority(context.manifest.slug, context.connection)
        .authorizationUrl,
    );
    if (
      refreshed.accountsOrigin !==
        context.connection.metadata?.zohoAccountsOrigin ||
      refreshed.apiOrigin !== context.connection.metadata?.zohoInvoiceApiOrigin
    )
      throw new Error("token_refresh_failed");
  }
  if (context.manifest.slug === "zoho-expense") {
    const refreshed = service.zohoCrmAuthorityFromToken(
      context.token,
      service.connectionAuthority(context.manifest.slug, context.connection)
        .authorizationUrl,
    );
    if (
      refreshed.accountsOrigin !==
        context.connection.metadata?.zohoAccountsOrigin ||
      refreshed.apiOrigin !== context.connection.metadata?.zohoExpenseApiOrigin
    )
      throw new Error("token_refresh_failed");
  }
  const closeRefreshProfile =
    context.manifest.slug === "close"
      ? ((await service.fetchProviderProfile(
          "close",
          context.token.access_token,
          {
            closeOrganizationId: service.stringOrNull(
              context.token.organization_id,
            ),
            closeUserId: service.stringOrNull(context.token.user_id),
          },
        )) as Record<string, unknown>)
      : null;
  const zendeskRefreshProfile =
    context.manifest.slug === "zendesk"
      ? ((await service.fetchProviderProfile(
          "zendesk",
          context.token.access_token,
          {
            zendeskInstanceOrigin: service.stringOrNull(
              context.connection.metadata?.zendeskInstanceOrigin,
            ),
          },
        )) as Record<string, unknown>)
      : null;
  const helpScoutRefreshProfile =
    context.manifest.slug === "help-scout"
      ? ((await service.fetchProviderProfile(
          "help-scout",
          context.token.access_token,
        )) as Record<string, unknown>)
      : null;
  const frontRefreshProfile =
    context.manifest.slug === "front"
      ? ((await service.fetchProviderProfile(
          "front",
          context.token.access_token,
        )) as Record<string, unknown>)
      : null;
  const todoistRefreshProfile =
    context.manifest.slug === "todoist"
      ? ((await service.fetchProviderProfile(
          "todoist",
          context.token.access_token,
        )) as Record<string, unknown>)
      : null;
  const calendlyRefreshProfile =
    context.manifest.slug === "calendly"
      ? ((await service.fetchProviderProfile(
          "calendly",
          context.token.access_token,
        )) as Record<string, unknown>)
      : null;
  const sageAccountingRefreshProfile =
    context.manifest.slug === "sage-accounting"
      ? ((await service.fetchProviderProfile(
          "sage-accounting",
          context.token.access_token,
          {
            sageAccountingSubscriptionKey: service.stringOrNull(
              context.credentials.sageAccountingSubscriptionKey,
            ),
          },
        )) as Record<string, unknown>)
      : null;
  const myobRefreshProfile =
    context.manifest.slug === "myob"
      ? ((await service.fetchProviderProfile(
          "myob",
          context.token.access_token,
          {
            myobBusinessId: service.stringOrNull(
              context.connection.metadata?.myobCompanyFileId,
            ),
            myobCompanyFileToken: service.stringOrNull(
              context.credentials.myobCompanyFileToken,
            ),
            myobApiKey: service.stringOrNull(
              context.credentials.clientId ??
                context.connection.metadata?.clientId,
            ),
          },
        )) as Record<string, unknown>)
      : null;
  const calComRefreshProfile =
    context.manifest.slug === "cal-com"
      ? ((await service.fetchProviderProfile(
          "cal-com",
          context.token.access_token,
        )) as Record<string, unknown>)
      : null;
  const docusignRefreshProfile =
    context.manifest.slug === "docusign"
      ? ((await service.fetchProviderProfile(
          "docusign",
          context.token.access_token,
        )) as Record<string, unknown>)
      : null;
  const dropboxSignRefreshProfile =
    context.manifest.slug === "dropbox-sign"
      ? ((await service.fetchProviderProfile(
          "dropbox-sign",
          context.token.access_token,
          {
            dropboxSignAccountId: service.stringOrNull(
              context.connection.metadata?.dropboxSignAccountId,
            ),
          },
          context.token,
        )) as Record<string, unknown>)
      : null;
  const pandaDocRefreshProfile =
    context.manifest.slug === "pandadoc"
      ? ((await service.fetchProviderProfile(
          "pandadoc",
          context.token.access_token,
        )) as Record<string, unknown>)
      : null;
  const typeformRefreshProfile =
    context.manifest.slug === "typeform"
      ? ((await service.fetchProviderProfile(
          "typeform",
          context.token.access_token,
          {
            typeformAccountId: service.stringOrNull(
              context.connection.metadata?.typeformAccountId,
            ),
            typeformWorkspaceId: service.stringOrNull(
              context.connection.metadata?.typeformWorkspaceId,
            ),
            typeformApiOrigin: service.stringOrNull(
              context.connection.metadata?.typeformApiOrigin,
            ),
          },
        )) as Record<string, unknown>)
      : null;
  const bufferRefreshProfile =
    context.manifest.slug === "buffer"
      ? ((await service.fetchProviderProfile(
          "buffer",
          context.token.access_token,
        )) as Record<string, unknown>)
      : null;
  const clioGrowRefreshProfile =
    context.manifest.slug === "clio-grow"
      ? ((await service.fetchProviderProfile(
          "clio-grow",
          context.token.access_token,
        )) as Record<string, unknown>)
      : null;
  const practicePantherRefreshProfile =
    context.manifest.slug === "practicepanther"
      ? ((await service.fetchProviderProfile(
          "practicepanther",
          context.token.access_token,
        )) as Record<string, unknown>)
      : null;
  const smokeballRefreshProfile =
    context.manifest.slug === "smokeball"
      ? ((await service.fetchProviderProfile(
          "smokeball",
          context.token.access_token,
        )) as Record<string, unknown>)
      : null;
  const filevineRefreshProfile =
    context.manifest.slug === "filevine"
      ? ((await service.fetchProviderProfile(
          "filevine",
          context.token.access_token,
        )) as Record<string, unknown>)
      : null;
  return {
    ...context,
    grantedScopes,
    pipedriveRefreshProfile,
    zohoRefreshAuthority,
    zohoRefreshProfile,
    zohoPeopleRefreshAuthority,
    zohoPeopleRefreshProfile,
    zohoCampaignsRefreshAuthority,
    zohoCampaignsRefreshProfile,
    zohoAnalyticsRefreshAuthority,
    zohoAnalyticsRefreshProfile,
    zohoDeskRefreshAuthority,
    zohoDeskRefreshProfile,
    closeRefreshProfile,
    zendeskRefreshProfile,
    helpScoutRefreshProfile,
    frontRefreshProfile,
    todoistRefreshProfile,
    calendlyRefreshProfile,
    sageAccountingRefreshProfile,
    myobRefreshProfile,
    calComRefreshProfile,
    docusignRefreshProfile,
    dropboxSignRefreshProfile,
    pandaDocRefreshProfile,
    typeformRefreshProfile,
    bufferRefreshProfile,
    clioGrowRefreshProfile,
    practicePantherRefreshProfile,
    smokeballRefreshProfile,
    filevineRefreshProfile,
  };
}

async function runOAuthRefreshPhase5(
  service: MarketplaceConnectorOAuthService,
  context: Awaited<ReturnType<typeof runOAuthRefreshPhase4>>,
) {
  if (
    context.pipedriveRefreshProfile &&
    (service.positiveNumericId(
      context.pipedriveRefreshProfile.pipedriveUserId,
    ) !==
      service.positiveNumericId(context.connection.metadata?.pipedriveUserId) ||
      service.positiveNumericId(
        context.pipedriveRefreshProfile.pipedriveCompanyId,
      ) !==
        service.positiveNumericId(
          context.connection.metadata?.pipedriveCompanyId,
        ))
  )
    throw new Error("token_refresh_failed");
  if (
    context.bufferRefreshProfile &&
    service.stringOrNull(context.bufferRefreshProfile.bufferAccountId) !==
      service.stringOrNull(context.connection.metadata?.bufferAccountId)
  )
    throw new Error("token_refresh_failed");
  if (
    context.clioGrowRefreshProfile &&
    (context.clioGrowRefreshProfile.clioGrowAuthorityVerified !== true ||
      service.stringOrNull(context.clioGrowRefreshProfile.clioGrowApiOrigin) !==
        "https://api.clio.com" ||
      service.stringOrNull(context.clioGrowRefreshProfile.clioGrowApiRegion) !==
        "us")
  )
    throw new Error("token_refresh_failed");
  if (
    context.practicePantherRefreshProfile &&
    (context.practicePantherRefreshProfile.practicePantherAuthorityVerified !==
      true ||
      service.stringOrNull(
        context.practicePantherRefreshProfile.practicePantherApiOrigin,
      ) !== "https://app.practicepanther.com")
  )
    throw new Error("token_refresh_failed");
  if (
    context.smokeballRefreshProfile &&
    (context.smokeballRefreshProfile.smokeballAuthorityVerified !== true ||
      service.stringOrNull(
        context.smokeballRefreshProfile.smokeballApiOrigin,
      ) !== "https://api.smokeball.com" ||
      service.stringOrNull(
        context.smokeballRefreshProfile.smokeballApiRegion,
      ) !== "us" ||
      service.stringOrNull(
        context.smokeballRefreshProfile.smokeballApiVersion,
      ) !== "v1")
  )
    throw new Error("token_refresh_failed");
  if (
    context.filevineRefreshProfile &&
    (context.filevineRefreshProfile.filevineAuthorityVerified !== true ||
      service.stringOrNull(context.filevineRefreshProfile.filevineApiOrigin) !==
        "https://api.filevine.io" ||
      service.stringOrNull(context.filevineRefreshProfile.filevineApiRegion) !==
        "us" ||
      service.stringOrNull(
        context.filevineRefreshProfile.filevineApiVersion,
      ) !== "v2")
  )
    throw new Error("token_refresh_failed");
  if (
    context.zohoRefreshProfile &&
    (service.positiveNumericId(
      context.zohoRefreshProfile.zohoCrmOrganizationId,
    ) !==
      service.positiveNumericId(
        context.connection.metadata?.zohoCrmOrganizationId,
      ) ||
      service.positiveNumericId(context.zohoRefreshProfile.zohoCrmUserId) !==
        service.positiveNumericId(context.connection.metadata?.zohoCrmUserId) ||
      context.zohoRefreshAuthority?.apiOrigin !==
        service.stringOrNull(context.connection.metadata?.zohoCrmApiOrigin) ||
      context.zohoRefreshAuthority?.accountsOrigin !==
        service.stringOrNull(context.connection.metadata?.zohoAccountsOrigin))
  )
    throw new Error("token_refresh_failed");
  if (
    context.zohoDeskRefreshProfile &&
    (service.positiveNumericId(
      context.zohoDeskRefreshProfile.zohoDeskOrganizationId,
    ) !==
      service.positiveNumericId(
        context.connection.metadata?.zohoDeskOrganizationId,
      ) ||
      context.zohoDeskRefreshAuthority?.apiOrigin !==
        service.stringOrNull(context.connection.metadata?.zohoDeskApiOrigin) ||
      context.zohoDeskRefreshAuthority?.accountsOrigin !==
        service.stringOrNull(context.connection.metadata?.zohoAccountsOrigin))
  )
    throw new Error("token_refresh_failed");
  if (
    context.zohoPeopleRefreshProfile &&
    (service.positiveNumericId(
      context.zohoPeopleRefreshProfile.zohoPeopleUserId,
    ) !==
      service.positiveNumericId(
        context.connection.metadata?.zohoPeopleUserId,
      ) ||
      context.zohoPeopleRefreshAuthority?.apiOrigin !==
        service.stringOrNull(
          context.connection.metadata?.zohoPeopleApiOrigin,
        ) ||
      context.zohoPeopleRefreshAuthority?.accountsOrigin !==
        service.stringOrNull(context.connection.metadata?.zohoAccountsOrigin))
  )
    throw new Error("token_refresh_failed");
  if (
    context.zohoCampaignsRefreshProfile &&
    (service.positiveNumericId(
      context.zohoCampaignsRefreshProfile.zohoCampaignsUserId,
    ) !==
      service.positiveNumericId(
        context.connection.metadata?.zohoCampaignsUserId,
      ) ||
      context.zohoCampaignsRefreshAuthority?.apiOrigin !==
        service.stringOrNull(
          context.connection.metadata?.zohoCampaignsApiOrigin,
        ) ||
      context.zohoCampaignsRefreshAuthority?.accountsOrigin !==
        service.stringOrNull(context.connection.metadata?.zohoAccountsOrigin))
  )
    throw new Error("token_refresh_failed");
  if (
    context.zohoAnalyticsRefreshProfile &&
    (service.positiveNumericId(
      context.zohoAnalyticsRefreshProfile.zohoAnalyticsUserId,
    ) !==
      service.positiveNumericId(
        context.connection.metadata?.zohoAnalyticsUserId,
      ) ||
      context.zohoAnalyticsRefreshAuthority?.apiOrigin !==
        service.stringOrNull(
          context.connection.metadata?.zohoAnalyticsApiOrigin,
        ) ||
      context.zohoAnalyticsRefreshAuthority?.accountsOrigin !==
        service.stringOrNull(context.connection.metadata?.zohoAccountsOrigin))
  )
    throw new Error("token_refresh_failed");
  if (
    context.closeRefreshProfile &&
    (service.stringOrNull(context.closeRefreshProfile.closeOrganizationId) !==
      service.stringOrNull(context.connection.metadata?.closeOrganizationId) ||
      service.stringOrNull(context.closeRefreshProfile.closeUserId) !==
        service.stringOrNull(context.connection.metadata?.closeUserId))
  )
    throw new Error("token_refresh_failed");
  if (
    context.zendeskRefreshProfile &&
    (service.positiveNumericId(context.zendeskRefreshProfile.zendeskUserId) !==
      service.positiveNumericId(context.connection.metadata?.zendeskUserId) ||
      service.stringOrNull(
        context.zendeskRefreshProfile.zendeskInstanceOrigin,
      ) !==
        service.stringOrNull(
          context.connection.metadata?.zendeskInstanceOrigin,
        ))
  )
    throw new Error("token_refresh_failed");
  if (
    context.helpScoutRefreshProfile &&
    service.positiveNumericId(
      context.helpScoutRefreshProfile.helpScoutUserId,
    ) !==
      service.positiveNumericId(context.connection.metadata?.helpScoutUserId)
  )
    throw new Error("token_refresh_failed");
  if (
    context.frontRefreshProfile &&
    service.stringOrNull(context.frontRefreshProfile.frontCompanyId) !==
      service.stringOrNull(context.connection.metadata?.frontCompanyId)
  )
    throw new Error("token_refresh_failed");
  if (
    context.todoistRefreshProfile &&
    service.todoistOpaqueId(context.todoistRefreshProfile.todoistUserId) !==
      service.todoistOpaqueId(context.connection.metadata?.todoistUserId)
  )
    throw new Error("token_refresh_failed");
  if (
    context.calendlyRefreshProfile &&
    (service.stringOrNull(context.calendlyRefreshProfile.calendlyUserUri) !==
      service.stringOrNull(context.connection.metadata?.calendlyUserUri) ||
      service.stringOrNull(
        context.calendlyRefreshProfile.calendlyOrganizationUri,
      ) !==
        service.stringOrNull(
          context.connection.metadata?.calendlyOrganizationUri,
        ))
  )
    throw new Error("token_refresh_failed");
  if (
    context.sageAccountingRefreshProfile &&
    service.stringOrNull(
      context.sageAccountingRefreshProfile.sageAccountingBusinessId,
    ) !==
      service.stringOrNull(
        context.connection.metadata?.sageAccountingBusinessId,
      )
  )
    throw new Error("token_refresh_failed");
  if (
    context.myobRefreshProfile &&
    service
      .stringOrNull(context.myobRefreshProfile.myobCompanyFileId)
      ?.toLowerCase() !==
      service
        .stringOrNull(context.connection.metadata?.myobCompanyFileId)
        ?.toLowerCase()
  )
    throw new Error("token_refresh_failed");
  if (
    context.calComRefreshProfile &&
    (service.positiveNumericId(context.calComRefreshProfile.calComUserId) !==
      service.positiveNumericId(context.connection.metadata?.calComUserId) ||
      service.stringOrNull(context.calComRefreshProfile.calComUsername) !==
        service.stringOrNull(context.connection.metadata?.calComUsername))
  )
    throw new Error("token_refresh_failed");
  if (
    context.docusignRefreshProfile &&
    (service.stringOrNull(context.docusignRefreshProfile.docusignUserId) !==
      service.stringOrNull(context.connection.metadata?.docusignUserId) ||
      service.stringOrNull(context.docusignRefreshProfile.docusignAccountId) !==
        service.stringOrNull(context.connection.metadata?.docusignAccountId) ||
      service.stringOrNull(context.docusignRefreshProfile.docusignBaseUri) !==
        service.stringOrNull(context.connection.metadata?.docusignBaseUri))
  )
    throw new Error("token_refresh_failed");
  if (
    context.dropboxSignRefreshProfile &&
    service.stringOrNull(
      context.dropboxSignRefreshProfile.dropboxSignAccountId,
    ) !==
      service.stringOrNull(context.connection.metadata?.dropboxSignAccountId)
  )
    throw new Error("token_refresh_failed");
  if (
    context.pandaDocRefreshProfile &&
    (service.stringOrNull(
      context.pandaDocRefreshProfile.pandaDocMembershipId,
    ) !==
      service.stringOrNull(context.connection.metadata?.pandaDocMembershipId) ||
      service.stringOrNull(
        context.pandaDocRefreshProfile.pandaDocWorkspaceId,
      ) !==
        service.stringOrNull(context.connection.metadata?.pandaDocWorkspaceId))
  )
    throw new Error("token_refresh_failed");
  if (
    context.typeformRefreshProfile &&
    (service.stringOrNull(context.typeformRefreshProfile.typeformAccountId) !==
      service.stringOrNull(context.connection.metadata?.typeformAccountId) ||
      service.stringOrNull(
        context.typeformRefreshProfile.typeformWorkspaceId,
      ) !==
        service.stringOrNull(
          context.connection.metadata?.typeformWorkspaceId,
        ) ||
      service.stringOrNull(context.typeformRefreshProfile.typeformApiOrigin) !==
        service.stringOrNull(context.connection.metadata?.typeformApiOrigin))
  )
    throw new Error("token_refresh_failed");
  const nextCredentials = {
    ...context.credentials,
    accessToken: context.token.access_token,
    refreshToken:
      context.token.refresh_token ?? context.credentials.refreshToken,
    ...(context.token.owner_id ? { ownerId: context.token.owner_id } : {}),
    ...(context.token.refresh_token_expires_in
      ? {
          refreshTokenExpiresAt: new Date(
            Date.now() + context.token.refresh_token_expires_in * 1000,
          ).toISOString(),
        }
      : context.manifest.slug === "front" &&
          context.token.refresh_token &&
          context.token.refresh_token !== context.credentials.refreshToken
        ? {
            refreshTokenExpiresAt: new Date(
              Date.now() + 180 * 24 * 60 * 60 * 1000,
            ).toISOString(),
          }
        : {}),
    expiresAt:
      context.token.expires_at &&
      !Number.isNaN(Date.parse(context.token.expires_at))
        ? new Date(context.token.expires_at).toISOString()
        : new Date(
            Date.now() + (context.token.expires_in ?? 3600) * 1000,
          ).toISOString(),
    grantedScopes: context.grantedScopes,
    tokenType: context.token.token_type ?? context.credentials.tokenType,
  };
  service.credentials.applyEncrypted(context.connection, nextCredentials);
  context.connection.metadata = {
    ...(context.connection.metadata ?? {}),
    tokenStatus: "valid",
    grantedScopes: context.grantedScopes,
    lastTokenRefreshAt: new Date().toISOString(),
    ...(context.pipedriveRefreshProfile
      ? {
          pipedriveApiOrigin: service.pipedriveApiOrigin(
            service.stringOrNull(
              context.pipedriveRefreshProfile.pipedriveApiOrigin,
            ),
          ),
          pipedriveCompanyName: service.stringOrNull(
            context.pipedriveRefreshProfile.pipedriveCompanyName,
          ),
          displayName:
            service.stringOrNull(
              context.pipedriveRefreshProfile.pipedriveCompanyName,
            ) ?? context.connection.metadata?.displayName,
        }
      : {}),
    ...(context.zohoRefreshProfile && context.zohoRefreshAuthority
      ? {
          zohoCrmOrganizationName: service.stringOrNull(
            context.zohoRefreshProfile.zohoCrmOrganizationName,
          ),
          zohoCrmEnvironment: service.stringOrNull(
            context.zohoRefreshProfile.zohoCrmEnvironment,
          ),
          zohoRegion: context.zohoRefreshAuthority.region,
          zohoAccountsOrigin: context.zohoRefreshAuthority.accountsOrigin,
          zohoCrmApiOrigin: context.zohoRefreshAuthority.apiOrigin,
          displayName:
            service.stringOrNull(
              context.zohoRefreshProfile.zohoCrmOrganizationName,
            ) ?? context.connection.metadata?.displayName,
        }
      : {}),
    ...(context.zohoDeskRefreshProfile && context.zohoDeskRefreshAuthority
      ? {
          zohoDeskOrganizationName: service.stringOrNull(
            context.zohoDeskRefreshProfile.zohoDeskOrganizationName,
          ),
          zohoDeskEdition: service.stringOrNull(
            context.zohoDeskRefreshProfile.zohoDeskEdition,
          ),
          zohoRegion: context.zohoDeskRefreshAuthority.region,
          zohoAccountsOrigin: context.zohoDeskRefreshAuthority.accountsOrigin,
          zohoDeskApiOrigin: context.zohoDeskRefreshAuthority.apiOrigin,
          displayName:
            service.stringOrNull(
              context.zohoDeskRefreshProfile.zohoDeskOrganizationName,
            ) ?? context.connection.metadata?.displayName,
        }
      : {}),
    ...(context.closeRefreshProfile
      ? {
          closeOrganizationName: service.stringOrNull(
            context.closeRefreshProfile.closeOrganizationName,
          ),
          closeUserName: service.stringOrNull(
            context.closeRefreshProfile.closeUserName,
          ),
          refreshTokenRotatedAt: new Date().toISOString(),
          displayName:
            service.stringOrNull(
              context.closeRefreshProfile.closeOrganizationName,
            ) ?? context.connection.metadata?.displayName,
        }
      : {}),
    ...(context.zendeskRefreshProfile
      ? {
          zendeskUserName: service.stringOrNull(
            context.zendeskRefreshProfile.zendeskUserName,
          ),
          zendeskUserRole: service.stringOrNull(
            context.zendeskRefreshProfile.zendeskUserRole,
          ),
          refreshTokenRotatedAt: context.token.refresh_token
            ? new Date().toISOString()
            : context.connection.metadata?.refreshTokenRotatedAt,
        }
      : {}),
    ...(context.todoistRefreshProfile
      ? {
          todoistUserName: service.stringOrNull(
            context.todoistRefreshProfile.todoistUserName,
          ),
          todoistUserEmail: service.stringOrNull(
            context.todoistRefreshProfile.todoistUserEmail,
          ),
          refreshTokenRotatedAt: context.token.refresh_token
            ? new Date().toISOString()
            : context.connection.metadata?.refreshTokenRotatedAt,
          displayName:
            service.stringOrNull(
              context.todoistRefreshProfile.todoistUserName,
            ) ?? context.connection.metadata?.displayName,
        }
      : {}),
  };
  context.connection.status = "ready";
  context.connection.lastValidatedAt = new Date();
  await service.connectionRepo.save(context.connection);
  await service.auditLogService.record({
    actorType: "system",
    workspaceId: context.connection.workspaceId,
    eventType: `marketplace.${context.manifest.slug}.token.refreshed`,
    resourceType: "marketplace_connection",
    resourceId: context.connection.id,
    metadata: { grantedScopes: context.grantedScopes },
  });
  return {
    accessToken: context.token.access_token,
    credentials: nextCredentials,
    refreshed: true,
  };
}

export const OAuthRefreshExtension = {
  async refreshIfNeeded(
    this: MarketplaceConnectorOAuthService,
    connection: MarketplaceConnectionEntity,
  ): Promise<OAuthAccessTokenResult> {
    const activeRefresh = this.tokenRefreshes.get(connection.id);
    if (activeRefresh) return activeRefresh;

    const refresh = this.refreshIfNeededUnlocked(connection).finally(() => {
      if (this.tokenRefreshes.get(connection.id) === refresh) {
        this.tokenRefreshes.delete(connection.id);
      }
    });
    this.tokenRefreshes.set(connection.id, refresh);
    return refresh;
  },

  async refreshIfNeededUnlocked(
    this: MarketplaceConnectorOAuthService,
    connection: MarketplaceConnectionEntity,
  ): Promise<OAuthAccessTokenResult> {
    const manifest = this.requireOAuthManifest(connection.appSlug);
    const credentials = this.credentials.decrypt(connection);
    if (!credentials?.accessToken) throw new Error("credential_missing");
    if (manifest.auth.type === "oauth1") {
      const expiresAt = this.stringOrNull(credentials.expiresAt);
      if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
        throw new Error("token_expired");
      }
      return {
        accessToken: String(credentials.accessToken),
        credentials,
        refreshed: false,
      };
    }
    const expiresAtValue = this.stringOrNull(credentials.expiresAt);
    if (!expiresAtValue && manifest.auth.oauth?.supportsRefresh === false) {
      return {
        accessToken: String(credentials.accessToken),
        credentials,
        refreshed: false,
      };
    }
    const expiresAt = new Date(expiresAtValue ?? "");
    if (expiresAt.getTime() - Date.now() > 120_000) {
      return {
        accessToken: String(credentials.accessToken),
        credentials,
        refreshed: false,
      };
    }
    if (manifest.slug === "7shifts") {
      const clientId = this.configService
        .get<string>("SEVEN_SHIFTS_CLIENT_ID")
        ?.trim();
      const clientSecret = this.configService
        .get<string>("SEVEN_SHIFTS_CLIENT_SECRET")
        ?.trim();
      if (!clientId || !clientSecret) throw new Error("token_refresh_failed");
      const token = await this.exchangeToken(
        manifest.slug,
        {
          grant_type: "client_credentials",
          client_id: clientId,
          client_secret: clientSecret,
          scope: manifest.auth.oauth?.requiredScopes.join(" ") ?? "",
        },
        this.connectionAuthority(manifest.slug, connection),
      );
      if (!token.access_token) throw new Error("token_refresh_failed");
      const grantedScopes =
        this.normalizeScopeString(token.scope) ||
        this.stringArray(credentials.grantedScopes);
      const nextCredentials = {
        ...credentials,
        clientId,
        accessToken: token.access_token,
        refreshToken: credentials.refreshToken,
        expiresAt: new Date(
          Date.now() + (token.expires_in ?? 3600) * 1000,
        ).toISOString(),
        grantedScopes,
        tokenType: token.token_type ?? "Bearer",
      };
      this.credentials.applyEncrypted(connection, nextCredentials);
      connection.metadata = {
        ...(connection.metadata ?? {}),
        tokenStatus: "valid",
        grantedScopes,
        lastTokenRefreshAt: new Date().toISOString(),
      };
      connection.status = "ready";
      connection.lastValidatedAt = new Date();
      await this.connectionRepo.save(connection);
      await this.auditLogService.record({
        actorType: "system",
        workspaceId: connection.workspaceId,
        eventType: "marketplace.7shifts.token.refreshed",
        resourceType: "marketplace_connection",
        resourceId: connection.id,
        metadata: { grantedScopes },
      });
      return {
        accessToken: token.access_token,
        credentials: nextCredentials,
        refreshed: true,
      };
    }
    if (manifest.auth.oauth?.supportsRefresh === false) {
      throw new Error("token_expired");
    }
    if (manifest.slug === "threads") {
      const refreshed = await this.refreshThreadsLongLivedToken(
        String(credentials.accessToken),
      );
      const grantedScopes = this.stringArray(credentials.grantedScopes);
      const nextCredentials = {
        ...credentials,
        accessToken: refreshed.access_token,
        refreshToken: refreshed.access_token,
        expiresAt: new Date(
          Date.now() + (refreshed.expires_in ?? 5_184_000) * 1000,
        ).toISOString(),
        grantedScopes,
        tokenType: refreshed.token_type ?? "Bearer",
      };
      this.credentials.applyEncrypted(connection, nextCredentials);
      connection.metadata = {
        ...(connection.metadata ?? {}),
        tokenStatus: "valid",
        grantedScopes,
        lastTokenRefreshAt: new Date().toISOString(),
      };
      connection.status = "ready";
      connection.lastValidatedAt = new Date();
      await this.connectionRepo.save(connection);
      await this.auditLogService.record({
        actorType: "system",
        workspaceId: connection.workspaceId,
        eventType: "marketplace.threads.token.refreshed",
        resourceType: "marketplace_connection",
        resourceId: connection.id,
        metadata: { grantedScopes },
      });
      return {
        accessToken: refreshed.access_token,
        credentials: nextCredentials,
        refreshed: true,
      };
    }
    const phase1 = await runOAuthRefreshPhase1(this, { connection });
    const phase2 = await runOAuthRefreshPhase2(this, phase1);
    const phase3 = await runOAuthRefreshPhase3(this, phase2);
    const phase4 = await runOAuthRefreshPhase4(this, phase3);
    return runOAuthRefreshPhase5(this, phase4);
  },
};
