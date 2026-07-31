import type { MarketplaceOAuthStateEntity } from "../../../../entities";
import type {
  MarketplaceConnectorOAuthService,
  OAuthTokenResponse,
} from "../connector-oauth.service";

type Service = MarketplaceConnectorOAuthService;
type OAuthManifest = ReturnType<Service["requireOAuthManifest"]>;
type OAuthAuthority = ReturnType<Service["oauthStateAuthority"]>;
type ShareFileAuthority = ReturnType<Service["shareFileAuthority"]>;
type PCloudAuthority = ReturnType<Service["pCloudAuthorityFromCallback"]>;
type AhaAuthority = ReturnType<Service["ahaAuthority"]>;
type DeputyAuthority = ReturnType<Service["deputyAuthority"]>;
type ZohoMailAuthority = ReturnType<Service["zohoMailAuthorityFromToken"]>;
type ZohoCrmAuthority = ReturnType<Service["zohoCrmAuthorityFromToken"]>;
type ZohoDeskAuthority = ReturnType<Service["zohoDeskAuthorityFromToken"]>;
type ZohoPeopleAuthority = ReturnType<Service["zohoPeopleAuthorityFromToken"]>;
type ZohoCampaignsAuthority = ReturnType<
  Service["zohoCampaignsAuthorityFromToken"]
>;
type ZohoAnalyticsAuthority = ReturnType<
  Service["zohoAnalyticsAuthorityFromToken"]
>;
type ZohoWorkDriveAuthority = ReturnType<
  Service["zohoWorkDriveAuthorityFromToken"]
>;

type OAuthStoredCredentialsInput = {
  manifest: OAuthManifest;
  oauthState: MarketplaceOAuthStateEntity;
  clientSecret: string | null | undefined;
  token: OAuthTokenResponse;
  providerSession: Record<string, unknown> | null;
  refreshTokenExpiresAt?: string;
  expiresAt: Date | null;
  grantedScopes: string[];
  shareFileAuthority: ShareFileAuthority | null;
  deputyAuthority: DeputyAuthority | null;
  pCloudAuthority: PCloudAuthority | null;
  ahaAuthority: AhaAuthority | null;
};

export function buildOAuthStoredCredentials(
  service: Service,
  {
    manifest,
    oauthState,
    clientSecret,
    token,
    providerSession,
    refreshTokenExpiresAt,
    expiresAt,
    grantedScopes,
    shareFileAuthority,
    deputyAuthority,
    pCloudAuthority,
    ahaAuthority,
  }: OAuthStoredCredentialsInput,
): Record<string, unknown> {
  return {
    clientId: oauthState.clientId,
    ...(clientSecret &&
    ![
      "box",
      "signnow",
      "signrequest",
      "signeasy",
      "rightsignature",
      "adobe-acrobat-sign",
      "dropbox",
      "dropbox-paper",
      "pcloud",
      "sharefile",
      "deputy",
      "7shifts",
      "resource-guru",
      "timely-time-tracking",
      "rescuetime",
      "hubstaff",
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
      "ms-project",
      "onedrive",
      "sharepoint",
      "microsoft-planner",
      "microsoft-to-do",
      "microsoft-lists",
      "microsoft-dynamics-365-sales",
      "microsoft-dynamics-365-customer-service",
      "microsoft-dynamics-365-business-central",
      "microsoft-entra-id",
      "yammer",
      "viva-learning",
      "microsoft-dynamics-365",
      "microsoft-viva-engage",
      "zoom",
      "jira",
      "onenote",
      "microsoft-bookings",
      "microsoft-power-bi",
      "jira-service-management",
      "buffer",
      "atlassian-compass",
      "meistertask",
      "jane-app",
      "shopify",
      "stripe",
      "quickbooks",
      "freshbooks",
      "wave",
      "sage-accounting",
      "freeagent",
      "salesforce",
      "hubspot",
      "pipedrive",
      "zoho",
      "zoho-desk",
      "zoho-projects",
      "copper",
      "surveymonkey",
      "fillout",
      "mailchimp",
      "mailchimp-surveys",
      "klaviyo-sms",
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
    ].includes(manifest.slug)
      ? { clientSecret }
      : {}),
    accessToken: token.access_token,
    ...(token.refresh_token ? { refreshToken: token.refresh_token } : {}),
    ...(manifest.slug === "smokeball"
      ? {
          smokeballApiKey: service.configService
            .get<string>("SMOKEBALL_API_KEY")
            ?.trim(),
        }
      : {}),
    ...(token.owner_id ? { ownerId: token.owner_id } : {}),
    ...(manifest.slug === "cloudflare"
      ? {
          CLOUDFLARE_ACCOUNT_ID: service.stringOrNull(
            providerSession?.cloudflareAccountId,
          ),
          CLOUDFLARE_ZONE_ID: service.stringOrNull(
            providerSession?.cloudflareZoneId,
          ),
        }
      : {}),
    ...(manifest.slug === "vercel"
      ? {
          VERCEL_PROJECT_ID: service.stringOrNull(
            providerSession?.vercelProjectId,
          ),
          VERCEL_TEAM_ID: service.stringOrNull(token.team_id),
          VERCEL_INSTALLATION_ID: service.stringOrNull(token.installation_id),
        }
      : {}),
    ...(manifest.slug === "heroku"
      ? {
          HEROKU_TEAM_ID: service.stringOrNull(providerSession?.herokuTeamId),
          HEROKU_APP_ID: service.stringOrNull(providerSession?.herokuAppId),
        }
      : {}),
    ...(manifest.slug === "digitalocean"
      ? {
          DIGITALOCEAN_TEAM_ID: service.stringOrNull(
            providerSession?.digitalOceanTeamId,
          ),
          DIGITALOCEAN_PROJECT_ID: service.stringOrNull(
            providerSession?.digitalOceanProjectId,
          ),
          DIGITALOCEAN_RESOURCE_URN: service.stringOrNull(
            providerSession?.digitalOceanResourceUrn,
          ),
        }
      : {}),
    ...(manifest.slug === "firebase"
      ? {
          FIREBASE_PROJECT_ID: service.stringOrNull(
            providerSession?.firebaseProjectId,
          ),
        }
      : {}),
    ...(manifest.slug === "supabase"
      ? {
          SUPABASE_ORGANIZATION_SLUG: service.stringOrNull(
            providerSession?.supabaseOrganizationSlug,
          ),
          SUPABASE_PROJECT_REF: service.stringOrNull(
            providerSession?.supabaseProjectRef,
          ),
        }
      : {}),
    ...(manifest.slug === "bamboohr"
      ? {
          BAMBOOHR_COMPANY_DOMAIN: service.stringOrNull(
            providerSession?.bambooHRCompanyDomain,
          ),
          BAMBOOHR_LOCATION_ID: service.stringOrNull(
            providerSession?.bambooHRLocationId,
          ),
        }
      : {}),
    ...(manifest.slug === "greenhouse"
      ? {
          GREENHOUSE_ORGANIZATION_ID: service.stringOrNull(
            providerSession?.greenhouseOrganizationId,
          ),
        }
      : {}),
    ...(manifest.slug === "lever"
      ? {
          LEVER_ACCOUNT_ID: service.stringOrNull(
            providerSession?.leverAccountId,
          ),
        }
      : {}),
    ...(manifest.slug === "gmail"
      ? {
          GMAIL_ACCOUNT_EMAIL: service.stringOrNull(
            providerSession?.gmailAccountEmail,
          ),
        }
      : {}),
    ...(manifest.slug === "google-calendar"
      ? {
          GOOGLE_CALENDAR_ACCOUNT_EMAIL: service.stringOrNull(
            providerSession?.googleCalendarAccountEmail,
          ),
          GOOGLE_CALENDAR_DEFAULT_CALENDAR_ID: service.stringOrNull(
            providerSession?.googleCalendarDefaultCalendarId,
          ),
        }
      : {}),
    ...(refreshTokenExpiresAt ? { refreshTokenExpiresAt } : {}),
    ...(expiresAt ? { expiresAt: expiresAt.toISOString() } : {}),
    grantedScopes,
    tokenType: token.token_type,
    ...(manifest.slug === "egnyte"
      ? {
          egnyteDomain: service.stringOrNull(providerSession?.egnyteDomain),
        }
      : {}),
    ...(manifest.slug === "nationbuilder"
      ? {
          nationBuilderNationSlug: service.stringOrNull(
            providerSession?.nationBuilderNationSlug,
          ),
        }
      : {}),
    ...(manifest.slug === "shopify"
      ? { shopDomain: service.stringOrNull(providerSession?.shopDomain) }
      : {}),
    ...(manifest.slug === "zendesk"
      ? {
          zendeskInstanceOrigin: service.stringOrNull(
            providerSession?.zendeskInstanceOrigin,
          ),
        }
      : {}),
    ...(manifest.slug === "surveymonkey"
      ? {
          surveyMonkeyAccessUrl: service
            .stringOrNull(token.access_url)
            ?.replace(/\/$/, ""),
        }
      : {}),
    ...(manifest.slug === "fillout"
      ? {
          filloutBaseUrl: service
            .stringOrNull(token.base_url)
            ?.replace(/\/$/, ""),
        }
      : {}),
    ...(manifest.slug === "google-ads"
      ? {
          customerId: service.stringOrNull(providerSession?.customerId),
          loginCustomerId: service.stringOrNull(
            providerSession?.loginCustomerId,
          ),
        }
      : {}),
    ...(manifest.slug === "google-analytics"
      ? {
          propertyId: service.stringOrNull(providerSession?.propertyId),
        }
      : {}),
    ...(manifest.slug === "google-search-console"
      ? { siteUrl: service.stringOrNull(providerSession?.siteUrl) }
      : {}),
    ...(manifest.slug === "google-business-profile"
      ? {
          accountName: service.stringOrNull(providerSession?.accountName),
          locationName: service.stringOrNull(providerSession?.locationName),
        }
      : {}),
    ...(manifest.slug === "google-merchant-center"
      ? { accountName: service.stringOrNull(providerSession?.accountName) }
      : {}),
    ...(manifest.slug === "mastodon"
      ? {
          mastodonInstanceOrigin: service.stringOrNull(
            providerSession?.mastodonInstanceOrigin,
          ),
        }
      : {}),
    ...(manifest.slug === "bynder"
      ? {
          bynderPortalOrigin: service.stringOrNull(
            providerSession?.bynderPortalOrigin,
          ),
        }
      : {}),
    ...(manifest.slug === "canto"
      ? {
          cantoAccountOrigin: service.stringOrNull(
            providerSession?.cantoAccountOrigin,
          ),
        }
      : {}),
    ...(manifest.slug === "frontify"
      ? {
          frontifyAccountOrigin: service.stringOrNull(
            providerSession?.frontifyAccountOrigin,
          ),
        }
      : {}),
    ...(manifest.slug === "asset-bank"
      ? {
          assetBankBaseUrl: service.stringOrNull(
            providerSession?.assetBankBaseUrl,
          ),
        }
      : {}),
    ...(manifest.slug === "ms-project"
      ? {
          msProjectEnvironmentOrigin: service.stringOrNull(
            providerSession?.msProjectEnvironmentOrigin,
          ),
        }
      : {}),
    ...(manifest.slug === "microsoft-dynamics-365-sales"
      ? {
          dynamics365SalesEnvironmentOrigin: service.stringOrNull(
            providerSession?.dynamics365SalesEnvironmentOrigin,
          ),
        }
      : {}),
    ...(manifest.slug === "microsoft-dynamics-365-customer-service"
      ? {
          dynamics365CustomerServiceEnvironmentOrigin: service.stringOrNull(
            providerSession?.dynamics365CustomerServiceEnvironmentOrigin,
          ),
        }
      : {}),
    ...(manifest.slug === "microsoft-dynamics-365-business-central"
      ? {
          businessCentralEnvironmentName: service.stringOrNull(
            providerSession?.businessCentralEnvironmentName,
          ),
        }
      : {}),
    ...(manifest.slug === "jane-app"
      ? {
          janeClinicOrigin: service.stringOrNull(
            providerSession?.janeClinicOrigin,
          ),
        }
      : {}),
    ...(manifest.slug === "sage-accounting"
      ? {
          sageAccountingSubscriptionKey: service.stringOrNull(
            providerSession?.sageAccountingSubscriptionKey,
          ),
        }
      : {}),
    ...(manifest.slug === "myob"
      ? {
          myobCompanyFileToken: service.stringOrNull(
            providerSession?.myobCompanyFileToken,
          ),
        }
      : {}),
    ...(manifest.slug === "sharefile"
      ? { shareFileApiOrigin: shareFileAuthority?.apiOrigin }
      : {}),
    ...(manifest.slug === "deputy"
      ? { deputyApiOrigin: deputyAuthority?.apiOrigin }
      : {}),
    ...(manifest.slug === "pcloud"
      ? {
          pCloudApiOrigin: pCloudAuthority?.apiOrigin,
          pCloudLocationId: pCloudAuthority?.locationId,
          pCloudUserId: token.uid === undefined ? null : String(token.uid),
        }
      : {}),
    ...(manifest.slug === "aha"
      ? {
          ahaAccountSubdomain: ahaAuthority?.accountSubdomain,
          ahaApiOrigin: ahaAuthority?.apiOrigin,
        }
      : {}),
  };
}

type OAuthConnectionMetadataInput = {
  manifest: OAuthManifest;
  oauthState: MarketplaceOAuthStateEntity;
  grantedScopes: string[];
  profile: unknown;
  authority: OAuthAuthority;
  token: OAuthTokenResponse;
  providerSession: Record<string, unknown> | null;
  shareFileAuthority: ShareFileAuthority | null;
  deputyAuthority: DeputyAuthority | null;
  pCloudAuthority: PCloudAuthority | null;
  ahaAuthority: AhaAuthority | null;
  zohoAuthority: ZohoMailAuthority | null;
  zohoWorkDriveAuthority: ZohoWorkDriveAuthority | null;
  zohoCrmAuthority: ZohoCrmAuthority | null;
  zohoBooksAuthority: ZohoCrmAuthority | null;
  zohoInvoiceAuthority: ZohoCrmAuthority | null;
  zohoExpenseAuthority: ZohoCrmAuthority | null;
  zohoDeskAuthority: ZohoDeskAuthority | null;
  zohoProjectsAuthority: ZohoCrmAuthority | null;
  zohoPeopleAuthority: ZohoPeopleAuthority | null;
  zohoCampaignsAuthority: ZohoCampaignsAuthority | null;
  zohoAnalyticsAuthority: ZohoAnalyticsAuthority | null;
};

export function buildOAuthConnectionMetadata(
  service: Service,
  {
    manifest,
    oauthState,
    grantedScopes,
    profile,
    authority,
    token,
    providerSession,
    shareFileAuthority,
    deputyAuthority,
    pCloudAuthority,
    ahaAuthority,
    zohoAuthority,
    zohoWorkDriveAuthority,
    zohoCrmAuthority,
    zohoBooksAuthority,
    zohoInvoiceAuthority,
    zohoExpenseAuthority,
    zohoDeskAuthority,
    zohoProjectsAuthority,
    zohoPeopleAuthority,
    zohoCampaignsAuthority,
    zohoAnalyticsAuthority,
  }: OAuthConnectionMetadataInput,
): ReturnType<Service["buildMetadata"]> {
  return service.buildMetadata(
    manifest.slug,
    oauthState.clientId,
    grantedScopes,
    profile,
    {
      authorityMode: authority.mode,
      authorityTenantId: authority.tenantId,
      zohoAccountsOrigin: zohoAuthority?.accountsOrigin,
      zohoMailOrigin: zohoAuthority?.mailOrigin,
      zohoRegion: zohoAuthority?.region,
      zohoWorkDriveApiOrigin: zohoWorkDriveAuthority?.apiOrigin,
      zohoWorkDriveDownloadOrigin: zohoWorkDriveAuthority?.downloadOrigin,
      zohoWorkDriveUploadOrigin: zohoWorkDriveAuthority?.uploadOrigin,
      zohoCrmApiOrigin: zohoCrmAuthority?.apiOrigin,
      zohoBooksApiOrigin: zohoBooksAuthority?.apiOrigin,
      zohoInvoiceApiOrigin: zohoInvoiceAuthority?.apiOrigin,
      zohoExpenseApiOrigin: zohoExpenseAuthority?.apiOrigin,
      zohoDeskApiOrigin: zohoDeskAuthority?.apiOrigin,
      zohoProjectsApiOrigin: zohoProjectsAuthority?.apiOrigin,
      zohoPeopleApiOrigin: zohoPeopleAuthority?.apiOrigin,
      zohoCampaignsApiOrigin: zohoCampaignsAuthority?.apiOrigin,
      zohoAnalyticsApiOrigin: zohoAnalyticsAuthority?.apiOrigin,
      ...(zohoProjectsAuthority
        ? {
            zohoAccountsOrigin: zohoProjectsAuthority.accountsOrigin,
            zohoRegion: zohoProjectsAuthority.region,
            zohoProjectsPortalId: service.stringOrNull(
              providerSession?.zohoProjectsPortalId,
            ),
          }
        : {}),
      ...(zohoDeskAuthority
        ? {
            zohoAccountsOrigin: zohoDeskAuthority.accountsOrigin,
            zohoRegion: zohoDeskAuthority.region,
          }
        : {}),
      ...(zohoExpenseAuthority
        ? {
            zohoAccountsOrigin: zohoExpenseAuthority.accountsOrigin,
            zohoRegion: zohoExpenseAuthority.region,
            zohoExpenseOrganizationId: service.stringOrNull(
              providerSession?.zohoExpenseOrganizationId,
            ),
          }
        : {}),
      ...(zohoInvoiceAuthority
        ? {
            zohoAccountsOrigin: zohoInvoiceAuthority.accountsOrigin,
            zohoRegion: zohoInvoiceAuthority.region,
            zohoInvoiceOrganizationId: service.stringOrNull(
              providerSession?.zohoInvoiceOrganizationId,
            ),
          }
        : {}),
      ...(zohoBooksAuthority
        ? {
            zohoAccountsOrigin: zohoBooksAuthority.accountsOrigin,
            zohoRegion: zohoBooksAuthority.region,
            zohoBooksOrganizationId: service.stringOrNull(
              providerSession?.zohoBooksOrganizationId,
            ),
          }
        : {}),
      ...(zohoCrmAuthority
        ? {
            zohoAccountsOrigin: zohoCrmAuthority.accountsOrigin,
            zohoRegion: zohoCrmAuthority.region,
          }
        : {}),
      ...(zohoWorkDriveAuthority
        ? {
            zohoAccountsOrigin: zohoWorkDriveAuthority.accountsOrigin,
            zohoRegion: zohoWorkDriveAuthority.region,
          }
        : {}),
      ...(zohoPeopleAuthority
        ? {
            zohoAccountsOrigin: zohoPeopleAuthority.accountsOrigin,
            zohoRegion: zohoPeopleAuthority.region,
          }
        : {}),
      ...(zohoCampaignsAuthority
        ? {
            zohoAccountsOrigin: zohoCampaignsAuthority.accountsOrigin,
            zohoRegion: zohoCampaignsAuthority.region,
          }
        : {}),
      ...(zohoAnalyticsAuthority
        ? {
            zohoAccountsOrigin: zohoAnalyticsAuthority.accountsOrigin,
            zohoRegion: zohoAnalyticsAuthority.region,
          }
        : {}),
      ...(manifest.slug === "egnyte"
        ? {
            egnyteDomain: service.stringOrNull(providerSession?.egnyteDomain),
          }
        : {}),
      ...(manifest.slug === "nationbuilder"
        ? {
            nationBuilderNationSlug: service.stringOrNull(
              providerSession?.nationBuilderNationSlug,
            ),
          }
        : {}),
      ...(manifest.slug === "shopify"
        ? { shopDomain: service.stringOrNull(providerSession?.shopDomain) }
        : {}),
      ...(manifest.slug === "zendesk"
        ? {
            zendeskInstanceOrigin: service.stringOrNull(
              providerSession?.zendeskInstanceOrigin,
            ),
          }
        : {}),
      ...(manifest.slug === "mastodon"
        ? {
            mastodonInstanceOrigin: service.stringOrNull(
              providerSession?.mastodonInstanceOrigin,
            ),
            mastodonInstanceDomain: service.stringOrNull(
              providerSession?.mastodonInstanceDomain,
            ),
            mastodonInstanceVersion: service.stringOrNull(
              providerSession?.mastodonInstanceVersion,
            ),
            mastodonMaxCharacters:
              typeof providerSession?.mastodonMaxCharacters === "number"
                ? providerSession.mastodonMaxCharacters
                : null,
          }
        : {}),
      ...(manifest.slug === "google-ads"
        ? {
            customerId: service.stringOrNull(providerSession?.customerId),
            loginCustomerId: service.stringOrNull(
              providerSession?.loginCustomerId,
            ),
          }
        : {}),
      ...(manifest.slug === "google-analytics"
        ? {
            propertyId: service.stringOrNull(providerSession?.propertyId),
          }
        : {}),
      ...(manifest.slug === "google-search-console"
        ? { siteUrl: service.stringOrNull(providerSession?.siteUrl) }
        : {}),
      ...(manifest.slug === "google-business-profile"
        ? {
            accountName: service.stringOrNull(providerSession?.accountName),
            locationName: service.stringOrNull(providerSession?.locationName),
          }
        : {}),
      ...(manifest.slug === "google-merchant-center"
        ? { accountName: service.stringOrNull(providerSession?.accountName) }
        : {}),
      ...(manifest.slug === "bynder"
        ? {
            bynderPortalOrigin: service.stringOrNull(
              providerSession?.bynderPortalOrigin,
            ),
          }
        : {}),
      ...(manifest.slug === "canto"
        ? {
            cantoAccountOrigin: service.stringOrNull(
              providerSession?.cantoAccountOrigin,
            ),
          }
        : {}),
      ...(manifest.slug === "frontify"
        ? {
            frontifyAccountOrigin: service.stringOrNull(
              providerSession?.frontifyAccountOrigin,
            ),
          }
        : {}),
      ...(manifest.slug === "asset-bank"
        ? {
            assetBankBaseUrl: service.stringOrNull(
              providerSession?.assetBankBaseUrl,
            ),
          }
        : {}),
      ...(manifest.slug === "bamboohr"
        ? {
            bambooHRCompanyDomain: service.stringOrNull(
              providerSession?.bambooHRCompanyDomain,
            ),
            bambooHRLocationId: service.stringOrNull(
              providerSession?.bambooHRLocationId,
            ),
          }
        : {}),
      ...(manifest.slug === "greenhouse"
        ? {
            greenhouseOrganizationId: service.stringOrNull(
              providerSession?.greenhouseOrganizationId,
            ),
          }
        : {}),
      ...(manifest.slug === "lever"
        ? {
            leverAccountId: service.stringOrNull(
              providerSession?.leverAccountId,
            ),
          }
        : {}),
      ...(manifest.slug === "gmail"
        ? {
            gmailAccountEmail: service.stringOrNull(
              providerSession?.gmailAccountEmail,
            ),
          }
        : {}),
      ...(manifest.slug === "google-calendar"
        ? {
            googleCalendarAccountEmail: service.stringOrNull(
              providerSession?.googleCalendarAccountEmail,
            ),
            googleCalendarDefaultCalendarId: service.stringOrNull(
              providerSession?.googleCalendarDefaultCalendarId,
            ),
          }
        : {}),
      ...(manifest.slug === "ms-project"
        ? {
            msProjectEnvironmentOrigin: service.stringOrNull(
              providerSession?.msProjectEnvironmentOrigin,
            ),
          }
        : {}),
      ...(manifest.slug === "microsoft-dynamics-365-sales"
        ? {
            dynamics365SalesEnvironmentOrigin: service.stringOrNull(
              providerSession?.dynamics365SalesEnvironmentOrigin,
            ),
          }
        : {}),
      ...(manifest.slug === "microsoft-dynamics-365-customer-service"
        ? {
            dynamics365CustomerServiceEnvironmentOrigin: service.stringOrNull(
              providerSession?.dynamics365CustomerServiceEnvironmentOrigin,
            ),
          }
        : {}),
      ...(manifest.slug === "microsoft-dynamics-365-business-central"
        ? {
            businessCentralEnvironmentName: service.stringOrNull(
              providerSession?.businessCentralEnvironmentName,
            ),
          }
        : {}),
      ...(manifest.slug === "jane-app"
        ? {
            janeClinicOrigin: service.stringOrNull(
              providerSession?.janeClinicOrigin,
            ),
          }
        : {}),
      ...(manifest.slug === "sharefile"
        ? { shareFileApiOrigin: shareFileAuthority?.apiOrigin }
        : {}),
      ...(manifest.slug === "deputy"
        ? { deputyApiOrigin: deputyAuthority?.apiOrigin }
        : {}),
      ...(manifest.slug === "pcloud"
        ? {
            pCloudApiOrigin: pCloudAuthority?.apiOrigin,
            pCloudLocationId: pCloudAuthority?.locationId,
            pCloudUserId: token.uid === undefined ? null : String(token.uid),
          }
        : {}),
      ...(manifest.slug === "aha"
        ? {
            ahaAccountSubdomain: ahaAuthority?.accountSubdomain,
            ahaApiOrigin: ahaAuthority?.apiOrigin,
          }
        : {}),
    },
  );
}
