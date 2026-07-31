import { safeConnectorFetch } from "../../safe-connector-fetch";
import type {
  OAuthProviderProfileHandler,
  OAuthProviderProfileHandlerMap,
} from "./oauth-provider-profile-handler";
import type { MarketplaceConnectorOAuthService } from "../../connector-oauth.service";
import { BadRequestException } from "@nestjs/common";

const oauthProviderProfileHandler049: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    providerSession,
    _tokenResponse,
  ) {
    const organizationId = this.stringOrNull(
      providerSession?.closeOrganizationId,
    );
    const userId = this.stringOrNull(providerSession?.closeUserId);
    if (
      !organizationId ||
      !userId ||
      !/^orga_[A-Za-z0-9]{1,200}$/.test(organizationId) ||
      !/^user_[A-Za-z0-9]{1,200}$/.test(userId)
    )
      throw new BadRequestException(
        "Close token response is missing its exact organization or user binding",
      );
    const response = await safeConnectorFetch(
      "https://api.close.com/api/v1/me/?_fields=id,first_name,last_name,organizations",
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      },
    );
    const me = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const organizations = Array.isArray(me.organizations)
      ? me.organizations
          .filter(
            (row): row is Record<string, unknown> =>
              Boolean(row) && typeof row === "object" && !Array.isArray(row),
          )
          .map((row) => ({
            id: this.stringOrNull(row.id),
            name: this.stringOrNull(row.name)?.slice(0, 200) ?? null,
          }))
      : [];
    const organization = organizations.find((row) => row.id === organizationId);
    if (!response.ok || this.stringOrNull(me.id) !== userId || !organization)
      throw new BadRequestException(
        "Close authorization is not bound to the selected organization and user",
      );
    const userName = [
      this.stringOrNull(me.first_name),
      this.stringOrNull(me.last_name),
    ]
      .filter(Boolean)
      .join(" ")
      .slice(0, 200);
    return {
      closeOrganizationId: organizationId,
      closeOrganizationName: organization.name,
      closeUserId: userId,
      closeUserName: userName || null,
    };
  };

const oauthProviderProfileHandler050: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    const headers = {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    };
    const [accountResponse, userResponse] = await Promise.all([
      safeConnectorFetch("https://api.copper.com/developer_api/v1/account", {
        method: "GET",
        headers,
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      }),
      safeConnectorFetch("https://api.copper.com/developer_api/v1/users/me", {
        method: "GET",
        headers,
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      }),
    ]);
    const account = (await accountResponse.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const user = (await userResponse.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const accountId = this.positiveNumericId(account.id);
    const userId = this.positiveNumericId(user.id);
    if (!accountResponse.ok || !userResponse.ok || !accountId || !userId)
      throw new BadRequestException(
        "Copper authorization is not bound to one valid account and user",
      );
    return {
      copperAccountId: accountId,
      copperAccountName: this.stringOrNull(account.name)?.slice(0, 200) ?? null,
      copperPrimaryTimezone:
        this.stringOrNull(account.primary_timezone)?.slice(0, 100) ?? null,
      copperUserId: userId,
      copperUserName: this.stringOrNull(user.name)?.slice(0, 200) ?? null,
    };
  };

const oauthProviderProfileHandler051: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    providerSession,
    _tokenResponse,
  ) {
    const apiOrigin = this.pipedriveApiOrigin(
      this.stringOrNull(providerSession?.pipedriveApiDomain),
    );
    const response = await safeConnectorFetch(`${apiOrigin}/api/v1/users/me`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    const body = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const data =
      body.data && typeof body.data === "object" && !Array.isArray(body.data)
        ? (body.data as Record<string, unknown>)
        : {};
    const userId = this.positiveNumericId(data.id);
    const companyId = this.positiveNumericId(data.company_id);
    if (!response.ok || body.success === false || !userId || !companyId)
      throw new BadRequestException(
        "Pipedrive authorization is not bound to one valid user, company, and API domain",
      );
    return {
      pipedriveUserId: userId,
      pipedriveCompanyId: companyId,
      pipedriveCompanyName:
        this.stringOrNull(data.company_name)?.slice(0, 200) ?? null,
      pipedriveCompanyDomain:
        this.stringOrNull(data.company_domain)?.slice(0, 200) ?? null,
      pipedriveApiOrigin: apiOrigin,
    };
  };

const oauthProviderProfileHandler052: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    const clientId = this.configService
      .get<string>("HUBSPOT_CLIENT_ID")
      ?.trim();
    const clientSecret = this.configService
      .get<string>("HUBSPOT_CLIENT_SECRET")
      ?.trim();
    if (!clientId || !clientSecret)
      throw new BadRequestException(
        "HubSpot introspection credentials are not configured on Railway",
      );
    const response = await safeConnectorFetch(
      "https://api.hubapi.com/oauth/2026-03/token/introspect",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          token: accessToken,
          token_type_hint: "access_token",
        }),
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      },
    );
    const body = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const hubId = this.stringOrNull(body.hub_id);
    const userId = this.stringOrNull(body.user_id);
    const responseClientId = this.stringOrNull(body.client_id);
    const scopes = Array.isArray(body.scopes)
      ? body.scopes.filter(
          (value): value is string => typeof value === "string",
        )
      : [];
    if (
      !response.ok ||
      body.active !== true ||
      !hubId ||
      !/^[1-9][0-9]{0,19}$/.test(hubId) ||
      !userId ||
      !/^[1-9][0-9]{0,19}$/.test(userId) ||
      responseClientId !== clientId ||
      !["oauth", "crm.objects.companies.read", "crm.objects.deals.read"].every(
        (scope) => scopes.includes(scope),
      )
    )
      throw new BadRequestException(
        "HubSpot authorization is not bound to the configured app, exact Hub, user, and required scopes",
      );
    return {
      hubSpotHubId: hubId,
      hubSpotUserId: userId,
      hubSpotAppId: this.stringOrNull(body.app_id),
      hubSpotHubDomain: this.stringOrNull(body.hub_domain),
      hubSpotTokenScopes: scopes,
    };
  };

const oauthProviderProfileHandler053: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    providerSession,
    _tokenResponse,
  ) {
    const organizationId = this.stringOrNull(
      providerSession?.salesforceOrganizationId,
    );
    const userId = this.stringOrNull(providerSession?.salesforceUserId);
    const instanceOrigin = this.stringOrNull(
      providerSession?.salesforceInstanceOrigin,
    );
    if (!organizationId || !userId || !instanceOrigin)
      throw new BadRequestException(
        "Salesforce callback is not bound to one organization, user, and instance",
      );
    const url = new URL("/services/data/v67.0/query", instanceOrigin);
    url.searchParams.set(
      "q",
      `SELECT Id, Name FROM Organization WHERE Id = '${organizationId}' LIMIT 1`,
    );
    const response = await safeConnectorFetch(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    const body = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const records = Array.isArray(body.records) ? body.records : [];
    const organization =
      records[0] && typeof records[0] === "object" && !Array.isArray(records[0])
        ? (records[0] as Record<string, unknown>)
        : {};
    if (!response.ok || this.stringOrNull(organization.Id) !== organizationId)
      throw new BadRequestException(
        "Salesforce authorization is not valid for the signed organization",
      );
    return {
      salesforceOrganizationId: organizationId,
      salesforceUserId: userId,
      salesforceInstanceOrigin: instanceOrigin,
      salesforceOrganizationName: this.stringOrNull(organization.Name),
    };
  };

const oauthProviderProfileHandler054: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    providerSession,
    _tokenResponse,
  ) {
    const subscriptionKey = this.normalizeSageAccountingSubscriptionKey(
      this.stringOrNull(providerSession?.sageAccountingSubscriptionKey) ?? "",
    );
    const response = await safeConnectorFetch(
      "https://api.accounting.sage.com/v3.1/businesses",
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
          "Ocp-Apim-Subscription-Key": subscriptionKey,
          "User-Agent": "RelayConsole-SageAccounting/1.0",
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      },
    );
    const body = await response.json().catch(() => []);
    const rows = Array.isArray(body)
      ? body
      : body && typeof body === "object" && !Array.isArray(body)
        ? Array.isArray((body as Record<string, unknown>).items)
          ? ((body as Record<string, unknown>).items as unknown[])
          : []
        : [];
    const businesses = rows
      .map((value) =>
        value && typeof value === "object" && !Array.isArray(value)
          ? (value as Record<string, unknown>)
          : {},
      )
      .filter((value) => {
        const id = this.stringOrNull(value.id);
        return Boolean(id && /^[A-Za-z0-9_-]{1,200}$/.test(id));
      });
    if (!response.ok || businesses.length !== 1)
      throw new BadRequestException(
        "Sage Accounting authorization must grant exactly one business",
      );
    const business = businesses[0];
    return {
      sageAccountingBusinessId: this.stringOrNull(business.id),
      sageAccountingBusinessName:
        this.stringOrNull(business.name) ??
        this.stringOrNull(business.displayed_as),
    };
  };

const oauthProviderProfileHandler055: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    const response = await safeConnectorFetch("https://api.freeagent.com/v2/company", {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "RelayConsole-FreeAgent/1.0",
      },
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    const body = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const company =
      body.company &&
      typeof body.company === "object" &&
      !Array.isArray(body.company)
        ? (body.company as Record<string, unknown>)
        : {};
    const companyId = this.stringOrNull(company.id);
    if (!response.ok || !companyId || !/^[1-9][0-9]{0,31}$/.test(companyId))
      throw new BadRequestException(
        "FreeAgent authorization is not valid for one company",
      );
    return {
      freeAgentCompanyId: companyId,
      freeAgentCompanyName: this.stringOrNull(company.name),
      freeAgentCompanyType: this.stringOrNull(company.type),
      freeAgentCurrency: this.stringOrNull(company.currency),
    };
  };

const oauthProviderProfileHandler056: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    providerSession,
    _tokenResponse,
  ) {
    const businessId = this.stringOrNull(providerSession?.waveBusinessId);
    if (!businessId || !/^[A-Za-z0-9+/=_-]{1,256}$/.test(businessId))
      throw new BadRequestException(
        "Wave callback is not bound to one valid business",
      );
    const response = await safeConnectorFetch("https://gql.waveapps.com/graphql/public", {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query:
          "query RelayWaveConnectedBusiness($businessId: ID!) { business(id: $businessId) { id name isPersonal } }",
        variables: { businessId },
      }),
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    const body = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const data =
      body.data && typeof body.data === "object" && !Array.isArray(body.data)
        ? (body.data as Record<string, unknown>)
        : {};
    const business =
      data.business &&
      typeof data.business === "object" &&
      !Array.isArray(data.business)
        ? (data.business as Record<string, unknown>)
        : {};
    if (
      !response.ok ||
      (Array.isArray(body.errors) && body.errors.length > 0) ||
      this.stringOrNull(business.id) !== businessId
    )
      throw new BadRequestException(
        "Wave authorization is not valid for the selected business",
      );
    return {
      waveBusinessId: businessId,
      waveBusinessName: this.stringOrNull(business.name),
      waveBusinessIsPersonal: business.isPersonal === true,
    };
  };

const oauthProviderProfileHandler057: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    const response = await safeConnectorFetch(
      "https://api.freshbooks.com/auth/api/v1/users/me",
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      },
    );
    const body = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const identity =
      body.response &&
      typeof body.response === "object" &&
      !Array.isArray(body.response)
        ? (body.response as Record<string, unknown>)
        : {};
    const memberships = Array.isArray(identity.business_memberships)
      ? identity.business_memberships
      : [];
    const candidates = memberships
      .map((value) => {
        const membership =
          value && typeof value === "object" && !Array.isArray(value)
            ? (value as Record<string, unknown>)
            : {};
        const business =
          membership.business &&
          typeof membership.business === "object" &&
          !Array.isArray(membership.business)
            ? (membership.business as Record<string, unknown>)
            : {};
        return {
          businessId:
            typeof business.id === "number" &&
            Number.isSafeInteger(business.id) &&
            business.id > 0
              ? String(business.id)
              : this.stringOrNull(business.id),
          accountId: this.stringOrNull(business.account_id),
          businessName: this.stringOrNull(business.name),
          role: this.stringOrNull(membership.role),
          active: business.active === true,
        };
      })
      .filter(
        (value) =>
          value.active &&
          value.businessId &&
          /^[1-9][0-9]{0,31}$/.test(value.businessId) &&
          value.accountId &&
          /^[A-Za-z0-9_-]{1,64}$/.test(value.accountId) &&
          value.role,
      )
      .sort((left, right) => {
        const preferred = new Set([
          "owner",
          "business_partner",
          "business_accountant",
        ]);
        return (
          Number(preferred.has(right.role!)) - Number(preferred.has(left.role!))
        );
      });
    const selected = candidates[0];
    if (!response.ok || !selected)
      throw new BadRequestException(
        "FreshBooks authorization has no active accounting business",
      );
    return {
      freshbooksBusinessId: selected.businessId,
      freshbooksAccountId: selected.accountId,
      freshbooksBusinessName: selected.businessName,
      freshbooksRole: selected.role,
    };
  };

const oauthProviderProfileHandler058: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    providerSession,
    _tokenResponse,
  ) {
    const realmId = this.stringOrNull(providerSession?.quickbooksRealmId);
    const environment = this.stringOrNull(
      providerSession?.quickbooksEnvironment,
    );
    if (
      !realmId ||
      !/^[1-9][0-9]{0,31}$/.test(realmId) ||
      !environment ||
      !["sandbox", "production"].includes(environment)
    )
      throw new BadRequestException(
        "QuickBooks callback is not bound to a valid company",
      );
    const host =
      environment === "sandbox"
        ? "sandbox-quickbooks.api.intuit.com"
        : "quickbooks.api.intuit.com";
    const url = new URL(
      `https://${host}/v3/company/${realmId}/companyinfo/${realmId}`,
    );
    url.searchParams.set("minorversion", "75");
    const response = await safeConnectorFetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    const body = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const companyInfo =
      body.CompanyInfo &&
      typeof body.CompanyInfo === "object" &&
      !Array.isArray(body.CompanyInfo)
        ? (body.CompanyInfo as Record<string, unknown>)
        : {};
    if (!response.ok || this.stringOrNull(companyInfo.Id) !== realmId)
      throw new BadRequestException(
        "QuickBooks token is not valid for the callback company",
      );
    return {
      quickbooksRealmId: realmId,
      quickbooksEnvironment: environment,
      quickbooksCompanyName: this.stringOrNull(companyInfo.CompanyName),
      quickbooksLegalName: this.stringOrNull(companyInfo.LegalName),
    };
  };

const oauthProviderProfileHandler059: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    const authEventId = this.jwtStringClaim(
      accessToken,
      "authentication_event_id",
    );
    if (!authEventId || !this.isUuid(authEventId))
      throw new BadRequestException(
        "Xero authorization event binding is invalid",
      );
    const url = new URL("https://api.xero.com/connections");
    url.searchParams.set("authEventId", authEventId);
    const response = await safeConnectorFetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    const body = await response.json().catch(() => []);
    const connections = Array.isArray(body) ? body : [];
    if (!response.ok || connections.length !== 1)
      throw new BadRequestException(
        "Xero authorization must grant exactly one organisation",
      );
    const connection =
      connections[0] &&
      typeof connections[0] === "object" &&
      !Array.isArray(connections[0])
        ? (connections[0] as Record<string, unknown>)
        : {};
    const connectionId = this.stringOrNull(connection.id);
    const tenantId = this.stringOrNull(connection.tenantId);
    const tenantType = this.stringOrNull(connection.tenantType);
    if (
      !connectionId ||
      !tenantId ||
      !this.isUuid(connectionId) ||
      !this.isUuid(tenantId) ||
      tenantType !== "ORGANISATION"
    )
      throw new BadRequestException(
        "Xero connection is not bound to one valid organisation",
      );
    return {
      xeroConnectionId: connectionId,
      xeroTenantId: tenantId,
      xeroTenantName: this.stringOrNull(connection.tenantName),
      xeroTenantType: tenantType,
      xeroAuthEventId: authEventId,
    };
  };

const oauthProviderProfileHandler060: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    providerSession,
    _tokenResponse,
  ) {
    const accountId = this.stringOrNull(providerSession?.stripeAccountId);
    const livemode = providerSession?.stripeLivemode;
    if (!accountId || !/^acct_[A-Za-z0-9]{1,125}$/.test(accountId)) {
      throw new BadRequestException("Stripe account binding is invalid");
    }
    if (typeof livemode !== "boolean") {
      throw new BadRequestException("Stripe account mode binding is invalid");
    }
    const response = await safeConnectorFetch("https://api.stripe.com/v1/balance", {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        "Stripe-Version": "2026-06-24.dahlia",
      },
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    const body = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    if (!response.ok || body.livemode !== livemode) {
      throw new BadRequestException(
        "Stripe token validation did not match the authorized account and mode",
      );
    }
    return {
      stripeAccountId: accountId,
      stripeLivemode: livemode,
      displayName: `${accountId} (${livemode ? "live" : "test"})`,
    };
  };

const oauthProviderProfileHandler061: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    providerSession,
    _tokenResponse,
  ) {
    const shopDomain = this.normalizeShopifyDomain(
      this.stringOrNull(providerSession?.shopDomain) ?? "",
    );
    const response = await safeConnectorFetch(
      `https://${shopDomain}/admin/api/2026-07/graphql.json`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": accessToken,
        },
        body: JSON.stringify({
          query:
            "query RelayShopBinding { shop { id name myshopifyDomain primaryDomain { host url } currencyCode } }",
        }),
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      },
    );
    const body = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const data =
      body.data && typeof body.data === "object" && !Array.isArray(body.data)
        ? (body.data as Record<string, unknown>)
        : {};
    const shop =
      data.shop && typeof data.shop === "object" && !Array.isArray(data.shop)
        ? (data.shop as Record<string, unknown>)
        : {};
    const returnedDomain = this.stringOrNull(shop.myshopifyDomain);
    const shopId = this.stringOrNull(shop.id);
    if (
      !response.ok ||
      (Array.isArray(body.errors) && body.errors.length > 0) ||
      !shopId ||
      returnedDomain !== shopDomain
    ) {
      throw new BadRequestException(
        "Shopify token validation did not match the authorized shop",
      );
    }
    return {
      shopifyShopId: shopId,
      shopDomain,
      shopifyShopName: this.stringOrNull(shop.name),
      shopifyCurrencyCode: this.stringOrNull(shop.currencyCode),
      shopifyPrimaryDomain: shop.primaryDomain,
    };
  };

const oauthProviderProfileHandler062: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    for (const origin of [
      "https://api.contentful.com",
      "https://api.eu.contentful.com",
    ]) {
      const response = await safeConnectorFetch(`${origin}/users/me`, {
        method: "GET",
        headers: {
          Accept: "application/vnd.contentful.management.v1+json",
          Authorization: `Bearer ${accessToken}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
      const body = (await response.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      const sys =
        body.sys && typeof body.sys === "object" && !Array.isArray(body.sys)
          ? (body.sys as Record<string, unknown>)
          : {};
      const userId =
        this.stringOrNull(sys.id) ??
        this.stringOrNull(body.id) ??
        this.stringOrNull(body.email);
      if (response.ok && userId) {
        return {
          ...body,
          contentfulUserId: userId,
          contentfulCmaOrigin: origin,
        };
      }
      if (![401, 403, 404].includes(response.status)) break;
    }
    throw new BadRequestException(
      "Contentful connected-user validation failed",
    );
  };

const oauthProviderProfileHandler063: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    const clientId = this.configService
      .get<string>("WORDPRESS_COM_CLIENT_ID")
      ?.trim();
    if (!clientId) {
      throw new BadRequestException(
        "WordPress.com client configuration is incomplete",
      );
    }
    const tokenInfoUrl = new URL(
      "https://public-api.wordpress.com/oauth2/token-info",
    );
    tokenInfoUrl.searchParams.set("client_id", clientId);
    tokenInfoUrl.searchParams.set("token", accessToken);
    const tokenInfoResponse = await safeConnectorFetch(tokenInfoUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    const tokenInfo = (await tokenInfoResponse
      .json()
      .catch(() => ({}))) as Record<string, unknown>;
    const blogId =
      typeof tokenInfo.blog_id === "number"
        ? String(tokenInfo.blog_id)
        : this.stringOrNull(tokenInfo.blog_id);
    const userId =
      typeof tokenInfo.user_id === "number"
        ? String(tokenInfo.user_id)
        : this.stringOrNull(tokenInfo.user_id);
    const tokenClientId =
      typeof tokenInfo.client_id === "number"
        ? String(tokenInfo.client_id)
        : this.stringOrNull(tokenInfo.client_id);
    const scopes = (this.stringOrNull(tokenInfo.scope) ?? "")
      .split(/[ ,]+/)
      .map((scope) => scope.trim())
      .filter(Boolean);
    if (
      !tokenInfoResponse.ok ||
      !blogId ||
      !userId ||
      tokenClientId !== clientId ||
      !["sites", "posts"].every((scope) => scopes.includes(scope))
    ) {
      throw new BadRequestException(
        "WordPress.com specific-blog authorization validation failed",
      );
    }
    const siteResponse = await safeConnectorFetch(
      `https://public-api.wordpress.com/rest/v1.1/sites/${encodeURIComponent(blogId)}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      },
    );
    const site = (await siteResponse.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const returnedSiteId =
      typeof site.ID === "number"
        ? String(site.ID)
        : this.stringOrNull(site.ID);
    if (!siteResponse.ok || returnedSiteId !== blogId) {
      throw new BadRequestException(
        "WordPress.com authorized-site validation failed",
      );
    }
    return {
      wordpressComBlogId: blogId,
      wordpressComUserId: userId,
      wordpressComScopes: scopes,
      wordpressComSiteName: this.stringOrNull(site.name),
      wordpressComSiteUrl: this.stringOrNull(site.URL),
      wordpressComIsJetpack: site.jetpack === true,
      wordpressComIsPrivate: site.is_private === true,
    };
  };

const oauthProviderProfileHandler064: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    const response = await safeConnectorFetch(
      "https://api.webflow.com/v2/token/introspect",
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      },
    );
    const body = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const authorization =
      body.authorization &&
      typeof body.authorization === "object" &&
      !Array.isArray(body.authorization)
        ? (body.authorization as Record<string, unknown>)
        : {};
    const authorizedTo =
      authorization.authorizedTo &&
      typeof authorization.authorizedTo === "object" &&
      !Array.isArray(authorization.authorizedTo)
        ? (authorization.authorizedTo as Record<string, unknown>)
        : {};
    const application =
      body.application &&
      typeof body.application === "object" &&
      !Array.isArray(body.application)
        ? (body.application as Record<string, unknown>)
        : {};
    const webflowAuthorizationId = this.stringOrNull(authorization.id);
    const webflowSiteIds = this.stringArray(authorizedTo.siteIds).slice(0, 100);
    const webflowWorkspaceIds = this.stringArray(
      authorizedTo.workspaceIds,
    ).slice(0, 100);
    const webflowUserIds = this.stringArray(authorizedTo.userIds).slice(0, 20);
    const webflowScopes = (this.stringOrNull(authorization.scope) ?? "")
      .split(/[ ,]+/)
      .map((scope) => scope.trim())
      .filter(Boolean);
    if (
      !response.ok ||
      !webflowAuthorizationId ||
      (!webflowSiteIds.length && !webflowWorkspaceIds.length)
    ) {
      throw new BadRequestException(
        "Webflow App authorization validation failed",
      );
    }
    return {
      webflowAuthorizationId,
      webflowSiteIds,
      webflowWorkspaceIds,
      webflowUserIds,
      webflowScopes,
      webflowApplicationId: this.stringOrNull(application.id),
      webflowApplicationName: this.stringOrNull(application.displayName),
    };
  };

const oauthProviderProfileHandler065: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    const response = await safeConnectorFetch("https://api.canva.com/rest/v1/users/me", {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    const body = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const teamUser =
      body.team_user &&
      typeof body.team_user === "object" &&
      !Array.isArray(body.team_user)
        ? (body.team_user as Record<string, unknown>)
        : {};
    const canvaUserId = this.stringOrNull(teamUser.user_id);
    const canvaTeamId = this.stringOrNull(teamUser.team_id);
    if (!response.ok || !canvaUserId || !canvaTeamId) {
      throw new BadRequestException(
        "Canva connected-user and team validation failed",
      );
    }
    return { canvaUserId, canvaTeamId };
  };

const oauthProviderProfileHandler066: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    providerSession,
    _tokenResponse,
  ) {
    const companyGuid = this.stringOrNull(
      providerSession?.sevenShiftsCompanyGuid,
    );
    const companyId = this.stringOrNull(providerSession?.sevenShiftsCompanyId);
    if (!companyGuid || !companyId) {
      throw new BadRequestException("7shifts company binding is missing");
    }
    const response = await safeConnectorFetch("https://api.7shifts.com/v2/whoami", {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        "x-api-version": "2026-06-01",
        "x-company-guid": companyGuid,
      },
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    const body = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    if (!response.ok) {
      throw new BadRequestException(
        "7shifts company authorization validation failed",
      );
    }
    return {
      ...body,
      sevenShiftsCompanyGuid: companyGuid,
      sevenShiftsCompanyId: companyId,
    };
  };

const oauthProviderProfileHandler067: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    providerSession,
    _tokenResponse,
  ) {
    const clinicOrigin = this.normalizeJaneClinicOrigin(
      this.stringOrNull(providerSession?.janeClinicOrigin) ?? "",
    );
    const response = await safeConnectorFetch(`${clinicOrigin}/api/2026-01-01/company`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    const body = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    if (!response.ok) {
      throw new BadRequestException(
        "Jane App practitioner and clinic authorization validation failed",
      );
    }
    return { ...body, janeClinicOrigin: clinicOrigin };
  };

const oauthProviderProfileHandler068: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    providerSession,
    _tokenResponse,
  ) {
    const authority = this.pCloudAuthority(
      this.stringOrNull(providerSession?.pCloudApiOrigin) ?? "",
    );
    const response = await safeConnectorFetch(`${authority.apiOrigin}/userinfo`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    const body = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const userId =
      this.stringOrNull(providerSession?.pCloudUserId) ??
      (body.userid === undefined ? null : String(body.userid)) ??
      (body.uid === undefined ? null : String(body.uid)) ??
      this.stringOrNull(body.email);
    if (!response.ok || Number(body.result ?? 0) !== 0 || !userId) {
      throw new BadRequestException("pCloud connected-user validation failed");
    }
    return {
      ...body,
      pCloudUserId: userId,
      pCloudApiOrigin: authority.apiOrigin,
      pCloudLocationId: providerSession?.pCloudLocationId,
    };
  };

const oauthProviderProfileHandler069: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    providerSession,
    _tokenResponse,
  ) {
    const authority = this.shareFileAuthority(
      this.stringOrNull(providerSession?.shareFileApiOrigin) ?? "",
    );
    const response = await safeConnectorFetch(`${authority.apiOrigin}/sf/v3/Users`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    const body = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const userId =
      this.stringOrNull(body.Id) ??
      this.stringOrNull(body.id) ??
      this.stringOrNull(body.Email) ??
      this.stringOrNull(body.email);
    if (!response.ok || !userId) {
      throw new BadRequestException(
        "ShareFile connected-user validation failed",
      );
    }
    return {
      ...body,
      shareFileUserId: userId,
      shareFileApiOrigin: authority.apiOrigin,
    };
  };

const oauthProviderProfileHandler070: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    providerSession,
    _tokenResponse,
  ) {
    const authority = this.deputyAuthority(
      this.stringOrNull(providerSession?.deputyApiOrigin) ?? "",
    );
    const response = await safeConnectorFetch(`${authority.apiOrigin}/api/v1/me`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    const body = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const userId =
      this.stringOrNull(body.Id) ??
      this.stringOrNull(body.id) ??
      this.stringOrNull(body.UserId) ??
      this.stringOrNull(body.Email) ??
      this.stringOrNull(body.email);
    if (!response.ok || !userId) {
      throw new BadRequestException(
        "Deputy connected-user and install validation failed",
      );
    }
    return {
      ...body,
      deputyUserId: userId,
      deputyApiOrigin: authority.apiOrigin,
    };
  };

const oauthProviderProfileHandler071: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    providerSession,
    _tokenResponse,
  ) {
    const nationSlug = this.normalizeNationBuilderNationSlug(
      this.stringOrNull(providerSession?.nationBuilderNationSlug) ?? "",
    );
    const response = await safeConnectorFetch(
      `https://${nationSlug}.nationbuilder.com/api/v2/signups/me`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      },
    );
    const body = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const data =
      body.data && typeof body.data === "object" && !Array.isArray(body.data)
        ? (body.data as Record<string, unknown>)
        : {};
    const userId = this.stringOrNull(data.id);
    if (!response.ok || !userId) {
      throw new BadRequestException(
        "NationBuilder connected-admin and nation validation failed",
      );
    }
    return {
      ...body,
      nationBuilderUserId: userId,
      nationBuilderNationSlug: nationSlug,
    };
  };

const oauthProviderProfileHandler072: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    providerSession,
    _tokenResponse,
  ) {
    const domain = this.normalizeEgnyteDomain(
      this.stringOrNull(providerSession?.egnyteDomain) ?? "",
    );
    const response = await safeConnectorFetch(
      `https://${domain}.egnyte.com/pubapi/v1/userinfo`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      },
    );
    const body = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const userId =
      this.stringOrNull(body.user_id) ??
      this.stringOrNull(body.username) ??
      this.stringOrNull(body.email);
    if (!response.ok || !userId) {
      throw new BadRequestException("Egnyte connected-user validation failed");
    }
    return { ...body, egnyteUserId: userId, egnyteDomain: domain };
  };

const oauthProviderProfileHandler073: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    providerSession,
    _tokenResponse,
  ) {
    const portalOrigin = this.normalizeBynderPortal(
      this.stringOrNull(providerSession?.bynderPortalOrigin) ?? "",
    );
    const response = await safeConnectorFetch(`${portalOrigin}/api/v4/currentuser/`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    const body = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const userId =
      this.stringOrNull(body.id) ??
      this.stringOrNull(body.userId) ??
      this.stringOrNull(body.username) ??
      this.stringOrNull(body.email);
    if (!response.ok || !userId) {
      throw new BadRequestException("Bynder connected-user validation failed");
    }
    return {
      ...body,
      bynderUserId: userId,
      bynderPortalOrigin: portalOrigin,
    };
  };

const oauthProviderProfileHandler074: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    providerSession,
    _tokenResponse,
  ) {
    const accountOrigin = this.normalizeCantoAccount(
      this.stringOrNull(providerSession?.cantoAccountOrigin) ?? "",
    );
    const response = await safeConnectorFetch(`${accountOrigin}/api/v1/user`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    const body = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const userId =
      this.stringOrNull(body.id) ??
      this.stringOrNull(body.userId) ??
      this.stringOrNull(body.username) ??
      this.stringOrNull(body.email);
    if (!response.ok || !userId)
      throw new BadRequestException("Canto connected-user validation failed");
    return {
      ...body,
      cantoUserId: userId,
      cantoAccountOrigin: accountOrigin,
    };
  };

const oauthProviderProfileHandler075: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    providerSession,
    _tokenResponse,
  ) {
    const environmentOrigin = this.normalizeMsProjectEnvironment(
      this.stringOrNull(providerSession?.msProjectEnvironmentOrigin) ?? "",
    );
    const response = await safeConnectorFetch(`${environmentOrigin}/api/data/v9.2/WhoAmI`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        "OData-MaxVersion": "4.0",
        "OData-Version": "4.0",
      },
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    const body = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const userId = this.stringOrNull(body.UserId);
    if (!response.ok || !userId)
      throw new BadRequestException(
        "Microsoft Project environment and signed-in user validation failed",
      );
    return {
      ...body,
      msProjectUserId: userId,
      msProjectEnvironmentOrigin: environmentOrigin,
    };
  };

export const OAuthProviderProfileHandlers03: OAuthProviderProfileHandlerMap =
  Object.freeze({
    close: oauthProviderProfileHandler049,
    copper: oauthProviderProfileHandler050,
    pipedrive: oauthProviderProfileHandler051,
    hubspot: oauthProviderProfileHandler052,
    salesforce: oauthProviderProfileHandler053,
    "sage-accounting": oauthProviderProfileHandler054,
    freeagent: oauthProviderProfileHandler055,
    wave: oauthProviderProfileHandler056,
    freshbooks: oauthProviderProfileHandler057,
    quickbooks: oauthProviderProfileHandler058,
    xero: oauthProviderProfileHandler059,
    stripe: oauthProviderProfileHandler060,
    shopify: oauthProviderProfileHandler061,
    contentful: oauthProviderProfileHandler062,
    "wordpress-com": oauthProviderProfileHandler063,
    webflow: oauthProviderProfileHandler064,
    canva: oauthProviderProfileHandler065,
    "7shifts": oauthProviderProfileHandler066,
    "jane-app": oauthProviderProfileHandler067,
    pcloud: oauthProviderProfileHandler068,
    sharefile: oauthProviderProfileHandler069,
    deputy: oauthProviderProfileHandler070,
    nationbuilder: oauthProviderProfileHandler071,
    egnyte: oauthProviderProfileHandler072,
    bynder: oauthProviderProfileHandler073,
    canto: oauthProviderProfileHandler074,
    "ms-project": oauthProviderProfileHandler075,
  });
