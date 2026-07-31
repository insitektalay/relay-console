import { safeConnectorFetch } from "../../safe-connector-fetch";
import type {
  OAuthProviderProfileHandler,
  OAuthProviderProfileHandlerMap,
} from "./oauth-provider-profile-handler";
import type { MarketplaceConnectorOAuthService } from "../../connector-oauth.service";
import { BadRequestException } from "@nestjs/common";

const oauthProviderProfileHandler076: OAuthProviderProfileHandler =
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
    const [profileResponse, driveResponse] = await Promise.all([
      safeConnectorFetch(
        "https://graph.microsoft.com/v1.0/me?$select=id,displayName,mail,userPrincipalName",
        {
          method: "GET",
          headers,
          redirect: "error",
          signal: AbortSignal.timeout(20_000),
          cache: "no-store",
        },
      ),
      safeConnectorFetch(
        "https://graph.microsoft.com/v1.0/me/drive?$select=id,driveType,name",
        {
          method: "GET",
          headers,
          redirect: "error",
          signal: AbortSignal.timeout(20_000),
          cache: "no-store",
        },
      ),
    ]);
    const profile = (await profileResponse.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const drive = (await driveResponse.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const userId = this.stringOrNull(profile.id);
    const driveId = this.stringOrNull(drive.id);
    if (!profileResponse.ok || !driveResponse.ok || !userId || !driveId)
      throw new BadRequestException(
        "OneDrive signed-in user and own-drive validation failed",
      );
    return {
      ...profile,
      onedriveUserId: userId,
      onedriveDriveId: driveId,
      onedriveDriveName: this.stringOrNull(drive.name),
      onedriveDriveType: this.stringOrNull(drive.driveType),
    };
  };

const oauthProviderProfileHandler077: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    providerSession,
    _tokenResponse,
  ) {
    const environmentOrigin =
      this.microsoftDynamics365SalesApi.normalizeEnvironment(
        this.stringOrNull(providerSession?.dynamics365SalesEnvironmentOrigin) ??
          "",
      );
    const identity = await this.microsoftDynamics365SalesApi.read(
      accessToken,
      environmentOrigin,
      "identity.get",
    );
    if (!identity.userId)
      throw new BadRequestException(
        "Microsoft Dynamics 365 Sales environment and signed-in user validation failed",
      );
    return {
      dynamics365SalesUserId: identity.userId,
      dynamics365SalesOrganizationId: identity.organizationId,
      dynamics365SalesBusinessUnitId: identity.businessUnitId,
      dynamics365SalesEnvironmentOrigin: identity.environmentOrigin,
    };
  };

const oauthProviderProfileHandler078: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    providerSession,
    _tokenResponse,
  ) {
    const environmentOrigin =
      this.microsoftDynamics365CustomerServiceApi.normalizeEnvironment(
        this.stringOrNull(
          providerSession?.dynamics365CustomerServiceEnvironmentOrigin,
        ) ?? "",
      );
    const identity = await this.microsoftDynamics365CustomerServiceApi.read(
      accessToken,
      environmentOrigin,
      "identity.get",
    );
    if (!identity.userId)
      throw new BadRequestException(
        "Microsoft Dynamics 365 Customer Service environment and signed-in user validation failed",
      );
    return {
      dynamics365CustomerServiceUserId: identity.userId,
      dynamics365CustomerServiceOrganizationId: identity.organizationId,
      dynamics365CustomerServiceBusinessUnitId: identity.businessUnitId,
      dynamics365CustomerServiceEnvironmentOrigin: identity.environmentOrigin,
    };
  };

const oauthProviderProfileHandler079: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    providerSession,
    _tokenResponse,
  ) {
    const environmentName =
      this.microsoftDynamics365BusinessCentralApi.normalizeEnvironmentName(
        this.stringOrNull(providerSession?.businessCentralEnvironmentName) ??
          "",
      );
    const directory = await this.microsoftDynamics365BusinessCentralApi.read(
      accessToken,
      environmentName,
      "companies.list",
    );
    return {
      businessCentralEnvironmentName: directory.environmentName,
      businessCentralCompanyCount: directory.companies.length,
    };
  };

const oauthProviderProfileHandler080: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    const identity = await this.microsoftEntraIdGraph.read(
      accessToken,
      "identity.get",
    );
    return {
      microsoftEntraIdUserId: identity.id,
      microsoftEntraIdDisplayName: identity.displayName,
      microsoftEntraIdUserPrincipalName: identity.userPrincipalName,
      microsoftEntraIdUserType: identity.userType,
    };
  };

const oauthProviderProfileHandler081: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    const identity = await this.yammerApi.read(accessToken, "identity.get");
    return {
      yammerUserId: identity.id,
      yammerFullName: identity.fullName,
      yammerEmail: identity.email,
      yammerNetworkId: identity.networkId,
    };
  };

const oauthProviderProfileHandler082: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    const directory = await this.vivaLearningGraph.read(
      accessToken,
      "providers.list",
    );
    return {
      vivaLearningProviderCount: directory.providers.length,
      vivaLearningProviderDirectoryTruncated: directory.truncated,
    };
  };

const oauthProviderProfileHandler083: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    providerSession,
    _tokenResponse,
  ) {
    const accountOrigin = this.normalizeFrontifyAccount(
      this.stringOrNull(providerSession?.frontifyAccountOrigin) ?? "",
    );
    const response = await safeConnectorFetch(`${accountOrigin}/graphql`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Frontify-Beta": "enabled",
      },
      body: JSON.stringify({
        query: "query RelayFrontifyIdentity { currentUser { id name email } }",
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
    const user =
      data.currentUser &&
      typeof data.currentUser === "object" &&
      !Array.isArray(data.currentUser)
        ? (data.currentUser as Record<string, unknown>)
        : {};
    const userId = this.stringOrNull(user.id);
    if (!response.ok || !userId)
      throw new BadRequestException(
        "Frontify connected-user validation failed",
      );
    return {
      ...user,
      frontifyUserId: userId,
      frontifyAccountOrigin: accountOrigin,
    };
  };

const oauthProviderProfileHandler084: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    providerSession,
    _tokenResponse,
  ) {
    const baseUrl = this.normalizeAssetBankSite(
      this.stringOrNull(providerSession?.assetBankBaseUrl) ?? "",
    );
    const response = await safeConnectorFetch(`${baseUrl}/rest/authenticated-user`, {
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
      throw new BadRequestException(
        "Asset Bank connected-user validation failed",
      );
    return {
      ...body,
      assetBankUserId: userId,
      assetBankBaseUrl: baseUrl,
    };
  };

const oauthProviderProfileHandler085: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    providerSession,
    _tokenResponse,
  ) {
    const organizationId = this.stringOrNull(
      providerSession?.zohoExpenseOrganizationId,
    );
    const authority = this.zohoCrmAuthority(
      this.stringOrNull(providerSession?.zohoAccountsOrigin) ?? "",
    );
    if (
      !organizationId ||
      !/^[1-9][0-9]{0,19}$/.test(organizationId) ||
      authority.apiOrigin !==
        this.stringOrNull(providerSession?.zohoExpenseApiOrigin)
    )
      throw new BadRequestException(
        "Zoho Expense regional organization binding is invalid",
      );
    const response = await safeConnectorFetch(
      `${authority.apiOrigin}/expense/v1/organizations`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Zoho-oauthtoken ${accessToken}`,
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
    const organizations = Array.isArray(body.organizations)
      ? body.organizations.filter(
          (value): value is Record<string, unknown> =>
            Boolean(value) &&
            typeof value === "object" &&
            !Array.isArray(value),
        )
      : [];
    const exact = organizations.find(
      (organization) =>
        this.stringOrNull(organization.organization_id) === organizationId,
    );
    if (!response.ok || !exact)
      throw new BadRequestException(
        "Zoho Expense exact organization validation failed",
      );
    return {
      zohoExpenseOrganizationId: organizationId,
      zohoExpenseOrganizationName: this.stringOrNull(exact.name),
      zohoExpenseCurrencyCode: this.stringOrNull(exact.currency_code),
      zohoExpenseTimeZone: this.stringOrNull(exact.time_zone),
      zohoAccountsOrigin: authority.accountsOrigin,
      zohoExpenseApiOrigin: authority.apiOrigin,
      zohoRegion: authority.region,
    };
  };

const oauthProviderProfileHandler086: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    providerSession,
    _tokenResponse,
  ) {
    const organizationId = this.stringOrNull(
      providerSession?.zohoInvoiceOrganizationId,
    );
    const authority = this.zohoCrmAuthority(
      this.stringOrNull(providerSession?.zohoAccountsOrigin) ?? "",
    );
    if (
      !organizationId ||
      !/^[1-9][0-9]{0,19}$/.test(organizationId) ||
      authority.apiOrigin !==
        this.stringOrNull(providerSession?.zohoInvoiceApiOrigin)
    )
      throw new BadRequestException(
        "Zoho Invoice regional organization binding is invalid",
      );
    const response = await safeConnectorFetch(
      `${authority.apiOrigin}/invoice/v3/organizations`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Zoho-oauthtoken ${accessToken}`,
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
    const organizations = Array.isArray(body.organizations)
      ? body.organizations.filter(
          (value): value is Record<string, unknown> =>
            Boolean(value) &&
            typeof value === "object" &&
            !Array.isArray(value),
        )
      : [];
    const exact = organizations.find(
      (organization) =>
        this.stringOrNull(organization.organization_id) === organizationId,
    );
    if (!response.ok || !exact)
      throw new BadRequestException(
        "Zoho Invoice exact organization validation failed",
      );
    return {
      zohoInvoiceOrganizationId: organizationId,
      zohoInvoiceOrganizationName: this.stringOrNull(exact.name),
      zohoInvoiceCurrencyCode: this.stringOrNull(exact.currency_code),
      zohoInvoiceTimeZone: this.stringOrNull(exact.time_zone),
      zohoAccountsOrigin: authority.accountsOrigin,
      zohoInvoiceApiOrigin: authority.apiOrigin,
      zohoRegion: authority.region,
    };
  };

const oauthProviderProfileHandler087: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    providerSession,
    _tokenResponse,
  ) {
    const organizationId = this.stringOrNull(
      providerSession?.zohoBooksOrganizationId,
    );
    const authority = this.zohoCrmAuthority(
      this.stringOrNull(providerSession?.zohoAccountsOrigin) ?? "",
    );
    if (
      !organizationId ||
      !/^[1-9][0-9]{0,19}$/.test(organizationId) ||
      authority.apiOrigin !==
        this.stringOrNull(providerSession?.zohoBooksApiOrigin)
    )
      throw new BadRequestException(
        "Zoho Books regional organization binding is invalid",
      );
    const response = await safeConnectorFetch(
      `${authority.apiOrigin}/books/v3/organizations`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Zoho-oauthtoken ${accessToken}`,
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
    const organizations = Array.isArray(body.organizations)
      ? body.organizations.filter(
          (value): value is Record<string, unknown> =>
            Boolean(value) &&
            typeof value === "object" &&
            !Array.isArray(value),
        )
      : [];
    const exact = organizations.find(
      (organization) =>
        this.stringOrNull(organization.organization_id) === organizationId,
    );
    if (!response.ok || !exact)
      throw new BadRequestException(
        "Zoho Books exact organization validation failed",
      );
    return {
      zohoBooksOrganizationId: organizationId,
      zohoBooksOrganizationName: this.stringOrNull(exact.name),
      zohoBooksCurrencyCode: this.stringOrNull(exact.currency_code),
      zohoBooksTimeZone: this.stringOrNull(exact.time_zone),
      zohoAccountsOrigin: authority.accountsOrigin,
      zohoBooksApiOrigin: authority.apiOrigin,
      zohoRegion: authority.region,
    };
  };

const oauthProviderProfileHandler088: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    providerSession,
    _tokenResponse,
  ) {
    const authority = this.zohoDeskAuthority(
      this.stringOrNull(providerSession?.zohoAccountsOrigin) ?? "",
    );
    if (
      authority.apiOrigin !==
      this.stringOrNull(providerSession?.zohoDeskApiOrigin)
    )
      throw new BadRequestException(
        "Zoho Desk regional API binding is invalid",
      );
    const response = await safeConnectorFetch(
      `${authority.apiOrigin}/api/v1/accessibleOrganizations`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Zoho-oauthtoken ${accessToken}`,
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
    const rows = Array.isArray(body.data)
      ? body.data.filter(
          (value): value is Record<string, unknown> =>
            Boolean(value) &&
            typeof value === "object" &&
            !Array.isArray(value),
        )
      : [];
    const organizations = rows
      .map((row) => ({ row, id: this.positiveNumericId(row.id) }))
      .filter((entry) => Boolean(entry.id));
    if (!response.ok || organizations.length !== 1)
      throw new BadRequestException(
        "Zoho Desk consent-bound organization validation failed",
      );
    const exact = organizations[0];
    return {
      zohoDeskOrganizationId: exact.id,
      zohoDeskOrganizationName: this.stringOrNull(exact.row.companyName),
      zohoDeskPortalName: this.stringOrNull(exact.row.portalName),
      zohoDeskEdition: this.stringOrNull(exact.row.edition),
      zohoDeskSandbox: exact.row.isSandboxPortal === true,
      zohoAccountsOrigin: authority.accountsOrigin,
      zohoDeskApiOrigin: authority.apiOrigin,
      zohoRegion: authority.region,
    };
  };

const oauthProviderProfileHandler089: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    providerSession,
    _tokenResponse,
  ) {
    const authority = this.zohoCrmAuthority(
      this.stringOrNull(providerSession?.zohoAccountsOrigin) ?? "",
    );
    if (
      authority.apiOrigin !==
      this.stringOrNull(providerSession?.zohoProjectsApiOrigin)
    )
      throw new BadRequestException(
        "Zoho Projects regional API binding is invalid",
      );
    const portalId = this.positiveNumericId(
      providerSession?.zohoProjectsPortalId,
    );
    if (!portalId)
      throw new BadRequestException("Zoho Projects portal binding is invalid");
    const response = await safeConnectorFetch(`${authority.apiOrigin}/projects/v3/portals`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Zoho-oauthtoken ${accessToken}`,
      },
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    const body = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const values = Array.isArray(body.portals)
      ? body.portals
      : Array.isArray(body.data)
        ? body.data
        : [];
    const exact = values
      .filter(
        (value): value is Record<string, unknown> =>
          Boolean(value) && typeof value === "object" && !Array.isArray(value),
      )
      .find((value) => this.positiveNumericId(value.id) === portalId);
    if (!response.ok || !exact)
      throw new BadRequestException(
        "Zoho Projects exact portal validation failed",
      );
    return {
      zohoProjectsPortalId: portalId,
      zohoProjectsPortalName: this.stringOrNull(exact.name),
      zohoProjectsTimeZone: this.stringOrNull(
        exact.time_zone ?? exact.timezone,
      ),
      zohoAccountsOrigin: authority.accountsOrigin,
      zohoProjectsApiOrigin: authority.apiOrigin,
      zohoRegion: authority.region,
    };
  };

const oauthProviderProfileHandler090: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    providerSession,
    _tokenResponse,
  ) {
    const authority = this.zohoPeopleAuthority(
      this.stringOrNull(providerSession?.zohoAccountsOrigin) ?? "",
    );
    if (
      authority.apiOrigin !==
      this.stringOrNull(providerSession?.zohoPeopleApiOrigin)
    ) {
      throw new BadRequestException(
        "Zoho People regional API binding is invalid",
      );
    }
    const headers = {
      Accept: "application/json",
      Authorization: `Zoho-oauthtoken ${accessToken}`,
    };
    const [profileResponse, structureResponse] = await Promise.all([
      safeConnectorFetch(`${authority.accountsOrigin}/oauth/user/info`, {
        method: "GET",
        headers,
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      }),
      safeConnectorFetch(
        `${authority.apiOrigin}/people/api/v3/orgstructure/entities?offset=1&limit=1`,
        {
          method: "GET",
          headers,
          redirect: "error",
          signal: AbortSignal.timeout(20_000),
          cache: "no-store",
        },
      ),
    ]);
    const profile = (await profileResponse.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    await structureResponse.json().catch(() => ({}));
    const userId = this.positiveNumericId(
      profile.ZUID ??
        profile.zuid ??
        profile.User_Id ??
        profile.user_id ??
        profile.id,
    );
    if (!profileResponse.ok || !structureResponse.ok || !userId) {
      throw new BadRequestException(
        "Zoho People authorization could not verify the current user and organization-structure scope",
      );
    }
    return {
      zohoPeopleUserId: userId,
      zohoPeopleDisplayName:
        this.stringOrNull(
          profile.Display_Name ?? profile.display_name ?? profile.name,
        )?.slice(0, 200) ?? null,
      zohoPeopleEmail: this.normalizeEmail(
        profile.Email ?? profile.email ?? profile.Email_Id,
      ),
      zohoAccountsOrigin: authority.accountsOrigin,
      zohoPeopleApiOrigin: authority.apiOrigin,
      zohoRegion: authority.region,
    };
  };

const oauthProviderProfileHandler091: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    providerSession,
    _tokenResponse,
  ) {
    const authority = this.zohoCampaignsAuthority(
      this.stringOrNull(providerSession?.zohoAccountsOrigin) ?? "",
    );
    if (
      authority.apiOrigin !==
      this.stringOrNull(providerSession?.zohoCampaignsApiOrigin)
    ) {
      throw new BadRequestException(
        "Zoho Campaigns regional API binding is invalid",
      );
    }
    const headers = {
      Accept: "application/json",
      Authorization: `Zoho-oauthtoken ${accessToken}`,
    };
    const [profileResponse, campaignsResponse] = await Promise.all([
      safeConnectorFetch(`${authority.accountsOrigin}/oauth/user/info`, {
        method: "GET",
        headers,
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      }),
      safeConnectorFetch(
        `${authority.apiOrigin}/api/v1.1/recentcampaigns?resfmt=JSON&sort=desc&fromindex=1&range=1&status=all`,
        {
          method: "GET",
          headers,
          redirect: "error",
          signal: AbortSignal.timeout(20_000),
          cache: "no-store",
        },
      ),
    ]);
    const profile = (await profileResponse.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const campaigns = (await campaignsResponse
      .json()
      .catch(() => ({}))) as Record<string, unknown>;
    const userId = this.positiveNumericId(
      profile.ZUID ??
        profile.zuid ??
        profile.User_Id ??
        profile.user_id ??
        profile.id,
    );
    const campaignsCode = this.stringOrNull(campaigns.code) ?? "0";
    if (
      !profileResponse.ok ||
      !campaignsResponse.ok ||
      !userId ||
      !["0", "6101"].includes(campaignsCode)
    ) {
      throw new BadRequestException(
        "Zoho Campaigns authorization could not verify the current user and campaign-read scope",
      );
    }
    return {
      zohoCampaignsUserId: userId,
      zohoCampaignsDisplayName:
        this.stringOrNull(
          profile.Display_Name ?? profile.display_name ?? profile.name,
        )?.slice(0, 200) ?? null,
      zohoCampaignsEmail: this.normalizeEmail(
        profile.Email ?? profile.email ?? profile.Email_Id,
      ),
      zohoAccountsOrigin: authority.accountsOrigin,
      zohoCampaignsApiOrigin: authority.apiOrigin,
      zohoRegion: authority.region,
    };
  };

const oauthProviderProfileHandler092: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    providerSession,
    _tokenResponse,
  ) {
    const authority = this.zohoAnalyticsAuthority(
      this.stringOrNull(providerSession?.zohoAccountsOrigin) ?? "",
    );
    if (
      authority.apiOrigin !==
      this.stringOrNull(providerSession?.zohoAnalyticsApiOrigin)
    ) {
      throw new BadRequestException(
        "Zoho Analytics regional API binding is invalid",
      );
    }
    const headers = {
      Accept: "application/json",
      Authorization: `Zoho-oauthtoken ${accessToken}`,
    };
    const [profileResponse, workspacesResponse] = await Promise.all([
      safeConnectorFetch(`${authority.accountsOrigin}/oauth/user/info`, {
        method: "GET",
        headers,
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      }),
      safeConnectorFetch(`${authority.apiOrigin}/restapi/v2/workspaces`, {
        method: "GET",
        headers,
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      }),
    ]);
    const profile = (await profileResponse.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const workspaces = (await workspacesResponse
      .json()
      .catch(() => ({}))) as Record<string, unknown>;
    const userId = this.positiveNumericId(
      profile.ZUID ??
        profile.zuid ??
        profile.User_Id ??
        profile.user_id ??
        profile.id,
    );
    if (
      !profileResponse.ok ||
      !workspacesResponse.ok ||
      !userId ||
      workspaces.status !== "success"
    ) {
      throw new BadRequestException(
        "Zoho Analytics authorization could not verify the current user and workspace-metadata scope",
      );
    }
    return {
      zohoAnalyticsUserId: userId,
      zohoAnalyticsDisplayName:
        this.stringOrNull(
          profile.Display_Name ?? profile.display_name ?? profile.name,
        )?.slice(0, 200) ?? null,
      zohoAnalyticsEmail: this.normalizeEmail(
        profile.Email ?? profile.email ?? profile.Email_Id,
      ),
      zohoAccountsOrigin: authority.accountsOrigin,
      zohoAnalyticsApiOrigin: authority.apiOrigin,
      zohoRegion: authority.region,
    };
  };

const oauthProviderProfileHandler093: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    providerSession,
    _tokenResponse,
  ) {
    const authority = this.zohoCrmAuthority(
      this.stringOrNull(providerSession?.zohoAccountsOrigin) ?? "",
    );
    if (
      authority.apiOrigin !==
      this.stringOrNull(providerSession?.zohoCrmApiOrigin)
    ) {
      throw new BadRequestException("Zoho CRM regional API binding is invalid");
    }
    const headers = {
      Accept: "application/json",
      Authorization: `Zoho-oauthtoken ${accessToken}`,
    };
    const [organizationResponse, currentUserResponse] = await Promise.all([
      safeConnectorFetch(`${authority.apiOrigin}/crm/v8/org`, {
        method: "GET",
        headers,
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      }),
      safeConnectorFetch(`${authority.apiOrigin}/crm/v8/users?type=CurrentUser`, {
        method: "GET",
        headers,
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      }),
    ]);
    const organizationBody = (await organizationResponse
      .json()
      .catch(() => ({}))) as Record<string, unknown>;
    const currentUserBody = (await currentUserResponse
      .json()
      .catch(() => ({}))) as Record<string, unknown>;
    const organizations = Array.isArray(organizationBody.org)
      ? organizationBody.org.filter(
          (value): value is Record<string, unknown> =>
            Boolean(value) &&
            typeof value === "object" &&
            !Array.isArray(value),
        )
      : [];
    const currentUsers = Array.isArray(currentUserBody.users)
      ? currentUserBody.users.filter(
          (value): value is Record<string, unknown> =>
            Boolean(value) &&
            typeof value === "object" &&
            !Array.isArray(value),
        )
      : [];
    const organization = organizations[0] ?? {};
    const organizationId = this.positiveNumericId(organization.id);
    const userId =
      currentUsers.length === 1
        ? this.positiveNumericId(currentUsers[0].id)
        : null;
    if (
      !organizationResponse.ok ||
      !currentUserResponse.ok ||
      organizations.length !== 1 ||
      !organizationId ||
      !userId
    ) {
      throw new BadRequestException(
        "Zoho CRM authorization is not bound to exactly one valid organization and current user",
      );
    }
    return {
      zohoCrmOrganizationId: organizationId,
      zohoCrmOrganizationName:
        this.stringOrNull(organization.company_name)?.slice(0, 200) ?? null,
      zohoCrmEnvironment:
        this.stringOrNull(organization.environment)?.slice(0, 50) ?? null,
      zohoCrmUserId: userId,
      zohoAccountsOrigin: authority.accountsOrigin,
      zohoCrmApiOrigin: authority.apiOrigin,
      zohoRegion: authority.region,
    };
  };

const oauthProviderProfileHandler094: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    providerSession,
    _tokenResponse,
  ) {
    const authority = this.zohoWorkDriveAuthority(
      this.stringOrNull(providerSession?.zohoAccountsOrigin) ?? "",
    );
    if (
      authority.apiOrigin !==
        this.stringOrNull(providerSession?.zohoWorkDriveApiOrigin) ||
      authority.downloadOrigin !==
        this.stringOrNull(providerSession?.zohoWorkDriveDownloadOrigin) ||
      authority.uploadOrigin !==
        this.stringOrNull(providerSession?.zohoWorkDriveUploadOrigin)
    ) {
      throw new BadRequestException(
        "Zoho WorkDrive regional API binding is invalid",
      );
    }
    const response = await safeConnectorFetch(
      `${authority.apiOrigin}/workdrive/api/v1/users/me`,
      {
        method: "GET",
        headers: {
          Accept: "application/vnd.api+json",
          Authorization: `Zoho-oauthtoken ${accessToken}`,
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
    if (!response.ok || !Array.isArray(body.value))
      throw new BadRequestException(
        "OneNote signed-in account validation failed",
      );
    return {
      oneNoteValidated: true,
      oneNoteNotebookSampleCount: body.value.slice(0, 25).length,
    };
  };

const oauthProviderProfileHandler095: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    providerSession,
    _tokenResponse,
  ) {
    const selected = this.normalizeMicrosoftBookingsBinding({
      businessId: providerSession?.businessId,
      displayName: providerSession?.displayName,
    });
    const response = await safeConnectorFetch(
      `https://graph.microsoft.com/v1.0/solutions/bookingBusinesses/${encodeURIComponent(selected.businessId)}`,
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
    const returnedId = this.stringOrNull(body.id);
    if (
      !response.ok ||
      !returnedId ||
      returnedId.toLowerCase() !== selected.businessId.toLowerCase()
    )
      throw new BadRequestException(
        "Microsoft Bookings selected-business validation failed",
      );
    return {
      microsoftBookingsValidated: true,
      microsoftBookingsSelectedBusinessId: selected.businessId,
      microsoftBookingsSelectedBusinessDisplayName:
        this.stringOrNull(body.displayName) ?? selected.displayName,
    };
  };

const oauthProviderProfileHandler096: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    providerSession,
    _tokenResponse,
  ) {
    const selected = this.normalizeMicrosoftPowerBIBinding({
      workspaceId: providerSession?.workspaceId,
      workspaceName: providerSession?.workspaceName,
    });
    const response = await safeConnectorFetch(
      `https://api.powerbi.com/v1.0/myorg/groups/${selected.workspaceId}`,
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
    const returnedId = this.stringOrNull(body.id);
    if (
      !response.ok ||
      !returnedId ||
      returnedId.toLowerCase() !== selected.workspaceId.toLowerCase()
    )
      throw new BadRequestException(
        "Microsoft Power BI selected-workspace validation failed",
      );
    return {
      microsoftPowerBIValidated: true,
      microsoftPowerBISelectedWorkspaceId: selected.workspaceId,
      microsoftPowerBISelectedWorkspaceName:
        this.stringOrNull(body.name) ?? selected.workspaceName,
    };
  };

const oauthProviderProfileHandler097: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    providerSession,
    _tokenResponse,
  ) {
    const selected = this.normalizeMicrosoftDynamics365Binding({
      environmentOrigin: providerSession?.environmentOrigin,
      environmentDisplayName: providerSession?.environmentDisplayName,
    });
    const apiRoot = `${selected.environmentOrigin}/api/data/v9.2`;
    const headers = {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      "OData-MaxVersion": "4.0",
      "OData-Version": "4.0",
    };
    const [organizationResponse, accountsResponse, opportunitiesResponse] =
      await Promise.all([
        safeConnectorFetch(
          `${apiRoot}/organizations?$select=organizationid,friendlyname,uniquename,version,languagecode&$top=1`,
          {
            method: "GET",
            headers,
            redirect: "error",
            signal: AbortSignal.timeout(20_000),
            cache: "no-store",
          },
        ),
        safeConnectorFetch(`${apiRoot}/accounts?$select=accountid&$top=1`, {
          method: "GET",
          headers,
          redirect: "error",
          signal: AbortSignal.timeout(20_000),
          cache: "no-store",
        }),
        safeConnectorFetch(`${apiRoot}/opportunities?$select=opportunityid&$top=1`, {
          method: "GET",
          headers,
          redirect: "error",
          signal: AbortSignal.timeout(20_000),
          cache: "no-store",
        }),
      ]);
    const body = (await organizationResponse
      .json()
      .catch(() => ({}))) as Record<string, unknown>;
    const organizations = Array.isArray(body.value) ? body.value : [];
    const organization =
      organizations[0] &&
      typeof organizations[0] === "object" &&
      !Array.isArray(organizations[0])
        ? (organizations[0] as Record<string, unknown>)
        : {};
    const organizationId = this.stringOrNull(organization.organizationid);
    if (
      !organizationResponse.ok ||
      !accountsResponse.ok ||
      !opportunitiesResponse.ok ||
      !organizationId
    )
      throw new BadRequestException(
        "Microsoft Dynamics 365 selected Sales environment validation failed",
      );
    return {
      microsoftDynamics365Validated: true,
      microsoftDynamics365EnvironmentOrigin: selected.environmentOrigin,
      microsoftDynamics365EnvironmentDisplayName:
        this.stringOrNull(organization.friendlyname) ??
        selected.environmentDisplayName,
      microsoftDynamics365OrganizationId: organizationId,
      microsoftDynamics365StandardSalesTablesVerified: true,
    };
  };

const oauthProviderProfileHandler098: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    providerSession,
    _tokenResponse,
  ) {
    const selected = this.normalizeMicrosoftVivaEngageBinding({
      communityId: providerSession?.communityId,
      communityName: providerSession?.communityName,
    });
    const headers = {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    };
    const [networkResponse, userResponse] = await Promise.all([
      safeConnectorFetch("https://www.yammer.com/api/v1/networks/current.json", {
        method: "GET",
        headers,
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      }),
      safeConnectorFetch("https://www.yammer.com/api/v1/users/current.json", {
        method: "GET",
        headers,
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      }),
    ]);
    const networkBody = (await networkResponse
      .json()
      .catch(() => ({}))) as unknown;
    const networkValue = Array.isArray(networkBody)
      ? networkBody[0]
      : networkBody;
    const network =
      networkValue &&
      typeof networkValue === "object" &&
      !Array.isArray(networkValue)
        ? (networkValue as Record<string, unknown>)
        : {};
    const user = (await userResponse.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const id = (value: unknown) =>
      typeof value === "string"
        ? value
        : typeof value === "number" && Number.isFinite(value)
          ? String(value)
          : null;
    const networkId = id(network.id);
    const currentUserId = id(user.id);
    if (
      !networkResponse.ok ||
      !userResponse.ok ||
      !networkId ||
      !/^\d{1,32}$/.test(networkId) ||
      !currentUserId ||
      !/^\d{1,32}$/.test(currentUserId)
    )
      throw new BadRequestException(
        "Microsoft Viva Engage current network and user validation failed",
      );
    const communitiesResponse = await safeConnectorFetch(
      `https://www.yammer.com/api/v1/groups/for_user/${currentUserId}.json`,
      {
        method: "GET",
        headers,
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      },
    );
    const communitiesBody = (await communitiesResponse
      .json()
      .catch(() => [])) as unknown;
    const communities = Array.isArray(communitiesBody) ? communitiesBody : [];
    const community = communities.find(
      (value) =>
        value &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        id((value as Record<string, unknown>).id) === selected.communityId,
    ) as Record<string, unknown> | undefined;
    if (!communitiesResponse.ok || !community)
      throw new BadRequestException(
        "Microsoft Viva Engage selected community is not joined by the current user",
      );
    return {
      microsoftVivaEngageValidated: true,
      microsoftVivaEngageNetworkId: networkId,
      microsoftVivaEngageNetworkName: this.stringOrNull(network.name),
      microsoftVivaEngageCurrentUserId: currentUserId,
      microsoftVivaEngageCurrentUserDisplayName:
        this.stringOrNull(user.full_name) ?? this.stringOrNull(user.name),
      microsoftVivaEngageSelectedCommunityId: selected.communityId,
      microsoftVivaEngageSelectedCommunityName:
        this.stringOrNull(community.name) ?? selected.communityName,
      microsoftVivaEngageSelectedCommunityVerified: true,
    };
  };

const oauthProviderProfileHandler099: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    providerSession,
    _tokenResponse,
  ) {
    const selected = this.normalizeMicrosoftListsBinding({
      siteId: providerSession?.siteId,
      listId: providerSession?.listId,
      listWebUrl: providerSession?.listWebUrl,
      listDisplayName: providerSession?.listDisplayName,
      allowedFieldNames: providerSession?.allowedFieldNames,
    });
    const response = await safeConnectorFetch(
      `https://graph.microsoft.com/v1.0/sites/${selected.siteId}/lists/${selected.listId}`,
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
    const list = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const returnedId = this.stringOrNull(list.id);
    const returnedWebUrl = this.stringOrNull(list.webUrl);
    if (
      !response.ok ||
      returnedId !== selected.listId ||
      !returnedWebUrl ||
      this.normalizeMicrosoftListWebUrl(returnedWebUrl) !== selected.listWebUrl
    )
      throw new BadRequestException(
        "Microsoft Lists selected-list administrator grant validation failed",
      );
    return {
      microsoftListsSelectedSiteId: selected.siteId,
      microsoftListsSelectedListId: selected.listId,
      microsoftListsSelectedListWebUrl: selected.listWebUrl,
      microsoftListsSelectedListDisplayName:
        this.stringOrNull(list.displayName) ?? selected.listDisplayName,
      microsoftListsAllowedFieldNames: selected.allowedFieldNames,
      microsoftListsGrantVerified: true,
    };
  };

const oauthProviderProfileHandler100: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    const response = await safeConnectorFetch("https://api.vimeo.com/me", {
      method: "GET",
      headers: {
        Accept: "application/vnd.vimeo.*+json;version=3.4",
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
    if (!response.ok || !this.stringOrNull(body.uri))
      throw new BadRequestException(
        "Vimeo connected-account validation failed",
      );
    return body;
  };

const oauthProviderProfileHandler101: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    const response = await safeConnectorFetch("https://platform.quip.com/1/users/current", {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    if (!response.ok)
      throw new BadRequestException("Quip user validation failed");
    const body = (await response.json()) as unknown;
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw new BadRequestException(
        "Quip user validation returned an invalid profile",
      );
    return body as Record<string, unknown>;
  };

const oauthProviderProfileHandler102: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    const response = await safeConnectorFetch(
      "https://openapi.niftypm.com/api/v1.0/users/me",
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
    if (!response.ok || !this.stringOrNull(body.id)) {
      throw new BadRequestException("Box connected-user validation failed");
    }
    return body as Record<string, unknown>;
  };

const oauthProviderProfileHandler103: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    const response = await safeConnectorFetch(
      "https://api.dropboxapi.com/2/users/get_current_account",
      {
        method: "POST",
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
    if (!response.ok || !this.stringOrNull(body.account_id)) {
      throw new BadRequestException(
        "Dropbox connected-account validation failed",
      );
    }
    return body;
  };

const oauthProviderProfileHandler104: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    const response = await safeConnectorFetch("https://api.lucid.co/v1/users/me/profile", {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        "Lucid-Api-Version": "1",
      },
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    const body = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    if (
      !response.ok ||
      (!this.stringOrNull(body.id) &&
        !this.stringOrNull(body.userId) &&
        !this.stringOrNull(body.email))
    ) {
      throw new BadRequestException("Lucid connected-user validation failed");
    }
    return body;
  };

export const OAuthProviderProfileHandlers04: OAuthProviderProfileHandlerMap =
  Object.freeze({
    onedrive: oauthProviderProfileHandler076,
    "microsoft-dynamics-365-sales": oauthProviderProfileHandler077,
    "microsoft-dynamics-365-customer-service": oauthProviderProfileHandler078,
    "microsoft-dynamics-365-business-central": oauthProviderProfileHandler079,
    "microsoft-entra-id": oauthProviderProfileHandler080,
    yammer: oauthProviderProfileHandler081,
    "viva-learning": oauthProviderProfileHandler082,
    frontify: oauthProviderProfileHandler083,
    "asset-bank": oauthProviderProfileHandler084,
    "zoho-expense": oauthProviderProfileHandler085,
    "zoho-invoice": oauthProviderProfileHandler086,
    "zoho-books": oauthProviderProfileHandler087,
    "zoho-desk": oauthProviderProfileHandler088,
    "zoho-projects": oauthProviderProfileHandler089,
    "zoho-people": oauthProviderProfileHandler090,
    "zoho-campaigns": oauthProviderProfileHandler091,
    "zoho-analytics": oauthProviderProfileHandler092,
    zoho: oauthProviderProfileHandler093,
    "zoho-workdrive": oauthProviderProfileHandler094,
    "microsoft-bookings": oauthProviderProfileHandler095,
    "microsoft-power-bi": oauthProviderProfileHandler096,
    "microsoft-dynamics-365": oauthProviderProfileHandler097,
    "microsoft-viva-engage": oauthProviderProfileHandler098,
    "microsoft-lists": oauthProviderProfileHandler099,
    vimeo: oauthProviderProfileHandler100,
    quip: oauthProviderProfileHandler101,
    nifty: oauthProviderProfileHandler102,
    dropbox: oauthProviderProfileHandler103,
    "dropbox-paper": oauthProviderProfileHandler103,
    lucidspark: oauthProviderProfileHandler104,
    lucidchart: oauthProviderProfileHandler104,
  });
