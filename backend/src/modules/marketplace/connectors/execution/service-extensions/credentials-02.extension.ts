import type { MarketplaceConnectorExecutionService } from "../../connector-execution.service";
import { MarketplaceConnectionEntity } from "../../../../../entities";
import { type AcquireCredentials } from "../../acquire/acquire-api.adapter";
import { type AgorapulseCredentials } from "../../agorapulse/agorapulse-api.adapter";
import { type AirshipCredentials } from "../../airship/airship-api.adapter";
import { type ApolloGraphOsCredentials } from "../../apollo-graphql-studio/apollo-graphos-api.adapter";
import { type AppsFlyerCredentials } from "../../appsflyer/appsflyer-api.adapter";
import { type BasecampCredentials } from "../../basecamp/basecamp-api.adapter";
import {
  BeehiivApiAdapter,
  type BeehiivCredentials,
} from "../../beehiiv/beehiiv-api.adapter";
import { type BrandwatchCredentials } from "../../brandwatch/brandwatch-api.adapter";
import { type CalComCredentials } from "../../cal-com/cal-com-api.adapter";
import { type CalendlyCredentials } from "../../calendly/calendly-api.adapter";
import { type CleverTapCredentials } from "../../clevertap/clevertap-api.adapter";
import { type ClockifyCredentials } from "../../clockify/clockify-api.adapter";
import { type CloseApiCredentials } from "../../close/close-api.adapter";
import { type CopperApiCredentials } from "../../copper/copper-api.adapter";
import { type DocusignIdentifyCredentials } from "../../docusign-identify/docusign-identify-api.adapter";
import { type DocusignCredentials } from "../../docusign/docusign-api.adapter";
import { type DropboxSignCredentials } from "../../dropbox-sign/dropbox-sign-api.adapter";
import { type EDeskCredentials } from "../../edesk/edesk-api.adapter";
import { type FirebaseCloudMessagingCredentials } from "../../firebase-cloud-messaging/firebase-cloud-messaging-api.adapter";
import { type FredCredentials } from "../../fred/fred-api.adapter";
import { type FreeAgentApiCredentials } from "../../freeagent/freeagent-api.adapter";
import { type FreshBooksApiCredentials } from "../../freshbooks/freshbooks-api.adapter";
import { type FreshdeskCredentials } from "../../freshdesk/freshdesk-api.adapter";
import { type FrontCredentials } from "../../front/front-api.adapter";
import { type GorgiasCredentials } from "../../gorgias/gorgias-api.adapter";
import { type HarvestCredentials } from "../../harvest/harvest-api.adapter";
import { type HelpScoutCredentials } from "../../help-scout/help-scout-api.adapter";
import { type HootsuiteCredentials } from "../../hootsuite/hootsuite-api.adapter";
import { type HopinCredentials } from "../../hopin/hopin-api.adapter";
import { type HubSpotApiCredentials } from "../../hubspot/hubspot-api.adapter";
import { type HunterCredentials } from "../../hunter-io/hunter-api.adapter";
import { type IntercomApiCredentials } from "../../intercom/intercom-api.adapter";
import { type IroncladClickwrapCredentials } from "../../ironclad-clickwrap/ironclad-clickwrap-api.adapter";
import { type KayakoCredentials } from "../../kayako/kayako-api.adapter";
import { type KhorosCredentials } from "../../khoros/khoros-api.adapter";
import { type LaterCredentials } from "../../later/later-api.adapter";
import { type LeadIqCredentials } from "../../leadiq/leadiq-api.adapter";
import { type LumaCredentials } from "../../luma/luma-api.adapter";
import { type LushaCredentials } from "../../lusha/lusha-api.adapter";
import { type MeltwaterCredentials } from "../../meltwater/meltwater-api.adapter";
import { type MentionCredentials } from "../../mention/mention-api.adapter";
import { type MessageBirdCredentials } from "../../messagebird/messagebird-api.adapter";
import { type MetricoolCredentials } from "../../metricool/metricool-api.adapter";
import { type OneSignalCredentials } from "../../onesignal/onesignal-api.adapter";
import { type OpenPhoneCredentials } from "../../openphone/openphone-api.adapter";
import { type PandaDocCredentials } from "../../pandadoc/pandadoc-api.adapter";
import { type PipedriveApiCredentials } from "../../pipedrive/pipedrive-api.adapter";
import { type PublerCredentials } from "../../publer/publer-api.adapter";
import { type PusherBeamsCredentials } from "../../pusher-beams/pusher-beams-api.adapter";
import { type PushwooshCredentials } from "../../pushwoosh/pushwoosh-api.adapter";
import {
  type QuickBooksApiCredentials,
  type QuickBooksEnvironment,
} from "../../quickbooks/quickbooks-api.adapter";
import { type ReAmazeCredentials } from "../../re-amaze/re-amaze-api.adapter";
import { type RocketReachCredentials } from "../../rocketreach/rocketreach-api.adapter";
import { type SalesforceApiCredentials } from "../../salesforce/salesforce-api.adapter";
import { type SanityCredentials } from "../../sanity/sanity-api.adapter";
import { type SeamlessAiCredentials } from "../../seamless-ai/seamless-ai-api.adapter";
import {
  SendFoxApiAdapter,
  type SendFoxCredentials,
} from "../../sendfox/sendfox-api.adapter";
import { type ShopifyCredentials } from "../../shopify/shopify-api.adapter";
import { type SmartsheetCredentials } from "../../smartsheet/smartsheet-api.adapter";
import { type SnovCredentials } from "../../snov-io/snov-api.adapter";
import { type SprinklrCredentials } from "../../sprinklr/sprinklr-api.adapter";
import { type SproutSocialCredentials } from "../../sprout-social/sprout-social-api.adapter";
import { type StrapiCloudCredentials } from "../../strapi-cloud/strapi-cloud-api.adapter";
import { type StripeApiCredentials } from "../../stripe/stripe-api.adapter";
import { type SubstackCredentials } from "../../substack/substack-api.adapter";
import { type TeamworkCredentials } from "../../teamwork/teamwork-api.adapter";
import { type TempoTimesheetsCredentials } from "../../tempo-timesheets/tempo-timesheets-api.adapter";
import { type TickTickCredentials } from "../../ticktick/ticktick-api.adapter";
import { type TodoistCredentials } from "../../todoist/todoist-api.adapter";
import { type TogglTrackCredentials } from "../../toggl-track/toggl-track-api.adapter";
import { type TwilioCredentials } from "../../twilio/twilio-api.adapter";
import {
  TypeformApiAdapter,
  type TypeformCredentials,
} from "../../typeform/typeform-api.adapter";
import { type UpLeadCredentials } from "../../uplead/uplead-api.adapter";
import { type VonageCredentials } from "../../vonage/vonage-api.adapter";
import { type WaveApiCredentials } from "../../wave/wave-api.adapter";
import { type WizaCredentials } from "../../wiza/wiza-api.adapter";
import { type WooCommerceCredentials } from "../../woocommerce/woocommerce-api.adapter";
import { type WrikeCredentials } from "../../wrike/wrike-api.adapter";
import { type XeroApiCredentials } from "../../xero/xero-api.adapter";
import { type ZendeskCredentials } from "../../zendesk/zendesk-api.adapter";
import { type ZephyrScaleCredentials } from "../../zephyr-scale/zephyr-scale-api.adapter";
import { type ZohoAnalyticsCredentials } from "../../zoho-analytics/zoho-analytics-api.adapter";
import { type ZohoCampaignsCredentials } from "../../zoho-campaigns/zoho-campaigns-api.adapter";
import { type ZohoPeopleCredentials } from "../../zoho-people/zoho-people-api.adapter";
import { type ZohoApiCredentials } from "../../zoho/zoho-api.adapter";
import { ConnectorExecutionError } from "../connector-execution.error";

export const CredentialsExtension2 = {
  gorgiasCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): GorgiasCredentials {
    return {
      domain:
        this.stringOrNull(stored?.GORGIAS_DOMAIN) ??
        this.stringOrNull(stored?.domain) ??
        "",
      username:
        this.stringOrNull(stored?.GORGIAS_USERNAME) ??
        this.stringOrNull(stored?.username) ??
        "",
      apiKey:
        this.stringOrNull(stored?.GORGIAS_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
    };
  },

  reAmazeCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): ReAmazeCredentials {
    return {
      brand:
        this.stringOrNull(stored?.REAMAZE_BRAND) ??
        this.stringOrNull(stored?.brand) ??
        "",
      loginEmail:
        this.stringOrNull(stored?.REAMAZE_LOGIN_EMAIL) ??
        this.stringOrNull(stored?.loginEmail) ??
        "",
      apiToken:
        this.stringOrNull(stored?.REAMAZE_API_TOKEN) ??
        this.stringOrNull(stored?.apiToken) ??
        "",
    };
  },

  edeskCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): EDeskCredentials {
    return {
      apiToken:
        this.stringOrNull(stored?.EDESK_API_TOKEN) ??
        this.stringOrNull(stored?.apiToken) ??
        "",
    };
  },

  kayakoCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): KayakoCredentials {
    return {
      domain:
        this.stringOrNull(stored?.KAYAKO_DOMAIN) ??
        this.stringOrNull(stored?.domain) ??
        "",
      accessToken:
        this.stringOrNull(stored?.KAYAKO_ACCESS_TOKEN) ??
        this.stringOrNull(stored?.accessToken) ??
        "",
    };
  },

  acquireCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): AcquireCredentials {
    return {
      accountId:
        this.stringOrNull(stored?.ACQUIRE_ACCOUNT_ID) ??
        this.stringOrNull(stored?.accountId) ??
        "",
      apiKey:
        this.stringOrNull(stored?.ACQUIRE_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
    };
  },

  ironcladClickwrapCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): IroncladClickwrapCredentials {
    return {
      accessToken:
        this.stringOrNull(stored?.IRONCLAD_CLICKWRAP_ACCESS_TOKEN) ??
        this.stringOrNull(stored?.accessToken) ??
        "",
      siteId:
        this.stringOrNull(stored?.IRONCLAD_CLICKWRAP_SITE_ID) ??
        this.stringOrNull(stored?.siteId) ??
        "",
    };
  },

  docusignIdentifyCredentials(
    this: MarketplaceConnectorExecutionService,
    connection: MarketplaceConnectionEntity,
    accessToken: string,
  ): DocusignIdentifyCredentials {
    return {
      accessToken,
      accountId:
        this.stringOrNull(connection.metadata?.docusignIdentifyAccountId) ??
        undefined,
      baseUri:
        this.stringOrNull(connection.metadata?.docusignIdentifyBaseUri) ??
        undefined,
    };
  },

  freshdeskCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): FreshdeskCredentials {
    return {
      domain:
        this.stringOrNull(stored?.FRESHDESK_DOMAIN) ??
        this.stringOrNull(stored?.domain) ??
        "",
      apiKey:
        this.stringOrNull(stored?.FRESHDESK_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
    };
  },

  sanityCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): SanityCredentials {
    return {
      projectId:
        this.stringOrNull(stored?.SANITY_PROJECT_ID) ??
        this.stringOrNull(stored?.projectId) ??
        "",
      dataset:
        this.stringOrNull(stored?.SANITY_DATASET) ??
        this.stringOrNull(stored?.dataset) ??
        "",
      apiToken:
        this.stringOrNull(stored?.SANITY_API_TOKEN) ??
        this.stringOrNull(stored?.apiToken) ??
        "",
    };
  },

  strapiCloudCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): StrapiCloudCredentials {
    return {
      instanceUrl:
        this.stringOrNull(stored?.STRAPI_CLOUD_INSTANCE_URL) ??
        this.stringOrNull(stored?.instanceUrl) ??
        "",
      allowedApiIds:
        this.stringOrNull(stored?.STRAPI_CLOUD_ALLOWED_API_IDS) ??
        this.stringOrNull(stored?.allowedApiIds) ??
        "",
      apiToken:
        this.stringOrNull(stored?.STRAPI_CLOUD_API_TOKEN) ??
        this.stringOrNull(stored?.apiToken) ??
        "",
    };
  },

  shopifyCredentials(
    this: MarketplaceConnectorExecutionService,
    connection: MarketplaceConnectionEntity,
    accessToken: string,
  ): ShopifyCredentials {
    const shopDomain =
      this.stringOrNull(connection.metadata?.shopDomain) ??
      this.stringOrNull(connection.metadata?.myshopifyDomain) ??
      this.stringOrNull(connection.metadata?.providerDomain) ??
      "";
    return { shopDomain, accessToken };
  },

  wooCommerceCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): WooCommerceCredentials {
    return {
      storeOrigin:
        this.stringOrNull(stored?.WOOCOMMERCE_STORE_ORIGIN) ??
        this.stringOrNull(stored?.storeOrigin) ??
        "",
      consumerKey:
        this.stringOrNull(stored?.WOOCOMMERCE_CONSUMER_KEY) ??
        this.stringOrNull(stored?.consumerKey) ??
        "",
      consumerSecret:
        this.stringOrNull(stored?.WOOCOMMERCE_CONSUMER_SECRET) ??
        this.stringOrNull(stored?.consumerSecret) ??
        "",
    };
  },

  stripeCredentials(
    this: MarketplaceConnectorExecutionService,
    connection: MarketplaceConnectionEntity,
    accessToken: string,
  ): StripeApiCredentials {
    const accountId = this.stringOrNull(connection.metadata?.stripeAccountId);
    const livemode = connection.metadata?.stripeLivemode;
    if (!accountId || typeof livemode !== "boolean") {
      throw new ConnectorExecutionError(
        "credential_missing",
        "Stripe connection account binding is missing.",
      );
    }
    return { accessToken, accountId, livemode };
  },

  xeroCredentials(
    this: MarketplaceConnectorExecutionService,
    connection: MarketplaceConnectionEntity,
    accessToken: string,
  ): XeroApiCredentials {
    const tenantId = this.stringOrNull(connection.metadata?.xeroTenantId);
    if (!tenantId)
      throw new ConnectorExecutionError(
        "credential_missing",
        "Xero organisation binding is missing.",
      );
    return { accessToken, tenantId };
  },

  quickBooksCredentials(
    this: MarketplaceConnectorExecutionService,
    connection: MarketplaceConnectionEntity,
    accessToken: string,
  ): QuickBooksApiCredentials {
    const realmId = this.stringOrNull(connection.metadata?.quickbooksRealmId);
    const environment = this.stringOrNull(
      connection.metadata?.quickbooksEnvironment,
    );
    if (
      !realmId ||
      !environment ||
      !["sandbox", "production"].includes(environment)
    )
      throw new ConnectorExecutionError(
        "credential_missing",
        "QuickBooks company binding is missing.",
      );
    return {
      accessToken,
      realmId,
      environment: environment as QuickBooksEnvironment,
    };
  },

  freshBooksCredentials(
    this: MarketplaceConnectorExecutionService,
    connection: MarketplaceConnectionEntity,
    accessToken: string,
  ): FreshBooksApiCredentials {
    const businessId = this.stringOrNull(
      connection.metadata?.freshbooksBusinessId,
    );
    const accountId = this.stringOrNull(
      connection.metadata?.freshbooksAccountId,
    );
    const role = this.stringOrNull(connection.metadata?.freshbooksRole);
    if (!businessId || !accountId || !role)
      throw new ConnectorExecutionError(
        "credential_missing",
        "FreshBooks business binding is missing.",
      );
    return { accessToken, businessId, accountId, role };
  },

  waveCredentials(
    this: MarketplaceConnectorExecutionService,
    connection: MarketplaceConnectionEntity,
    accessToken: string,
  ): WaveApiCredentials {
    const businessId = this.stringOrNull(connection.metadata?.waveBusinessId);
    if (!businessId)
      throw new ConnectorExecutionError(
        "credential_missing",
        "Wave business binding is missing.",
      );
    return { accessToken, businessId };
  },

  freeAgentCredentials(
    this: MarketplaceConnectorExecutionService,
    connection: MarketplaceConnectionEntity,
    accessToken: string,
  ): FreeAgentApiCredentials {
    const companyId = this.stringOrNull(
      connection.metadata?.freeAgentCompanyId,
    );
    if (!companyId)
      throw new ConnectorExecutionError(
        "credential_missing",
        "FreeAgent company binding is missing.",
      );
    return { accessToken, companyId };
  },

  salesforceCredentials(
    this: MarketplaceConnectorExecutionService,
    connection: MarketplaceConnectionEntity,
    accessToken: string,
  ): SalesforceApiCredentials {
    const organizationId = this.stringOrNull(
      connection.metadata?.salesforceOrganizationId,
    );
    const instanceOrigin = this.stringOrNull(
      connection.metadata?.salesforceInstanceOrigin,
    );
    if (!organizationId || !instanceOrigin)
      throw new ConnectorExecutionError(
        "credential_missing",
        "Salesforce organization and instance binding is missing.",
      );
    return { accessToken, organizationId, instanceOrigin };
  },

  hubSpotCredentials(
    this: MarketplaceConnectorExecutionService,
    connection: MarketplaceConnectionEntity,
    accessToken: string,
  ): HubSpotApiCredentials {
    const hubId = this.stringOrNull(connection.metadata?.hubSpotHubId);
    if (!hubId)
      throw new ConnectorExecutionError(
        "credential_missing",
        "HubSpot Hub binding is missing.",
      );
    return { accessToken, hubId };
  },

  pipedriveCredentials(
    this: MarketplaceConnectorExecutionService,
    connection: MarketplaceConnectionEntity,
    accessToken: string,
  ): PipedriveApiCredentials {
    const companyId = this.stringOrNull(
      connection.metadata?.pipedriveCompanyId,
    );
    const apiOrigin = this.stringOrNull(
      connection.metadata?.pipedriveApiOrigin,
    );
    if (!companyId || !apiOrigin)
      throw new ConnectorExecutionError(
        "credential_missing",
        "Pipedrive company and API domain binding is missing.",
      );
    return { accessToken, companyId, apiOrigin };
  },

  zohoCredentials(
    this: MarketplaceConnectorExecutionService,
    connection: MarketplaceConnectionEntity,
    accessToken: string,
  ): ZohoApiCredentials {
    const organizationId = this.stringOrNull(
      connection.metadata?.zohoCrmOrganizationId,
    );
    const apiOrigin = this.stringOrNull(connection.metadata?.zohoCrmApiOrigin);
    if (!organizationId || !apiOrigin)
      throw new ConnectorExecutionError(
        "credential_missing",
        "Zoho CRM organization and regional API binding is missing.",
      );
    return { accessToken, organizationId, apiOrigin };
  },

  zohoPeopleCredentials(
    this: MarketplaceConnectorExecutionService,
    connection: MarketplaceConnectionEntity,
    accessToken: string,
  ): ZohoPeopleCredentials {
    const userId = this.stringOrNull(connection.metadata?.zohoPeopleUserId);
    const apiOrigin = this.stringOrNull(
      connection.metadata?.zohoPeopleApiOrigin,
    );
    const accountsOrigin = this.stringOrNull(
      connection.metadata?.zohoAccountsOrigin,
    );
    if (!userId || !apiOrigin || !accountsOrigin)
      throw new ConnectorExecutionError(
        "credential_missing",
        "Zoho People user and regional authority binding is missing.",
      );
    return { accessToken, userId, apiOrigin, accountsOrigin };
  },

  zohoCampaignsCredentials(
    this: MarketplaceConnectorExecutionService,
    connection: MarketplaceConnectionEntity,
    accessToken: string,
  ): ZohoCampaignsCredentials {
    const userId = this.stringOrNull(connection.metadata?.zohoCampaignsUserId);
    const apiOrigin = this.stringOrNull(
      connection.metadata?.zohoCampaignsApiOrigin,
    );
    const accountsOrigin = this.stringOrNull(
      connection.metadata?.zohoAccountsOrigin,
    );
    if (!userId || !apiOrigin || !accountsOrigin)
      throw new ConnectorExecutionError(
        "credential_missing",
        "Zoho Campaigns user and regional authority binding is missing.",
      );
    return { accessToken, userId, apiOrigin, accountsOrigin };
  },

  zohoAnalyticsCredentials(
    this: MarketplaceConnectorExecutionService,
    connection: MarketplaceConnectionEntity,
    accessToken: string,
  ): ZohoAnalyticsCredentials {
    const userId = this.stringOrNull(connection.metadata?.zohoAnalyticsUserId);
    const apiOrigin = this.stringOrNull(
      connection.metadata?.zohoAnalyticsApiOrigin,
    );
    const accountsOrigin = this.stringOrNull(
      connection.metadata?.zohoAccountsOrigin,
    );
    if (!userId || !apiOrigin || !accountsOrigin)
      throw new ConnectorExecutionError(
        "credential_missing",
        "Zoho Analytics user and regional authority binding is missing.",
      );
    return { accessToken, userId, apiOrigin, accountsOrigin };
  },

  copperCredentials(
    this: MarketplaceConnectorExecutionService,
    connection: MarketplaceConnectionEntity,
    accessToken: string,
  ): CopperApiCredentials {
    const accountId = this.stringOrNull(connection.metadata?.copperAccountId);
    if (!accountId)
      throw new ConnectorExecutionError(
        "credential_missing",
        "Copper account binding is missing.",
      );
    return { accessToken, accountId };
  },

  closeCredentials(
    this: MarketplaceConnectorExecutionService,
    connection: MarketplaceConnectionEntity,
    accessToken: string,
  ): CloseApiCredentials {
    const organizationId = this.stringOrNull(
      connection.metadata?.closeOrganizationId,
    );
    if (!organizationId)
      throw new ConnectorExecutionError(
        "credential_missing",
        "Close organization binding is missing.",
      );
    return { accessToken, organizationId };
  },

  zendeskCredentials(
    this: MarketplaceConnectorExecutionService,
    connection: MarketplaceConnectionEntity,
    accessToken: string,
  ): ZendeskCredentials {
    const instanceOrigin = this.stringOrNull(
      connection.metadata?.zendeskInstanceOrigin,
    );
    const userId = this.stringOrNull(connection.metadata?.zendeskUserId);
    if (!instanceOrigin || !userId)
      throw new ConnectorExecutionError(
        "credential_missing",
        "Zendesk Support instance or authorizing user binding is missing.",
      );
    return { accessToken, instanceOrigin, userId };
  },

  intercomCredentials(
    this: MarketplaceConnectorExecutionService,
    connection: MarketplaceConnectionEntity,
    accessToken: string,
  ): IntercomApiCredentials {
    const apiOrigin = this.stringOrNull(connection.metadata?.intercomApiOrigin);
    const workspaceId = this.stringOrNull(
      connection.metadata?.intercomWorkspaceId,
    );
    const adminId = this.stringOrNull(connection.metadata?.intercomAdminId);
    const region = this.stringOrNull(connection.metadata?.intercomRegion);
    if (!apiOrigin || !workspaceId || !adminId || !region)
      throw new ConnectorExecutionError(
        "credential_missing",
        "Intercom workspace, region, or verified admin binding is missing.",
      );
    return { accessToken, apiOrigin, workspaceId, adminId, region };
  },

  helpScoutCredentials(
    this: MarketplaceConnectorExecutionService,
    connection: MarketplaceConnectionEntity,
    accessToken: string,
  ): HelpScoutCredentials {
    const userId = this.stringOrNull(connection.metadata?.helpScoutUserId);
    if (!userId)
      throw new ConnectorExecutionError(
        "credential_missing",
        "Help Scout authorizing-user binding is missing.",
      );
    return { accessToken, userId };
  },

  frontCredentials(
    this: MarketplaceConnectorExecutionService,
    connection: MarketplaceConnectionEntity,
    accessToken: string,
  ): FrontCredentials {
    const companyId = this.stringOrNull(connection.metadata?.frontCompanyId);
    if (!companyId || !/^cmp_[A-Za-z0-9_-]{1,190}$/.test(companyId))
      throw new ConnectorExecutionError(
        "credential_missing",
        "Front company binding is missing.",
      );
    return { accessToken, companyId };
  },

  teamworkCredentials(
    this: MarketplaceConnectorExecutionService,
    connection: MarketplaceConnectionEntity,
    accessToken: string,
  ): TeamworkCredentials {
    const installationId = this.stringOrNull(
      connection.metadata?.teamworkInstallationId,
    );
    const apiOrigin = this.stringOrNull(connection.metadata?.teamworkApiOrigin);
    if (
      !installationId ||
      !/^[1-9][0-9]{0,18}$/.test(installationId) ||
      !apiOrigin
    )
      throw new ConnectorExecutionError(
        "credential_missing",
        "Teamwork installation binding is missing.",
      );
    return { accessToken, installationId, apiOrigin };
  },

  basecampCredentials(
    this: MarketplaceConnectorExecutionService,
    connection: MarketplaceConnectionEntity,
    accessToken: string,
  ): BasecampCredentials {
    const accountId = this.stringOrNull(connection.metadata?.basecampAccountId);
    const accountOrigin = this.stringOrNull(
      connection.metadata?.basecampAccountOrigin,
    );
    if (!accountId || !/^[1-9][0-9]{0,18}$/.test(accountId) || !accountOrigin)
      throw new ConnectorExecutionError(
        "credential_missing",
        "Basecamp account binding is missing.",
      );
    return { accessToken, accountId, accountOrigin };
  },

  wrikeCredentials(
    this: MarketplaceConnectorExecutionService,
    connection: MarketplaceConnectionEntity,
    accessToken: string,
  ): WrikeCredentials {
    const accountId = this.stringOrNull(connection.metadata?.wrikeAccountId);
    const userId = this.stringOrNull(connection.metadata?.wrikeUserId);
    const apiOrigin = this.stringOrNull(connection.metadata?.wrikeApiOrigin);
    if (
      !accountId ||
      !userId ||
      !/^[A-Za-z0-9_-]{1,200}$/.test(accountId) ||
      !/^[A-Za-z0-9_-]{1,200}$/.test(userId) ||
      !apiOrigin
    )
      throw new ConnectorExecutionError(
        "credential_missing",
        "Wrike account, user, or regional-host binding is missing.",
      );
    return { accessToken, accountId, userId, apiOrigin };
  },

  smartsheetCredentials(
    this: MarketplaceConnectorExecutionService,
    connection: MarketplaceConnectionEntity,
    accessToken: string,
  ): SmartsheetCredentials {
    const accountId = this.stringOrNull(
      connection.metadata?.smartsheetAccountId,
    );
    const userId = this.stringOrNull(connection.metadata?.smartsheetUserId);
    const apiOrigin = this.stringOrNull(
      connection.metadata?.smartsheetApiOrigin,
    );
    if (
      !accountId ||
      !userId ||
      !/^[1-9][0-9]{0,24}$/.test(accountId) ||
      !/^[1-9][0-9]{0,24}$/.test(userId) ||
      !apiOrigin
    )
      throw new ConnectorExecutionError(
        "credential_missing",
        "Smartsheet account, user, or API-origin binding is missing.",
      );
    return { accessToken, accountId, userId, apiOrigin };
  },

  todoistCredentials(
    this: MarketplaceConnectorExecutionService,
    connection: MarketplaceConnectionEntity,
    accessToken: string,
  ): TodoistCredentials {
    const userId = this.stringOrNull(connection.metadata?.todoistUserId);
    const apiOrigin = this.stringOrNull(connection.metadata?.todoistApiOrigin);
    if (
      !userId ||
      !/^[A-Za-z0-9_-]{1,64}$/.test(userId) ||
      apiOrigin !== "https://api.todoist.com/api/v1"
    )
      throw new ConnectorExecutionError(
        "credential_missing",
        "Todoist user or fixed API-origin binding is missing.",
      );
    return { accessToken, userId };
  },

  ticktickCredentials(
    this: MarketplaceConnectorExecutionService,
    connection: MarketplaceConnectionEntity,
    accessToken: string,
  ): TickTickCredentials {
    const apiOrigin = this.stringOrNull(connection.metadata?.ticktickApiOrigin);
    const grantVerified = connection.metadata?.ticktickGrantVerified === true;
    if (apiOrigin !== "https://api.ticktick.com/open/v1" || !grantVerified)
      throw new ConnectorExecutionError(
        "credential_missing",
        "TickTick access-grant or fixed API-origin binding is missing.",
      );
    return { accessToken };
  },

  togglTrackCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): TogglTrackCredentials {
    return {
      apiToken:
        this.stringOrNull(stored?.TOGGL_TRACK_API_TOKEN) ??
        this.stringOrNull(stored?.apiToken) ??
        "",
    };
  },

  lumaCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
    connection: MarketplaceConnectionEntity,
  ): LumaCredentials {
    const apiKey =
      this.stringOrNull(stored?.LUMA_API_KEY) ??
      this.stringOrNull(stored?.apiKey);
    const boundUserId = this.stringOrNull(connection.metadata?.lumaUserId);
    const boundCalendarId = this.stringOrNull(
      connection.metadata?.lumaCalendarId,
    );
    const apiOrigin = this.stringOrNull(connection.metadata?.lumaApiOrigin);
    if (
      !apiKey ||
      !boundUserId ||
      !boundCalendarId ||
      apiOrigin !== "https://public-api.luma.com" ||
      connection.metadata?.userBindingVerified !== true ||
      connection.metadata?.calendarBindingVerified !== true
    ) {
      throw new ConnectorExecutionError(
        "credential_missing",
        "Luma API key, user binding, Calendar binding, or fixed API origin is missing.",
      );
    }
    return { apiKey, boundUserId, boundCalendarId };
  },

  openPhoneCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
    connection: MarketplaceConnectionEntity,
  ): OpenPhoneCredentials {
    const apiKey =
      this.stringOrNull(stored?.OPENPHONE_API_KEY) ??
      this.stringOrNull(stored?.apiKey);
    if (
      !apiKey ||
      this.stringOrNull(connection.metadata?.openPhoneApiOrigin) !==
        "https://api.openphone.com" ||
      connection.metadata?.keyValidated !== true ||
      connection.metadata?.fullAccessWorkspaceKeyReadSurfaceOnly !== true
    )
      throw new ConnectorExecutionError(
        "credential_missing",
        "Quo API key or fixed read-only connection boundary is missing.",
      );
    return { apiKey };
  },

  twilioCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
    connection?: MarketplaceConnectionEntity,
  ): TwilioCredentials {
    const accountSid = this.stringOrNull(stored?.TWILIO_ACCOUNT_SID);
    const apiKeySid = this.stringOrNull(stored?.TWILIO_API_KEY_SID);
    const apiKeySecret = this.stringOrNull(stored?.TWILIO_API_KEY_SECRET);
    if (
      !accountSid ||
      !apiKeySid ||
      !apiKeySecret ||
      (connection &&
        (this.stringOrNull(connection.metadata?.twilioApiOrigin) !==
          "https://api.twilio.com" ||
          connection.metadata?.keyValidated !== true ||
          connection.metadata?.restrictedMessageReadOnly !== true))
    )
      throw new ConnectorExecutionError(
        "credential_missing",
        "Twilio Restricted API key or fixed message-read boundary is missing.",
      );
    return { accountSid, apiKeySid, apiKeySecret };
  },

  vonageCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
    connection?: MarketplaceConnectionEntity,
  ): VonageCredentials {
    const apiKey = this.stringOrNull(stored?.VONAGE_API_KEY);
    const apiSecret = this.stringOrNull(stored?.VONAGE_API_SECRET);
    if (
      !apiKey ||
      !apiSecret ||
      (connection &&
        (this.stringOrNull(connection.metadata?.vonageApiOrigin) !==
          "https://rest.nexmo.com" ||
          connection.metadata?.keyValidated !== true ||
          connection.metadata?.fullAccountSecretReadSurfaceOnly !== true))
    )
      throw new ConnectorExecutionError(
        "credential_missing",
        "Vonage API key/secret or fixed balance-read boundary is missing.",
      );
    return { apiKey, apiSecret };
  },

  messageBirdCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
    connection?: MarketplaceConnectionEntity,
  ): MessageBirdCredentials {
    const organizationId = this.stringOrNull(
      stored?.MESSAGEBIRD_ORGANIZATION_ID,
    );
    const workspaceId = this.stringOrNull(stored?.MESSAGEBIRD_WORKSPACE_ID);
    const accessKey = this.stringOrNull(stored?.MESSAGEBIRD_ACCESS_KEY);
    if (
      !organizationId ||
      !workspaceId ||
      !accessKey ||
      (connection &&
        (this.stringOrNull(connection.metadata?.messageBirdApiOrigin) !==
          "https://api.bird.com" ||
          connection.metadata?.accessKeyValidated !== true ||
          connection.metadata?.selectedWorkspaceMetadataOnly !== true))
    )
      throw new ConnectorExecutionError(
        "credential_missing",
        "Bird organization/workspace IDs, dedicated AccessKey, or fixed workspace-read boundary is missing.",
      );
    return { organizationId, workspaceId, accessKey };
  },

  fredCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
    connection?: MarketplaceConnectionEntity,
  ): FredCredentials {
    const apiKey = this.stringOrNull(stored?.FRED_API_KEY);
    if (
      !apiKey ||
      (connection &&
        (this.stringOrNull(connection.metadata?.fredApiOrigin) !==
          "https://api.stlouisfed.org" ||
          connection.metadata?.apiKeyValidated !== true ||
          connection.metadata?.fixedSeriesRoutesOnly !== true))
    )
      throw new ConnectorExecutionError(
        "credential_missing",
        "FRED API key or fixed series-read boundary is missing.",
      );
    return { apiKey };
  },

  apolloGraphOsCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
    connection?: MarketplaceConnectionEntity,
  ): ApolloGraphOsCredentials {
    const apiKey = this.stringOrNull(stored?.APOLLO_GRAPHOS_API_KEY);
    const graphId = this.stringOrNull(stored?.APOLLO_GRAPH_ID);
    const variant = this.stringOrNull(stored?.APOLLO_GRAPH_VARIANT);
    if (
      !apiKey ||
      !graphId ||
      !variant ||
      (connection &&
        (this.stringOrNull(connection.metadata?.apolloGraphOsApiOrigin) !==
          "https://api.apollographql.com" ||
          this.stringOrNull(connection.metadata?.apolloGraphId) !== graphId ||
          this.stringOrNull(connection.metadata?.apolloGraphVariant) !==
            variant ||
          connection.metadata?.graphApiKeyValidated !== true ||
          connection.metadata?.fixedGraphMetadataQueriesOnly !== true))
    )
      throw new ConnectorExecutionError(
        "credential_missing",
        "Apollo graph key, exact graph/variant binding, or fixed metadata-query boundary is missing.",
      );
    return { apiKey, graphId, variant };
  },

  hunterCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
    connection?: MarketplaceConnectionEntity,
  ): HunterCredentials {
    const apiKey = this.stringOrNull(stored?.HUNTER_API_KEY);
    if (
      !apiKey ||
      (connection &&
        (this.stringOrNull(connection.metadata?.hunterApiOrigin) !==
          "https://api.hunter.io" ||
          connection.metadata?.apiKeyValidated !== true ||
          connection.metadata?.fixedReducedReadsOnly !== true))
    )
      throw new ConnectorExecutionError(
        "credential_missing",
        "Hunter API key or fixed reduced-read boundary is missing.",
      );
    return { apiKey };
  },

  snovCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
    connection?: MarketplaceConnectionEntity,
  ): SnovCredentials {
    const clientId = this.stringOrNull(stored?.SNOV_CLIENT_ID);
    const clientSecret = this.stringOrNull(stored?.SNOV_CLIENT_SECRET);
    if (
      !clientId ||
      !clientSecret ||
      (connection &&
        (this.stringOrNull(connection.metadata?.snovApiOrigin) !==
          "https://api.snov.io" ||
          connection.metadata?.clientCredentialsValidated !== true ||
          connection.metadata?.fixedSingleEmailVerificationOnly !== true ||
          connection.metadata?.oneEmailPerStart !== true ||
          connection.metadata?.webhookBlocked !== true))
    )
      throw new ConnectorExecutionError(
        "credential_missing",
        "Snov.io client credentials or fixed single-email verification boundary is missing.",
      );
    return { clientId, clientSecret };
  },

  lushaCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
    connection?: MarketplaceConnectionEntity,
  ): LushaCredentials {
    const apiKey = this.stringOrNull(stored?.LUSHA_API_KEY);
    if (
      !apiKey ||
      (connection &&
        (this.stringOrNull(connection.metadata?.lushaApiOrigin) !==
          "https://api.lusha.com" ||
          connection.metadata?.apiKeyValidated !== true ||
          connection.metadata?.fixedAccountUsageOnly !== true ||
          connection.metadata?.businessProfileDataBlocked !== true ||
          connection.metadata?.providerHostedMcpBlocked !== true))
    )
      throw new ConnectorExecutionError(
        "credential_missing",
        "Lusha API key or fixed account-usage boundary is missing.",
      );
    return { apiKey };
  },

  leadIqCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
    connection?: MarketplaceConnectionEntity,
  ): LeadIqCredentials {
    const apiKey = this.stringOrNull(stored?.LEADIQ_API_KEY);
    if (
      !apiKey ||
      (connection &&
        (this.stringOrNull(connection.metadata?.leadIqApiEndpoint) !==
          "https://api.leadiq.com/graphql" ||
          connection.metadata?.apiKeyValidated !== true ||
          connection.metadata?.fixedAccountQueryOnly !== true ||
          connection.metadata?.noCreditOperationOnly !== true ||
          connection.metadata?.peopleCompanyDataBlocked !== true ||
          connection.metadata?.providerHostedMcpBlocked !== true))
    )
      throw new ConnectorExecutionError(
        "credential_missing",
        "LeadIQ API key or fixed no-credit account-query boundary is missing.",
      );
    return { apiKey };
  },

  seamlessAiCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
    connection?: MarketplaceConnectionEntity,
  ): SeamlessAiCredentials {
    const apiKey = this.stringOrNull(stored?.SEAMLESS_API_KEY);
    if (
      !apiKey ||
      (connection &&
        (this.stringOrNull(connection.metadata?.seamlessAiApiOrigin) !==
          "https://api.seamless.ai" ||
          connection.metadata?.apiKeyValidated !== true ||
          connection.metadata?.fixedCompanySearchOnly !== true ||
          connection.metadata?.publicApiV1Only !== true ||
          connection.metadata?.maxResults !== 5 ||
          connection.metadata?.peopleContactDataBlocked !== true ||
          connection.metadata?.researchOutreachMcpBlocked !== true))
    )
      throw new ConnectorExecutionError(
        "credential_missing",
        "Seamless.AI API key or fixed company-search boundary is missing.",
      );
    return { apiKey };
  },

  rocketReachCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
    connection?: MarketplaceConnectionEntity,
  ): RocketReachCredentials {
    const apiKey = this.stringOrNull(stored?.ROCKETREACH_API_KEY);
    if (
      !apiKey ||
      (connection &&
        (this.stringOrNull(connection.metadata?.rocketReachApiEndpoint) !==
          "https://api.rocketreach.co/api/v2/universal/account/" ||
          connection.metadata?.apiKeyValidated !== true ||
          connection.metadata?.fixedUniversalAccountReadOnly !== true ||
          connection.metadata?.accountIdentityStripped !== true ||
          connection.metadata?.peopleCompanyDataBlocked !== true ||
          connection.metadata?.providerHostedMcpBlocked !== true))
    )
      throw new ConnectorExecutionError(
        "credential_missing",
        "RocketReach API key or fixed Universal account boundary is missing.",
      );
    return { apiKey };
  },

  upLeadCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
    connection?: MarketplaceConnectionEntity,
  ): UpLeadCredentials {
    const apiKey = this.stringOrNull(stored?.UPLEAD_API_KEY);
    if (
      !apiKey ||
      (connection &&
        (this.stringOrNull(connection.metadata?.upLeadApiEndpoint) !==
          "https://api.uplead.com/v2/credits" ||
          connection.metadata?.apiKeyValidated !== true ||
          connection.metadata?.fixedCreditsReadOnly !== true ||
          connection.metadata?.accountEmailStripped !== true ||
          connection.metadata?.peopleCompanyDataBlocked !== true ||
          connection.metadata?.prospectingPreviewListsExportsBlocked !== true))
    )
      throw new ConnectorExecutionError(
        "credential_missing",
        "UpLead API key or fixed credits-read boundary is missing.",
      );
    return { apiKey };
  },

  wizaCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
    connection?: MarketplaceConnectionEntity,
  ): WizaCredentials {
    const apiKey = this.stringOrNull(stored?.WIZA_API_KEY);
    if (
      !apiKey ||
      (connection &&
        (this.stringOrNull(connection.metadata?.wizaApiEndpoint) !==
          "https://wiza.co/api/meta/credits" ||
          connection.metadata?.apiKeyValidated !== true ||
          connection.metadata?.fixedCreditBalancesReadOnly !== true ||
          connection.metadata?.peopleCompanyDataBlocked !== true ||
          connection.metadata?.bulkListsWebhooksExportsBlocked !== true ||
          connection.metadata?.adminFinancialRawBlocked !== true))
    )
      throw new ConnectorExecutionError(
        "credential_missing",
        "Wiza API key or fixed credit-balances boundary is missing.",
      );
    return { apiKey };
  },

  hopinCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): HopinCredentials {
    const accessToken =
      this.stringOrNull(stored?.RINGCENTRAL_EVENTS_ACCESS_TOKEN) ??
      this.stringOrNull(stored?.accessToken);
    const organizationId =
      this.stringOrNull(stored?.RINGCENTRAL_EVENTS_ORGANIZATION_ID) ??
      this.stringOrNull(stored?.organizationId);
    if (
      !accessToken ||
      !organizationId ||
      !/^[A-Za-z0-9_-]{1,128}$/.test(organizationId)
    )
      throw new ConnectorExecutionError(
        "credential_missing",
        "RingCentral Events bearer token or Organization ID is missing.",
      );
    return { accessToken, organizationId };
  },

  harvestCredentials(
    this: MarketplaceConnectorExecutionService,
    connection: MarketplaceConnectionEntity,
    accessToken: string,
  ): HarvestCredentials {
    const accountId = this.stringOrNull(connection.metadata?.harvestAccountId);
    const userId = this.stringOrNull(connection.metadata?.harvestApiUserId);
    const apiOrigin = this.stringOrNull(connection.metadata?.harvestApiOrigin);
    if (
      !accountId ||
      !userId ||
      !/^[1-9]\d{0,18}$/.test(accountId) ||
      !/^[1-9]\d{0,18}$/.test(userId) ||
      apiOrigin !== "https://api.harvestapp.com/v2"
    )
      throw new ConnectorExecutionError(
        "credential_missing",
        "Harvest account, authorizing user, or fixed API-origin binding is missing.",
      );
    return { accessToken, accountId, userId };
  },

  clockifyCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
    connection?: MarketplaceConnectionEntity,
  ): ClockifyCredentials {
    return {
      apiKey:
        this.stringOrNull(stored?.CLOCKIFY_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
      apiBaseUrl:
        this.stringOrNull(stored?.CLOCKIFY_API_BASE_URL) ??
        this.stringOrNull(stored?.apiBaseUrl) ??
        "https://api.clockify.me/api/v1",
      userId:
        this.stringOrNull(connection?.metadata?.clockifyUserId) ?? undefined,
    };
  },

  tempoTimesheetsCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): TempoTimesheetsCredentials {
    return {
      apiToken:
        this.stringOrNull(stored?.TEMPO_API_TOKEN) ??
        this.stringOrNull(stored?.apiToken) ??
        "",
      jiraSiteUrl:
        this.stringOrNull(stored?.TEMPO_JIRA_SITE_URL) ??
        this.stringOrNull(stored?.jiraSiteUrl) ??
        "",
    };
  },

  zephyrScaleCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): ZephyrScaleCredentials {
    return {
      apiToken:
        this.stringOrNull(stored?.ZEPHYR_SCALE_API_TOKEN) ??
        this.stringOrNull(stored?.apiToken) ??
        "",
      region:
        this.stringOrNull(stored?.ZEPHYR_SCALE_REGION) ??
        this.stringOrNull(stored?.region) ??
        "",
      projectKey:
        this.stringOrNull(stored?.ZEPHYR_SCALE_PROJECT_KEY) ??
        this.stringOrNull(stored?.projectKey) ??
        "",
    };
  },

  calendlyCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
    connection: MarketplaceConnectionEntity,
  ): CalendlyCredentials {
    const accessToken = this.stringOrNull(stored?.accessToken) ?? "";
    const userUri = this.stringOrNull(connection.metadata?.calendlyUserUri);
    const organizationUri = this.stringOrNull(
      connection.metadata?.calendlyOrganizationUri,
    );
    if (
      !accessToken ||
      !userUri ||
      !organizationUri ||
      !/^https:\/\/api\.calendly\.com\/users\/[A-Za-z0-9_-]{1,64}$/.test(
        userUri,
      ) ||
      !/^https:\/\/api\.calendly\.com\/organizations\/[A-Za-z0-9_-]{1,64}$/.test(
        organizationUri,
      )
    )
      throw new ConnectorExecutionError(
        "credential_missing",
        "Calendly access token, user, or current-organization binding is missing.",
      );
    return { accessToken, userUri, organizationUri };
  },

  calComCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
    connection: MarketplaceConnectionEntity,
  ): CalComCredentials {
    const accessToken = this.stringOrNull(stored?.accessToken) ?? "";
    const userId = this.stringOrNull(connection.metadata?.calComUserId) ?? "";
    const username =
      this.stringOrNull(connection.metadata?.calComUsername) ?? "";
    if (
      !accessToken ||
      !/^[1-9][0-9]{0,19}$/.test(userId) ||
      !/^[A-Za-z0-9_-]{1,128}$/.test(username) ||
      this.stringOrNull(connection.metadata?.calComApiOrigin) !==
        "https://api.cal.com/v2"
    )
      throw new ConnectorExecutionError(
        "credential_missing",
        "Cal.com access token or exact-user binding is missing.",
      );
    return { accessToken, userId, username };
  },

  docusignCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
    connection: MarketplaceConnectionEntity,
  ): DocusignCredentials {
    const accessToken = this.stringOrNull(stored?.accessToken) ?? "";
    const accountId =
      this.stringOrNull(connection.metadata?.docusignAccountId) ?? "";
    const baseUri =
      this.stringOrNull(connection.metadata?.docusignBaseUri) ?? "";
    if (
      !accessToken ||
      !/^[0-9A-Fa-f-]{1,64}$/.test(accountId) ||
      !/^https:\/\/[a-z0-9-]+\.docusign\.net$/.test(baseUri)
    )
      throw new ConnectorExecutionError(
        "credential_missing",
        "Docusign access token, selected account, or regional base URI is missing.",
      );
    return { accessToken, accountId, baseUri };
  },

  dropboxSignCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
    connection: MarketplaceConnectionEntity,
  ): DropboxSignCredentials {
    const accessToken = this.stringOrNull(stored?.accessToken) ?? "";
    const accountId =
      this.stringOrNull(connection.metadata?.dropboxSignAccountId) ?? "";
    if (
      !accessToken ||
      !/^[0-9A-Fa-f]{24,64}$/.test(accountId) ||
      this.stringOrNull(connection.metadata?.dropboxSignApiOrigin) !==
        "https://api.hellosign.com/v3"
    )
      throw new ConnectorExecutionError(
        "credential_missing",
        "Dropbox Sign access token or exact-account binding is missing.",
      );
    return { accessToken, accountId };
  },

  pandaDocCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
    connection: MarketplaceConnectionEntity,
  ): PandaDocCredentials {
    const accessToken = this.stringOrNull(stored?.accessToken) ?? "";
    const membershipId =
      this.stringOrNull(connection.metadata?.pandaDocMembershipId) ?? "";
    const workspaceId =
      this.stringOrNull(connection.metadata?.pandaDocWorkspaceId) ?? "";
    if (
      !accessToken ||
      !/^[A-Za-z0-9_-]{1,64}$/.test(membershipId) ||
      !/^[A-Za-z0-9_-]{1,64}$/.test(workspaceId) ||
      this.stringOrNull(connection.metadata?.pandaDocApiOrigin) !==
        "https://api.pandadoc.com/public/v1"
    )
      throw new ConnectorExecutionError(
        "credential_missing",
        "PandaDoc access token, membership, or workspace binding is missing.",
      );
    return { accessToken, membershipId, workspaceId };
  },

  typeformCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
    connection: MarketplaceConnectionEntity,
  ): TypeformCredentials {
    const accessToken = this.stringOrNull(stored?.accessToken) ?? "";
    const accountId =
      this.stringOrNull(connection.metadata?.typeformAccountId) ?? "";
    const workspaceId =
      this.stringOrNull(connection.metadata?.typeformWorkspaceId) ?? "";
    const apiOrigin =
      this.stringOrNull(connection.metadata?.typeformApiOrigin) ?? "";
    if (
      !accessToken ||
      !/^[A-Za-z0-9_-]{1,64}$/.test(accountId) ||
      !/^[A-Za-z0-9_-]{1,64}$/.test(workspaceId) ||
      !TypeformApiAdapter.allowedOrigins.has(apiOrigin)
    )
      throw new ConnectorExecutionError(
        "credential_missing",
        "Typeform access token, account, workspace, or API-region binding is missing.",
      );
    return { accessToken, accountId, workspaceId, apiOrigin };
  },

  sendFoxCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
    connection: MarketplaceConnectionEntity,
  ): SendFoxCredentials {
    const accessToken = this.stringOrNull(stored?.accessToken) ?? "";
    const accountId =
      this.stringOrNull(connection.metadata?.sendFoxAccountId) ?? "";
    if (
      !accessToken ||
      !/^[1-9][0-9]{0,18}$/.test(accountId) ||
      this.stringOrNull(connection.metadata?.sendFoxApiOrigin) !==
        SendFoxApiAdapter.apiOrigin
    )
      throw new ConnectorExecutionError(
        "credential_missing",
        "SendFox access token or exact-account binding is missing.",
      );
    return { accessToken, accountId };
  },

  beehiivCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
    connection: MarketplaceConnectionEntity,
  ): BeehiivCredentials {
    const accessToken = this.stringOrNull(stored?.accessToken) ?? "";
    const organizationId =
      this.stringOrNull(connection.metadata?.beehiivOrganizationId) ?? "";
    if (
      !accessToken ||
      !/^org_[0-9a-fA-F-]{1,64}$/.test(organizationId) ||
      this.stringOrNull(connection.metadata?.beehiivApiOrigin) !==
        BeehiivApiAdapter.apiOrigin
    )
      throw new ConnectorExecutionError(
        "credential_missing",
        "beehiiv access token or exact-organization binding is missing.",
      );
    return { accessToken, organizationId };
  },

  substackCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
    connection: MarketplaceConnectionEntity,
  ): SubstackCredentials {
    return {
      apiToken:
        this.stringOrNull(stored?.SUBSTACK_API_TOKEN) ??
        this.stringOrNull(stored?.apiToken) ??
        "",
      validationLinkedInHandle:
        this.stringOrNull(
          connection.metadata?.SUBSTACK_VALIDATION_LINKEDIN_HANDLE,
        ) ??
        this.stringOrNull(
          connection.metadata?.substackValidationLinkedInHandle,
        ) ??
        "",
    };
  },

  hootsuiteCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): HootsuiteCredentials {
    return { accessToken: this.stringOrNull(stored?.accessToken) ?? "" };
  },

  sproutSocialCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): SproutSocialCredentials {
    return {
      clientId:
        this.stringOrNull(stored?.SPROUT_SOCIAL_CLIENT_ID) ??
        this.stringOrNull(stored?.clientId) ??
        "",
      clientSecret:
        this.stringOrNull(stored?.SPROUT_SOCIAL_CLIENT_SECRET) ??
        this.stringOrNull(stored?.clientSecret) ??
        "",
    };
  },

  laterCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): LaterCredentials {
    return {
      clientId:
        this.stringOrNull(stored?.LATER_CLIENT_ID) ??
        this.stringOrNull(stored?.clientId) ??
        "",
      clientSecret:
        this.stringOrNull(stored?.LATER_CLIENT_SECRET) ??
        this.stringOrNull(stored?.clientSecret) ??
        "",
    };
  },

  agorapulseCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): AgorapulseCredentials {
    return {
      apiKey:
        this.stringOrNull(stored?.AGORAPULSE_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
      organizationId:
        this.stringOrNull(stored?.AGORAPULSE_ORGANIZATION_ID) ??
        this.stringOrNull(stored?.organizationId) ??
        "",
      workspaceId:
        this.stringOrNull(stored?.AGORAPULSE_WORKSPACE_ID) ??
        this.stringOrNull(stored?.workspaceId) ??
        "",
    };
  },

  metricoolCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): MetricoolCredentials {
    return {
      userToken:
        this.stringOrNull(stored?.METRICOOL_USER_TOKEN) ??
        this.stringOrNull(stored?.userToken) ??
        "",
      userId:
        this.stringOrNull(stored?.METRICOOL_USER_ID) ??
        this.stringOrNull(stored?.userId) ??
        "",
      blogId:
        this.stringOrNull(stored?.METRICOOL_BLOG_ID) ??
        this.stringOrNull(stored?.blogId) ??
        "",
    };
  },

  publerCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): PublerCredentials {
    return {
      apiKey:
        this.stringOrNull(stored?.PUBLER_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
      workspaceId:
        this.stringOrNull(stored?.PUBLER_WORKSPACE_ID) ??
        this.stringOrNull(stored?.workspaceId) ??
        "",
    };
  },

  brandwatchCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): BrandwatchCredentials {
    return {
      accessToken:
        this.stringOrNull(stored?.BRANDWATCH_ACCESS_TOKEN) ??
        this.stringOrNull(stored?.accessToken) ??
        "",
      projectId:
        this.stringOrNull(stored?.BRANDWATCH_PROJECT_ID) ??
        this.stringOrNull(stored?.projectId) ??
        "",
    };
  },

  mentionCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): MentionCredentials {
    return {
      accessToken:
        this.stringOrNull(stored?.MENTION_ACCESS_TOKEN) ??
        this.stringOrNull(stored?.accessToken) ??
        "",
      accountId:
        this.stringOrNull(stored?.MENTION_ACCOUNT_ID) ??
        this.stringOrNull(stored?.accountId) ??
        "",
    };
  },

  meltwaterCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): MeltwaterCredentials {
    return {
      apiToken:
        this.stringOrNull(stored?.MELTWATER_API_TOKEN) ??
        this.stringOrNull(stored?.apiToken) ??
        "",
    };
  },

  sprinklrCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): SprinklrCredentials {
    return {
      apiKey: this.stringOrNull(stored?.SPRINKLR_API_KEY) ?? "",
      accessToken: this.stringOrNull(stored?.SPRINKLR_ACCESS_TOKEN) ?? "",
      environment: this.stringOrNull(stored?.SPRINKLR_ENVIRONMENT) ?? "",
      workspaceId: this.stringOrNull(stored?.SPRINKLR_WORKSPACE_ID) ?? "",
    };
  },

  khorosCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): KhorosCredentials {
    return {
      accessToken:
        this.stringOrNull(stored?.KHOROS_MARKETING_ACCESS_TOKEN) ?? "",
      companyId: this.stringOrNull(stored?.KHOROS_MARKETING_COMPANY_ID) ?? "",
    };
  },

  cleverTapCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): CleverTapCredentials {
    return {
      accountId: this.stringOrNull(stored?.CLEVERTAP_ACCOUNT_ID) ?? "",
      passcode: this.stringOrNull(stored?.CLEVERTAP_PASSCODE) ?? "",
      region: this.stringOrNull(stored?.CLEVERTAP_REGION) ?? "",
      profileIdentity:
        this.stringOrNull(stored?.CLEVERTAP_PROFILE_IDENTITY) ?? "",
    };
  },

  oneSignalCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): OneSignalCredentials {
    return {
      appId: this.stringOrNull(stored?.ONESIGNAL_APP_ID) ?? "",
      appApiKey: this.stringOrNull(stored?.ONESIGNAL_APP_API_KEY) ?? "",
    };
  },

  airshipCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): AirshipCredentials {
    return {
      bearerToken: this.stringOrNull(stored?.AIRSHIP_BEARER_TOKEN) ?? "",
      cloudSite: this.stringOrNull(stored?.AIRSHIP_CLOUD_SITE) ?? "",
    };
  },

  pushwooshCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): PushwooshCredentials {
    return {
      apiToken: this.stringOrNull(stored?.PUSHWOOSH_API_TOKEN) ?? "",
      applicationCode:
        this.stringOrNull(stored?.PUSHWOOSH_APPLICATION_CODE) ?? "",
    };
  },

  pusherBeamsCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): PusherBeamsCredentials {
    return {
      instanceId: this.stringOrNull(stored?.PUSHER_BEAMS_INSTANCE_ID) ?? "",
      secretKey: this.stringOrNull(stored?.PUSHER_BEAMS_SECRET_KEY) ?? "",
      interest: this.stringOrNull(stored?.PUSHER_BEAMS_INTEREST) ?? "",
    };
  },

  firebaseCloudMessagingCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): FirebaseCloudMessagingCredentials {
    return {
      serviceAccountJson:
        this.stringOrNull(stored?.FCM_SERVICE_ACCOUNT_JSON) ?? "",
      topic: this.stringOrNull(stored?.FCM_TOPIC) ?? "",
    };
  },

  appsFlyerCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): AppsFlyerCredentials {
    return { apiToken: this.stringOrNull(stored?.APPSFLYER_API_TOKEN) ?? "" };
  },
};
