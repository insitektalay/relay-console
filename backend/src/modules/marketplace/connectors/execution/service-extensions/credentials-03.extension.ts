import type { MarketplaceConnectorExecutionService } from "../../connector-execution.service";
import { MarketplaceConnectionEntity } from "../../../../../entities";
import { type AcceloCredentials } from "../../accelo/accelo-api.adapter";
import { type AdjustCredentials } from "../../adjust/adjust-api.adapter";
import { type AdobeMarketoEngageCredentials } from "../../adobe-marketo-engage/adobe-marketo-engage-api.adapter";
import { type AdobeTargetCredentials } from "../../adobe-target/adobe-target-api.adapter";
import { type AirfocusCredentials } from "../../airfocus/airfocus-api.adapter";
import { type AvazaCredentials } from "../../avaza/avaza-api.adapter";
import { type BambooHRCredentials } from "../../bamboohr/bamboohr-api.adapter";
import { type BettermodeCredentials } from "../../bettermode/bettermode-api.adapter";
import { type BlueConicCredentials } from "../../blueconic/blueconic-api.adapter";
import { type BranchCredentials } from "../../branch/branch-api.adapter";
import { type CalibreCredentials } from "../../calibre/calibre-api.adapter";
import { type CartaCredentials } from "../../carta/carta-api.adapter";
import { type CensusCredentials } from "../../census/census-api.adapter";
import { type CircleCredentials } from "../../circle/circle-api.adapter";
import { type CloudflareCredentials } from "../../cloudflare/cloudflare-api.adapter";
import { type CodaCredentials } from "../../coda/coda-api.adapter";
import { type ConcreteCmsCredentials } from "../../concrete-cms/concrete-cms-api.adapter";
import { type CraftCmsCredentials } from "../../craft-cms/craft-cms-api.adapter";
import { type CraftIoCredentials } from "../../craft-io/craft-io-api.adapter";
import { type CraftCredentials } from "../../craft/craft-api.adapter";
import {
  DATADOG_API_ORIGINS,
  type DatadogCredentials,
} from "../../datadog/datadog-api.adapter";
import { type DigitalOceanCredentials } from "../../digitalocean/digitalocean-api.adapter";
import { type DirectusSelfHostedCredentials } from "../../directus-self-hosted/directus-self-hosted-api.adapter";
import { type DiscourseCredentials } from "../../discourse/discourse-api.adapter";
import { type DrataCredentials } from "../../drata/drata-api.adapter";
import { type DrupalCredentials } from "../../drupal/drupal-api.adapter";
import { type FavroCredentials } from "../../favro/favro-api.adapter";
import { type FirebaseCredentials } from "../../firebase/firebase-api.adapter";
import { type GhostSelfHostedCredentials } from "../../ghost-self-hosted/ghost-self-hosted-api.adapter";
import { type GhostCredentials } from "../../ghost/ghost-api.adapter";
import { type GmailCredentials } from "../../gmail/gmail-api.adapter";
import { type GoogleCalendarCredentials } from "../../google-calendar/google-calendar-api.adapter";
import { type GreenhouseCredentials } from "../../greenhouse/greenhouse-api.adapter";
import { type GrooveCredentials } from "../../groove/groove-api.adapter";
import { type HerokuCredentials } from "../../heroku/heroku-api.adapter";
import { type HigherLogicCredentials } from "../../higher-logic/higher-logic-api.adapter";
import { type HightouchCredentials } from "../../hightouch/hightouch-api.adapter";
import { type HivebriteCredentials } from "../../hivebrite/hivebrite-api.adapter";
import { type HomebrewCredentials } from "../../homebrew/homebrew-api.adapter";
import { type JellyfinCredentials } from "../../jellyfin/jellyfin-api.adapter";
import { type JoomlaCredentials } from "../../joomla/joomla-api.adapter";
import { type KajabiCommunitiesCredentials } from "../../kajabi-communities/kajabi-communities-api.adapter";
import { type KantataOxCredentials } from "../../kantata-ox/kantata-ox-api.adapter";
import { type KirbyCmsCredentials } from "../../kirby-cms/kirby-cms-api.adapter";
import { type KochavaCredentials } from "../../kochava/kochava-api.adapter";
import { type LedgyCredentials } from "../../ledgy/ledgy-api.adapter";
import { type LeverCredentials } from "../../lever/lever-api.adapter";
import { type LiquidPlannerCredentials } from "../../liquidplanner/liquidplanner-api.adapter";
import { type LyticsCredentials } from "../../lytics/lytics-api.adapter";
import { type MagentoSelfHostedCredentials } from "../../magento-self-hosted/magento-self-hosted-api.adapter";
import { type MatomoSelfHostedCredentials } from "../../matomo-self-hosted/matomo-self-hosted-api.adapter";
import { type MightyNetworksCredentials } from "../../mighty-networks/mighty-networks-api.adapter";
import { type MParticleCredentials } from "../../mparticle/mparticle-api.adapter";
import { type MyCaseCredentials } from "../../mycase/mycase-api.adapter";
import { type NetlifyCredentials } from "../../netlify/netlify-api.adapter";
import { type NewRelicCredentials } from "../../new-relic/new-relic-api.adapter";
import { type OktaCredentials } from "../../okta/okta-api.adapter";
import { type OsanoCredentials } from "../../osano/osano-api.adapter";
import { type PadletCredentials } from "../../padlet/padlet-api.adapter";
import {
  PAGERDUTY_API_ORIGINS,
  type PagerDutyCredentials,
} from "../../pagerduty/pagerduty-api.adapter";
import {
  type PayPalCredentials,
  type PayPalEnvironment,
} from "../../paypal/paypal-api.adapter";
import { type PlanviewAgilePlaceCredentials } from "../../planview-agileplace/planview-agileplace-api.adapter";
import { type PlausibleSelfHostedCredentials } from "../../plausible-self-hosted/plausible-self-hosted-api.adapter";
import { type PlexPersonalMediaServerCredentials } from "../../plex-personal-media-server/plex-personal-media-server-api.adapter";
import { type PrestaShopSelfHostedCredentials } from "../../prestashop-self-hosted/prestashop-self-hosted-api.adapter";
import { type ProductPlanCredentials } from "../../productplan/productplan-api.adapter";
import { type SecureframeCredentials } from "../../secureframe/secureframe-api.adapter";
import { type SegmentCredentials } from "../../segment/segment-api.adapter";
import { type ShareworksCredentials } from "../../shareworks/shareworks-api.adapter";
import { type SingularCredentials } from "../../singular/singular-api.adapter";
import { type SprintoCredentials } from "../../sprinto/sprinto-api.adapter";
import { type StatamicCredentials } from "../../statamic/statamic-api.adapter";
import { type StatuspagePublicCredentials } from "../../statuspage/statuspage-public-api.adapter";
import { type StrapiSelfHostedCredentials } from "../../strapi-self-hosted/strapi-self-hosted-api.adapter";
import { type StructureForJiraCredentials } from "../../structure-for-jira/structure-for-jira-api.adapter";
import { type SupabaseSelfHostedCredentials } from "../../supabase-self-hosted/supabase-self-hosted-api.adapter";
import { type SupabaseCredentials } from "../../supabase/supabase-api.adapter";
import { type SynologyDsmCredentials } from "../../synology-dsm/synology-dsm-api.adapter";
import { type TealiumCredentials } from "../../tealium/tealium-api.adapter";
import { type TelegramPersonalBotsCredentials } from "../../telegram-personal-bots/telegram-personal-bots-api.adapter";
import { type TreasureDataCredentials } from "../../treasure-data/treasure-data-api.adapter";
import { type UmamiSelfHostedCredentials } from "../../umami-self-hosted/umami-self-hosted-api.adapter";
import { type VanillaForumsCredentials } from "../../vanilla-forums/vanilla-forums-api.adapter";
import { type VantaCredentials } from "../../vanta/vanta-api.adapter";
import { type VercelCredentials } from "../../vercel/vercel-api.adapter";
import { type VidyardCredentials } from "../../vidyard/vidyard-api.adapter";
import { type WordPressWooCommerceSelfHostedCredentials } from "../../wordpress-woocommerce-self-hosted/wordpress-woocommerce-self-hosted-api.adapter";
import { type WorkfrontPlanningCredentials } from "../../workfront-planning/workfront-planning-api.adapter";
import { type XrayTestManagementCredentials } from "../../xray-test-management/xray-test-management-api.adapter";
import { ConnectorExecutionError } from "../connector-execution.error";

export const CredentialsExtension3 = {
  adjustCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): AdjustCredentials {
    return { apiToken: this.stringOrNull(stored?.ADJUST_API_TOKEN) ?? "" };
  },

  branchCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): BranchCredentials {
    return {
      branchKey: this.stringOrNull(stored?.BRANCH_KEY) ?? "",
      linkUrl: this.stringOrNull(stored?.BRANCH_LINK_URL) ?? "",
    };
  },

  singularCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): SingularCredentials {
    return { apiKey: this.stringOrNull(stored?.SINGULAR_API_KEY) ?? "" };
  },

  kochavaCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): KochavaCredentials {
    return { apiKey: this.stringOrNull(stored?.KOCHAVA_API_KEY) ?? "" };
  },

  segmentPersonasCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): SegmentCredentials {
    const region = this.stringOrNull(stored?.SEGMENT_API_REGION) ?? "";
    return {
      publicApiToken: this.stringOrNull(stored?.SEGMENT_PUBLIC_API_TOKEN) ?? "",
      workspaceId: this.stringOrNull(stored?.SEGMENT_SPACE_ID) ?? "",
      apiOrigin:
        region === "eu1"
          ? "https://eu1.api.segmentapis.com"
          : region === "us"
            ? "https://api.segmentapis.com"
            : "",
    };
  },

  mParticleCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): MParticleCredentials {
    return {
      clientId: this.stringOrNull(stored?.MPARTICLE_CLIENT_ID) ?? "",
      clientSecret: this.stringOrNull(stored?.MPARTICLE_CLIENT_SECRET) ?? "",
      accountId: this.stringOrNull(stored?.MPARTICLE_ACCOUNT_ID) ?? "",
      workspaceId: this.stringOrNull(stored?.MPARTICLE_WORKSPACE_ID) ?? "",
    };
  },

  tealiumCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): TealiumCredentials {
    return {
      account: this.stringOrNull(stored?.TEALIUM_ACCOUNT) ?? "",
      profile: this.stringOrNull(stored?.TEALIUM_PROFILE) ?? "",
    };
  },

  lyticsCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): LyticsCredentials {
    return { apiToken: this.stringOrNull(stored?.LYTICS_API_TOKEN) ?? "" };
  },

  blueConicCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): BlueConicCredentials {
    return {
      tenantName: this.stringOrNull(stored?.BLUECONIC_TENANT_NAME) ?? "",
      clientId: this.stringOrNull(stored?.BLUECONIC_CLIENT_ID) ?? "",
      clientSecret: this.stringOrNull(stored?.BLUECONIC_CLIENT_SECRET) ?? "",
    };
  },

  treasureDataCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): TreasureDataCredentials {
    return {
      apiKey: this.stringOrNull(stored?.TREASURE_DATA_API_KEY) ?? "",
      apiRegion: this.stringOrNull(stored?.TREASURE_DATA_API_REGION) ?? "",
    };
  },

  hightouchCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): HightouchCredentials {
    return { apiKey: this.stringOrNull(stored?.HIGHTOUCH_API_KEY) ?? "" };
  },

  censusCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): CensusCredentials {
    return { apiKey: this.stringOrNull(stored?.CENSUS_API_KEY) ?? "" };
  },

  myCaseCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): MyCaseCredentials {
    return {
      accessToken: this.stringOrNull(stored?.MYCASE_ACCESS_TOKEN) ?? "",
    };
  },

  grooveCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
    connection?: MarketplaceConnectionEntity,
  ): GrooveCredentials {
    return {
      apiToken:
        this.stringOrNull(stored?.GROOVE_API_TOKEN) ??
        this.stringOrNull(stored?.apiToken) ??
        "",
      accountId:
        this.stringOrNull(connection?.metadata?.grooveAccountId) ?? undefined,
    };
  },

  datadogCredentials(
    this: MarketplaceConnectorExecutionService,
    connection: MarketplaceConnectionEntity,
    accessToken: string,
  ): DatadogCredentials {
    const apiOrigin =
      this.stringOrNull(connection.metadata?.datadogApiOrigin) ??
      "https://api.datadoghq.com";
    if (!DATADOG_API_ORIGINS.has(apiOrigin))
      throw new ConnectorExecutionError(
        "credential_missing",
        "Datadog API site binding is missing or invalid.",
      );
    return { accessToken, apiOrigin };
  },

  newRelicCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): NewRelicCredentials {
    const apiKey = this.stringOrNull(stored?.NEW_RELIC_USER_API_KEY);
    const accountValue = this.stringOrNull(stored?.NEW_RELIC_ACCOUNT_ID);
    const accountId = accountValue ? Number(accountValue) : NaN;
    const region = this.stringOrNull(stored?.NEW_RELIC_REGION)?.toLowerCase();
    if (
      !apiKey ||
      !Number.isSafeInteger(accountId) ||
      accountId <= 0 ||
      (region !== "us" && region !== "eu")
    )
      throw new ConnectorExecutionError(
        "credential_missing",
        "New Relic user key, positive account ID, or US/EU region binding is missing.",
      );
    return { apiKey, accountId, region };
  },

  pagerDutyCredentials(
    this: MarketplaceConnectorExecutionService,
    connection: MarketplaceConnectionEntity,
    accessToken: string,
  ): PagerDutyCredentials {
    const audience = this.pagerDutyAccountAudience(connection);
    const apiOrigin = audience.startsWith("as_account-eu.")
      ? "https://api.eu.pagerduty.com"
      : "https://api.pagerduty.com";
    if (!PAGERDUTY_API_ORIGINS.has(apiOrigin))
      throw new ConnectorExecutionError(
        "credential_missing",
        "PagerDuty account region binding is missing or invalid.",
      );
    return { accessToken, apiOrigin };
  },

  statuspageCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): StatuspagePublicCredentials {
    const pageId = this.stringOrNull(stored?.STATUSPAGE_PUBLIC_PAGE_ID);
    if (!pageId || !/^[a-z0-9]{8,32}$/.test(pageId))
      throw new ConnectorExecutionError(
        "credential_missing",
        "Statuspage exact public page ID binding is missing or invalid.",
      );
    return { pageId };
  },

  cloudflareCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
    accessToken: string,
  ): CloudflareCredentials {
    const accountId = this.stringOrNull(stored?.CLOUDFLARE_ACCOUNT_ID);
    const zoneId = this.stringOrNull(stored?.CLOUDFLARE_ZONE_ID);
    if (
      !accountId ||
      !zoneId ||
      !/^[a-f0-9]{32}$/.test(accountId) ||
      !/^[a-f0-9]{32}$/.test(zoneId)
    )
      throw new ConnectorExecutionError(
        "credential_missing",
        "Cloudflare exact account or selected-zone binding is missing or invalid.",
      );
    return { accessToken, accountId, zoneId };
  },

  vercelCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
    accessToken: string,
  ): VercelCredentials {
    const projectId = this.stringOrNull(stored?.VERCEL_PROJECT_ID);
    const teamId = this.stringOrNull(stored?.VERCEL_TEAM_ID);
    const installationId = this.stringOrNull(stored?.VERCEL_INSTALLATION_ID);
    if (
      !projectId ||
      !installationId ||
      !/^[A-Za-z0-9_-]{3,128}$/.test(projectId) ||
      !/^[A-Za-z0-9_-]{3,128}$/.test(installationId) ||
      (teamId !== null && !/^[A-Za-z0-9_-]{3,128}$/.test(teamId))
    )
      throw new ConnectorExecutionError(
        "credential_missing",
        "Vercel installation, team, or selected-project binding is missing or invalid.",
      );
    return { accessToken, projectId, teamId, installationId };
  },

  netlifyCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): NetlifyCredentials {
    const accessToken = this.stringOrNull(
      stored?.NETLIFY_PERSONAL_ACCESS_TOKEN,
    );
    const accountSlug = this.stringOrNull(stored?.NETLIFY_ACCOUNT_SLUG);
    const siteId = this.stringOrNull(stored?.NETLIFY_SITE_ID);
    if (
      !accessToken ||
      !accountSlug ||
      !siteId ||
      !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(accountSlug) ||
      !/^[A-Za-z0-9_-]{3,128}$/.test(siteId)
    )
      throw new ConnectorExecutionError(
        "credential_missing",
        "Netlify PAT, account slug, or selected-Site binding is missing or invalid.",
      );
    return { accessToken, accountSlug, siteId };
  },

  herokuCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): HerokuCredentials {
    const accessToken = this.stringOrNull(stored?.accessToken);
    const teamId = this.stringOrNull(stored?.HEROKU_TEAM_ID);
    const appId = this.stringOrNull(stored?.HEROKU_APP_ID);
    const uuid = /^[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$/;
    if (
      !accessToken ||
      !teamId ||
      !appId ||
      !uuid.test(teamId) ||
      !uuid.test(appId)
    )
      throw new ConnectorExecutionError(
        "credential_missing",
        "Heroku OAuth token, Team binding, or selected-App binding is missing or invalid.",
      );
    return { accessToken, teamId, appId };
  },

  digitalOceanCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): DigitalOceanCredentials {
    const accessToken = this.stringOrNull(stored?.accessToken);
    const teamId = this.stringOrNull(stored?.DIGITALOCEAN_TEAM_ID);
    const projectId = this.stringOrNull(stored?.DIGITALOCEAN_PROJECT_ID);
    const resourceUrn = this.stringOrNull(stored?.DIGITALOCEAN_RESOURCE_URN);
    const uuid = /^[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$/;
    const urn =
      /^(?:do:droplet:[1-9][0-9]{0,19}|do:app:[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12})$/;
    if (
      !accessToken ||
      !teamId ||
      !projectId ||
      !resourceUrn ||
      !uuid.test(teamId) ||
      !uuid.test(projectId) ||
      !urn.test(resourceUrn)
    )
      throw new ConnectorExecutionError(
        "credential_missing",
        "DigitalOcean OAuth token, Team, Project, or selected-resource binding is missing or invalid.",
      );
    return { accessToken, teamId, projectId, resourceUrn };
  },

  firebaseCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): FirebaseCredentials {
    const accessToken = this.stringOrNull(stored?.accessToken);
    const projectId = this.stringOrNull(stored?.FIREBASE_PROJECT_ID);
    if (
      !accessToken ||
      !projectId ||
      !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId)
    )
      throw new ConnectorExecutionError(
        "credential_missing",
        "Firebase OAuth token or exact selected-Project binding is missing or invalid.",
      );
    return { accessToken, projectId };
  },

  supabaseCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): SupabaseCredentials {
    const accessToken = this.stringOrNull(stored?.accessToken);
    const organizationSlug = this.stringOrNull(
      stored?.SUPABASE_ORGANIZATION_SLUG,
    );
    const projectRef = this.stringOrNull(stored?.SUPABASE_PROJECT_REF);
    if (
      !accessToken ||
      !organizationSlug ||
      !projectRef ||
      !/^[a-z0-9][a-z0-9_-]{1,127}$/.test(organizationSlug) ||
      !/^[a-z]{20}$/.test(projectRef)
    )
      throw new ConnectorExecutionError(
        "credential_missing",
        "Supabase OAuth token, exact Organization slug, or selected Project ref is missing or invalid.",
      );
    return { accessToken, organizationSlug, projectRef };
  },

  oktaCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): OktaCredentials {
    const origin = this.stringOrNull(stored?.OKTA_ORG_ORIGIN);
    const clientId = this.stringOrNull(stored?.OKTA_CLIENT_ID);
    const clientSecret = this.stringOrNull(stored?.OKTA_CLIENT_SECRET);
    const applicationId = this.stringOrNull(stored?.OKTA_APPLICATION_ID);
    if (!origin || !clientId || !clientSecret || !applicationId)
      throw new ConnectorExecutionError(
        "credential_missing",
        "Okta Org origin, OIN API service credentials, or selected Application ID is missing.",
      );
    return { origin, clientId, clientSecret, applicationId };
  },

  bambooHRCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): BambooHRCredentials {
    const accessToken = this.stringOrNull(stored?.accessToken);
    const companyDomain = this.stringOrNull(stored?.BAMBOOHR_COMPANY_DOMAIN);
    const locationId = this.stringOrNull(stored?.BAMBOOHR_LOCATION_ID);
    if (
      !accessToken ||
      !companyDomain ||
      !locationId ||
      !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(companyDomain) ||
      !/^[A-Za-z0-9_-]{1,128}$/.test(locationId)
    )
      throw new ConnectorExecutionError(
        "credential_missing",
        "BambooHR OAuth token, exact Company Domain, or selected Location binding is missing or invalid.",
      );
    return { accessToken, companyDomain, locationId };
  },

  greenhouseCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): GreenhouseCredentials {
    const accessToken = this.stringOrNull(stored?.accessToken);
    const organizationId = this.stringOrNull(
      stored?.GREENHOUSE_ORGANIZATION_ID,
    );
    if (
      !accessToken ||
      !organizationId ||
      !/^[A-Za-z0-9_-]{1,128}$/.test(organizationId)
    )
      throw new ConnectorExecutionError(
        "credential_missing",
        "Greenhouse OAuth token or exact Recruiting Organization binding is missing or invalid.",
      );
    return { accessToken, organizationId };
  },

  leverCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): LeverCredentials {
    const accessToken = this.stringOrNull(stored?.accessToken);
    const accountId = this.stringOrNull(stored?.LEVER_ACCOUNT_ID);
    if (!accessToken || !accountId || !/^[A-Za-z0-9_-]{1,128}$/.test(accountId))
      throw new ConnectorExecutionError(
        "credential_missing",
        "Lever OAuth token or exact Account binding is missing or invalid.",
      );
    return { accessToken, accountId };
  },

  gmailCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): GmailCredentials {
    const accessToken = this.stringOrNull(stored?.accessToken);
    const accountEmail = this.stringOrNull(stored?.GMAIL_ACCOUNT_EMAIL);
    if (
      !accessToken ||
      !accountEmail ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(accountEmail)
    )
      throw new ConnectorExecutionError(
        "credential_missing",
        "Gmail OAuth token or exact account binding is missing or invalid.",
      );
    return { accessToken, accountEmail };
  },

  googleCalendarCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): GoogleCalendarCredentials {
    const accessToken = this.stringOrNull(stored?.accessToken);
    const accountEmail = this.stringOrNull(
      stored?.GOOGLE_CALENDAR_ACCOUNT_EMAIL,
    );
    const defaultCalendarId = this.stringOrNull(
      stored?.GOOGLE_CALENDAR_DEFAULT_CALENDAR_ID,
    );
    if (
      !accessToken ||
      !accountEmail ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(accountEmail) ||
      !defaultCalendarId ||
      defaultCalendarId.length > 320
    )
      throw new ConnectorExecutionError(
        "credential_missing",
        "Google Calendar OAuth token or exact account/calendar binding is missing or invalid.",
      );
    return { accessToken, accountEmail, defaultCalendarId };
  },

  paypalCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): PayPalCredentials {
    const environment =
      this.stringOrNull(stored?.PAYPAL_ENVIRONMENT) ??
      this.stringOrNull(stored?.environment) ??
      "";
    return {
      clientId:
        this.stringOrNull(stored?.PAYPAL_CLIENT_ID) ??
        this.stringOrNull(stored?.clientId) ??
        "",
      clientSecret:
        this.stringOrNull(stored?.PAYPAL_CLIENT_SECRET) ??
        this.stringOrNull(stored?.clientSecret) ??
        "",
      environment: environment as PayPalEnvironment,
    };
  },

  kajabiCommunitiesCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): KajabiCommunitiesCredentials {
    return {
      clientId:
        this.stringOrNull(stored?.KAJABI_COMMUNITIES_CLIENT_ID) ??
        this.stringOrNull(stored?.clientId) ??
        "",
      clientSecret:
        this.stringOrNull(stored?.KAJABI_COMMUNITIES_CLIENT_SECRET) ??
        this.stringOrNull(stored?.clientSecret) ??
        "",
    };
  },

  circleCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): CircleCredentials {
    return {
      apiToken:
        this.stringOrNull(stored?.CIRCLE_ADMIN_V2_API_TOKEN) ??
        this.stringOrNull(stored?.apiToken) ??
        "",
    };
  },

  mightyNetworksCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
    metadata?: Record<string, unknown> | null,
  ): MightyNetworksCredentials {
    return {
      apiToken:
        this.stringOrNull(stored?.MIGHTY_NETWORKS_ADMIN_API_TOKEN) ??
        this.stringOrNull(stored?.apiToken) ??
        "",
      networkId:
        this.stringOrNull(metadata?.MIGHTY_NETWORKS_NETWORK_ID) ??
        this.stringOrNull(metadata?.networkId) ??
        this.stringOrNull(stored?.MIGHTY_NETWORKS_NETWORK_ID) ??
        this.stringOrNull(stored?.networkId) ??
        "",
    };
  },

  discourseCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
    metadata?: Record<string, unknown> | null,
  ): DiscourseCredentials {
    return {
      baseUrl:
        this.stringOrNull(metadata?.DISCOURSE_BASE_URL) ??
        this.stringOrNull(metadata?.baseUrl) ??
        this.stringOrNull(stored?.DISCOURSE_BASE_URL) ??
        this.stringOrNull(stored?.baseUrl) ??
        "",
      apiKey:
        this.stringOrNull(stored?.DISCOURSE_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
      apiUsername:
        this.stringOrNull(metadata?.DISCOURSE_API_USERNAME) ??
        this.stringOrNull(metadata?.apiUsername) ??
        this.stringOrNull(stored?.DISCOURSE_API_USERNAME) ??
        this.stringOrNull(stored?.apiUsername) ??
        "",
    };
  },

  vanillaForumsCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
    metadata?: Record<string, unknown> | null,
  ): VanillaForumsCredentials {
    return {
      baseUrl:
        this.stringOrNull(metadata?.VANILLA_FORUMS_BASE_URL) ??
        this.stringOrNull(metadata?.baseUrl) ??
        this.stringOrNull(stored?.VANILLA_FORUMS_BASE_URL) ??
        this.stringOrNull(stored?.baseUrl) ??
        "",
      accessToken:
        this.stringOrNull(stored?.VANILLA_FORUMS_ACCESS_TOKEN) ??
        this.stringOrNull(stored?.accessToken) ??
        "",
    };
  },

  bettermodeCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
    metadata?: Record<string, unknown> | null,
  ): BettermodeCredentials {
    return {
      region:
        this.stringOrNull(metadata?.BETTERMODE_REGION) ??
        this.stringOrNull(stored?.BETTERMODE_REGION) ??
        "",
      networkId:
        this.stringOrNull(metadata?.BETTERMODE_NETWORK_ID) ??
        this.stringOrNull(metadata?.networkId) ??
        this.stringOrNull(stored?.BETTERMODE_NETWORK_ID) ??
        this.stringOrNull(stored?.networkId) ??
        "",
      memberId:
        this.stringOrNull(metadata?.BETTERMODE_MEMBER_ID) ??
        this.stringOrNull(metadata?.memberId) ??
        this.stringOrNull(stored?.BETTERMODE_MEMBER_ID) ??
        this.stringOrNull(stored?.memberId) ??
        "",
      accessToken:
        this.stringOrNull(stored?.BETTERMODE_ACCESS_TOKEN) ??
        this.stringOrNull(stored?.accessToken) ??
        "",
    };
  },

  higherLogicCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
    metadata?: Record<string, unknown> | null,
  ): HigherLogicCredentials {
    return {
      region:
        this.stringOrNull(metadata?.HIGHER_LOGIC_REGION) ??
        this.stringOrNull(stored?.HIGHER_LOGIC_REGION) ??
        "",
      contactKey:
        this.stringOrNull(metadata?.HIGHER_LOGIC_CONTACT_KEY) ??
        this.stringOrNull(metadata?.higherLogicContactKey) ??
        this.stringOrNull(stored?.HIGHER_LOGIC_CONTACT_KEY) ??
        this.stringOrNull(stored?.contactKey) ??
        "",
      iamKey:
        this.stringOrNull(stored?.HIGHER_LOGIC_IAM_KEY) ??
        this.stringOrNull(stored?.iamKey) ??
        "",
      apiPassword:
        this.stringOrNull(stored?.HIGHER_LOGIC_API_PASSWORD) ??
        this.stringOrNull(stored?.apiPassword) ??
        "",
    };
  },

  hivebriteCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
    metadata?: Record<string, unknown> | null,
  ): HivebriteCredentials {
    return {
      baseUrl:
        this.stringOrNull(metadata?.HIVEBRITE_BASE_URL) ??
        this.stringOrNull(metadata?.hivebriteTenantOrigin) ??
        this.stringOrNull(stored?.HIVEBRITE_BASE_URL) ??
        this.stringOrNull(stored?.baseUrl) ??
        "",
      adminId:
        this.stringOrNull(metadata?.HIVEBRITE_ADMIN_ID) ??
        this.stringOrNull(metadata?.hivebriteAdminId) ??
        this.stringOrNull(stored?.HIVEBRITE_ADMIN_ID) ??
        this.stringOrNull(stored?.adminId) ??
        "",
      accessToken:
        this.stringOrNull(stored?.HIVEBRITE_ACCESS_TOKEN) ??
        this.stringOrNull(stored?.accessToken) ??
        "",
    };
  },

  ghostCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): GhostCredentials {
    return {
      adminUrl:
        this.stringOrNull(stored?.GHOST_ADMIN_URL) ??
        this.stringOrNull(stored?.adminUrl) ??
        "",
      adminApiKey:
        this.stringOrNull(stored?.GHOST_ADMIN_API_KEY) ??
        this.stringOrNull(stored?.adminApiKey) ??
        "",
    };
  },

  codaCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): CodaCredentials {
    return {
      apiToken:
        this.stringOrNull(stored?.CODA_API_TOKEN) ??
        this.stringOrNull(stored?.apiToken) ??
        "",
    };
  },

  craftCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): CraftCredentials {
    return {
      apiUrl:
        this.stringOrNull(stored?.CRAFT_API_URL) ??
        this.stringOrNull(stored?.apiUrl) ??
        "",
    };
  },

  telegramPersonalBotsCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): TelegramPersonalBotsCredentials {
    const allowed = (this.stringOrNull(stored?.TELEGRAM_ALLOWED_CHAT_IDS) ??
      this.stringOrNull(stored?.allowedChatIds) ??
      "") as string;
    return {
      botToken:
        this.stringOrNull(stored?.TELEGRAM_BOT_TOKEN) ??
        this.stringOrNull(stored?.botToken) ??
        "",
      allowedChatIds: [
        ...new Set(
          allowed
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
        ),
      ],
    };
  },

  matomoSelfHostedCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): MatomoSelfHostedCredentials {
    const siteId =
      this.stringOrNull(stored?.MATOMO_SELF_HOSTED_SITE_ID) ??
      this.stringOrNull(stored?.siteId) ??
      "";
    return {
      installationUrl:
        this.stringOrNull(stored?.MATOMO_SELF_HOSTED_INSTALLATION_URL) ??
        this.stringOrNull(stored?.installationUrl) ??
        "",
      tokenAuth:
        this.stringOrNull(stored?.MATOMO_SELF_HOSTED_TOKEN_AUTH) ??
        this.stringOrNull(stored?.tokenAuth) ??
        "",
      siteId: Number(siteId),
    };
  },

  plausibleSelfHostedCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): PlausibleSelfHostedCredentials {
    return {
      installationUrl:
        this.stringOrNull(stored?.PLAUSIBLE_SELF_HOSTED_INSTALLATION_URL) ??
        this.stringOrNull(stored?.installationUrl) ??
        "",
      apiKey:
        this.stringOrNull(stored?.PLAUSIBLE_SELF_HOSTED_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
      siteId:
        this.stringOrNull(stored?.PLAUSIBLE_SELF_HOSTED_SITE_ID) ??
        this.stringOrNull(stored?.siteId) ??
        "",
    };
  },

  umamiSelfHostedCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): UmamiSelfHostedCredentials {
    return {
      installationUrl:
        this.stringOrNull(stored?.UMAMI_SELF_HOSTED_INSTALLATION_URL) ??
        this.stringOrNull(stored?.installationUrl) ??
        "",
      username:
        this.stringOrNull(stored?.UMAMI_SELF_HOSTED_USERNAME) ??
        this.stringOrNull(stored?.username) ??
        "",
      password:
        this.stringOrNull(stored?.UMAMI_SELF_HOSTED_PASSWORD) ??
        this.stringOrNull(stored?.password) ??
        "",
      websiteId:
        this.stringOrNull(stored?.UMAMI_SELF_HOSTED_WEBSITE_ID) ??
        this.stringOrNull(stored?.websiteId) ??
        "",
    };
  },

  ghostSelfHostedCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): GhostSelfHostedCredentials {
    return {
      installationUrl:
        this.stringOrNull(stored?.GHOST_SELF_HOSTED_INSTALLATION_URL) ??
        this.stringOrNull(stored?.installationUrl) ??
        "",
      adminApiKey:
        this.stringOrNull(stored?.GHOST_SELF_HOSTED_ADMIN_API_KEY) ??
        this.stringOrNull(stored?.adminApiKey) ??
        "",
    };
  },

  xrayTestManagementCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): XrayTestManagementCredentials {
    return {
      clientId:
        this.stringOrNull(stored?.XRAY_TEST_MANAGEMENT_CLIENT_ID) ??
        this.stringOrNull(stored?.clientId) ??
        "",
      clientSecret:
        this.stringOrNull(stored?.XRAY_TEST_MANAGEMENT_CLIENT_SECRET) ??
        this.stringOrNull(stored?.clientSecret) ??
        "",
      projectId:
        this.stringOrNull(stored?.XRAY_TEST_MANAGEMENT_PROJECT_ID) ??
        this.stringOrNull(stored?.projectId) ??
        "",
    };
  },

  structureForJiraCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): StructureForJiraCredentials {
    return {
      personalAccessToken:
        this.stringOrNull(stored?.STRUCTURE_FOR_JIRA_PERSONAL_ACCESS_TOKEN) ??
        this.stringOrNull(stored?.personalAccessToken) ??
        "",
      region:
        this.stringOrNull(stored?.STRUCTURE_FOR_JIRA_REGION) ??
        this.stringOrNull(stored?.region) ??
        "",
    };
  },

  productPlanCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): ProductPlanCredentials {
    return {
      apiToken:
        this.stringOrNull(stored?.PRODUCTPLAN_API_TOKEN) ??
        this.stringOrNull(stored?.apiToken) ??
        "",
    };
  },

  craftIoCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): CraftIoCredentials {
    return {
      apiKey:
        this.stringOrNull(stored?.CRAFT_IO_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
      accountId:
        this.stringOrNull(stored?.CRAFT_IO_ACCOUNT_ID) ??
        this.stringOrNull(stored?.accountId) ??
        "",
      region:
        this.stringOrNull(stored?.CRAFT_IO_REGION) ??
        this.stringOrNull(stored?.region) ??
        "",
    };
  },

  airfocusCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): AirfocusCredentials {
    return {
      apiToken:
        this.stringOrNull(stored?.AIRFOCUS_API_TOKEN) ??
        this.stringOrNull(stored?.apiToken) ??
        "",
      region:
        this.stringOrNull(stored?.AIRFOCUS_REGION) ??
        this.stringOrNull(stored?.region) ??
        "",
    };
  },

  favroCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): FavroCredentials {
    return {
      email:
        this.stringOrNull(stored?.FAVRO_ACCOUNT_EMAIL) ??
        this.stringOrNull(stored?.email) ??
        "",
      apiToken:
        this.stringOrNull(stored?.FAVRO_API_TOKEN) ??
        this.stringOrNull(stored?.apiToken) ??
        "",
    };
  },

  planviewAgilePlaceCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): PlanviewAgilePlaceCredentials {
    return {
      apiToken:
        this.stringOrNull(stored?.PLANVIEW_AGILEPLACE_API_TOKEN) ??
        this.stringOrNull(stored?.apiToken) ??
        "",
      accountHostname:
        this.stringOrNull(stored?.PLANVIEW_AGILEPLACE_ACCOUNT_HOSTNAME) ??
        this.stringOrNull(stored?.accountHostname) ??
        "",
    };
  },

  liquidPlannerCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): LiquidPlannerCredentials {
    return {
      apiToken:
        this.stringOrNull(stored?.LIQUIDPLANNER_API_TOKEN) ??
        this.stringOrNull(stored?.apiToken) ??
        "",
    };
  },

  workfrontPlanningCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): WorkfrontPlanningCredentials {
    return {
      clientId:
        this.stringOrNull(stored?.WORKFRONT_PLANNING_CLIENT_ID) ??
        this.stringOrNull(stored?.clientId) ??
        "",
      clientSecret:
        this.stringOrNull(stored?.WORKFRONT_PLANNING_CLIENT_SECRET) ??
        this.stringOrNull(stored?.clientSecret) ??
        "",
      imsOrgId:
        this.stringOrNull(stored?.WORKFRONT_PLANNING_IMS_ORG_ID) ??
        this.stringOrNull(stored?.imsOrgId) ??
        "",
      scope:
        this.stringOrNull(stored?.WORKFRONT_PLANNING_SCOPE) ??
        this.stringOrNull(stored?.scope) ??
        "",
      customerHostname:
        this.stringOrNull(stored?.WORKFRONT_PLANNING_CUSTOMER_HOSTNAME) ??
        this.stringOrNull(stored?.customerHostname) ??
        "",
    };
  },

  kantataOxCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): KantataOxCredentials {
    return {
      oauthToken:
        this.stringOrNull(stored?.KANTATA_OX_OAUTH_TOKEN) ??
        this.stringOrNull(stored?.oauthToken) ??
        "",
      workspaceId:
        this.stringOrNull(stored?.KANTATA_OX_WORKSPACE_ID) ??
        this.stringOrNull(stored?.workspaceId) ??
        "",
    };
  },

  acceloCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): AcceloCredentials {
    return {
      deployment:
        this.stringOrNull(stored?.ACCELO_DEPLOYMENT) ??
        this.stringOrNull(stored?.deployment) ??
        "",
      clientId:
        this.stringOrNull(stored?.ACCELO_CLIENT_ID) ??
        this.stringOrNull(stored?.clientId) ??
        "",
      clientSecret:
        this.stringOrNull(stored?.ACCELO_CLIENT_SECRET) ??
        this.stringOrNull(stored?.clientSecret) ??
        "",
      jobId:
        this.stringOrNull(stored?.ACCELO_JOB_ID) ??
        this.stringOrNull(stored?.jobId) ??
        "",
    };
  },

  avazaCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): AvazaCredentials {
    return {
      personalAccessToken:
        this.stringOrNull(stored?.AVAZA_PERSONAL_ACCESS_TOKEN) ??
        this.stringOrNull(stored?.personalAccessToken) ??
        "",
      projectId:
        this.stringOrNull(stored?.AVAZA_PROJECT_ID) ??
        this.stringOrNull(stored?.projectId) ??
        "",
    };
  },

  homebrewCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): HomebrewCredentials {
    return {
      formulaToken:
        this.stringOrNull(stored?.HOMEBREW_FORMULA_TOKEN) ??
        this.stringOrNull(stored?.formulaToken) ??
        "",
      caskToken:
        this.stringOrNull(stored?.HOMEBREW_CASK_TOKEN) ??
        this.stringOrNull(stored?.caskToken) ??
        "",
    };
  },

  calibreCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): CalibreCredentials {
    return {
      serverOrigin:
        this.stringOrNull(stored?.CALIBRE_SERVER_ORIGIN) ??
        this.stringOrNull(stored?.serverOrigin) ??
        "",
      username:
        this.stringOrNull(stored?.CALIBRE_USERNAME) ??
        this.stringOrNull(stored?.username) ??
        "",
      password:
        this.stringOrNull(stored?.CALIBRE_PASSWORD) ??
        this.stringOrNull(stored?.password) ??
        "",
      libraryId:
        this.stringOrNull(stored?.CALIBRE_LIBRARY_ID) ??
        this.stringOrNull(stored?.libraryId) ??
        "",
      bookId:
        this.stringOrNull(stored?.CALIBRE_BOOK_ID) ??
        this.stringOrNull(stored?.bookId) ??
        "",
    };
  },

  plexPersonalMediaServerCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): PlexPersonalMediaServerCredentials {
    return {
      serverOrigin:
        this.stringOrNull(stored?.PLEX_PERSONAL_SERVER_ORIGIN) ??
        this.stringOrNull(stored?.serverOrigin) ??
        "",
      token:
        this.stringOrNull(stored?.PLEX_PERSONAL_AUTH_TOKEN) ??
        this.stringOrNull(stored?.token) ??
        "",
      ratingKey:
        this.stringOrNull(stored?.PLEX_PERSONAL_RATING_KEY) ??
        this.stringOrNull(stored?.ratingKey) ??
        "",
    };
  },

  jellyfinCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): JellyfinCredentials {
    return {
      serverBaseUrl:
        this.stringOrNull(stored?.JELLYFIN_SERVER_BASE_URL) ??
        this.stringOrNull(stored?.serverBaseUrl) ??
        "",
      apiKey:
        this.stringOrNull(stored?.JELLYFIN_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
      itemId:
        this.stringOrNull(stored?.JELLYFIN_ITEM_ID) ??
        this.stringOrNull(stored?.itemId) ??
        "",
    };
  },

  synologyDsmCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): SynologyDsmCredentials {
    return {
      serverOrigin:
        this.stringOrNull(stored?.SYNOLOGY_DSM_SERVER_ORIGIN) ??
        this.stringOrNull(stored?.serverOrigin) ??
        "",
      apiName:
        this.stringOrNull(stored?.SYNOLOGY_DSM_API_NAME) ??
        this.stringOrNull(stored?.apiName) ??
        "",
    };
  },

  wordpressWooCommerceSelfHostedCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): WordPressWooCommerceSelfHostedCredentials {
    return {
      storeBaseUrl:
        this.stringOrNull(stored?.WORDPRESS_WOOCOMMERCE_STORE_BASE_URL) ??
        this.stringOrNull(stored?.storeBaseUrl) ??
        "",
      productId:
        this.stringOrNull(stored?.WORDPRESS_WOOCOMMERCE_PRODUCT_ID) ??
        this.stringOrNull(stored?.productId) ??
        "",
    };
  },

  magentoSelfHostedCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): MagentoSelfHostedCredentials {
    return {
      commerceBaseUrl:
        this.stringOrNull(stored?.MAGENTO_SELF_HOSTED_BASE_URL) ??
        this.stringOrNull(stored?.commerceBaseUrl) ??
        "",
      productSku:
        this.stringOrNull(stored?.MAGENTO_SELF_HOSTED_PRODUCT_SKU) ??
        this.stringOrNull(stored?.productSku) ??
        "",
    };
  },

  prestashopSelfHostedCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): PrestaShopSelfHostedCredentials {
    return {
      shopBaseUrl:
        this.stringOrNull(stored?.PRESTASHOP_SELF_HOSTED_BASE_URL) ??
        this.stringOrNull(stored?.shopBaseUrl) ??
        "",
      webserviceKey:
        this.stringOrNull(stored?.PRESTASHOP_SELF_HOSTED_WEBSERVICE_KEY) ??
        this.stringOrNull(stored?.webserviceKey) ??
        "",
      productId:
        this.stringOrNull(stored?.PRESTASHOP_SELF_HOSTED_PRODUCT_ID) ??
        this.stringOrNull(stored?.productId) ??
        "",
    };
  },

  drupalCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): DrupalCredentials {
    return {
      siteBaseUrl:
        this.stringOrNull(stored?.DRUPAL_SITE_BASE_URL) ??
        this.stringOrNull(stored?.siteBaseUrl) ??
        "",
      nodeBundle:
        this.stringOrNull(stored?.DRUPAL_NODE_BUNDLE) ??
        this.stringOrNull(stored?.nodeBundle) ??
        "",
      nodeUuid:
        this.stringOrNull(stored?.DRUPAL_NODE_UUID) ??
        this.stringOrNull(stored?.nodeUuid) ??
        "",
    };
  },

  joomlaCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): JoomlaCredentials {
    return {
      siteBaseUrl:
        this.stringOrNull(stored?.JOOMLA_SITE_BASE_URL) ??
        this.stringOrNull(stored?.siteBaseUrl) ??
        "",
      apiToken:
        this.stringOrNull(stored?.JOOMLA_API_TOKEN) ??
        this.stringOrNull(stored?.apiToken) ??
        "",
      articleId:
        this.stringOrNull(stored?.JOOMLA_ARTICLE_ID) ??
        this.stringOrNull(stored?.articleId) ??
        "",
    };
  },

  concreteCmsCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): ConcreteCmsCredentials {
    return {
      siteBaseUrl:
        this.stringOrNull(stored?.CONCRETE_CMS_SITE_BASE_URL) ??
        this.stringOrNull(stored?.siteBaseUrl) ??
        "",
      accessToken:
        this.stringOrNull(stored?.CONCRETE_CMS_ACCESS_TOKEN) ??
        this.stringOrNull(stored?.accessToken) ??
        "",
      pageId:
        this.stringOrNull(stored?.CONCRETE_CMS_PAGE_ID) ??
        this.stringOrNull(stored?.pageId) ??
        "",
    };
  },

  craftCmsCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): CraftCmsCredentials {
    return {
      siteBaseUrl:
        this.stringOrNull(stored?.CRAFT_CMS_SITE_BASE_URL) ??
        this.stringOrNull(stored?.siteBaseUrl) ??
        "",
      graphqlToken:
        this.stringOrNull(stored?.CRAFT_CMS_GRAPHQL_TOKEN) ??
        this.stringOrNull(stored?.graphqlToken) ??
        "",
      entryUid:
        this.stringOrNull(stored?.CRAFT_CMS_ENTRY_UID) ??
        this.stringOrNull(stored?.entryUid) ??
        "",
    };
  },

  statamicCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): StatamicCredentials {
    return {
      siteBaseUrl:
        this.stringOrNull(stored?.STATAMIC_SITE_BASE_URL) ??
        this.stringOrNull(stored?.siteBaseUrl) ??
        "",
      apiToken:
        this.stringOrNull(stored?.STATAMIC_API_AUTH_TOKEN) ??
        this.stringOrNull(stored?.apiToken) ??
        "",
      collectionHandle:
        this.stringOrNull(stored?.STATAMIC_COLLECTION_HANDLE) ??
        this.stringOrNull(stored?.collectionHandle) ??
        "",
      entryId:
        this.stringOrNull(stored?.STATAMIC_ENTRY_ID) ??
        this.stringOrNull(stored?.entryId) ??
        "",
    };
  },

  kirbyCmsCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): KirbyCmsCredentials {
    return {
      siteBaseUrl:
        this.stringOrNull(stored?.KIRBY_CMS_SITE_BASE_URL) ??
        this.stringOrNull(stored?.siteBaseUrl) ??
        "",
      userEmail:
        this.stringOrNull(stored?.KIRBY_CMS_USER_EMAIL) ??
        this.stringOrNull(stored?.userEmail) ??
        "",
      userPassword:
        this.stringOrNull(stored?.KIRBY_CMS_USER_PASSWORD) ??
        this.stringOrNull(stored?.userPassword) ??
        "",
      pageId:
        this.stringOrNull(stored?.KIRBY_CMS_PAGE_ID) ??
        this.stringOrNull(stored?.pageId) ??
        "",
    };
  },

  directusSelfHostedCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): DirectusSelfHostedCredentials {
    return {
      instanceBaseUrl:
        this.stringOrNull(stored?.DIRECTUS_SELF_HOSTED_BASE_URL) ??
        this.stringOrNull(stored?.instanceBaseUrl) ??
        "",
      staticToken:
        this.stringOrNull(stored?.DIRECTUS_SELF_HOSTED_STATIC_TOKEN) ??
        this.stringOrNull(stored?.staticToken) ??
        "",
      collection:
        this.stringOrNull(stored?.DIRECTUS_SELF_HOSTED_COLLECTION) ??
        this.stringOrNull(stored?.collection) ??
        "",
      itemKey:
        this.stringOrNull(stored?.DIRECTUS_SELF_HOSTED_ITEM_KEY) ??
        this.stringOrNull(stored?.itemKey) ??
        "",
    };
  },

  strapiSelfHostedCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): StrapiSelfHostedCredentials {
    return {
      projectBaseUrl:
        this.stringOrNull(stored?.STRAPI_SELF_HOSTED_BASE_URL) ??
        this.stringOrNull(stored?.projectBaseUrl) ??
        "",
      apiToken:
        this.stringOrNull(stored?.STRAPI_SELF_HOSTED_API_TOKEN) ??
        this.stringOrNull(stored?.apiToken) ??
        "",
      contentTypeRoute:
        this.stringOrNull(stored?.STRAPI_SELF_HOSTED_CONTENT_TYPE_ROUTE) ??
        this.stringOrNull(stored?.contentTypeRoute) ??
        "",
      documentId:
        this.stringOrNull(stored?.STRAPI_SELF_HOSTED_DOCUMENT_ID) ??
        this.stringOrNull(stored?.documentId) ??
        "",
    };
  },

  supabaseSelfHostedCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): SupabaseSelfHostedCredentials {
    return {
      projectBaseUrl:
        this.stringOrNull(stored?.SUPABASE_SELF_HOSTED_BASE_URL) ??
        this.stringOrNull(stored?.projectBaseUrl) ??
        "",
      publishableKey:
        this.stringOrNull(stored?.SUPABASE_SELF_HOSTED_PUBLISHABLE_KEY) ??
        this.stringOrNull(stored?.publishableKey) ??
        "",
      table:
        this.stringOrNull(stored?.SUPABASE_SELF_HOSTED_TABLE) ??
        this.stringOrNull(stored?.table) ??
        "",
      rowId:
        this.stringOrNull(stored?.SUPABASE_SELF_HOSTED_ROW_ID) ??
        this.stringOrNull(stored?.rowId) ??
        "",
    };
  },

  vidyardCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): VidyardCredentials {
    return {
      apiToken:
        this.stringOrNull(stored?.VIDYARD_API_TOKEN) ??
        this.stringOrNull(stored?.apiToken) ??
        "",
    };
  },

  padletCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): PadletCredentials {
    return {
      apiKey:
        this.stringOrNull(stored?.PADLET_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
    };
  },

  adobeMarketoEngageCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): AdobeMarketoEngageCredentials {
    return {
      instanceOrigin:
        this.stringOrNull(stored?.MARKETO_INSTANCE_ORIGIN) ??
        this.stringOrNull(stored?.instanceOrigin) ??
        "",
      clientId:
        this.stringOrNull(stored?.MARKETO_CLIENT_ID) ??
        this.stringOrNull(stored?.clientId) ??
        "",
      clientSecret:
        this.stringOrNull(stored?.MARKETO_CLIENT_SECRET) ??
        this.stringOrNull(stored?.clientSecret) ??
        "",
    };
  },

  adobeTargetCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): AdobeTargetCredentials {
    return {
      tenant:
        this.stringOrNull(stored?.ADOBE_TARGET_TENANT) ??
        this.stringOrNull(stored?.tenant) ??
        "",
      clientId:
        this.stringOrNull(stored?.ADOBE_TARGET_CLIENT_ID) ??
        this.stringOrNull(stored?.clientId) ??
        "",
      clientSecret:
        this.stringOrNull(stored?.ADOBE_TARGET_CLIENT_SECRET) ??
        this.stringOrNull(stored?.clientSecret) ??
        "",
      scopes:
        this.stringOrNull(stored?.ADOBE_TARGET_SCOPES) ??
        this.stringOrNull(stored?.scopes) ??
        "",
    };
  },

  osanoCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): OsanoCredentials {
    return {
      apiKey:
        this.stringOrNull(stored?.OSANO_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
    };
  },

  secureframeCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): SecureframeCredentials {
    return {
      region:
        this.stringOrNull(stored?.SECUREFRAME_REGION) ??
        this.stringOrNull(stored?.region) ??
        "",
      apiKey:
        this.stringOrNull(stored?.SECUREFRAME_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
      apiSecret:
        this.stringOrNull(stored?.SECUREFRAME_API_SECRET) ??
        this.stringOrNull(stored?.apiSecret) ??
        "",
    };
  },

  vantaCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): VantaCredentials {
    return {
      clientId:
        this.stringOrNull(stored?.VANTA_CLIENT_ID) ??
        this.stringOrNull(stored?.clientId) ??
        "",
      clientSecret:
        this.stringOrNull(stored?.VANTA_CLIENT_SECRET) ??
        this.stringOrNull(stored?.clientSecret) ??
        "",
    };
  },

  cartaCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): CartaCredentials {
    return {
      clientId:
        this.stringOrNull(stored?.CARTA_CLIENT_ID) ??
        this.stringOrNull(stored?.clientId) ??
        "",
      clientSecret:
        this.stringOrNull(stored?.CARTA_CLIENT_SECRET) ??
        this.stringOrNull(stored?.clientSecret) ??
        "",
    };
  },

  shareworksCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): ShareworksCredentials {
    return {
      accountNumber:
        this.stringOrNull(stored?.SHAREWORKS_ACCOUNT_NUMBER) ??
        this.stringOrNull(stored?.accountNumber) ??
        "",
      clientId:
        this.stringOrNull(stored?.SHAREWORKS_CLIENT_ID) ??
        this.stringOrNull(stored?.clientId) ??
        "",
      clientSecret:
        this.stringOrNull(stored?.SHAREWORKS_CLIENT_SECRET) ??
        this.stringOrNull(stored?.clientSecret) ??
        "",
      privateKey:
        this.stringOrNull(stored?.SHAREWORKS_PRIVATE_KEY) ??
        this.stringOrNull(stored?.privateKey) ??
        "",
    };
  },

  ledgyCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): LedgyCredentials {
    return {
      apiKey:
        this.stringOrNull(stored?.LEDGY_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
    };
  },

  drataCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): DrataCredentials {
    return {
      region:
        this.stringOrNull(stored?.DRATA_REGION) ??
        this.stringOrNull(stored?.region) ??
        "",
      workspaceId:
        this.stringOrNull(stored?.DRATA_WORKSPACE_ID) ??
        this.stringOrNull(stored?.workspaceId) ??
        "",
      apiKey:
        this.stringOrNull(stored?.DRATA_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
    };
  },

  sprintoCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): SprintoCredentials {
    return {
      apiKey:
        this.stringOrNull(stored?.SPRINTO_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
    };
  },
};
