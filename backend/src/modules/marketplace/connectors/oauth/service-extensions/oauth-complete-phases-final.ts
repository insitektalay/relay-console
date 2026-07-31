import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { MarketplaceConnectionEntity } from "../../../../../entities";
import type { MarketplaceConnectorOAuthService } from "../../connector-oauth.service";
import {
  buildOAuthConnectionMetadata,
  buildOAuthStoredCredentials,
} from "../oauth-complete-persistence";

import { runOAuthCompleteInitialPhases } from "./oauth-complete-phases-initial";
async function runOAuthCompletePhase5(
  service: MarketplaceConnectorOAuthService,
  context: Awaited<ReturnType<typeof runOAuthCompleteInitialPhases>>,
) {
  if (
    context.manifest.slug === "pandadoc" &&
    (!context.token.refresh_token || context.token.expires_in !== 31_535_999)
  ) {
    throw new BadRequestException(
      "PandaDoc OAuth did not return the documented 31,535,999-second access token and complete refresh pair; reconnect the workspace",
    );
  }
  if (
    context.manifest.slug === "typeform" &&
    (!context.token.refresh_token || !context.token.expires_in)
  ) {
    throw new BadRequestException(
      "Typeform OAuth did not return a provider expiry and required single-use rotating refresh token; reconnect the workspace",
    );
  }
  if (
    context.manifest.slug === "buffer" &&
    (!context.token.refresh_token || context.token.expires_in !== 3_600)
  ) {
    throw new BadRequestException(
      "Buffer OAuth did not return the documented one-hour access token and required single-use rotating refresh token; reconnect the account",
    );
  }
  if (
    context.manifest.slug === "restream" &&
    (!context.token.refresh_token || !context.token.expires_in)
  ) {
    throw new BadRequestException(
      "Restream OAuth did not return the required expiring access token and rotating refresh token; reconnect the account",
    );
  }
  if (
    context.manifest.slug === "clio-grow" &&
    (!context.token.refresh_token || context.token.expires_in !== 86_400)
  )
    throw new BadRequestException(
      "Clio Grow OAuth did not return the documented 24-hour access token and required single-use rotating refresh token; reconnect the account",
    );
  if (
    context.manifest.slug === "practicepanther" &&
    !context.token.refresh_token
  )
    throw new BadRequestException(
      "PracticePanther OAuth did not return the required rotating refresh token; reconnect the account",
    );
  if (
    context.manifest.slug === "smokeball" &&
    (!context.token.refresh_token || context.token.expires_in !== 3_600)
  )
    throw new BadRequestException(
      "Smokeball OAuth did not return the documented one-hour access token and refresh token; reconnect the firm",
    );
  if (context.manifest.slug === "filevine" && !context.token.refresh_token)
    throw new BadRequestException(
      "Filevine OAuth did not return the required refresh token; reconnect the tenant",
    );
  if (
    ["microsoft-365-ediscovery", "google-vault"].includes(
      context.manifest.slug,
    ) &&
    !context.token.refresh_token
  )
    throw new BadRequestException(
      `${context.manifest.name} OAuth did not return the required offline refresh token; reconnect the account`,
    );
  if (
    context.manifest.slug === "monday-com" &&
    context.token.access_token &&
    !context.token.expires_in &&
    !context.token.expires_at
  ) {
    const expiresAt = service.jwtExpiry(context.token.access_token);
    if (!expiresAt)
      throw new BadRequestException(
        "Monday.com OAuth 2.1 access token did not contain a valid expiry",
      );
    context.token.expires_at = expiresAt;
  }
  let grantedScopes = service.resolveGrantedScopes(
    context.manifest.slug,
    context.token.scope ?? context.token.scopes,
    context.oauthState.scopes,
    context.token.refresh_token,
  );
  service.assertRequiredScopes(context.manifest.slug, grantedScopes, {
    requestedScopes: context.oauthState.scopes,
    refreshToken: context.token.refresh_token,
  });
  if (
    context.manifest.slug === "firebase" &&
    (grantedScopes.length !== 1 ||
      grantedScopes[0] !== "https://www.googleapis.com/auth/firebase.readonly")
  )
    throw new ForbiddenException(
      "Firebase must grant exactly firebase.readonly and no broader Google scopes",
    );
  if (
    context.manifest.slug === "supabase" &&
    (grantedScopes.length !== 2 ||
      !grantedScopes.includes("organizations:read") ||
      !grantedScopes.includes("projects:read"))
  )
    throw new ForbiddenException(
      "Supabase OAuth App must grant exactly organizations:read and projects:read",
    );
  if (
    context.manifest.slug === "bamboohr" &&
    (grantedScopes.length !== 3 ||
      !["field", "meta", "offline_access"].every((scope) =>
        grantedScopes.includes(scope),
      ))
  )
    throw new ForbiddenException(
      "BambooHR must grant exactly field, meta, and offline_access",
    );
  if (
    context.manifest.slug === "greenhouse" &&
    (grantedScopes.length !== 3 ||
      ![
        "harvest:jobs:list",
        "harvest:offices:list",
        "harvest:departments:list",
      ].every((scope) => grantedScopes.includes(scope)))
  )
    throw new ForbiddenException(
      "Greenhouse must grant exactly the Jobs, Offices, and Departments list scopes",
    );
  if (
    context.manifest.slug === "lever" &&
    (grantedScopes.length !== 3 ||
      !["offline_access", "postings:read:admin", "stages:read:admin"].every(
        (scope) => grantedScopes.includes(scope),
      ))
  )
    throw new ForbiddenException(
      "Lever must grant exactly offline_access and the Postings/Stages admin-read scopes",
    );
  if (
    context.manifest.slug === "gmail" &&
    (grantedScopes.length !== 2 ||
      ![
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/gmail.compose",
      ].every((scope) => grantedScopes.includes(scope)))
  )
    throw new ForbiddenException(
      "Gmail must grant exactly gmail.readonly and gmail.compose",
    );
  if (
    context.manifest.slug === "google-calendar" &&
    (grantedScopes.length !== 3 ||
      ![
        "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
        "https://www.googleapis.com/auth/calendar.events.freebusy",
        "https://www.googleapis.com/auth/calendar.events",
      ].every((scope) => grantedScopes.includes(scope)))
  )
    throw new ForbiddenException(
      "Google Calendar must grant exactly calendar.calendarlist.readonly, calendar.events.freebusy, and calendar.events",
    );
  const expiresAt = context.token.expires_in
    ? new Date(Date.now() + context.token.expires_in * 1000)
    : context.token.expires_at &&
        !Number.isNaN(Date.parse(context.token.expires_at))
      ? new Date(context.token.expires_at)
      : context.manifest.slug === "salesforce"
        ? new Date(Date.now() + 15 * 60 * 1000)
        : context.manifest.slug === "hubspot"
          ? new Date(Date.now() + 30 * 60 * 1000)
          : context.manifest.slug === "pipedrive"
            ? new Date(Date.now() + 60 * 60 * 1000)
            : context.manifest.slug === "audius"
              ? new Date(Date.now() + 60 * 60 * 1000)
              : null;
  const providerSession = context.callbackProviderSession;
  const salesforceBinding =
    context.manifest.slug === "salesforce"
      ? service.verifySalesforceTokenResponse(
          context.token,
          context.clientSecret,
        )
      : null;
  const zohoAuthority =
    context.manifest.slug === "zoho-mail"
      ? service.zohoMailAuthorityFromToken(
          context.token,
          context.authority.authorizationUrl,
        )
      : null;
  const zohoWorkDriveAuthority =
    context.manifest.slug === "zoho-workdrive"
      ? service.zohoWorkDriveAuthorityFromToken(
          context.token,
          context.authority.authorizationUrl,
        )
      : null;
  const zohoCrmAuthority =
    context.manifest.slug === "zoho"
      ? service.zohoCrmAuthorityFromToken(
          context.token,
          context.authority.authorizationUrl,
        )
      : null;
  const zohoDeskAuthority =
    context.manifest.slug === "zoho-desk"
      ? service.zohoDeskAuthorityFromToken(
          context.token,
          context.authority.authorizationUrl,
        )
      : null;
  const zohoProjectsAuthority =
    context.manifest.slug === "zoho-projects"
      ? service.zohoCrmAuthorityFromToken(
          context.token,
          context.authority.authorizationUrl,
        )
      : null;
  const zohoBooksAuthority =
    context.manifest.slug === "zoho-books"
      ? service.zohoCrmAuthorityFromToken(
          context.token,
          context.authority.authorizationUrl,
        )
      : null;
  const zohoInvoiceAuthority =
    context.manifest.slug === "zoho-invoice"
      ? service.zohoCrmAuthorityFromToken(
          context.token,
          context.authority.authorizationUrl,
        )
      : null;
  const zohoExpenseAuthority =
    context.manifest.slug === "zoho-expense"
      ? service.zohoCrmAuthorityFromToken(
          context.token,
          context.authority.authorizationUrl,
        )
      : null;
  const zohoPeopleAuthority =
    context.manifest.slug === "zoho-people"
      ? service.zohoPeopleAuthorityFromToken(
          context.token,
          context.authority.authorizationUrl,
        )
      : null;
  const zohoCampaignsAuthority =
    context.manifest.slug === "zoho-campaigns"
      ? service.zohoCampaignsAuthorityFromToken(
          context.token,
          context.authority.authorizationUrl,
        )
      : null;
  const zohoAnalyticsAuthority =
    context.manifest.slug === "zoho-analytics"
      ? service.zohoAnalyticsAuthorityFromToken(
          context.token,
          context.authority.authorizationUrl,
        )
      : null;
  const lineClaims =
    context.manifest.slug === "line"
      ? await service.verifyLineIdToken(
          context.token.id_token,
          context.oauthState.clientId,
          service.stringOrNull(providerSession?.nonce),
        )
      : null;
  const sliteClaims =
    context.manifest.slug === "slite"
      ? await service.verifySliteIdToken(
          context.token.id_token,
          context.oauthState.clientId,
          service.stringOrNull(providerSession?.nonce),
        )
      : null;
  if (context.manifest.slug === "hubstaff") {
    await service.verifyHubstaffIdToken(
      context.token.id_token,
      context.oauthState.clientId,
      service.stringOrNull(providerSession?.nonce),
    );
  }
  return {
    ...context,
    grantedScopes,
    expiresAt,
    providerSession,
    salesforceBinding,
    zohoAuthority,
    zohoWorkDriveAuthority,
    zohoCrmAuthority,
    zohoDeskAuthority,
    zohoProjectsAuthority,
    zohoBooksAuthority,
    zohoInvoiceAuthority,
    zohoExpenseAuthority,
    zohoPeopleAuthority,
    zohoCampaignsAuthority,
    zohoAnalyticsAuthority,
    lineClaims,
    sliteClaims,
  };
}

async function runOAuthCompletePhase6(
  service: MarketplaceConnectorOAuthService,
  context: Awaited<ReturnType<typeof runOAuthCompletePhase5>>,
) {
  const fetchedProfile = await service.fetchProviderProfile(
    context.manifest.slug,
    context.token.access_token,
    context.manifest.slug === "close"
      ? {
          ...(context.providerSession ?? {}),
          closeOrganizationId: service.stringOrNull(
            context.token.organization_id,
          ),
          closeUserId: service.stringOrNull(context.token.user_id),
        }
      : context.manifest.slug === "zendesk"
        ? {
            ...(context.providerSession ?? {}),
            zendeskInstanceOrigin: service.stringOrNull(
              context.providerSession?.zendeskInstanceOrigin,
            ),
          }
        : context.manifest.slug === "wave"
          ? {
              ...(context.providerSession ?? {}),
              waveBusinessId: service.stringOrNull(context.token.businessId),
            }
          : context.salesforceBinding
            ? {
                ...(context.providerSession ?? {}),
                ...context.salesforceBinding,
              }
            : context.manifest.slug === "pipedrive"
              ? {
                  ...(context.providerSession ?? {}),
                  pipedriveApiDomain: service.stringOrNull(
                    context.token.api_domain,
                  ),
                }
              : context.manifest.slug === "surveymonkey"
                ? {
                    ...(context.providerSession ?? {}),
                    surveyMonkeyAccessUrl: service
                      .stringOrNull(context.token.access_url)
                      ?.replace(/\/$/, ""),
                  }
                : context.manifest.slug === "fillout"
                  ? {
                      ...(context.providerSession ?? {}),
                      filloutBaseUrl: service
                        .stringOrNull(context.token.base_url)
                        ?.replace(/\/$/, ""),
                    }
                  : context.manifest.slug === "stripe"
                    ? {
                        ...(context.providerSession ?? {}),
                        stripeAccountId: service.stringOrNull(
                          context.token.stripe_user_id ??
                            context.token.account_id,
                        ),
                        stripeLivemode: context.token.livemode,
                      }
                    : context.sliteClaims
                      ? {
                          ...(context.providerSession ?? {}),
                          sliteClaims: context.sliteClaims,
                        }
                      : context.lineClaims
                        ? {
                            ...(context.providerSession ?? {}),
                            lineSubject: context.lineClaims.sub,
                          }
                        : context.zohoProjectsAuthority
                          ? {
                              ...(context.providerSession ?? {}),
                              zohoAccountsOrigin:
                                context.zohoProjectsAuthority.accountsOrigin,
                              zohoProjectsApiOrigin:
                                context.zohoProjectsAuthority.apiOrigin,
                              zohoRegion: context.zohoProjectsAuthority.region,
                            }
                          : context.zohoDeskAuthority
                            ? {
                                ...(context.providerSession ?? {}),
                                zohoAccountsOrigin:
                                  context.zohoDeskAuthority.accountsOrigin,
                                zohoDeskApiOrigin:
                                  context.zohoDeskAuthority.apiOrigin,
                                zohoRegion: context.zohoDeskAuthority.region,
                              }
                            : context.zohoExpenseAuthority
                              ? {
                                  ...(context.providerSession ?? {}),
                                  zohoAccountsOrigin:
                                    context.zohoExpenseAuthority.accountsOrigin,
                                  zohoExpenseApiOrigin:
                                    context.zohoExpenseAuthority.apiOrigin,
                                  zohoRegion:
                                    context.zohoExpenseAuthority.region,
                                }
                              : context.zohoInvoiceAuthority
                                ? {
                                    ...(context.providerSession ?? {}),
                                    zohoAccountsOrigin:
                                      context.zohoInvoiceAuthority
                                        .accountsOrigin,
                                    zohoInvoiceApiOrigin:
                                      context.zohoInvoiceAuthority.apiOrigin,
                                    zohoRegion:
                                      context.zohoInvoiceAuthority.region,
                                  }
                                : context.zohoBooksAuthority
                                  ? {
                                      ...(context.providerSession ?? {}),
                                      zohoAccountsOrigin:
                                        context.zohoBooksAuthority
                                          .accountsOrigin,
                                      zohoBooksApiOrigin:
                                        context.zohoBooksAuthority.apiOrigin,
                                      zohoRegion:
                                        context.zohoBooksAuthority.region,
                                    }
                                  : context.zohoAuthority
                                    ? {
                                        ...(context.providerSession ?? {}),
                                        zohoAccountsOrigin:
                                          context.zohoAuthority.accountsOrigin,
                                        zohoMailOrigin:
                                          context.zohoAuthority.mailOrigin,
                                        zohoRegion:
                                          context.zohoAuthority.region,
                                      }
                                    : context.zohoWorkDriveAuthority
                                      ? {
                                          ...(context.providerSession ?? {}),
                                          zohoAccountsOrigin:
                                            context.zohoWorkDriveAuthority
                                              .accountsOrigin,
                                          zohoWorkDriveApiOrigin:
                                            context.zohoWorkDriveAuthority
                                              .apiOrigin,
                                          zohoWorkDriveDownloadOrigin:
                                            context.zohoWorkDriveAuthority
                                              .downloadOrigin,
                                          zohoWorkDriveUploadOrigin:
                                            context.zohoWorkDriveAuthority
                                              .uploadOrigin,
                                          zohoRegion:
                                            context.zohoWorkDriveAuthority
                                              .region,
                                        }
                                      : context.zohoCrmAuthority
                                        ? {
                                            ...(context.providerSession ?? {}),
                                            zohoAccountsOrigin:
                                              context.zohoCrmAuthority
                                                .accountsOrigin,
                                            zohoCrmApiOrigin:
                                              context.zohoCrmAuthority
                                                .apiOrigin,
                                            zohoRegion:
                                              context.zohoCrmAuthority.region,
                                          }
                                        : context.zohoPeopleAuthority
                                          ? {
                                              ...(context.providerSession ??
                                                {}),
                                              zohoAccountsOrigin:
                                                context.zohoPeopleAuthority
                                                  .accountsOrigin,
                                              zohoPeopleApiOrigin:
                                                context.zohoPeopleAuthority
                                                  .apiOrigin,
                                              zohoRegion:
                                                context.zohoPeopleAuthority
                                                  .region,
                                            }
                                          : context.zohoCampaignsAuthority
                                            ? {
                                                ...(context.providerSession ??
                                                  {}),
                                                zohoAccountsOrigin:
                                                  context.zohoCampaignsAuthority
                                                    .accountsOrigin,
                                                zohoCampaignsApiOrigin:
                                                  context.zohoCampaignsAuthority
                                                    .apiOrigin,
                                                zohoRegion:
                                                  context.zohoCampaignsAuthority
                                                    .region,
                                              }
                                            : context.zohoAnalyticsAuthority
                                              ? {
                                                  ...(context.providerSession ??
                                                    {}),
                                                  zohoAccountsOrigin:
                                                    context
                                                      .zohoAnalyticsAuthority
                                                      .accountsOrigin,
                                                  zohoAnalyticsApiOrigin:
                                                    context
                                                      .zohoAnalyticsAuthority
                                                      .apiOrigin,
                                                  zohoRegion:
                                                    context
                                                      .zohoAnalyticsAuthority
                                                      .region,
                                                }
                                              : context.pCloudAuthority
                                                ? {
                                                    ...(context.providerSession ??
                                                      {}),
                                                    pCloudApiOrigin:
                                                      context.pCloudAuthority
                                                        .apiOrigin,
                                                    pCloudLocationId:
                                                      context.pCloudAuthority
                                                        .locationId,
                                                    pCloudUserId:
                                                      context.token.uid ===
                                                      undefined
                                                        ? null
                                                        : String(
                                                            context.token.uid,
                                                          ),
                                                  }
                                                : context.shareFileAuthority
                                                  ? {
                                                      ...(context.providerSession ??
                                                        {}),
                                                      shareFileApiOrigin:
                                                        context
                                                          .shareFileAuthority
                                                          .apiOrigin,
                                                    }
                                                  : context.deputyAuthority
                                                    ? {
                                                        ...(context.providerSession ??
                                                          {}),
                                                        deputyApiOrigin:
                                                          context
                                                            .deputyAuthority
                                                            .apiOrigin,
                                                      }
                                                    : context.ahaAuthority
                                                      ? {
                                                          ...(context.providerSession ??
                                                            {}),
                                                          ahaAccountSubdomain:
                                                            context.ahaAuthority
                                                              .accountSubdomain,
                                                          ahaApiOrigin:
                                                            context.ahaAuthority
                                                              .apiOrigin,
                                                        }
                                                      : context.providerSession,
    context.token,
    context.grantedScopes,
  );
  const profile =
    context.manifest.slug === "miro"
      ? {
          ...(fetchedProfile &&
          typeof fetchedProfile === "object" &&
          !Array.isArray(fetchedProfile)
            ? (fetchedProfile as Record<string, unknown>)
            : {}),
          miroUserId: service.stringOrNull(context.token.user_id),
          miroTeamId: service.stringOrNull(context.token.team_id),
        }
      : context.manifest.slug === "guru"
        ? {
            ...(fetchedProfile &&
            typeof fetchedProfile === "object" &&
            !Array.isArray(fetchedProfile)
              ? (fetchedProfile as Record<string, unknown>)
              : {}),
            guruOAuthUserId: service.stringOrNull(context.token.user_id),
          }
        : fetchedProfile;
  if (
    context.manifest.slug === "ringcentral" &&
    service.stringOrNull(context.token.owner_id) !==
      service.stringOrNull((profile as Record<string, unknown>).id)
  ) {
    throw new ForbiddenException(
      "RingCentral token owner does not match the connected extension",
    );
  }
  if (context.manifest.slug === "harvest") {
    const accountId = service.positiveNumericId(
      (profile as Record<string, unknown>).harvestAccountId,
    );
    if (!accountId)
      throw new BadRequestException("Harvest account binding is invalid");
    const exactScope = `harvest:${accountId}`;
    if (
      context.grantedScopes.length &&
      !context.grantedScopes.includes(exactScope)
    )
      throw new ForbiddenException(
        "Harvest did not return the selected single-account grant",
      );
    context.grantedScopes = [exactScope];
  }
  const refreshTokenExpiresAt = context.token.refresh_token_expires_in
    ? new Date(
        Date.now() + context.token.refresh_token_expires_in * 1000,
      ).toISOString()
    : context.manifest.slug === "front" && context.token.refresh_token
      ? new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString()
      : undefined;
  const storedCredentials = buildOAuthStoredCredentials(service, {
    manifest: context.manifest,
    oauthState: context.oauthState,
    clientSecret: context.clientSecret,
    token: context.token,
    providerSession: context.providerSession,
    refreshTokenExpiresAt,
    expiresAt: context.expiresAt,
    grantedScopes: context.grantedScopes,
    shareFileAuthority: context.shareFileAuthority,
    deputyAuthority: context.deputyAuthority,
    pCloudAuthority: context.pCloudAuthority,
    ahaAuthority: context.ahaAuthority,
  });
  const encrypted = service.credentials.encrypt(storedCredentials);
  const existing = context.oauthState.reauthorizeConnectionId
    ? await service.getConnectionWithSecrets(
        context.oauthState.workspaceId,
        context.manifest.slug,
        context.oauthState.reauthorizeConnectionId,
      )
    : null;
  const metadata = buildOAuthConnectionMetadata(service, {
    manifest: context.manifest,
    oauthState: context.oauthState,
    grantedScopes: context.grantedScopes,
    profile,
    authority: context.authority,
    token: context.token,
    providerSession: context.providerSession,
    shareFileAuthority: context.shareFileAuthority,
    deputyAuthority: context.deputyAuthority,
    pCloudAuthority: context.pCloudAuthority,
    ahaAuthority: context.ahaAuthority,
    zohoAuthority: context.zohoAuthority,
    zohoWorkDriveAuthority: context.zohoWorkDriveAuthority,
    zohoCrmAuthority: context.zohoCrmAuthority,
    zohoBooksAuthority: context.zohoBooksAuthority,
    zohoInvoiceAuthority: context.zohoInvoiceAuthority,
    zohoExpenseAuthority: context.zohoExpenseAuthority,
    zohoDeskAuthority: context.zohoDeskAuthority,
    zohoProjectsAuthority: context.zohoProjectsAuthority,
    zohoPeopleAuthority: context.zohoPeopleAuthority,
    zohoCampaignsAuthority: context.zohoCampaignsAuthority,
    zohoAnalyticsAuthority: context.zohoAnalyticsAuthority,
  });
  return {
    ...context,
    fetchedProfile,
    profile,
    refreshTokenExpiresAt,
    storedCredentials,
    encrypted,
    existing,
    metadata,
  };
}

async function runOAuthCompletePhase7(
  service: MarketplaceConnectorOAuthService,
  context: Awaited<ReturnType<typeof runOAuthCompletePhase6>>,
) {
  const connectionInput: Partial<MarketplaceConnectionEntity> = {
    workspaceId: context.oauthState.workspaceId,
    appSlug: context.manifest.slug,
    displayName: context.oauthState.displayName,
    environment: context.oauthState.environment,
    authType:
      context.manifest.auth.oauth?.pkce === false
        ? "oauth2_authorization_code"
        : "oauth2_pkce_user",
    credentialNames: [
      `${context.manifest.slug.toUpperCase()}_OAUTH_TOKEN_BUNDLE`,
      ...(context.clientSecret &&
      ![
        "box",
        "dropbox",
        "dropbox-paper",
        "pcloud",
        "sharefile",
        "deputy",
        "zoho-workdrive",
        "zoho-people",
        "zoho-campaigns",
        "zoho-analytics",
        "inoreader",
        "guru",
        "vimeo",
        "wistia",
        "frame-io",
        "mural",
        "figjam",
        "figma",
        "miro",
        "canva",
        "webflow",
        "wordpress-com",
        "sharepoint",
        "microsoft-planner",
        "microsoft-to-do",
        "microsoft-lists",
        "jane-app",
        "onenote",
        "microsoft-bookings",
        "microsoft-power-bi",
        "microsoft-dynamics-365",
        "microsoft-viva-engage",
        "zoom",
        "shopify",
        "stripe",
        "zoho",
        "copper",
        "surveymonkey",
        "fillout",
        "mailchimp",
        "klaviyo",
        "convertkit",
        "campaign-monitor",
        "constant-contact",
        "close",
        "zendesk",
        "intercom",
        "help-scout",
        "front",
        "teamwork",
        "basecamp",
        "wrike",
        "smartsheet",
        "todoist",
        "ticktick",
        "harvest",
        "calendly",
        "cal-com",
        "docusign",
        "dropbox-sign",
        "pandadoc",
        "typeform",
        "sendfox",
        "beehiiv",
        "clio-manage",
        "clio-grow",
        "practicepanther",
        "smokeball",
        "lawpay",
        "filevine",
      ].includes(context.manifest.slug)
        ? [
            context.manifest.slug === "dropbox-sign"
              ? "DROPBOX_SIGN_CLIENT_SECRET"
              : context.manifest.slug === "clio-manage"
                ? "CLIO_MANAGE_CLIENT_SECRET"
                : context.manifest.slug === "clio-grow"
                  ? "CLIO_GROW_CLIENT_SECRET"
                  : context.manifest.slug === "practicepanther"
                    ? "PRACTICEPANTHER_CLIENT_SECRET"
                    : `${context.manifest.slug.toUpperCase()}_CLIENT_SECRET`,
          ]
        : []),
      ...(context.manifest.slug === "smokeball" ? ["SMOKEBALL_API_KEY"] : []),
    ],
    secretCiphertext: context.encrypted.ciphertext,
    secretIv: context.encrypted.iv,
    secretAuthTag: context.encrypted.authTag,
    secretKeyVersion: context.encrypted.keyVersion,
    selectedCapabilities: context.oauthState.selectedCapabilities,
    status: "ready",
    lastValidatedAt: new Date(),
    metadata: context.metadata,
    createdByUserId:
      context.existing?.createdByUserId ?? context.oauthState.userId,
    updatedByUserId: context.oauthState.userId,
    lastErrorCode: null,
    lastErrorMessage: null,
  };
  const connection = await service.connectionRepo.save(
    context.existing
      ? Object.assign(context.existing, connectionInput)
      : service.connectionRepo.create(connectionInput),
  );
  await service.consumeOAuthState(context.oauthState);
  await service.auditLogService.record({
    actorType: "user",
    actorId: context.oauthState.userId,
    workspaceId: context.oauthState.workspaceId,
    eventType: `marketplace.${context.manifest.slug}.oauth.completed`,
    resourceType: "marketplace_connection",
    resourceId: connection.id,
    metadata: {
      grantedScopes: context.grantedScopes,
      accountLabel:
        service.stringOrNull(context.metadata.primaryMailboxAddress) ??
        service.stringOrNull(context.metadata.displayName),
      tenantId: service.stringOrNull(context.metadata.tenantId),
    },
  });
  await service.toolRequestService.resolveToolRequestsFromConnection({
    workspaceId: context.oauthState.workspaceId,
    appSlug: context.manifest.slug,
    selectedCapabilities: connection.selectedCapabilities,
  });
  return {
    connection: service.toConnectionView(connection),
    returnTo: service.appendOAuthResult(
      context.oauthState.returnTo,
      connection.id,
    ),
  };
}

export async function runOAuthCompletePhases(
  service: MarketplaceConnectorOAuthService,
  context: {
    appSlug: string;
    input: Parameters<MarketplaceConnectorOAuthService["completeOAuth"]>[1];
  },
) {
  const phase4 = await runOAuthCompleteInitialPhases(service, context);
  const phase5 = await runOAuthCompletePhase5(service, phase4);
  const phase6 = await runOAuthCompletePhase6(service, phase5);
  return runOAuthCompletePhase7(service, phase6);
}
