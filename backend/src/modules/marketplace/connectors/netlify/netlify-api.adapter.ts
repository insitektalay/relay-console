export const NETLIFY_API_ORIGIN = "https://api.netlify.com/api/v1";

export type NetlifyCredentials = {
  accessToken: string;
  accountSlug: string;
  siteId: string;
};

export class NetlifyApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly statusCode = 502,
  ) {
    super(message);
  }
}

type Requester = (url: string, init: RequestInit) => Promise<Response>;

export class NetlifyApiAdapter {
  constructor(private readonly requester: Requester = fetch) {}

  async health(credentials: NetlifyCredentials) {
    const result = await this.getSite(credentials);
    return { ready: true, siteId: result.site.id, siteName: result.site.name };
  }

  async listSites(credentials: NetlifyCredentials, input: { limit?: unknown }) {
    const limit = this.limit(input.limit);
    const accountSlug = this.accountSlug(credentials.accountSlug);
    const response = await this.request(
      credentials,
      `/${accountSlug}/sites?page=1&per_page=${limit}`,
    );
    const sites = this.array(response.body)
      .slice(0, limit)
      .map((value) => this.site(value, accountSlug));
    return {
      sites,
      returnedCount: sites.length,
      more: response.more,
      automaticPagination: false,
    };
  }

  async getSite(credentials: NetlifyCredentials) {
    const siteId = this.id(credentials.siteId, "site");
    const response = await this.request(credentials, `/sites/${siteId}`);
    const site = this.site(response.body, credentials.accountSlug);
    if (site.id !== siteId)
      throw new NetlifyApiError(
        "netlify_site_binding_mismatch",
        "Netlify selected-site binding changed.",
        403,
      );
    return { site };
  }

  async listDeploys(
    credentials: NetlifyCredentials,
    input: { limit?: unknown },
  ) {
    const limit = this.limit(input.limit);
    const siteId = this.id(credentials.siteId, "site");
    const response = await this.request(
      credentials,
      `/sites/${siteId}/deploys?page=1&per_page=${limit}`,
    );
    const deploys = this.array(response.body)
      .slice(0, limit)
      .map((value) => this.deploy(value, siteId));
    return {
      deploys,
      returnedCount: deploys.length,
      more: response.more,
      automaticPagination: false,
    };
  }

  private async request(credentials: NetlifyCredentials, path: string) {
    if (
      !/^\/(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\/sites|sites\/[A-Za-z0-9_-]{3,128}(?:\/deploys)?)(?:\?page=1&per_page=(?:[1-9]|1[0-9]|2[0-5]))?$/.test(
        path,
      )
    )
      throw new NetlifyApiError(
        "netlify_path_invalid",
        "Netlify API path is invalid.",
        400,
      );
    if (!credentials.accessToken || credentials.accessToken.length > 30_000)
      throw new NetlifyApiError(
        "netlify_credential_missing",
        "Netlify personal access token is missing.",
        401,
      );
    const response = await this.requester(`${NETLIFY_API_ORIGIN}${path}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${credentials.accessToken}`,
        "User-Agent": "RelayConsole-Netlify/1.0",
      },
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    if (!response.ok) {
      const code =
        response.status === 401
          ? "netlify_token_invalid"
          : response.status === 403
            ? "netlify_team_access_denied"
            : response.status === 404
              ? "netlify_not_found"
              : response.status === 429
                ? "netlify_rate_limited"
                : "netlify_unavailable";
      throw new NetlifyApiError(
        code,
        "Netlify API request failed.",
        response.status,
      );
    }
    const text = await response.text();
    if (Buffer.byteLength(text, "utf8") > 1_000_000)
      throw new NetlifyApiError(
        "netlify_response_too_large",
        "Netlify response exceeded Relay's limit.",
      );
    try {
      return {
        body: JSON.parse(text) as unknown,
        more: /(?:^|,)\s*<[^>]+>;\s*rel="next"(?:,|$)/i.test(
          response.headers.get("link") ?? "",
        ),
      };
    } catch {
      throw new NetlifyApiError(
        "netlify_response_invalid",
        "Netlify returned an invalid response.",
      );
    }
  }

  private site(value: unknown, accountSlugInput: string) {
    const site = this.record(value);
    const accountSlug = this.accountSlug(accountSlugInput);
    if (this.text(site.account_slug) !== accountSlug)
      throw new NetlifyApiError(
        "netlify_account_binding_mismatch",
        "Netlify Site account binding changed.",
        403,
      );
    const publishedDeploy = this.record(site.published_deploy);
    return {
      id: this.id(site.id, "site response"),
      name: this.text(site.name),
      state: this.text(site.state),
      plan: this.text(site.plan),
      url: this.text(site.url),
      sslUrl: this.text(site.ssl_url),
      createdAt: this.text(site.created_at),
      updatedAt: this.text(site.updated_at),
      account: {
        slug: accountSlug,
        name: this.text(site.account_name),
      },
      publishedDeploy: {
        id: this.text(publishedDeploy.id),
        state: this.text(publishedDeploy.state),
        context: this.text(publishedDeploy.context),
        createdAt: this.text(publishedDeploy.created_at),
        publishedAt: this.text(publishedDeploy.published_at),
      },
      environmentValuesReturned: false,
      repositoryDetailsReturned: false,
      domainDetailsReturned: false,
    };
  }

  private deploy(value: unknown, siteId: string) {
    const deploy = this.record(value);
    if (this.text(deploy.site_id) !== siteId)
      throw new NetlifyApiError(
        "netlify_site_binding_mismatch",
        "Netlify Deploy site binding changed.",
        403,
      );
    return {
      id: this.id(deploy.id, "deploy response"),
      siteId,
      name: this.text(deploy.name),
      state: this.text(deploy.state),
      context: this.text(deploy.context),
      url: this.text(deploy.url),
      sslUrl: this.text(deploy.ssl_url),
      deployUrl: this.text(deploy.deploy_url),
      deploySslUrl: this.text(deploy.deploy_ssl_url),
      draft: this.boolean(deploy.draft),
      locked: this.boolean(deploy.locked),
      skipped: this.boolean(deploy.skipped),
      createdAt: this.text(deploy.created_at),
      updatedAt: this.text(deploy.updated_at),
      publishedAt: this.text(deploy.published_at),
      hasError: Boolean(this.text(deploy.error_message)),
      errorMessageReturned: false,
      sourceMetadataReturned: false,
      filesReturned: false,
      logsReturned: false,
    };
  }

  private accountSlug(value: unknown) {
    if (
      typeof value !== "string" ||
      !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(value)
    )
      throw new NetlifyApiError(
        "netlify_account_slug_invalid",
        "Netlify account slug is invalid.",
        400,
      );
    return value;
  }
  private id(value: unknown, label: string) {
    if (typeof value !== "string" || !/^[A-Za-z0-9_-]{3,128}$/.test(value))
      throw new NetlifyApiError(
        `netlify_${label.replaceAll(" ", "_")}_id_invalid`,
        `Netlify ${label} ID is invalid.`,
        400,
      );
    return value;
  }
  private limit(value: unknown) {
    if (value === undefined) return 10;
    if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 25)
      throw new NetlifyApiError(
        "netlify_limit_invalid",
        "Netlify result limit must be between 1 and 25.",
        400,
      );
    return Number(value);
  }
  private record(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }
  private array(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }
  private text(value: unknown) {
    return typeof value === "string" ? value.slice(0, 1_000) : null;
  }
  private boolean(value: unknown) {
    return typeof value === "boolean" ? value : null;
  }
}
