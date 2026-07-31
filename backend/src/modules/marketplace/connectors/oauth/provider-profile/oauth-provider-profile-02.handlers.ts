import { safeConnectorFetch } from "../../safe-connector-fetch";
import type {
  OAuthProviderProfileHandler,
  OAuthProviderProfileHandlerMap,
} from "./oauth-provider-profile-handler";
import type { MarketplaceConnectorOAuthService } from "../../connector-oauth.service";
import { BadRequestException } from "@nestjs/common";

const oauthProviderProfileHandler027: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    providerSession,
    _tokenResponse,
  ) {
    const companyFileId = this.stringOrNull(providerSession?.myobBusinessId);
    if (
      !companyFileId ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        companyFileId,
      )
    )
      throw new BadRequestException("MYOB company-file binding is invalid");
    const companyFileToken = this.normalizeMyobCompanyFileToken(
      this.stringOrNull(providerSession?.myobCompanyFileToken) ?? "",
    );
    const apiKey = this.stringOrNull(providerSession?.myobApiKey);
    if (!apiKey) throw new BadRequestException("MYOB API key is missing");
    const response = await safeConnectorFetch(
      `https://api.myob.com/accountright/${companyFileId}/`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
          "x-myobapi-cftoken": companyFileToken,
          "x-myobapi-key": apiKey,
          "x-myobapi-version": "v2",
          "User-Agent": "RelayConsole-MYOB/1.0",
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      },
    );
    const body = await response.json().catch(() => ({}));
    const rows = Array.isArray(body) ? body : [body];
    const companyFile = rows
      .filter(
        (value): value is Record<string, unknown> =>
          !!value && typeof value === "object" && !Array.isArray(value),
      )
      .find(
        (value) =>
          this.stringOrNull(value.Id)?.toLowerCase() ===
          companyFileId.toLowerCase(),
      );
    if (!response.ok || !companyFile)
      throw new BadRequestException(
        "MYOB authorization could not verify the selected company file",
      );
    return {
      myobCompanyFileId: companyFileId,
      myobCompanyFileName: this.stringOrNull(companyFile.Name),
      myobProductVersion: this.stringOrNull(companyFile.ProductVersion),
      myobProductLevel: this.stringOrNull(companyFile.ProductLevel),
      myobCountry: this.stringOrNull(companyFile.Country),
    };
  };

const oauthProviderProfileHandler028: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    tokenResponse,
  ) {
    const installation = tokenResponse?.installation;
    const installationId = this.positiveNumericId(installation?.id);
    const companyId = this.positiveNumericId(installation?.company?.id);
    const apiOrigin = this.normalizeTeamworkApiOrigin(
      this.stringOrNull(installation?.apiEndPoint) ?? "",
    );
    const response = await safeConnectorFetch(
      "https://www.teamwork.com/launchpad/v1/userinfo.json",
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
          "User-Agent": "RelayConsole-Teamwork/1.0",
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
    const userInstallationId = this.positiveNumericId(
      body.installation_id ?? body.installationId,
    );
    const userId = this.positiveNumericId(body.user_id ?? body.userId);
    if (
      !response.ok ||
      !installationId ||
      !userInstallationId ||
      installationId !== userInstallationId ||
      !userId
    )
      throw new BadRequestException(
        "Teamwork authorization could not verify its exact installation",
      );
    return {
      teamworkInstallationId: installationId,
      teamworkInstallationName:
        this.stringOrNull(installation?.name)?.slice(0, 200) ?? null,
      teamworkCompanyId: companyId,
      teamworkCompanyName:
        this.stringOrNull(installation?.company?.name)?.slice(0, 200) ?? null,
      teamworkRegion:
        this.stringOrNull(installation?.region)?.slice(0, 50) ?? null,
      teamworkApiOrigin: apiOrigin,
      teamworkUserId: userId,
    };
  };

const oauthProviderProfileHandler029: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    const response = await safeConnectorFetch(
      "https://launchpad.37signals.com/authorization.json",
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
          "User-Agent": "RelayConsole (support@relayconsole.work)",
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
      body.identity &&
      typeof body.identity === "object" &&
      !Array.isArray(body.identity)
        ? (body.identity as Record<string, unknown>)
        : null;
    const identityId = this.positiveNumericId(identity?.id);
    const accounts = Array.isArray(body.accounts) ? body.accounts : [];
    const account = accounts
      .map((value) =>
        value && typeof value === "object" && !Array.isArray(value)
          ? (value as Record<string, unknown>)
          : null,
      )
      .filter(
        (value): value is Record<string, unknown> =>
          value !== null && value.product === "bc3",
      )
      .sort((left, right) =>
        String(left.id ?? "").localeCompare(String(right.id ?? ""), "en", {
          numeric: true,
        }),
      )[0];
    const accountId = this.positiveNumericId(account?.id);
    const accountOrigin = this.normalizeBasecampAccountOrigin(
      this.stringOrNull(account?.href) ?? "",
    );
    if (!response.ok || !identityId || !accountId)
      throw new BadRequestException(
        "Basecamp authorization could not verify an accessible bc3 account",
      );
    return {
      basecampIdentityId: identityId,
      basecampIdentityName: [
        this.stringOrNull(identity?.first_name),
        this.stringOrNull(identity?.last_name),
      ]
        .filter(Boolean)
        .join(" ")
        .slice(0, 200),
      basecampAccountId: accountId,
      basecampAccountName:
        this.stringOrNull(account?.name)?.slice(0, 200) ?? null,
      basecampAccountOrigin: accountOrigin,
      basecampProduct: "bc3",
    };
  };

const oauthProviderProfileHandler030: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    tokenResponse,
  ) {
    const host = this.normalizeWrikeHost(
      this.stringOrNull(
        (tokenResponse as unknown as Record<string, unknown> | null)?.host,
      ) ?? "",
    );
    const apiOrigin = `https://${host}/api/v4`;
    const fetchFirst = async (path: string) => {
      const response = await safeConnectorFetch(`${apiOrigin}${path}`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
      const raw = await response.text();
      if (Buffer.byteLength(raw, "utf8") > 2_000_000)
        throw new BadRequestException(
          "Wrike profile response exceeded Relay bounds",
        );
      let body: Record<string, unknown>;
      try {
        body = (raw ? JSON.parse(raw) : {}) as Record<string, unknown>;
      } catch {
        throw new BadRequestException(
          "Wrike profile response was invalid JSON",
        );
      }
      const data = Array.isArray(body.data) ? body.data : [];
      const first = data[0];
      if (
        !response.ok ||
        !first ||
        typeof first !== "object" ||
        Array.isArray(first)
      )
        throw new BadRequestException(
          "Wrike authorization could not verify its account and user",
        );
      return first as Record<string, unknown>;
    };
    const account = await fetchFirst("/account");
    const user = await fetchFirst("/contacts?me=true");
    const accountId = this.wrikeOpaqueId(account.id, "account");
    const userId = this.wrikeOpaqueId(user.id, "user");
    return {
      wrikeAccountId: accountId,
      wrikeAccountName: this.stringOrNull(account.name)?.slice(0, 200) ?? null,
      wrikeUserId: userId,
      wrikeUserName:
        this.stringOrNull(user.firstName)?.slice(0, 100) ??
        this.stringOrNull(user.lastName)?.slice(0, 100) ??
        null,
      wrikeUserEmail:
        this.stringOrNull(user.primaryEmail)?.slice(0, 320) ?? null,
      wrikeProviderHost: host,
      wrikeApiOrigin: apiOrigin,
    };
  };

const oauthProviderProfileHandler031: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    const apiOrigin = "https://api.smartsheet.com/2.0";
    const response = await safeConnectorFetch(`${apiOrigin}/users/me`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        "smartsheet-integration-source": "AI,Relay Console,Marketplace",
      },
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 2_000_000)
      throw new BadRequestException(
        "Smartsheet profile response exceeded Relay bounds",
      );
    let user: Record<string, unknown>;
    try {
      user = (raw ? JSON.parse(raw) : {}) as Record<string, unknown>;
    } catch {
      throw new BadRequestException(
        "Smartsheet profile response was invalid JSON",
      );
    }
    const account =
      user.account && typeof user.account === "object"
        ? (user.account as Record<string, unknown>)
        : {};
    const userId = this.smartsheetNumericId(user.id, "user");
    const accountId = this.smartsheetNumericId(account.id, "account");
    if (!response.ok)
      throw new BadRequestException(
        "Smartsheet authorization could not verify its account and user",
      );
    return {
      smartsheetAccountId: accountId,
      smartsheetAccountName:
        this.stringOrNull(account.name)?.slice(0, 200) ?? null,
      smartsheetUserId: userId,
      smartsheetUserName:
        [this.stringOrNull(user.firstName), this.stringOrNull(user.lastName)]
          .filter(Boolean)
          .join(" ")
          .slice(0, 200) || null,
      smartsheetUserEmail: this.stringOrNull(user.email)?.slice(0, 320) ?? null,
      smartsheetApiOrigin: apiOrigin,
    };
  };

const oauthProviderProfileHandler032: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    const apiOrigin = "https://api.todoist.com/api/v1";
    const response = await safeConnectorFetch(`${apiOrigin}/user`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 2_000_000)
      throw new BadRequestException(
        "Todoist profile response exceeded Relay bounds",
      );
    let user: Record<string, unknown>;
    try {
      user = (raw ? JSON.parse(raw) : {}) as Record<string, unknown>;
    } catch {
      throw new BadRequestException(
        "Todoist profile response was invalid JSON",
      );
    }
    if (!response.ok)
      throw new BadRequestException(
        "Todoist authorization could not verify its user",
      );
    return {
      todoistUserId: this.todoistOpaqueId(user.id),
      todoistUserName: this.stringOrNull(user.full_name)?.slice(0, 200) ?? null,
      todoistUserEmail: this.stringOrNull(user.email)?.slice(0, 320) ?? null,
      todoistApiOrigin: apiOrigin,
    };
  };

const oauthProviderProfileHandler033: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    const apiOrigin = "https://api.ticktick.com/open/v1";
    const response = await safeConnectorFetch(`${apiOrigin}/project`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 2_000_000)
      throw new BadRequestException(
        "TickTick grant-validation response exceeded Relay bounds",
      );
    let projects: unknown;
    try {
      projects = raw ? JSON.parse(raw) : null;
    } catch {
      throw new BadRequestException(
        "TickTick grant-validation response was invalid JSON",
      );
    }
    if (!response.ok || !Array.isArray(projects))
      throw new BadRequestException(
        "TickTick authorization could not validate its access grant",
      );
    return {
      ticktickGrantVerified: true,
      ticktickApiOrigin: apiOrigin,
      ticktickVisibleProjectCount: Math.min(projects.length, 10_000),
    };
  };

const oauthProviderProfileHandler034: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    const apiOrigin = "https://api.calendly.com";
    const response = await safeConnectorFetch(`${apiOrigin}/users/me`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "RelayConsole-Calendly/1.0",
      },
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > 2_000_000)
      throw new BadRequestException(
        "Calendly connected-user response exceeded Relay bounds",
      );
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 2_000_000)
      throw new BadRequestException(
        "Calendly connected-user response exceeded Relay bounds",
      );
    let body: Record<string, unknown>;
    try {
      body = (raw ? JSON.parse(raw) : {}) as Record<string, unknown>;
    } catch {
      throw new BadRequestException(
        "Calendly connected-user response was invalid JSON",
      );
    }
    const resource =
      body.resource &&
      typeof body.resource === "object" &&
      !Array.isArray(body.resource)
        ? (body.resource as Record<string, unknown>)
        : {};
    const userUri = this.stringOrNull(resource.uri);
    const organizationUri = this.stringOrNull(resource.current_organization);
    if (
      !response.ok ||
      !userUri ||
      !organizationUri ||
      !/^https:\/\/api\.calendly\.com\/users\/[A-Za-z0-9_-]{1,64}$/.test(
        userUri,
      ) ||
      !/^https:\/\/api\.calendly\.com\/organizations\/[A-Za-z0-9_-]{1,64}$/.test(
        organizationUri,
      )
    )
      throw new BadRequestException(
        "Calendly authorization could not verify its exact user and current organization",
      );
    return {
      calendlyUserUri: userUri,
      calendlyOrganizationUri: organizationUri,
      calendlyUserName: this.stringOrNull(resource.name)?.slice(0, 200) ?? null,
      calendlyApiOrigin: apiOrigin,
    };
  };

const oauthProviderProfileHandler035: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    const apiOrigin = "https://api.cal.com/v2";
    const response = await safeConnectorFetch(`${apiOrigin}/me`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "RelayConsole-CalCom/1.0",
      },
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > 2_000_000)
      throw new BadRequestException(
        "Cal.com connected-user response exceeded Relay bounds",
      );
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 2_000_000)
      throw new BadRequestException(
        "Cal.com connected-user response exceeded Relay bounds",
      );
    let body: Record<string, unknown>;
    try {
      body = (raw ? JSON.parse(raw) : {}) as Record<string, unknown>;
    } catch {
      throw new BadRequestException(
        "Cal.com connected-user response was invalid JSON",
      );
    }
    const data =
      body.data && typeof body.data === "object" && !Array.isArray(body.data)
        ? (body.data as Record<string, unknown>)
        : {};
    const userId = this.positiveNumericId(data.id);
    const username = this.stringOrNull(data.username);
    if (
      !response.ok ||
      !userId ||
      !username ||
      !/^[A-Za-z0-9_-]{1,128}$/.test(username)
    )
      throw new BadRequestException(
        "Cal.com authorization could not verify its exact user",
      );
    return {
      calComUserId: String(userId),
      calComUsername: username,
      calComUserName: this.stringOrNull(data.name)?.slice(0, 200) ?? null,
      calComApiOrigin: apiOrigin,
    };
  };

const oauthProviderProfileHandler036: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    const response = await safeConnectorFetch(
      "https://account.docusign.com/oauth/userinfo",
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
          "User-Agent": "RelayConsole-Docusign/1.0",
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      },
    );
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > 2_000_000)
      throw new BadRequestException(
        "Docusign UserInfo response exceeded Relay bounds",
      );
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 2_000_000)
      throw new BadRequestException(
        "Docusign UserInfo response exceeded Relay bounds",
      );
    let body: Record<string, unknown>;
    try {
      body = (raw ? JSON.parse(raw) : {}) as Record<string, unknown>;
    } catch {
      throw new BadRequestException(
        "Docusign UserInfo response was invalid JSON",
      );
    }
    const accounts = Array.isArray(body.accounts)
      ? body.accounts
          .filter(
            (value): value is Record<string, unknown> =>
              Boolean(value) &&
              typeof value === "object" &&
              !Array.isArray(value),
          )
          .slice(0, 100)
      : [];
    const selected =
      accounts.find((account) => account.is_default === true) ?? accounts[0];
    const userId = this.stringOrNull(body.sub);
    const accountId = this.stringOrNull(selected?.account_id);
    const baseUri = this.stringOrNull(selected?.base_uri);
    let validBaseUri = false;
    try {
      const url = new URL(baseUri ?? "");
      const labels = url.hostname.toLowerCase().split(".");
      validBaseUri =
        url.protocol === "https:" &&
        !url.username &&
        !url.password &&
        !url.port &&
        (url.pathname === "/" || url.pathname === "") &&
        !url.search &&
        !url.hash &&
        labels.length === 3 &&
        labels[1] === "docusign" &&
        labels[2] === "net" &&
        /^[a-z0-9-]+$/.test(labels[0]);
    } catch {
      validBaseUri = false;
    }
    if (
      !response.ok ||
      !userId ||
      !/^[A-Za-z0-9_-]{1,100}$/.test(userId) ||
      !accountId ||
      !/^[0-9A-Fa-f-]{1,64}$/.test(accountId) ||
      !baseUri ||
      !validBaseUri
    )
      throw new BadRequestException(
        "Docusign authorization could not verify its exact user, selected account, and regional base URI",
      );
    return {
      docusignUserId: userId,
      docusignUserName: this.stringOrNull(body.name)?.slice(0, 200) ?? null,
      docusignAccountId: accountId,
      docusignAccountName:
        this.stringOrNull(selected?.account_name)?.slice(0, 200) ?? null,
      docusignBaseUri: new URL(baseUri).origin,
      docusignAccountIsDefault: selected?.is_default === true,
    };
  };

const oauthProviderProfileHandler037: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    providerSession,
    tokenResponse,
  ) {
    const accountId =
      this.stringOrNull(tokenResponse?.account_id) ??
      this.stringOrNull(providerSession?.dropboxSignAccountId);
    if (!accountId || !/^[0-9A-Fa-f]{24,64}$/.test(accountId))
      throw new BadRequestException(
        "Dropbox Sign token response did not contain a safe exact account ID",
      );
    const url = new URL("https://api.hellosign.com/v3/account");
    url.searchParams.set("account_id", accountId);
    const response = await safeConnectorFetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "RelayConsole-DropboxSign/1.0",
      },
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > 2_000_000)
      throw new BadRequestException(
        "Dropbox Sign account response exceeded Relay bounds",
      );
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 2_000_000)
      throw new BadRequestException(
        "Dropbox Sign account response exceeded Relay bounds",
      );
    let body: Record<string, unknown>;
    try {
      body = (raw ? JSON.parse(raw) : {}) as Record<string, unknown>;
    } catch {
      throw new BadRequestException(
        "Dropbox Sign account response was invalid JSON",
      );
    }
    const account =
      body.account &&
      typeof body.account === "object" &&
      !Array.isArray(body.account)
        ? (body.account as Record<string, unknown>)
        : {};
    const validatedId = this.stringOrNull(account.account_id);
    const locale = this.stringOrNull(account.locale);
    if (
      !response.ok ||
      validatedId?.toLowerCase() !== accountId.toLowerCase() ||
      (locale !== null && !/^[A-Za-z]{2}(?:[-_][A-Za-z]{2})?$/.test(locale))
    )
      throw new BadRequestException(
        "Dropbox Sign authorization could not validate its token-returned exact account",
      );
    return {
      dropboxSignAccountId: accountId.toLowerCase(),
      dropboxSignAccountLabel: `Dropbox Sign account …${accountId.slice(-8).toLowerCase()}`,
      dropboxSignLocale: locale,
      dropboxSignLocked: account.is_locked === true,
      dropboxSignPaid: account.is_paid_hs === true,
      dropboxSignApiOrigin: "https://api.hellosign.com/v3",
    };
  };

const oauthProviderProfileHandler038: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    const read = async (path: "members" | "workspaces") => {
      const url = new URL(`https://api.pandadoc.com/public/v1/${path}`);
      url.searchParams.set("count", "25");
      url.searchParams.set("page", "1");
      const response = await safeConnectorFetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
          "User-Agent": "RelayConsole-PandaDoc/1.0",
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
      const declared = Number(response.headers.get("content-length") ?? 0);
      if (declared > 2_000_000)
        throw new BadRequestException(
          `PandaDoc ${path} response exceeded Relay bounds`,
        );
      const raw = await response.text();
      if (Buffer.byteLength(raw, "utf8") > 2_000_000)
        throw new BadRequestException(
          `PandaDoc ${path} response exceeded Relay bounds`,
        );
      let body: Record<string, unknown>;
      try {
        body = (raw ? JSON.parse(raw) : {}) as Record<string, unknown>;
      } catch {
        throw new BadRequestException(
          `PandaDoc ${path} response was invalid JSON`,
        );
      }
      if (!response.ok || !Array.isArray(body.results))
        throw new BadRequestException(
          `PandaDoc authorization could not read its bounded ${path} binding`,
        );
      return body.results
        .filter(
          (value): value is Record<string, unknown> =>
            Boolean(value) &&
            typeof value === "object" &&
            !Array.isArray(value),
        )
        .slice(0, 25);
    };
    const [members, workspaces] = await Promise.all([
      read("members"),
      read("workspaces"),
    ]);
    const member = members[0] ?? {};
    const workspace = workspaces[0] ?? {};
    const membershipId = this.stringOrNull(
      member.id ?? member.uuid ?? member.membership_id,
    );
    const workspaceId = this.stringOrNull(
      workspace.id ?? workspace.uuid ?? workspace.workspace_id,
    );
    if (
      !membershipId ||
      !workspaceId ||
      !/^[A-Za-z0-9_-]{1,64}$/.test(membershipId) ||
      !/^[A-Za-z0-9_-]{1,64}$/.test(workspaceId)
    )
      throw new BadRequestException(
        "PandaDoc authorization could not verify an exact membership and token-bound workspace",
      );
    return {
      pandaDocMembershipId: membershipId,
      pandaDocMembershipLabel:
        this.stringOrNull(member.name)?.slice(0, 200) ??
        `PandaDoc member …${membershipId.slice(-8)}`,
      pandaDocWorkspaceId: workspaceId,
      pandaDocWorkspaceName:
        this.stringOrNull(workspace.name)?.slice(0, 200) ??
        `PandaDoc workspace …${workspaceId.slice(-8)}`,
      pandaDocApiOrigin: "https://api.pandadoc.com/public/v1",
    };
  };

const oauthProviderProfileHandler039: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    providerSession,
    _tokenResponse,
  ) {
    const allowedOrigins = [
      "https://api.typeform.com",
      "https://api.eu.typeform.com",
      "https://api.typeform.eu",
    ];
    const preferredOrigin = this.stringOrNull(
      providerSession?.typeformApiOrigin,
    );
    const candidates = [preferredOrigin, ...allowedOrigins].filter(
      (value, index, values): value is string =>
        Boolean(value) &&
        allowedOrigins.includes(value as string) &&
        values.indexOf(value) === index,
    );
    const read = async (origin: string, path: "/me" | "/workspaces") => {
      const url = new URL(path, origin);
      if (path === "/workspaces") url.searchParams.set("page_size", "25");
      const response = await safeConnectorFetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
          "User-Agent": "RelayConsole-Typeform/1.0",
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
      const declared = Number(response.headers.get("content-length") ?? 0);
      if (declared > 2_000_000)
        throw new BadRequestException(
          `Typeform ${path} response exceeded Relay bounds`,
        );
      const raw = await response.text();
      if (Buffer.byteLength(raw, "utf8") > 2_000_000)
        throw new BadRequestException(
          `Typeform ${path} response exceeded Relay bounds`,
        );
      let body: Record<string, unknown>;
      try {
        body = (raw ? JSON.parse(raw) : {}) as Record<string, unknown>;
      } catch {
        throw new BadRequestException(
          `Typeform ${path} response was invalid JSON`,
        );
      }
      return { body, ok: response.ok };
    };
    let apiOrigin = "";
    let me: Record<string, unknown> = {};
    for (const candidate of candidates) {
      const result = await read(candidate, "/me");
      if (result.ok) {
        apiOrigin = candidate;
        me = result.body;
        break;
      }
    }
    if (!apiOrigin)
      throw new BadRequestException(
        "Typeform authorization could not validate its API-region account binding",
      );
    const region = this.stringOrNull(
      me.data_region ?? me.region,
    )?.toLowerCase();
    if (region?.includes("eu") && apiOrigin === "https://api.typeform.com")
      apiOrigin = "https://api.eu.typeform.com";
    const accountId = this.stringOrNull(
      me.id ?? me.account_id ?? me.user_id ?? me.alias,
    );
    if (!accountId || !/^[A-Za-z0-9_-]{1,64}$/.test(accountId))
      throw new BadRequestException(
        "Typeform authorization could not verify an exact account identifier",
      );
    const workspaceResult = await read(apiOrigin, "/workspaces");
    const items = Array.isArray(workspaceResult.body.items)
      ? workspaceResult.body.items.filter(
          (value): value is Record<string, unknown> =>
            Boolean(value) &&
            typeof value === "object" &&
            !Array.isArray(value),
        )
      : [];
    const preferredWorkspaceId = this.stringOrNull(
      providerSession?.typeformWorkspaceId,
    );
    const workspace =
      items.find(
        (value) => this.stringOrNull(value.id) === preferredWorkspaceId,
      ) ?? items[0];
    const workspaceId = this.stringOrNull(workspace?.id);
    if (
      !workspaceResult.ok ||
      !workspaceId ||
      !/^[A-Za-z0-9_-]{1,64}$/.test(workspaceId)
    )
      throw new BadRequestException(
        "Typeform authorization could not verify a selected workspace",
      );
    return {
      typeformAccountId: accountId,
      typeformAccountLabel:
        this.stringOrNull(me.alias)?.slice(0, 200) ??
        `Typeform account …${accountId.slice(-8)}`,
      typeformWorkspaceId: workspaceId,
      typeformWorkspaceName:
        this.stringOrNull(workspace?.name)?.slice(0, 200) ??
        `Typeform workspace …${workspaceId.slice(-8)}`,
      typeformApiOrigin: apiOrigin,
    };
  };

const oauthProviderProfileHandler040: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    const response = await safeConnectorFetch("https://api.buffer.com", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "RelayConsole-Buffer/1.0",
      },
      body: JSON.stringify({
        query: "query RelayAccountIdentity { account { id } }",
        variables: {},
      }),
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 1_000_000)
      throw new BadRequestException(
        "Buffer account response exceeded Relay bounds",
      );
    let root: Record<string, unknown>;
    try {
      root = (raw ? JSON.parse(raw) : {}) as Record<string, unknown>;
    } catch {
      throw new BadRequestException("Buffer account response was invalid JSON");
    }
    const data =
      root.data && typeof root.data === "object" && !Array.isArray(root.data)
        ? (root.data as Record<string, unknown>)
        : {};
    const account =
      data.account &&
      typeof data.account === "object" &&
      !Array.isArray(data.account)
        ? (data.account as Record<string, unknown>)
        : {};
    const accountId = this.stringOrNull(account.id);
    if (
      !response.ok ||
      (Array.isArray(root.errors) && root.errors.length > 0) ||
      !accountId ||
      !/^[A-Za-z0-9_-]{1,100}$/.test(accountId)
    )
      throw new BadRequestException(
        "Buffer authorization could not verify an exact account",
      );
    return {
      bufferAccountId: accountId,
      bufferApiOrigin: "https://api.buffer.com",
    };
  };

const oauthProviderProfileHandler041: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    const response = await safeConnectorFetch("https://api.sendfox.com/me", {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "RelayConsole-SendFox/1.0",
      },
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > 2_000_000)
      throw new BadRequestException(
        "SendFox account response exceeded Relay bounds",
      );
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 2_000_000)
      throw new BadRequestException(
        "SendFox account response exceeded Relay bounds",
      );
    let body: Record<string, unknown>;
    try {
      body = (raw ? JSON.parse(raw) : {}) as Record<string, unknown>;
    } catch {
      throw new BadRequestException(
        "SendFox account response was invalid JSON",
      );
    }
    const accountId = this.stringOrNull(body.id);
    if (!response.ok || !accountId || !/^[1-9][0-9]{0,18}$/.test(accountId))
      throw new BadRequestException(
        response.status === 402
          ? "SendFox API access requires a paid account plan"
          : "SendFox authorization could not verify an exact account",
      );
    return {
      sendFoxAccountId: accountId,
      sendFoxAccountLabel:
        this.stringOrNull(body.name)?.slice(0, 200) ??
        `SendFox account …${accountId.slice(-8)}`,
      sendFoxApiOrigin: "https://api.sendfox.com",
    };
  };

const oauthProviderProfileHandler042: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    const response = await safeConnectorFetch("https://app.beehiiv.com/oauth/token/info", {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "RelayConsole-beehiiv/1.0",
      },
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > 2_000_000)
      throw new BadRequestException(
        "beehiiv token-info response exceeded Relay bounds",
      );
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 2_000_000)
      throw new BadRequestException(
        "beehiiv token-info response exceeded Relay bounds",
      );
    let body: Record<string, unknown>;
    try {
      body = (raw ? JSON.parse(raw) : {}) as Record<string, unknown>;
    } catch {
      throw new BadRequestException(
        "beehiiv token-info response was invalid JSON",
      );
    }
    const organizationId = this.stringOrNull(body.resource_owner_id);
    if (
      !response.ok ||
      !organizationId ||
      !/^org_[0-9a-fA-F-]{1,64}$/.test(organizationId)
    )
      throw new BadRequestException(
        "beehiiv authorization could not verify an exact organization",
      );
    return {
      beehiivOrganizationId: organizationId,
      beehiivAccountLabel: `beehiiv organization …${organizationId.slice(-8)}`,
      beehiivApiOrigin: "https://api.beehiiv.com",
    };
  };

const oauthProviderProfileHandler043: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    const accountsResponse = await safeConnectorFetch(
      "https://id.getharvest.com/api/v2/accounts",
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
          "User-Agent": "RelayConsole-Harvest/1.0 (support@relayconsole.com)",
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      },
    );
    const accountsRaw = await accountsResponse.text();
    if (Buffer.byteLength(accountsRaw, "utf8") > 2_000_000)
      throw new BadRequestException(
        "Harvest account-discovery response exceeded Relay bounds",
      );
    let accountsBody: Record<string, unknown>;
    try {
      accountsBody = (accountsRaw ? JSON.parse(accountsRaw) : {}) as Record<
        string,
        unknown
      >;
    } catch {
      throw new BadRequestException(
        "Harvest account-discovery response was invalid JSON",
      );
    }
    const harvestAccounts = (
      Array.isArray(accountsBody.accounts) ? accountsBody.accounts : []
    ).filter(
      (item): item is Record<string, unknown> =>
        !!item &&
        typeof item === "object" &&
        !Array.isArray(item) &&
        this.stringOrNull((item as Record<string, unknown>).product) ===
          "harvest",
    );
    if (!accountsResponse.ok || harvestAccounts.length !== 1)
      throw new BadRequestException(
        "Harvest authorization must grant exactly one Harvest account",
      );
    const account = harvestAccounts[0];
    const accountId = this.positiveNumericId(account.id);
    if (!accountId)
      throw new BadRequestException("Harvest account binding is invalid");
    const harvestIdUser =
      accountsBody.user &&
      typeof accountsBody.user === "object" &&
      !Array.isArray(accountsBody.user)
        ? (accountsBody.user as Record<string, unknown>)
        : {};
    const harvestIdUserId = this.positiveNumericId(harvestIdUser.id);
    if (!harvestIdUserId)
      throw new BadRequestException(
        "Harvest authorizing identity binding is invalid",
      );
    const apiOrigin = "https://api.harvestapp.com/v2";
    const userResponse = await safeConnectorFetch(`${apiOrigin}/users/me`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        "Harvest-Account-Id": String(accountId),
        "User-Agent": "RelayConsole-Harvest/1.0 (support@relayconsole.com)",
      },
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    const userRaw = await userResponse.text();
    if (Buffer.byteLength(userRaw, "utf8") > 2_000_000)
      throw new BadRequestException(
        "Harvest current-user response exceeded Relay bounds",
      );
    let apiUser: Record<string, unknown>;
    try {
      apiUser = (userRaw ? JSON.parse(userRaw) : {}) as Record<string, unknown>;
    } catch {
      throw new BadRequestException(
        "Harvest current-user response was invalid JSON",
      );
    }
    const apiUserId = this.positiveNumericId(apiUser.id);
    if (!userResponse.ok || !apiUserId)
      throw new BadRequestException(
        "Harvest authorization could not verify its account user",
      );
    return {
      harvestAccountId: String(accountId),
      harvestAccountName:
        this.stringOrNull(account.name)?.slice(0, 200) ?? null,
      harvestIdUserId: String(harvestIdUserId),
      harvestIdUserName:
        [
          this.stringOrNull(harvestIdUser.first_name),
          this.stringOrNull(harvestIdUser.last_name),
        ]
          .filter(Boolean)
          .join(" ")
          .slice(0, 200) || null,
      harvestApiUserId: String(apiUserId),
      harvestApiUserName:
        [
          this.stringOrNull(apiUser.first_name),
          this.stringOrNull(apiUser.last_name),
        ]
          .filter(Boolean)
          .join(" ")
          .slice(0, 200) || null,
      harvestApiUserEmail:
        this.stringOrNull(apiUser.email)?.slice(0, 320) ?? null,
      harvestApiOrigin: apiOrigin,
    };
  };

const oauthProviderProfileHandler044: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    const response = await safeConnectorFetch("https://api2.frontapp.com/me", {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "RelayConsole-Front/1.0",
      },
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    const body = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const companyId = this.stringOrNull(body.id);
    if (
      !response.ok ||
      !companyId ||
      !/^cmp_[A-Za-z0-9_-]{1,190}$/.test(companyId)
    )
      throw new BadRequestException(
        "Front authorization could not verify its exact company",
      );
    return {
      frontCompanyId: companyId,
      frontCompanyName: this.stringOrNull(body.name)?.slice(0, 200) ?? null,
    };
  };

const oauthProviderProfileHandler045: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    const response = await safeConnectorFetch("https://api.helpscout.net/v2/users/me", {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "RelayConsole-HelpScout/1.0",
      },
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    const body = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const userId = this.positiveNumericId(body.id);
    if (!response.ok || !userId || body.active === false)
      throw new BadRequestException(
        "Help Scout authorization could not verify its exact active user",
      );
    const firstName = this.stringOrNull(body.firstName);
    const lastName = this.stringOrNull(body.lastName);
    const userName = [firstName, lastName]
      .filter((value): value is string => Boolean(value))
      .join(" ")
      .slice(0, 200);
    return {
      helpScoutUserId: userId,
      helpScoutUserName: userName || null,
      helpScoutUserRole: this.stringOrNull(body.role)?.slice(0, 100) ?? null,
      helpScoutUserActive: true,
    };
  };

const oauthProviderProfileHandler046: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    const response = await safeConnectorFetch("https://api.intercom.io/me", {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        "Intercom-Version": "2.15",
      },
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    const body = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const app =
      body.app && typeof body.app === "object" && !Array.isArray(body.app)
        ? (body.app as Record<string, unknown>)
        : {};
    const adminId = this.stringOrNull(body.id);
    const workspaceId = this.stringOrNull(app.id_code);
    const workspaceName = this.stringOrNull(app.name);
    const region = this.stringOrNull(app.region)?.toUpperCase() ?? "";
    if (
      !response.ok ||
      !adminId ||
      !workspaceId ||
      !/^[A-Za-z0-9_-]{1,200}$/.test(adminId) ||
      !/^[A-Za-z0-9_-]{1,200}$/.test(workspaceId) ||
      !workspaceName ||
      !["US", "EU", "AU"].includes(region) ||
      body.email_verified !== true
    )
      throw new BadRequestException(
        "Intercom authorization could not verify its exact workspace, region, and authorizing admin",
      );
    return {
      intercomWorkspaceId: workspaceId,
      intercomWorkspaceName: workspaceName.slice(0, 200),
      intercomAdminId: adminId,
      intercomAdminName: this.stringOrNull(body.name)?.slice(0, 200) ?? null,
      intercomRegion: region,
      intercomApiOrigin: this.intercomApiOrigin(region),
      intercomEmailVerified: true,
    };
  };

const oauthProviderProfileHandler047: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    providerSession,
    _tokenResponse,
  ) {
    const instanceOrigin = this.normalizeZendeskInstance(
      this.stringOrNull(providerSession?.zendeskInstanceOrigin) ?? "",
    );
    const response = await safeConnectorFetch(`${instanceOrigin}/api/v2/users/me.json`, {
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
    const user =
      body.user && typeof body.user === "object" && !Array.isArray(body.user)
        ? (body.user as Record<string, unknown>)
        : {};
    const userId = this.positiveNumericId(user.id);
    if (!response.ok || !userId)
      throw new BadRequestException(
        "Zendesk authorization could not verify its exact instance and user",
      );
    return {
      zendeskInstanceOrigin: instanceOrigin,
      zendeskUserId: userId,
      zendeskUserName: this.stringOrNull(user.name)?.slice(0, 200) ?? null,
      zendeskUserRole: this.stringOrNull(user.role)?.slice(0, 100) ?? null,
    };
  };

const oauthProviderProfileHandler048: OAuthProviderProfileHandler =
  async function (
    this: MarketplaceConnectorOAuthService,
    _appSlug,
    accessToken,
    _providerSession,
    _tokenResponse,
  ) {
    const response = await safeConnectorFetch("https://app.attio.com/oauth/introspect", {
      method: "POST",
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
    const workspaceId = this.stringOrNull(body.workspace_id);
    const memberId = this.stringOrNull(body.authorized_by_workspace_member_id);
    const introspectedScopes =
      this.stringOrNull(body.scope)?.split(/\s+/).filter(Boolean) ?? [];
    if (
      !response.ok ||
      body.active !== true ||
      !workspaceId ||
      !memberId ||
      !/^[0-9a-fA-F-]{36}$/.test(workspaceId) ||
      !/^[0-9a-fA-F-]{36}$/.test(memberId)
    )
      throw new BadRequestException(
        "Attio authorization could not verify its exact workspace and authorizing member",
      );
    return {
      attioWorkspaceId: workspaceId,
      attioWorkspaceName:
        this.stringOrNull(body.workspace_name)?.slice(0, 200) ?? null,
      attioWorkspaceSlug:
        this.stringOrNull(body.workspace_slug)?.slice(0, 200) ?? null,
      attioAuthorizedByWorkspaceMemberId: memberId,
      attioGrantedScopes: introspectedScopes,
    };
  };

export const OAuthProviderProfileHandlers02: OAuthProviderProfileHandlerMap =
  Object.freeze({
    myob: oauthProviderProfileHandler027,
    teamwork: oauthProviderProfileHandler028,
    basecamp: oauthProviderProfileHandler029,
    wrike: oauthProviderProfileHandler030,
    smartsheet: oauthProviderProfileHandler031,
    todoist: oauthProviderProfileHandler032,
    ticktick: oauthProviderProfileHandler033,
    calendly: oauthProviderProfileHandler034,
    "cal-com": oauthProviderProfileHandler035,
    docusign: oauthProviderProfileHandler036,
    "dropbox-sign": oauthProviderProfileHandler037,
    pandadoc: oauthProviderProfileHandler038,
    typeform: oauthProviderProfileHandler039,
    buffer: oauthProviderProfileHandler040,
    sendfox: oauthProviderProfileHandler041,
    beehiiv: oauthProviderProfileHandler042,
    harvest: oauthProviderProfileHandler043,
    front: oauthProviderProfileHandler044,
    "help-scout": oauthProviderProfileHandler045,
    intercom: oauthProviderProfileHandler046,
    zendesk: oauthProviderProfileHandler047,
    attio: oauthProviderProfileHandler048,
  });
