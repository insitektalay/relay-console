import type { MarketplaceOAuthStateEntity } from "../../../../entities";
import type { MarketplaceConnectorOAuthService } from "../connector-oauth.service";

export function resolveOAuthCompleteClientSecret(
  service: MarketplaceConnectorOAuthService,
  slug: string,
  oauthState: MarketplaceOAuthStateEntity,
): string | null | undefined {
  return slug === "adobe-acrobat-sign"
    ? service.configService
        .get<string>("ADOBE_ACROBAT_SIGN_CLIENT_SECRET")
        ?.trim()
    : slug === "shopify"
      ? service.configService.get<string>("SHOPIFY_CLIENT_SECRET")?.trim()
      : slug === "stripe"
        ? service.configService
            .get<string>("STRIPE_APPS_DEVELOPER_SECRET_KEY")
            ?.trim()
        : slug === "quickbooks"
          ? service.configService
              .get<string>("QUICKBOOKS_CLIENT_SECRET")
              ?.trim()
          : slug === "freshbooks"
            ? service.configService
                .get<string>("FRESHBOOKS_CLIENT_SECRET")
                ?.trim()
            : slug === "wave"
              ? service.configService.get<string>("WAVE_CLIENT_SECRET")?.trim()
              : slug === "freeagent"
                ? service.configService
                    .get<string>("FREEAGENT_CLIENT_SECRET")
                    ?.trim()
                : slug === "salesforce"
                  ? service.configService
                      .get<string>("SALESFORCE_CLIENT_SECRET")
                      ?.trim()
                  : slug === "hubspot"
                    ? service.configService
                        .get<string>("HUBSPOT_CLIENT_SECRET")
                        ?.trim()
                    : slug === "pipedrive"
                      ? service.configService
                          .get<string>("PIPEDRIVE_CLIENT_SECRET")
                          ?.trim()
                      : slug === "zoho"
                        ? service.configService
                            .get<string>("ZOHO_CLIENT_SECRET")
                            ?.trim()
                        : slug === "zoho-desk"
                          ? service.configService
                              .get<string>("ZOHO_CLIENT_SECRET")
                              ?.trim()
                          : slug === "zoho-projects"
                            ? service.configService
                                .get<string>("ZOHO_CLIENT_SECRET")
                                ?.trim()
                            : slug === "copper"
                              ? service.configService
                                  .get<string>("COPPER_CLIENT_SECRET")
                                  ?.trim()
                              : slug === "surveymonkey"
                                ? service.configService
                                    .get<string>("SURVEYMONKEY_CLIENT_SECRET")
                                    ?.trim()
                                : slug === "fillout"
                                  ? service.configService
                                      .get<string>("FILLOUT_CLIENT_SECRET")
                                      ?.trim()
                                  : slug === "mailchimp"
                                    ? service.configService
                                        .get<string>("MAILCHIMP_CLIENT_SECRET")
                                        ?.trim()
                                    : slug === "klaviyo"
                                      ? service.configService
                                          .get<string>("KLAVIYO_CLIENT_SECRET")
                                          ?.trim()
                                      : slug === "convertkit"
                                        ? service.configService
                                            .get<string>(
                                              "CONVERTKIT_CLIENT_SECRET",
                                            )
                                            ?.trim()
                                        : slug === "campaign-monitor"
                                          ? service.configService
                                              .get<string>(
                                                "CAMPAIGN_MONITOR_CLIENT_SECRET",
                                              )
                                              ?.trim()
                                          : slug === "constant-contact"
                                            ? service.configService
                                                .get<string>(
                                                  "CONSTANT_CONTACT_CLIENT_SECRET",
                                                )
                                                ?.trim()
                                            : slug === "close"
                                              ? service.configService
                                                  .get<string>(
                                                    "CLOSE_CLIENT_SECRET",
                                                  )
                                                  ?.trim()
                                              : slug === "zendesk"
                                                ? service.configService
                                                    .get<string>(
                                                      "ZENDESK_CLIENT_SECRET",
                                                    )
                                                    ?.trim()
                                                : slug === "intercom"
                                                  ? service.configService
                                                      .get<string>(
                                                        "INTERCOM_CLIENT_SECRET",
                                                      )
                                                      ?.trim()
                                                  : slug === "help-scout"
                                                    ? service.configService
                                                        .get<string>(
                                                          "HELP_SCOUT_CLIENT_SECRET",
                                                        )
                                                        ?.trim()
                                                    : slug === "front"
                                                      ? service.configService
                                                          .get<string>(
                                                            "FRONT_CLIENT_SECRET",
                                                          )
                                                          ?.trim()
                                                      : slug === "teamwork"
                                                        ? service.configService
                                                            .get<string>(
                                                              "TEAMWORK_CLIENT_SECRET",
                                                            )
                                                            ?.trim()
                                                        : slug === "basecamp"
                                                          ? service.configService
                                                              .get<string>(
                                                                "BASECAMP_CLIENT_SECRET",
                                                              )
                                                              ?.trim()
                                                          : slug === "wrike"
                                                            ? service.configService
                                                                .get<string>(
                                                                  "WRIKE_CLIENT_SECRET",
                                                                )
                                                                ?.trim()
                                                            : slug ===
                                                                "smartsheet"
                                                              ? service.configService
                                                                  .get<string>(
                                                                    "SMARTSHEET_CLIENT_SECRET",
                                                                  )
                                                                  ?.trim()
                                                              : slug ===
                                                                  "todoist"
                                                                ? service.configService
                                                                    .get<string>(
                                                                      "TODOIST_CLIENT_SECRET",
                                                                    )
                                                                    ?.trim()
                                                                : slug ===
                                                                    "ticktick"
                                                                  ? service.configService
                                                                      .get<string>(
                                                                        "TICKTICK_CLIENT_SECRET",
                                                                      )
                                                                      ?.trim()
                                                                  : slug ===
                                                                      "harvest"
                                                                    ? service.configService
                                                                        .get<string>(
                                                                          "HARVEST_CLIENT_SECRET",
                                                                        )
                                                                        ?.trim()
                                                                    : slug ===
                                                                        "calendly"
                                                                      ? service.configService
                                                                          .get<string>(
                                                                            "CALENDLY_CLIENT_SECRET",
                                                                          )
                                                                          ?.trim()
                                                                      : slug ===
                                                                          "cal-com"
                                                                        ? service.configService
                                                                            .get<string>(
                                                                              "CAL_COM_CLIENT_SECRET",
                                                                            )
                                                                            ?.trim()
                                                                        : slug ===
                                                                            "docusign"
                                                                          ? service.configService
                                                                              .get<string>(
                                                                                "DOCUSIGN_CLIENT_SECRET",
                                                                              )
                                                                              ?.trim()
                                                                          : slug ===
                                                                              "dropbox-sign"
                                                                            ? service.configService
                                                                                .get<string>(
                                                                                  "DROPBOX_SIGN_CLIENT_SECRET",
                                                                                )
                                                                                ?.trim()
                                                                            : slug ===
                                                                                "pandadoc"
                                                                              ? service.configService
                                                                                  .get<string>(
                                                                                    "PANDADOC_CLIENT_SECRET",
                                                                                  )
                                                                                  ?.trim()
                                                                              : slug ===
                                                                                  "typeform"
                                                                                ? service.configService
                                                                                    .get<string>(
                                                                                      "TYPEFORM_CLIENT_SECRET",
                                                                                    )
                                                                                    ?.trim()
                                                                                : slug ===
                                                                                    "sendfox"
                                                                                  ? service.configService
                                                                                      .get<string>(
                                                                                        "SENDFOX_CLIENT_SECRET",
                                                                                      )
                                                                                      ?.trim()
                                                                                  : slug ===
                                                                                      "beehiiv"
                                                                                    ? service.configService
                                                                                        .get<string>(
                                                                                          "BEEHIIV_CLIENT_SECRET",
                                                                                        )
                                                                                        ?.trim()
                                                                                    : slug ===
                                                                                        "pcloud"
                                                                                      ? service.configService
                                                                                          .get<string>(
                                                                                            "PCLOUD_CLIENT_SECRET",
                                                                                          )
                                                                                          ?.trim()
                                                                                      : slug ===
                                                                                          "sharefile"
                                                                                        ? service.configService
                                                                                            .get<string>(
                                                                                              "SHAREFILE_CLIENT_SECRET",
                                                                                            )
                                                                                            ?.trim()
                                                                                        : slug ===
                                                                                            "deputy"
                                                                                          ? service.configService
                                                                                              .get<string>(
                                                                                                "DEPUTY_CLIENT_SECRET",
                                                                                              )
                                                                                              ?.trim()
                                                                                          : slug ===
                                                                                              "7shifts"
                                                                                            ? service.configService
                                                                                                .get<string>(
                                                                                                  "SEVEN_SHIFTS_CLIENT_SECRET",
                                                                                                )
                                                                                                ?.trim()
                                                                                            : slug ===
                                                                                                "resource-guru"
                                                                                              ? service.configService
                                                                                                  .get<string>(
                                                                                                    "RESOURCE_GURU_CLIENT_SECRET",
                                                                                                  )
                                                                                                  ?.trim()
                                                                                              : slug ===
                                                                                                  "timely-time-tracking"
                                                                                                ? service.configService
                                                                                                    .get<string>(
                                                                                                      "TIMELY_TIME_TRACKING_CLIENT_SECRET",
                                                                                                    )
                                                                                                    ?.trim()
                                                                                                : slug ===
                                                                                                    "rescuetime"
                                                                                                  ? service.configService
                                                                                                      .get<string>(
                                                                                                        "RESCUETIME_CLIENT_SECRET",
                                                                                                      )
                                                                                                      ?.trim()
                                                                                                  : slug ===
                                                                                                      "hubstaff"
                                                                                                    ? service.configService
                                                                                                        .get<string>(
                                                                                                          "HUBSTAFF_CLIENT_SECRET",
                                                                                                        )
                                                                                                        ?.trim()
                                                                                                    : slug ===
                                                                                                        "zoho-workdrive"
                                                                                                      ? service.configService
                                                                                                          .get<string>(
                                                                                                            "ZOHO_WORKDRIVE_CLIENT_SECRET",
                                                                                                          )
                                                                                                          ?.trim()
                                                                                                      : slug ===
                                                                                                          "dropbox-paper"
                                                                                                        ? service.configService
                                                                                                            .get<string>(
                                                                                                              "DROPBOX_PAPER_CLIENT_SECRET",
                                                                                                            )
                                                                                                            ?.trim()
                                                                                                        : slug ===
                                                                                                            "inoreader"
                                                                                                          ? service.configService
                                                                                                              .get<string>(
                                                                                                                "INOREADER_CLIENT_SECRET",
                                                                                                              )
                                                                                                              ?.trim()
                                                                                                          : slug ===
                                                                                                              "guru"
                                                                                                            ? service.configService
                                                                                                                .get<string>(
                                                                                                                  "GURU_CLIENT_SECRET",
                                                                                                                )
                                                                                                                ?.trim()
                                                                                                            : slug ===
                                                                                                                "vimeo"
                                                                                                              ? service.configService
                                                                                                                  .get<string>(
                                                                                                                    "VIMEO_CLIENT_SECRET",
                                                                                                                  )
                                                                                                                  ?.trim()
                                                                                                              : slug ===
                                                                                                                  "wistia"
                                                                                                                ? service.configService
                                                                                                                    .get<string>(
                                                                                                                      "WISTIA_CLIENT_SECRET",
                                                                                                                    )
                                                                                                                    ?.trim()
                                                                                                                : slug ===
                                                                                                                    "mural"
                                                                                                                  ? service.configService
                                                                                                                      .get<string>(
                                                                                                                        "MURAL_CLIENT_SECRET",
                                                                                                                      )
                                                                                                                      ?.trim()
                                                                                                                  : slug ===
                                                                                                                      "miro"
                                                                                                                    ? service.configService
                                                                                                                        .get<string>(
                                                                                                                          "MIRO_CLIENT_SECRET",
                                                                                                                        )
                                                                                                                        ?.trim()
                                                                                                                    : slug ===
                                                                                                                        "canva"
                                                                                                                      ? service.configService
                                                                                                                          .get<string>(
                                                                                                                            "CANVA_CLIENT_SECRET",
                                                                                                                          )
                                                                                                                          ?.trim()
                                                                                                                      : slug ===
                                                                                                                          "webflow"
                                                                                                                        ? service.configService
                                                                                                                            .get<string>(
                                                                                                                              "WEBFLOW_CLIENT_SECRET",
                                                                                                                            )
                                                                                                                            ?.trim()
                                                                                                                        : slug ===
                                                                                                                            "wordpress-com"
                                                                                                                          ? service.configService
                                                                                                                              .get<string>(
                                                                                                                                "WORDPRESS_COM_CLIENT_SECRET",
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
                                                                                                                                  "FIGMA_CLIENT_SECRET",
                                                                                                                                )
                                                                                                                                ?.trim()
                                                                                                                            : slug ===
                                                                                                                                "mindmeister"
                                                                                                                              ? service.configService
                                                                                                                                  .get<string>(
                                                                                                                                    "MINDMEISTER_CLIENT_SECRET",
                                                                                                                                  )
                                                                                                                                  ?.trim()
                                                                                                                              : slug ===
                                                                                                                                  "meistertask"
                                                                                                                                ? service.configService
                                                                                                                                    .get<string>(
                                                                                                                                      "MEISTERTASK_CLIENT_SECRET",
                                                                                                                                    )
                                                                                                                                    ?.trim()
                                                                                                                                : slug ===
                                                                                                                                    "any-do"
                                                                                                                                  ? service.configService
                                                                                                                                      .get<string>(
                                                                                                                                        "ANY_DO_CLIENT_SECRET",
                                                                                                                                      )
                                                                                                                                      ?.trim()
                                                                                                                                  : slug ===
                                                                                                                                      "remember-the-milk"
                                                                                                                                    ? service.configService
                                                                                                                                        .get<string>(
                                                                                                                                          "REMEMBER_THE_MILK_CLIENT_SECRET",
                                                                                                                                        )
                                                                                                                                        ?.trim()
                                                                                                                                    : slug ===
                                                                                                                                        "jane-app"
                                                                                                                                      ? service.configService
                                                                                                                                          .get<string>(
                                                                                                                                            "JANE_APP_CLIENT_SECRET",
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
                                                                                                                                              "LUCID_CLIENT_SECRET",
                                                                                                                                            )
                                                                                                                                            ?.trim()
                                                                                                                                        : slug ===
                                                                                                                                            "frame-io"
                                                                                                                                          ? service.configService
                                                                                                                                              .get<string>(
                                                                                                                                                "FRAME_IO_CLIENT_SECRET",
                                                                                                                                              )
                                                                                                                                              ?.trim()
                                                                                                                                          : service.decryptStateClientSecret(
                                                                                                                                              oauthState,
                                                                                                                                            );
}
