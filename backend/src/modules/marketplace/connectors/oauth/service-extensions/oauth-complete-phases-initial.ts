import { BadRequestException } from "@nestjs/common";
import { assertMarketplaceBetaGateAllowed } from "../../../marketplace-beta-gate";
import { RELAY_GOOGLE_OAUTH_SLUGS } from "../google-oauth-providers";
import type { MarketplaceConnectorOAuthService } from "../../connector-oauth.service";
import { resolveOAuthCompleteClientSecret } from "../oauth-complete-client-secret";
import { exchangeOAuthCompletionToken } from "../oauth-complete-token-exchange";

async function runOAuthCompletePhase1(
  service: MarketplaceConnectorOAuthService,
  context: {
    appSlug: string;
    input: Parameters<MarketplaceConnectorOAuthService["completeOAuth"]>[1];
  },
) {
  const manifest = service.requireOAuthManifest(context.appSlug);
  if (!service.stringOrNull(context.input.state)) {
    throw new BadRequestException(`Invalid ${manifest.name} OAuth state`);
  }
  if (
    manifest.slug !== "7shifts" &&
    !service.stringOrNull(context.input.code)
  ) {
    throw new BadRequestException(`${manifest.name} OAuth code is required`);
  }
  if (
    manifest.slug === "7shifts" &&
    (!service.stringOrNull(context.input.companyGuid) ||
      !service.stringOrNull(context.input.companyId))
  ) {
    throw new BadRequestException(
      "7shifts company authorization is incomplete",
    );
  }
  const oauthState = await service.oauthStateRepo
    .createQueryBuilder("state")
    .addSelect([
      "state.legacyCodeVerifier",
      "state.codeVerifierCiphertext",
      "state.codeVerifierIv",
      "state.codeVerifierAuthTag",
      "state.codeVerifierKeyVersion",
      "state.clientSecretCiphertext",
      "state.clientSecretIv",
      "state.clientSecretAuthTag",
      "state.clientSecretKeyVersion",
      "state.providerSessionCiphertext",
      "state.providerSessionIv",
      "state.providerSessionAuthTag",
      "state.providerSessionKeyVersion",
    ])
    .where("state.stateHash = :stateHash", {
      stateHash: service.hashState(context.input.state),
    })
    .getOne();
  if (!oauthState || oauthState.appSlug !== manifest.slug) {
    throw new BadRequestException(`Invalid ${manifest.name} OAuth state`);
  }
  if (oauthState.consumedAt)
    throw new BadRequestException(
      `${manifest.name} OAuth state was already used`,
    );
  if (oauthState.expiresAt.getTime() < Date.now()) {
    throw new BadRequestException(`${manifest.name} OAuth state expired`);
  }
  assertMarketplaceBetaGateAllowed({
    slug: manifest.slug,
    name: manifest.name,
    sourceType: "external_provider",
  });
  const codeVerifier =
    manifest.auth.oauth?.pkce !== false
      ? service.decryptStateCodeVerifier(manifest.name, oauthState)
      : null;
  const dropboxClientSecret =
    manifest.slug === "dropbox"
      ? service.configService.get<string>("DROPBOX_CLIENT_SECRET")?.trim()
      : null;
  const boxClientSecret =
    manifest.slug === "box"
      ? service.configService.get<string>("BOX_CLIENT_SECRET")?.trim()
      : null;
  const googleClientSecret = RELAY_GOOGLE_OAUTH_SLUGS.has(manifest.slug)
    ? service.configService.get<string>("GOOGLE_OAUTH_CLIENT_SECRET")?.trim()
    : null;
  const signNowClientSecret =
    manifest.slug === "signnow"
      ? service.configService.get<string>("SIGNNOW_CLIENT_SECRET")?.trim()
      : null;
  const signRequestClientSecret =
    manifest.slug === "signrequest"
      ? service.configService.get<string>("SIGNREQUEST_CLIENT_SECRET")?.trim()
      : null;
  const signeasyClientSecret =
    manifest.slug === "signeasy"
      ? service.configService.get<string>("SIGNEASY_CLIENT_SECRET")?.trim()
      : null;
  const rightSignatureClientSecret =
    manifest.slug === "rightsignature"
      ? service.configService
          .get<string>("RIGHTSIGNATURE_CLIENT_SECRET")
          ?.trim()
      : null;
  const restreamClientSecret =
    manifest.slug === "restream"
      ? service.configService.get<string>("RESTREAM_CLIENT_SECRET")?.trim()
      : null;
  const attioClientSecret =
    manifest.slug === "attio"
      ? service.configService.get<string>("ATTIO_CLIENT_SECRET")?.trim()
      : null;
  const providerClientSecret = resolveOAuthCompleteClientSecret(
    service,
    manifest.slug,
    oauthState,
  );
  const batch6ClientSecret =
    manifest.slug === "threads"
      ? service.configService.get<string>("THREADS_APP_SECRET")?.trim()
      : manifest.slug === "pinterest"
        ? service.configService.get<string>("PINTEREST_APP_SECRET")?.trim()
        : manifest.slug === "tumblr"
          ? service.configService.get<string>("TUMBLR_CONSUMER_SECRET")?.trim()
          : manifest.slug === "mastodon"
            ? providerClientSecret
            : null;
  const clientSecret =
    service.resolveBatch23OAuthClientSecret(manifest.slug) ??
    batch6ClientSecret ??
    googleClientSecret ??
    boxClientSecret ??
    dropboxClientSecret ??
    signNowClientSecret ??
    signRequestClientSecret ??
    signeasyClientSecret ??
    rightSignatureClientSecret ??
    restreamClientSecret ??
    attioClientSecret ??
    providerClientSecret;
  if (manifest.slug === "adobe-acrobat-sign" && !clientSecret)
    throw new BadRequestException(
      "Adobe Acrobat Sign client secret is not configured on Railway",
    );
  if (manifest.slug === "signnow" && !clientSecret)
    throw new BadRequestException(
      "SignNow client secret is not configured on Railway",
    );
  if (manifest.slug === "signrequest" && !clientSecret)
    throw new BadRequestException(
      "SignRequest client secret is not configured on Railway",
    );
  if (manifest.slug === "signeasy" && !clientSecret)
    throw new BadRequestException(
      "Signeasy client secret is not configured on Railway",
    );
  if (manifest.slug === "rightsignature" && !clientSecret)
    throw new BadRequestException(
      "RightSignature client secret is not configured on Railway",
    );
  if (manifest.slug === "freeagent" && !clientSecret)
    throw new BadRequestException(
      "FreeAgent client secret is not configured on Railway",
    );
  if (manifest.slug === "salesforce" && !clientSecret)
    throw new BadRequestException(
      "Salesforce client secret is not configured on Railway",
    );
  if (manifest.slug === "hubspot" && !clientSecret)
    throw new BadRequestException(
      "HubSpot client secret is not configured on Railway",
    );
  if (manifest.slug === "pipedrive" && !clientSecret)
    throw new BadRequestException(
      "Pipedrive client secret is not configured on Railway",
    );
  if (manifest.slug === "zoho" && !clientSecret)
    throw new BadRequestException(
      "Zoho CRM client secret is not configured on Railway",
    );
  if (manifest.slug === "zoho-desk" && !clientSecret)
    throw new BadRequestException(
      "Zoho Desk client secret is not configured on Railway",
    );
  if (manifest.slug === "zoho-projects" && !clientSecret)
    throw new BadRequestException(
      "Zoho Projects client secret is not configured on Railway",
    );
  if (manifest.slug === "zoho-people" && !clientSecret)
    throw new BadRequestException(
      "Zoho People client secret is not configured on Railway",
    );
  if (manifest.slug === "zoho-campaigns" && !clientSecret)
    throw new BadRequestException(
      "Zoho Campaigns client secret is not configured on Railway",
    );
  if (manifest.slug === "zoho-analytics" && !clientSecret)
    throw new BadRequestException(
      "Zoho Analytics client secret is not configured on Railway",
    );
  if (manifest.slug === "copper" && !clientSecret)
    throw new BadRequestException(
      "Copper client secret is not configured on Railway",
    );
  if (manifest.slug === "surveymonkey" && !clientSecret)
    throw new BadRequestException(
      "SurveyMonkey client secret is not configured on Railway",
    );
  if (manifest.slug === "fillout" && !clientSecret)
    throw new BadRequestException(
      "Fillout client secret is not configured on Railway",
    );
  if (manifest.slug === "mailchimp" && !clientSecret)
    throw new BadRequestException(
      "Mailchimp client secret is not configured on Railway",
    );
  if (manifest.slug === "mailchimp-surveys" && !clientSecret)
    throw new BadRequestException(
      "Mailchimp Surveys client secret is not configured on Railway",
    );
  if (manifest.slug === "klaviyo-sms" && !clientSecret)
    throw new BadRequestException(
      "Klaviyo SMS client secret is not configured on Railway",
    );
  if (manifest.slug === "klaviyo" && !clientSecret)
    throw new BadRequestException(
      "Klaviyo client secret is not configured on Railway",
    );
  if (manifest.slug === "convertkit" && !clientSecret)
    throw new BadRequestException(
      "Kit client secret is not configured on Railway",
    );
  if (manifest.slug === "campaign-monitor" && !clientSecret)
    throw new BadRequestException(
      "Campaign Monitor client secret is not configured on Railway",
    );
  if (manifest.slug === "constant-contact" && !clientSecret)
    throw new BadRequestException(
      "Constant Contact client secret is not configured on Railway",
    );
  if (manifest.slug === "close" && !clientSecret)
    throw new BadRequestException(
      "Close client secret is not configured on Railway",
    );
  if (manifest.slug === "attio" && !clientSecret)
    throw new BadRequestException(
      "Attio public app client secret is not configured on Railway",
    );
  if (manifest.slug === "zendesk" && !clientSecret)
    throw new BadRequestException(
      "Zendesk global OAuth client secret is not configured on Railway",
    );
  if (manifest.slug === "zoom" && !clientSecret)
    throw new BadRequestException(
      "Zoom OAuth client secret is not configured on Railway",
    );
  if (manifest.slug === "intercom" && !clientSecret)
    throw new BadRequestException(
      "Intercom public app client secret is not configured on Railway",
    );
  if (manifest.slug === "help-scout" && !clientSecret)
    throw new BadRequestException(
      "Help Scout OAuth app client secret is not configured on Railway",
    );
  if (manifest.slug === "front" && !clientSecret)
    throw new BadRequestException(
      "Front OAuth app client secret is not configured on Railway",
    );
  if (manifest.slug === "teamwork" && !clientSecret)
    throw new BadRequestException(
      "Teamwork App Login client secret is not configured on Railway",
    );
  if (manifest.slug === "basecamp" && !clientSecret)
    throw new BadRequestException(
      "Basecamp OAuth client secret is not configured on Railway",
    );
  if (manifest.slug === "wrike" && !clientSecret)
    throw new BadRequestException(
      "Wrike OAuth client secret is not configured on Railway",
    );
  if (manifest.slug === "smartsheet" && !clientSecret)
    throw new BadRequestException(
      "Smartsheet OAuth client secret is not configured on Railway",
    );
  if (manifest.slug === "todoist" && !clientSecret)
    throw new BadRequestException(
      "Todoist OAuth client secret is not configured on Railway",
    );
  if (manifest.slug === "ticktick" && !clientSecret)
    throw new BadRequestException(
      "TickTick OAuth client secret is not configured on Railway",
    );
  if (manifest.slug === "harvest" && !clientSecret)
    throw new BadRequestException(
      "Harvest OAuth client secret is not configured on Railway",
    );
  if (manifest.slug === "calendly" && !clientSecret)
    throw new BadRequestException(
      "Calendly OAuth client secret is not configured on Railway",
    );
  if (manifest.slug === "cal-com" && !clientSecret)
    throw new BadRequestException(
      "Cal.com OAuth client secret is not configured on Railway",
    );
  if (manifest.slug === "docusign" && !clientSecret)
    throw new BadRequestException(
      "Docusign integration-key secret is not configured on Railway",
    );
  if (manifest.slug === "dropbox-sign" && !clientSecret)
    throw new BadRequestException(
      "Dropbox Sign OAuth API App client secret is not configured on Railway",
    );
  if (manifest.slug === "pandadoc" && !clientSecret)
    throw new BadRequestException(
      "PandaDoc OAuth client secret is not configured on Railway",
    );
  if (manifest.slug === "typeform" && !clientSecret)
    throw new BadRequestException(
      "Typeform OAuth client secret is not configured on Railway",
    );
  if (manifest.slug === "sendfox" && !clientSecret)
    throw new BadRequestException(
      "SendFox OAuth client secret is not configured on Railway",
    );
  if (manifest.slug === "beehiiv" && !clientSecret)
    throw new BadRequestException(
      "beehiiv OAuth client secret is not configured on Railway",
    );
  if (manifest.slug === "buffer" && !clientSecret)
    throw new BadRequestException(
      "Buffer OAuth client secret is not configured on Railway",
    );
  return {
    ...context,
    manifest,
    oauthState,
    codeVerifier,
    dropboxClientSecret,
    boxClientSecret,
    googleClientSecret,
    signNowClientSecret,
    signRequestClientSecret,
    signeasyClientSecret,
    rightSignatureClientSecret,
    restreamClientSecret,
    attioClientSecret,
    providerClientSecret,
    batch6ClientSecret,
    clientSecret,
  };
}

async function runOAuthCompletePhase2(
  service: MarketplaceConnectorOAuthService,
  context: Awaited<ReturnType<typeof runOAuthCompletePhase1>>,
) {
  if (
    [
      "clio-manage",
      "clio-grow",
      "practicepanther",
      "smokeball",
      "lawpay",
      "filevine",
      "microsoft-365-ediscovery",
      "google-vault",
    ].includes(context.manifest.slug) &&
    !context.clientSecret
  )
    throw new BadRequestException(
      `${context.manifest.name} OAuth client secret is not configured on Railway`,
    );
  if (
    context.manifest.slug === "smokeball" &&
    !service.configService.get<string>("SMOKEBALL_API_KEY")?.trim()
  )
    throw new BadRequestException(
      "Smokeball provider-issued API key is not configured on Railway",
    );
  if (context.manifest.slug === "threads" && !context.clientSecret)
    throw new BadRequestException(
      "Threads app secret is not configured on Railway",
    );
  if (context.manifest.slug === "pinterest" && !context.clientSecret)
    throw new BadRequestException(
      "Pinterest app secret is not configured on Railway",
    );
  if (context.manifest.slug === "tumblr" && !context.clientSecret)
    throw new BadRequestException(
      "Tumblr consumer secret is not configured on Railway",
    );
  if (context.manifest.slug === "mastodon" && !context.clientSecret)
    throw new BadRequestException(
      "Mastodon dynamic app registration did not return a client secret",
    );
  if (context.manifest.slug === "nationbuilder" && !context.clientSecret)
    throw new BadRequestException(
      "NationBuilder OAuth client secret is not configured on Railway",
    );
  if (context.manifest.slug === "shopify") {
    service.validateShopifyCallback(context.input, context.clientSecret);
  }
  const stateAuthority = service.oauthStateAuthority(
    context.manifest.slug,
    context.oauthState,
  );
  if (context.manifest.slug === "pcloud" && !context.clientSecret) {
    throw new BadRequestException(
      "pCloud client secret is not configured on Railway",
    );
  }
  const shareFileAuthority =
    context.manifest.slug === "sharefile"
      ? service.shareFileAuthorityFromCallback(
          context.input,
          context.clientSecret,
        )
      : null;
  const pCloudAuthority =
    context.manifest.slug === "pcloud"
      ? service.pCloudAuthorityFromCallback(context.input)
      : null;
  const ahaAuthority =
    context.manifest.slug === "aha"
      ? service.ahaAuthorityFromCallback(context.input.accountSubdomain)
      : null;
  const adobeAcrobatSignAuthority =
    context.manifest.slug === "adobe-acrobat-sign"
      ? service.adobeAcrobatSignAuthority(
          context.input.adobeApiAccessPoint ?? "",
        )
      : null;
  const authority =
    adobeAcrobatSignAuthority ??
    ahaAuthority ??
    pCloudAuthority ??
    shareFileAuthority ??
    (context.manifest.slug === "zoho-expense" &&
    service.stringOrNull(context.input.accountsServer)
      ? service.zohoCrmAuthority(context.input.accountsServer!)
      : null) ??
    (context.manifest.slug === "zoho-invoice" &&
    service.stringOrNull(context.input.accountsServer)
      ? service.zohoCrmAuthority(context.input.accountsServer!)
      : null) ??
    (context.manifest.slug === "zoho-books" &&
    service.stringOrNull(context.input.accountsServer)
      ? service.zohoCrmAuthority(context.input.accountsServer!)
      : null) ??
    (context.manifest.slug === "zoho" &&
    service.stringOrNull(context.input.accountsServer)
      ? service.zohoCrmAuthority(context.input.accountsServer!)
      : null) ??
    (context.manifest.slug === "zoho-desk" &&
    service.stringOrNull(context.input.accountsServer)
      ? service.zohoDeskAuthority(context.input.accountsServer!)
      : null) ??
    (context.manifest.slug === "zoho-projects" &&
    service.stringOrNull(context.input.accountsServer)
      ? service.zohoCrmAuthority(context.input.accountsServer!)
      : null) ??
    (context.manifest.slug === "zoho-workdrive" &&
    service.stringOrNull(context.input.accountsServer)
      ? service.zohoWorkDriveAuthority(context.input.accountsServer!)
      : null) ??
    (context.manifest.slug === "zoho-people" &&
    service.stringOrNull(context.input.accountsServer)
      ? service.zohoPeopleAuthority(context.input.accountsServer!)
      : null) ??
    (context.manifest.slug === "zoho-campaigns" &&
    service.stringOrNull(context.input.accountsServer)
      ? service.zohoCampaignsAuthority(context.input.accountsServer!)
      : null) ??
    (context.manifest.slug === "zoho-analytics" &&
    service.stringOrNull(context.input.accountsServer)
      ? service.zohoAnalyticsAuthority(context.input.accountsServer!)
      : stateAuthority);
  const stateProviderSession = service.decryptStateProviderSession(
    context.oauthState,
  );
  const callbackProviderSession =
    context.manifest.slug === "adobe-acrobat-sign"
      ? {
          ...(stateProviderSession ?? {}),
          adobeAcrobatSignApiOrigin: adobeAcrobatSignAuthority?.apiOrigin,
        }
      : context.manifest.slug === "myob"
        ? {
            ...(stateProviderSession ?? {}),
            myobBusinessId: service.stringOrNull(context.input.businessId),
          }
        : context.manifest.slug === "7shifts"
          ? {
              ...(stateProviderSession ?? {}),
              sevenShiftsCompanyGuid: service.stringOrNull(
                context.input.companyGuid,
              ),
              sevenShiftsCompanyId: service.stringOrNull(
                context.input.companyId,
              ),
            }
          : context.manifest.slug === "quickbooks"
            ? {
                ...(stateProviderSession ?? {}),
                quickbooksRealmId: service.stringOrNull(context.input.realmId),
                quickbooksEnvironment: service.quickBooksEnvironment(),
              }
            : stateProviderSession;
  if (
    context.manifest.slug === "myob" &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      service.stringOrNull(callbackProviderSession?.myobBusinessId) ?? "",
    )
  ) {
    throw new BadRequestException(
      "MYOB callback did not include a valid company-file businessId",
    );
  }
  if (context.manifest.slug === "shopify") {
    const callbackShop = service.normalizeShopifyDomain(
      service.stringOrNull(context.input.shopifyShop) ?? "",
    );
    const stateShop = service.normalizeShopifyDomain(
      service.stringOrNull(callbackProviderSession?.shopDomain) ?? "",
    );
    if (callbackShop !== stateShop || authority.mode !== stateShop) {
      throw new BadRequestException(
        "Shopify callback shop does not match the authorized shop",
      );
    }
  }
  if (context.manifest.slug === "zendesk") {
    const sessionOrigin = service.normalizeZendeskInstance(
      service.stringOrNull(callbackProviderSession?.zendeskInstanceOrigin) ??
        "",
    );
    if (
      new URL(authority.authorizationUrl).origin !== sessionOrigin ||
      new URL(authority.tokenUrl).origin !== sessionOrigin
    )
      throw new BadRequestException(
        "Zendesk OAuth state does not match the authorized Support instance",
      );
  }
  if (
    context.manifest.slug === "zoho-workdrive" &&
    service.stringOrNull(context.input.location)
  ) {
    const location = service
      .stringOrNull(context.input.location)!
      .toLowerCase();
    if (location !== authority.mode) {
      throw new BadRequestException(
        "Zoho WorkDrive callback location does not match its Accounts data center",
      );
    }
  }
  if (
    context.manifest.slug === "zoho-people" &&
    service.stringOrNull(context.input.location)
  ) {
    const location = service
      .stringOrNull(context.input.location)!
      .toLowerCase();
    if (location !== authority.mode) {
      throw new BadRequestException(
        "Zoho People callback location does not match its Accounts data center",
      );
    }
  }
  if (
    context.manifest.slug === "zoho-campaigns" &&
    service.stringOrNull(context.input.location)
  ) {
    const location = service
      .stringOrNull(context.input.location)!
      .toLowerCase();
    if (location !== authority.mode) {
      throw new BadRequestException(
        "Zoho Campaigns callback location does not match its Accounts data center",
      );
    }
  }
  if (
    context.manifest.slug === "zoho-analytics" &&
    service.stringOrNull(context.input.location)
  ) {
    const location = service
      .stringOrNull(context.input.location)!
      .toLowerCase();
    if (location !== authority.mode) {
      throw new BadRequestException(
        "Zoho Analytics callback location does not match its Accounts data center",
      );
    }
  }
  if (
    context.manifest.slug === "zoho" &&
    service.stringOrNull(context.input.location)
  ) {
    const location = service
      .stringOrNull(context.input.location)!
      .toLowerCase();
    if (location !== authority.mode) {
      throw new BadRequestException(
        "Zoho CRM callback location does not match its Accounts data center",
      );
    }
  }
  if (
    context.manifest.slug === "zoho-desk" &&
    service.stringOrNull(context.input.location)
  ) {
    const location = service
      .stringOrNull(context.input.location)!
      .toLowerCase();
    if (location !== authority.mode)
      throw new BadRequestException(
        "Zoho Desk callback location does not match its Accounts data center",
      );
  }
  if (
    context.manifest.slug === "zoho-projects" &&
    service.stringOrNull(context.input.location) &&
    service.stringOrNull(context.input.location)!.toLowerCase() !==
      authority.mode
  )
    throw new BadRequestException(
      "Zoho Projects callback location does not match its Accounts data center",
    );
  if (
    context.manifest.slug === "zoho-books" &&
    service.stringOrNull(context.input.location) &&
    service.stringOrNull(context.input.location)!.toLowerCase() !==
      authority.mode
  )
    throw new BadRequestException(
      "Zoho Books callback location does not match its Accounts data center",
    );
  if (
    context.manifest.slug === "zoho-invoice" &&
    service.stringOrNull(context.input.location) &&
    service.stringOrNull(context.input.location)!.toLowerCase() !==
      authority.mode
  )
    throw new BadRequestException(
      "Zoho Invoice callback location does not match its Accounts data center",
    );
  if (
    context.manifest.slug === "zoho-expense" &&
    service.stringOrNull(context.input.location) &&
    service.stringOrNull(context.input.location)!.toLowerCase() !==
      authority.mode
  )
    throw new BadRequestException(
      "Zoho Expense callback location does not match its Accounts data center",
    );
  let token = await exchangeOAuthCompletionToken(service, {
    manifest: context.manifest,
    input: context.input,
    oauthState: context.oauthState,
    authority,
    callbackProviderSession,
    clientSecret: context.clientSecret,
    codeVerifier: context.codeVerifier,
  });
  if (!token.access_token)
    throw new BadRequestException(
      `${context.manifest.name} OAuth token exchange did not return an access token`,
    );
  if (context.manifest.slug === "pinterest" && !token.refresh_token)
    throw new BadRequestException(
      "Pinterest OAuth token exchange did not return a continuous refresh token",
    );
  if (context.manifest.slug === "tumblr" && !token.refresh_token)
    throw new BadRequestException(
      "Tumblr OAuth token exchange did not return an offline refresh token",
    );
  if (context.manifest.slug === "meetup" && !token.refresh_token)
    throw new BadRequestException(
      "Meetup OAuth token exchange did not return its single-use refresh token",
    );
  if (context.manifest.slug === "threads") {
    const longLived = await service.exchangeThreadsLongLivedToken(
      token.access_token,
      context.clientSecret!,
    );
    token = { ...token, ...longLived, refresh_token: longLived.access_token };
  }
  if (
    context.manifest.slug === "vercel" &&
    (!/^[A-Za-z0-9_-]{3,128}$/.test(
      service.stringOrNull(token.installation_id) ?? "",
    ) ||
      (service.stringOrNull(token.team_id) !== null &&
        !/^[A-Za-z0-9_-]{3,128}$/.test(service.stringOrNull(token.team_id)!)))
  )
    throw new BadRequestException(
      "Vercel token exchange did not return a valid installation binding",
    );
  if (context.manifest.slug === "heroku" && !token.refresh_token)
    throw new BadRequestException(
      "Heroku OAuth token exchange did not return its non-expiring refresh token",
    );
  if (
    context.manifest.slug === "digitalocean" &&
    (!token.refresh_token ||
      service.stringOrNull(token.info?.team_uuid) !==
        service.stringOrNull(callbackProviderSession?.digitalOceanTeamId))
  )
    throw new BadRequestException(
      "DigitalOcean OAuth did not return a rotating refresh token for the exact selected Team",
    );
  return {
    ...context,
    stateAuthority,
    shareFileAuthority,
    pCloudAuthority,
    ahaAuthority,
    adobeAcrobatSignAuthority,
    authority,
    stateProviderSession,
    callbackProviderSession,
    token,
  };
}

async function runOAuthCompletePhase3(
  service: MarketplaceConnectorOAuthService,
  context: Awaited<ReturnType<typeof runOAuthCompletePhase2>>,
) {
  if (
    context.manifest.slug === "firebase" &&
    (!context.token.refresh_token ||
      service.stringOrNull(
        context.callbackProviderSession?.firebaseProjectId,
      ) === null)
  )
    throw new BadRequestException(
      "Firebase Google OAuth did not return offline refresh access for the exact selected Project",
    );
  if (
    context.manifest.slug === "supabase" &&
    (!context.token.refresh_token ||
      service.stringOrNull(
        context.callbackProviderSession?.supabaseOrganizationSlug,
      ) === null ||
      service.stringOrNull(
        context.callbackProviderSession?.supabaseProjectRef,
      ) === null)
  )
    throw new BadRequestException(
      "Supabase OAuth did not return a rotating refresh token for the exact Organization and selected Project",
    );
  if (
    context.manifest.slug === "bamboohr" &&
    (!context.token.refresh_token ||
      service.stringOrNull(
        context.callbackProviderSession?.bambooHRCompanyDomain,
      ) === null ||
      service.stringOrNull(
        context.callbackProviderSession?.bambooHRLocationId,
      ) === null)
  )
    throw new BadRequestException(
      "BambooHR OAuth did not return offline refresh access for the exact Company and selected Location",
    );
  if (
    context.manifest.slug === "greenhouse" &&
    (!context.token.refresh_token ||
      service.stringOrNull(
        context.callbackProviderSession?.greenhouseOrganizationId,
      ) === null)
  )
    throw new BadRequestException(
      "Greenhouse partner OAuth did not return its rotating refresh token for the exact Organization",
    );
  if (
    context.manifest.slug === "lever" &&
    (!context.token.refresh_token ||
      service.stringOrNull(context.callbackProviderSession?.leverAccountId) ===
        null)
  )
    throw new BadRequestException(
      "Lever OAuth did not return its rotating refresh token for the exact Account",
    );
  if (
    context.manifest.slug === "gmail" &&
    (!context.token.refresh_token ||
      service.stringOrNull(
        context.callbackProviderSession?.gmailAccountEmail,
      ) === null)
  )
    throw new BadRequestException(
      "Gmail Google OAuth did not return offline refresh access for the exact account",
    );
  if (
    context.manifest.slug === "google-calendar" &&
    (!context.token.refresh_token ||
      service.stringOrNull(
        context.callbackProviderSession?.googleCalendarAccountEmail,
      ) === null ||
      service.stringOrNull(
        context.callbackProviderSession?.googleCalendarDefaultCalendarId,
      ) === null)
  )
    throw new BadRequestException(
      "Google Calendar OAuth did not return offline refresh access for the exact account and default Calendar",
    );
  if (!context.token.access_token)
    throw new BadRequestException(
      `${context.manifest.name} OAuth token exchange did not return an access token`,
    );
  if (context.manifest.slug === "audius" && !context.token.refresh_token)
    throw new BadRequestException(
      "Audius OAuth token exchange did not return the required refresh token",
    );
  if (
    ["klaviyo", "klaviyo-sms"].includes(context.manifest.slug) &&
    (!context.token.refresh_token || !context.token.expires_in)
  )
    throw new BadRequestException(
      "Klaviyo OAuth token exchange did not return an expiring access token and refresh token",
    );
  if (
    context.manifest.slug === "convertkit" &&
    (!context.token.refresh_token ||
      !context.token.expires_in ||
      context.token.scope !== "public")
  )
    throw new BadRequestException(
      "Kit OAuth token exchange did not return the public scope and a complete expiring token pair",
    );
  if (
    context.manifest.slug === "campaign-monitor" &&
    (!context.token.refresh_token || context.token.expires_in !== 1_209_600)
  )
    throw new BadRequestException(
      "Campaign Monitor OAuth token exchange did not return the documented fourteen-day complete token pair",
    );
  if (
    context.manifest.slug === "constant-contact" &&
    (!context.token.refresh_token || context.token.expires_in !== 86_400)
  )
    throw new BadRequestException(
      "Constant Contact OAuth token exchange did not return the documented twenty-four-hour complete token pair",
    );
  if (
    context.manifest.slug === "adobe-acrobat-sign" &&
    !context.token.refresh_token
  )
    throw new BadRequestException(
      "Adobe Acrobat Sign OAuth did not return the required refresh token",
    );
  if (context.manifest.slug === "signnow" && !context.token.refresh_token)
    throw new BadRequestException(
      "SignNow OAuth did not return the required refresh token",
    );
  if (context.manifest.slug === "signrequest" && !context.token.refresh_token)
    throw new BadRequestException(
      "SignRequest OAuth did not return the required refresh token",
    );
  if (context.manifest.slug === "signeasy" && !context.token.refresh_token)
    throw new BadRequestException(
      "Signeasy OAuth did not return the required rotating refresh token",
    );
  if (
    context.manifest.slug === "rightsignature" &&
    !context.token.refresh_token
  )
    throw new BadRequestException(
      "RightSignature OAuth did not return the required refresh token",
    );
  if (
    context.manifest.slug === "adobe-acrobat-sign" &&
    service.stringOrNull(context.token.api_access_point) &&
    service.adobeAcrobatSignAuthority(context.token.api_access_point!)
      .apiOrigin !== context.adobeAcrobatSignAuthority?.apiOrigin
  )
    throw new BadRequestException(
      "Adobe Acrobat Sign token API shard does not match the callback shard",
    );
  if (context.manifest.slug === "xero" && !context.token.refresh_token)
    throw new BadRequestException(
      "Xero OAuth token exchange did not return a rolling refresh token",
    );
  if (context.manifest.slug === "quickbooks" && !context.token.refresh_token)
    throw new BadRequestException(
      "QuickBooks OAuth token exchange did not return a rolling refresh token",
    );
  if (context.manifest.slug === "freshbooks" && !context.token.refresh_token)
    throw new BadRequestException(
      "FreshBooks OAuth token exchange did not return a single-use refresh token",
    );
  if (context.manifest.slug === "wave" && !context.token.refresh_token)
    throw new BadRequestException(
      "Wave OAuth token exchange did not return a refresh token",
    );
  if (context.manifest.slug === "freeagent" && !context.token.refresh_token)
    throw new BadRequestException(
      "FreeAgent OAuth token exchange did not return a refresh token",
    );
  if (
    context.manifest.slug === "sage-accounting" &&
    !context.token.refresh_token
  )
    throw new BadRequestException(
      "Sage Accounting OAuth token exchange did not return a rotating refresh token",
    );
  if (context.manifest.slug === "myob" && !context.token.refresh_token)
    throw new BadRequestException(
      "MYOB OAuth token exchange did not return a rotating refresh token",
    );
  if (
    context.manifest.slug === "help-scout" &&
    (!context.token.refresh_token || !context.token.expires_in)
  )
    throw new BadRequestException(
      "Help Scout OAuth token exchange did not return its rotating token pair",
    );
  if (
    context.manifest.slug === "front" &&
    (!context.token.refresh_token || !context.token.expires_in)
  )
    throw new BadRequestException(
      "Front OAuth token exchange did not return its expiring token pair",
    );
  if (
    context.manifest.slug === "basecamp" &&
    (!context.token.refresh_token || !context.token.expires_in)
  )
    throw new BadRequestException(
      "Basecamp OAuth token exchange did not return its two-week token pair",
    );
  if (
    context.manifest.slug === "wrike" &&
    (!context.token.refresh_token ||
      !context.token.expires_in ||
      !service.stringOrNull(
        (context.token as unknown as Record<string, unknown>).host,
      ))
  )
    throw new BadRequestException(
      "Wrike OAuth token exchange did not return its expiring token pair and regional host",
    );
  if (
    context.manifest.slug === "smartsheet" &&
    (!context.token.refresh_token || !context.token.expires_in)
  )
    throw new BadRequestException(
      "Smartsheet OAuth token exchange did not return its seven-day token pair",
    );
  if (
    context.manifest.slug === "todoist" &&
    (!context.token.refresh_token || !context.token.expires_in)
  )
    throw new BadRequestException(
      "Todoist OAuth token exchange did not return its rotating token pair",
    );
  if (context.manifest.slug === "salesforce" && !context.token.refresh_token)
    throw new BadRequestException(
      "Salesforce OAuth token exchange did not return a rotating refresh token",
    );
  if (context.manifest.slug === "hubspot" && !context.token.refresh_token)
    throw new BadRequestException(
      "HubSpot OAuth token exchange did not return a refresh token",
    );
  if (
    context.manifest.slug === "pipedrive" &&
    (!context.token.refresh_token || !context.token.api_domain)
  )
    throw new BadRequestException(
      "Pipedrive OAuth token exchange did not return a refresh token and API domain",
    );
  if (
    context.manifest.slug === "surveymonkey" &&
    ![
      "https://api.surveymonkey.com",
      "https://api.eu.surveymonkey.com",
      "https://api.surveymonkey.ca",
    ].includes(
      service.stringOrNull(context.token.access_url)?.replace(/\/$/, "") ?? "",
    )
  )
    throw new BadRequestException(
      "SurveyMonkey OAuth token exchange did not return an official regional access URL",
    );
  if (
    context.manifest.slug === "fillout" &&
    !["https://api.fillout.com", "https://eu-api.fillout.com"].includes(
      service.stringOrNull(context.token.base_url)?.replace(/\/$/, "") ?? "",
    )
  )
    throw new BadRequestException(
      "Fillout OAuth token exchange did not return a supported official API base URL",
    );
  if (
    context.manifest.slug === "wave" &&
    (!service.stringOrNull(context.token.businessId) ||
      !/^[A-Za-z0-9+/=_-]{1,256}$/.test(context.token.businessId!))
  )
    throw new BadRequestException(
      "Wave OAuth token is not restricted to one valid business",
    );
  if (context.manifest.slug === "sharefile" && context.shareFileAuthority) {
    const tokenSubdomain = service
      .stringOrNull(context.token.subdomain)
      ?.toLowerCase();
    const tokenApiControlPlane = service
      .stringOrNull(context.token.apicp)
      ?.toLowerCase();
    if (
      !tokenSubdomain ||
      !tokenApiControlPlane ||
      service.shareFileAuthority(
        `https://${tokenSubdomain}.${tokenApiControlPlane}`,
      ).apiOrigin !== context.shareFileAuthority.apiOrigin
    ) {
      throw new BadRequestException(
        "ShareFile token authority does not match the signed callback authority",
      );
    }
  }
  const deputyAuthority =
    context.manifest.slug === "deputy"
      ? service.deputyAuthority(
          service.stringOrNull(context.token.endpoint) ?? "",
        )
      : null;
  if (context.manifest.slug === "zoho-mail" && !context.token.refresh_token) {
    throw new BadRequestException(
      "Zoho Mail offline OAuth did not return a refresh token; reconnect with consent",
    );
  }
  if (
    context.manifest.slug === "zoho-workdrive" &&
    !context.token.refresh_token
  ) {
    throw new BadRequestException(
      "Zoho WorkDrive offline OAuth did not return a refresh token; reconnect with consent",
    );
  }
  if (context.manifest.slug === "zoho-people" && !context.token.refresh_token) {
    throw new BadRequestException(
      "Zoho People offline OAuth did not return a refresh token; reconnect with consent",
    );
  }
  if (
    context.manifest.slug === "zoho-campaigns" &&
    !context.token.refresh_token
  ) {
    throw new BadRequestException(
      "Zoho Campaigns offline OAuth did not return a refresh token; reconnect with consent",
    );
  }
  if (
    context.manifest.slug === "zoho-analytics" &&
    !context.token.refresh_token
  ) {
    throw new BadRequestException(
      "Zoho Analytics offline OAuth did not return a refresh token; reconnect with consent",
    );
  }
  if (context.manifest.slug === "zoho" && !context.token.refresh_token) {
    throw new BadRequestException(
      "Zoho CRM offline OAuth did not return a refresh token; reconnect with consent",
    );
  }
  if (context.manifest.slug === "zoho-desk" && !context.token.refresh_token)
    throw new BadRequestException(
      "Zoho Desk offline OAuth did not return a refresh token; reconnect with consent",
    );
  if (context.manifest.slug === "zoho-projects" && !context.token.refresh_token)
    throw new BadRequestException(
      "Zoho Projects offline OAuth did not return a refresh token; reconnect with consent",
    );
  if (context.manifest.slug === "zoho-books" && !context.token.refresh_token)
    throw new BadRequestException(
      "Zoho Books offline OAuth did not return a refresh token; reconnect with consent",
    );
  if (context.manifest.slug === "zoho-invoice" && !context.token.refresh_token)
    throw new BadRequestException(
      "Zoho Invoice offline OAuth did not return a refresh token; reconnect with consent",
    );
  if (context.manifest.slug === "zoho-expense" && !context.token.refresh_token)
    throw new BadRequestException(
      "Zoho Expense offline OAuth did not return a refresh token; reconnect with consent",
    );
  return {
    ...context,
    deputyAuthority,
  };
}

async function runOAuthCompletePhase4(
  service: MarketplaceConnectorOAuthService,
  context: Awaited<ReturnType<typeof runOAuthCompletePhase3>>,
) {
  if (
    context.manifest.slug === "close" &&
    (!context.token.refresh_token ||
      !context.token.expires_in ||
      !/^orga_[A-Za-z0-9]{1,200}$/.test(
        service.stringOrNull(context.token.organization_id) ?? "",
      ) ||
      !/^user_[A-Za-z0-9]{1,200}$/.test(
        service.stringOrNull(context.token.user_id) ?? "",
      ))
  )
    throw new BadRequestException(
      "Close OAuth did not return an expiring access token, rotating refresh token, and exact organization/user binding",
    );
  if (
    context.manifest.slug === "zendesk" &&
    (!context.token.refresh_token ||
      !context.token.expires_in ||
      !context.token.refresh_token_expires_in)
  )
    throw new BadRequestException(
      "Zendesk OAuth did not return the required expiring access and refresh tokens",
    );
  if (context.manifest.slug === "sharefile" && !context.token.refresh_token) {
    throw new BadRequestException(
      "ShareFile OAuth did not return the required refresh token; reconnect the account",
    );
  }
  if (
    context.manifest.slug === "shopify" &&
    (!context.token.refresh_token || !context.token.expires_in)
  ) {
    throw new BadRequestException(
      "Shopify OAuth did not return the required expiring offline access and rotating refresh tokens; reconnect the shop",
    );
  }
  if (
    context.manifest.slug === "stripe" &&
    (!context.token.refresh_token ||
      !context.token.expires_in ||
      !service.stringOrNull(
        context.token.stripe_user_id ?? context.token.account_id,
      ))
  ) {
    throw new BadRequestException(
      "Stripe Apps OAuth did not return the required account-bound rotating token bundle",
    );
  }
  if (context.manifest.slug === "deputy" && !context.token.refresh_token) {
    throw new BadRequestException(
      "Deputy OAuth did not return the required rotating refresh token; reconnect the account",
    );
  }
  if (context.manifest.slug === "bynder" && !context.token.refresh_token) {
    throw new BadRequestException(
      "Bynder OAuth did not return the required offline refresh token; reconnect the portal",
    );
  }
  if (context.manifest.slug === "canto" && !context.token.refresh_token) {
    throw new BadRequestException(
      "Canto OAuth did not return the required refresh token; reconnect the account",
    );
  }
  if (context.manifest.slug === "frontify" && !context.token.refresh_token) {
    throw new BadRequestException(
      "Frontify OAuth did not return the required refresh token; reconnect the account",
    );
  }
  if (context.manifest.slug === "ms-project" && !context.token.refresh_token) {
    throw new BadRequestException(
      "Microsoft Project OAuth did not return the required refresh token; reconnect the environment",
    );
  }
  if (context.manifest.slug === "onedrive" && !context.token.refresh_token) {
    throw new BadRequestException(
      "OneDrive OAuth did not return the required refresh token; reconnect the account",
    );
  }
  if (context.manifest.slug === "sharepoint" && !context.token.refresh_token) {
    throw new BadRequestException(
      "SharePoint OAuth did not return the required refresh token; reconnect the selected site",
    );
  }
  if (
    context.manifest.slug === "microsoft-planner" &&
    !context.token.refresh_token
  ) {
    throw new BadRequestException(
      "Microsoft Planner OAuth did not return the required refresh token; reconnect the work account",
    );
  }
  if (
    context.manifest.slug === "microsoft-to-do" &&
    !context.token.refresh_token
  ) {
    throw new BadRequestException(
      "Microsoft To Do OAuth did not return the required refresh token; reconnect the account",
    );
  }
  if (
    context.manifest.slug === "microsoft-lists" &&
    !context.token.refresh_token
  ) {
    throw new BadRequestException(
      "Microsoft Lists OAuth did not return the required refresh token; reconnect the selected list",
    );
  }
  if (context.manifest.slug === "onenote" && !context.token.refresh_token) {
    throw new BadRequestException(
      "OneNote OAuth did not return the required refresh token; reconnect the account",
    );
  }
  if (
    context.manifest.slug === "microsoft-bookings" &&
    !context.token.refresh_token
  ) {
    throw new BadRequestException(
      "Microsoft Bookings OAuth did not return the required refresh token; reconnect the selected business",
    );
  }
  if (
    context.manifest.slug === "microsoft-power-bi" &&
    !context.token.refresh_token
  ) {
    throw new BadRequestException(
      "Microsoft Power BI OAuth did not return the required refresh token; reconnect the selected workspace",
    );
  }
  if (
    context.manifest.slug === "microsoft-dynamics-365" &&
    !context.token.refresh_token
  ) {
    throw new BadRequestException(
      "Microsoft Dynamics 365 OAuth did not return the required refresh token; reconnect the selected environment",
    );
  }
  if (
    context.manifest.slug === "microsoft-viva-engage" &&
    !context.token.refresh_token
  ) {
    throw new BadRequestException(
      "Microsoft Viva Engage OAuth did not return the required refresh token; reconnect the selected community",
    );
  }
  if (context.manifest.slug === "zoom" && !context.token.refresh_token) {
    throw new BadRequestException(
      "Zoom OAuth did not return the required refresh token; reconnect the user-managed app",
    );
  }
  if (
    context.manifest.slug === "microsoft-dynamics-365-sales" &&
    !context.token.refresh_token
  ) {
    throw new BadRequestException(
      "Microsoft Dynamics 365 Sales OAuth did not return the required refresh token; reconnect the environment",
    );
  }
  if (
    context.manifest.slug === "microsoft-dynamics-365-customer-service" &&
    !context.token.refresh_token
  ) {
    throw new BadRequestException(
      "Microsoft Dynamics 365 Customer Service OAuth did not return the required refresh token; reconnect the environment",
    );
  }
  if (
    context.manifest.slug === "microsoft-dynamics-365-business-central" &&
    !context.token.refresh_token
  ) {
    throw new BadRequestException(
      "Microsoft Dynamics 365 Business Central OAuth did not return the required refresh token; reconnect the environment",
    );
  }
  if (
    context.manifest.slug === "microsoft-entra-id" &&
    !context.token.refresh_token
  ) {
    throw new BadRequestException(
      "Microsoft Entra ID OAuth did not return the required refresh token; reconnect the account",
    );
  }
  if (context.manifest.slug === "yammer" && !context.token.refresh_token) {
    throw new BadRequestException(
      "Yammer OAuth did not return the required refresh token; reconnect the account",
    );
  }
  if (
    context.manifest.slug === "viva-learning" &&
    !context.token.refresh_token
  ) {
    throw new BadRequestException(
      "Viva Learning OAuth did not return the required refresh token; reconnect the account",
    );
  }
  if (context.manifest.slug === "jira" && !context.token.refresh_token) {
    throw new BadRequestException(
      "Jira OAuth did not return the required refresh token; reconnect the site",
    );
  }
  if (
    context.manifest.slug === "jira-service-management" &&
    !context.token.refresh_token
  ) {
    throw new BadRequestException(
      "Jira Service Management OAuth did not return the required refresh token; reconnect the site",
    );
  }
  if (
    context.manifest.slug === "atlassian-compass" &&
    !context.token.refresh_token
  ) {
    throw new BadRequestException(
      "Atlassian Compass OAuth did not return the required refresh token; reconnect the site",
    );
  }
  if (context.manifest.slug === "asset-bank" && !context.token.refresh_token) {
    throw new BadRequestException(
      "Asset Bank OAuth did not return the required refresh token; reconnect the account",
    );
  }
  if (context.manifest.slug === "wistia" && !context.token.refresh_token) {
    throw new BadRequestException(
      "Wistia OAuth did not return the required refresh token; reconnect the account",
    );
  }
  if (context.manifest.slug === "mural" && !context.token.refresh_token) {
    throw new BadRequestException(
      "Mural OAuth did not return the required refresh token; reconnect the account",
    );
  }
  if (
    ["figjam", "figma"].includes(context.manifest.slug) &&
    !context.token.refresh_token
  ) {
    throw new BadRequestException(
      `${context.manifest.name} OAuth did not return the required Figma refresh token; reconnect the account`,
    );
  }
  if (context.manifest.slug === "miro" && !context.token.refresh_token) {
    throw new BadRequestException(
      "Miro OAuth did not return the required rotating refresh token; reconnect the team",
    );
  }
  if (context.manifest.slug === "canva" && !context.token.refresh_token) {
    throw new BadRequestException(
      "Canva OAuth did not return the required single-use rotating refresh token; reconnect the account",
    );
  }
  if (
    ["lucidspark", "lucidchart"].includes(context.manifest.slug) &&
    !context.token.refresh_token
  ) {
    throw new BadRequestException(
      `${context.manifest.name} OAuth did not return the required Lucid refresh token; reconnect the account`,
    );
  }
  if (context.manifest.slug === "frame-io" && !context.token.refresh_token) {
    throw new BadRequestException(
      "Frame.io OAuth did not return the required offline-access refresh token; reconnect the account",
    );
  }
  if (
    context.manifest.slug === "square-appointments" &&
    !context.token.refresh_token
  ) {
    throw new BadRequestException(
      "Square OAuth did not return the required refresh token; reconnect the seller account",
    );
  }
  if (context.manifest.slug === "jane-app" && !context.token.refresh_token) {
    throw new BadRequestException(
      "Jane App OAuth did not return the required refresh token; reconnect the practitioner account",
    );
  }
  if (context.manifest.slug === "github" && !context.token.refresh_token) {
    throw new BadRequestException(
      "GitHub App OAuth did not return the required refresh token; enable expiring user tokens and reconnect",
    );
  }
  if (context.manifest.slug === "gitlab" && !context.token.refresh_token) {
    throw new BadRequestException(
      "GitLab OAuth did not return the required refresh token; reconnect the account",
    );
  }
  if (context.manifest.slug === "bitbucket" && !context.token.refresh_token) {
    throw new BadRequestException(
      "Bitbucket OAuth did not return the required rotating refresh token; reconnect the account",
    );
  }
  if (context.manifest.slug === "notion" && !context.token.refresh_token) {
    throw new BadRequestException(
      "Notion OAuth did not return the required refresh token; reconnect the workspace",
    );
  }
  if (context.manifest.slug === "linear" && !context.token.refresh_token) {
    throw new BadRequestException(
      "Linear OAuth did not return the required rotating refresh token; reconnect the workspace",
    );
  }
  if (context.manifest.slug === "asana" && !context.token.refresh_token) {
    throw new BadRequestException(
      "Asana OAuth did not return the required refresh token; reconnect the account",
    );
  }
  if (context.manifest.slug === "monday-com" && !context.token.refresh_token) {
    throw new BadRequestException(
      "Monday.com OAuth 2.1 did not return the required rotating refresh token; enable the new OAuth flow and reconnect",
    );
  }
  if (context.manifest.slug === "airtable" && !context.token.refresh_token) {
    throw new BadRequestException(
      "Airtable OAuth did not return the required rotating refresh token; reconnect the integration",
    );
  }
  if (
    context.manifest.slug === "harvest" &&
    (!context.token.refresh_token || context.token.expires_in !== 1_209_600)
  ) {
    throw new BadRequestException(
      "Harvest OAuth did not return the documented fourteen-day access token and refresh token; reconnect the account",
    );
  }
  if (context.manifest.slug === "calendly" && !context.token.refresh_token) {
    throw new BadRequestException(
      "Calendly OAuth did not return the required single-use rotating refresh token; reconnect the account",
    );
  }
  if (
    context.manifest.slug === "cal-com" &&
    (!context.token.refresh_token || context.token.expires_in !== 1_800)
  ) {
    throw new BadRequestException(
      "Cal.com OAuth did not return the documented thirty-minute access token and refresh token; reconnect the account",
    );
  }
  if (
    context.manifest.slug === "nationbuilder" &&
    !context.token.refresh_token
  ) {
    throw new BadRequestException(
      "NationBuilder OAuth did not return the required rotating refresh token; migrate the app to V2 tokens and reconnect the nation",
    );
  }
  if (
    context.manifest.slug === "docusign" &&
    (!context.token.refresh_token || context.token.expires_in !== 28_800)
  ) {
    throw new BadRequestException(
      "Docusign OAuth did not return the documented eight-hour access token and extended refresh token; reconnect the account",
    );
  }
  if (
    context.manifest.slug === "dropbox-sign" &&
    (!context.token.refresh_token ||
      !context.token.expires_in ||
      !context.token.account_id)
  ) {
    throw new BadRequestException(
      "Dropbox Sign OAuth did not return the required account ID, provider expiry, and complete access/refresh token pair; reconnect the account",
    );
  }
  return {
    ...context,
  };
}

export async function runOAuthCompleteInitialPhases(
  service: MarketplaceConnectorOAuthService,
  context: {
    appSlug: string;
    input: Parameters<MarketplaceConnectorOAuthService["completeOAuth"]>[1];
  },
) {
  const phase1 = await runOAuthCompletePhase1(service, context);
  const phase2 = await runOAuthCompletePhase2(service, phase1);
  const phase3 = await runOAuthCompletePhase3(service, phase2);
  return runOAuthCompletePhase4(service, phase3);
}
