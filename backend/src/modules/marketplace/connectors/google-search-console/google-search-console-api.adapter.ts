import { safeConnectorFetch } from "../safe-connector-fetch";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;

export class GoogleSearchConsoleApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class GoogleSearchConsoleApiAdapter {
  private readonly webmastersOrigin =
    "https://www.googleapis.com/webmasters/v3";
  private readonly inspectionOrigin = "https://searchconsole.googleapis.com/v1";

  health(token: string) {
    this.token(token);
    return {
      readOnlyV1: true,
      selectedPropertyRequired: true,
      providerRequestCount: 0,
    };
  }

  async listProperties(token: string, input: JsonObject) {
    const maxResults = this.integer(input.maxResults, 25, 1, 25);
    const value = await this.request(
      token,
      "GET",
      `${this.webmastersOrigin}/sites`,
    );
    const all = this.array(value.siteEntry).map((entry) =>
      this.property(entry, null),
    );
    return {
      semanticReadContract: "google-search-console-properties-v1",
      properties: all.slice(0, maxResults),
      propertyCount: all.length,
      maxResults,
      truncated: all.length > maxResults,
      ...this.boundary(),
      providerRequestCount: 1,
    };
  }

  async getProperty(token: string, input: JsonObject) {
    const siteUrl = this.siteUrl(input.siteUrl);
    const value = await this.request(
      token,
      "GET",
      `${this.webmastersOrigin}/sites/${encodeURIComponent(siteUrl)}`,
    );
    return {
      semanticReadContract: "google-search-console-property-v1",
      property: {
        ...this.property(value, siteUrl),
        accessStatus: "accessible",
      },
      ...this.boundary(),
      providerRequestCount: 1,
    };
  }

  async querySearchAnalytics(token: string, input: JsonObject) {
    const siteUrl = this.siteUrl(input.siteUrl);
    const dimensions = this.dimensions(input.dimensions);
    const rowLimit = this.integer(input.rowLimit, 10, 1, 25);
    const { startDate, endDate } = this.dateRange(
      input.startDate,
      input.endDate,
    );
    const searchType = this.choice(
      input.searchType,
      ["web", "image", "video", "news", "discover", "googleNews"],
      "web",
    );
    const aggregationType = this.choice(
      input.aggregationType,
      ["auto", "byPage", "byProperty"],
      "auto",
    );
    if (aggregationType === "byProperty" && dimensions.includes("page"))
      throw new GoogleSearchConsoleApiError(
        "provider_validation_error",
        "byProperty aggregation cannot be grouped by page.",
      );
    const body = {
      startDate,
      endDate,
      dimensions,
      type: searchType,
      aggregationType,
      rowLimit,
      startRow: 0,
    };
    const value = await this.request(
      token,
      "POST",
      `${this.webmastersOrigin}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
      body,
    );
    const all = this.array(value.rows);
    const rows = all
      .slice(0, rowLimit)
      .map((entry) => this.analyticsRow(entry, dimensions));
    return {
      semanticReadContract: "google-search-console-search-analytics-v1",
      siteUrl,
      dateRange: { startDate, endDate },
      dimensions,
      searchType,
      aggregationType,
      rowLimit,
      rows,
      truncated: all.length > rowLimit,
      ...this.boundary(),
      providerRequestCount: 1,
    };
  }

  async inspectUrl(token: string, input: JsonObject) {
    const siteUrl = this.siteUrl(input.siteUrl);
    const inspectionUrl = this.containedUrl(
      input.inspectionUrl,
      siteUrl,
      "inspectionUrl",
    );
    const languageCode =
      input.languageCode === undefined
        ? undefined
        : this.languageCode(input.languageCode);
    const value = await this.request(
      token,
      "POST",
      `${this.inspectionOrigin}/urlInspection/index:inspect`,
      { inspectionUrl, siteUrl, ...(languageCode ? { languageCode } : {}) },
    );
    const result = this.object(value.inspectionResult);
    const index = this.object(result.indexStatusResult);
    const mobile = this.object(result.mobileUsabilityResult);
    const rich = this.object(result.richResultsResult);
    return {
      semanticReadContract: "google-search-console-url-inspection-v1",
      inspection: {
        siteUrl,
        inspectionUrl,
        verdict: this.scalar(index.verdict, 64),
        coverageState: this.scalar(index.coverageState, 256),
        robotsTxtState: this.scalar(index.robotsTxtState, 64),
        indexingState: this.scalar(index.indexingState, 64),
        pageFetchState: this.scalar(index.pageFetchState, 64),
        lastCrawlTime: this.scalar(index.lastCrawlTime, 64),
        googleCanonical: this.scalar(index.googleCanonical, 2048),
        userCanonical: this.scalar(index.userCanonical, 2048),
        sitemaps: this.strings(index.sitemap, 25, 2048),
        referringUrls: this.strings(index.referringUrls, 25, 2048),
        mobileUsabilityVerdict: this.scalar(mobile.verdict, 64),
        richResultsVerdict: this.scalar(rich.verdict, 64),
        inspectionResultLink: this.scalar(result.inspectionResultLink, 2048),
        issueSummary: [...this.issues(mobile), ...this.issues(rich)].slice(
          0,
          25,
        ),
        redactionStatus: "private-state-excluded",
      },
      ...this.boundary(),
      providerRequestCount: 1,
    };
  }

  async listSitemaps(token: string, input: JsonObject) {
    const siteUrl = this.siteUrl(input.siteUrl);
    const maxResults = this.integer(input.maxResults, 25, 1, 25);
    const value = await this.request(
      token,
      "GET",
      `${this.webmastersOrigin}/sites/${encodeURIComponent(siteUrl)}/sitemaps`,
    );
    const all = this.array(value.sitemap);
    return {
      semanticReadContract: "google-search-console-sitemaps-v1",
      siteUrl,
      sitemaps: all
        .slice(0, maxResults)
        .map((entry) => this.sitemap(entry, siteUrl)),
      sitemapCount: all.length,
      maxResults,
      truncated: all.length > maxResults,
      ...this.boundary(),
      providerRequestCount: 1,
    };
  }

  async getSitemap(token: string, input: JsonObject) {
    const siteUrl = this.siteUrl(input.siteUrl);
    const feedpath = this.containedUrl(input.feedpath, siteUrl, "feedpath");
    const value = await this.request(
      token,
      "GET",
      `${this.webmastersOrigin}/sites/${encodeURIComponent(siteUrl)}/sitemaps/${encodeURIComponent(feedpath)}`,
    );
    return {
      semanticReadContract: "google-search-console-sitemap-v1",
      siteUrl,
      sitemap: this.sitemap(value, siteUrl, feedpath),
      ...this.boundary(),
      providerRequestCount: 1,
    };
  }

  private async request(
    token: string,
    method: "GET" | "POST",
    base: string,
    body?: JsonObject,
  ) {
    this.token(token);
    const url = new URL(base);
    const path = url.pathname;
    const safeWebmasters =
      url.hostname === "www.googleapis.com" &&
      (method === "GET"
        ? /^\/webmasters\/v3\/sites(?:\/[^/]+(?:\/sitemaps(?:\/[^/]+)?)?)?$/.test(
            path,
          )
        : /^\/webmasters\/v3\/sites\/[^/]+\/searchAnalytics\/query$/.test(
            path,
          ));
    const safeInspection =
      method === "POST" &&
      url.hostname === "searchconsole.googleapis.com" &&
      path === "/v1/urlInspection/index:inspect";
    if (
      url.protocol !== "https:" ||
      url.search ||
      (!safeWebmasters && !safeInspection)
    )
      throw new GoogleSearchConsoleApiError(
        "provider_validation_error",
        "Google Search Console API URL is unsafe.",
      );
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        redirect: "error",
        signal: AbortSignal.timeout(20000),
      });
    } catch {
      throw new GoogleSearchConsoleApiError(
        "provider_unavailable",
        "Google Search Console API could not be reached.",
        502,
      );
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 1048576)
      throw new GoogleSearchConsoleApiError(
        "provider_validation_error",
        "Google Search Console response exceeded Relay bounds.",
      );
    if (!response.ok)
      throw new GoogleSearchConsoleApiError(
        response.status === 401
          ? "token_expired"
          : response.status === 403
            ? "insufficient_scope"
            : response.status === 429
              ? "provider_rate_limited"
              : response.status >= 500
                ? "provider_unavailable"
                : "provider_validation_error",
        "Google Search Console API rejected the bounded read request.",
        response.status,
      );
    try {
      return this.object(raw ? JSON.parse(raw) : {});
    } catch {
      throw new GoogleSearchConsoleApiError(
        "provider_validation_error",
        "Google Search Console API returned invalid JSON.",
      );
    }
  }

  private property(value: unknown, fallback: string | null) {
    const record = this.object(value);
    const siteUrl =
      typeof record.siteUrl === "string" ? record.siteUrl : fallback;
    return {
      siteUrl,
      propertyType: siteUrl?.startsWith("sc-domain:") ? "domain" : "url-prefix",
      permissionLevel: this.scalar(record.permissionLevel, 64),
      selected: fallback !== null && siteUrl === fallback,
      redactionStatus: "private-state-excluded",
    };
  }
  private analyticsRow(value: unknown, dimensions: string[]) {
    const record = this.object(value);
    const keys = this.strings(record.keys, 5, 2048);
    return {
      keys,
      dimensions: Object.fromEntries(
        dimensions.map((dimension, index) => [dimension, keys[index] ?? null]),
      ),
      clicks: this.number(record.clicks),
      impressions: this.number(record.impressions),
      ctr: this.number(record.ctr),
      position: this.number(record.position),
      redactionStatus: "private-state-excluded",
    };
  }
  private sitemap(value: unknown, siteUrl: string, fallback = "") {
    const record = this.object(value);
    return {
      siteUrl,
      path: this.scalar(record.path, 2048) ?? fallback,
      type: this.scalar(record.type, 64),
      isPending: record.isPending === true,
      isSitemapsIndex: record.isSitemapsIndex === true,
      lastSubmitted: this.scalar(record.lastSubmitted, 64),
      lastDownloaded: this.scalar(record.lastDownloaded, 64),
      warnings: this.number(record.warnings),
      errors: this.number(record.errors),
      contents: this.array(record.contents)
        .slice(0, 25)
        .map((entry) => {
          const item = this.object(entry);
          return {
            type: this.scalar(item.type, 64),
            submitted: this.number(item.submitted),
            indexed: this.number(item.indexed),
          };
        }),
      redactionStatus: "private-state-excluded",
    };
  }
  private issues(value: JsonObject) {
    return this.array(value.issues).map((entry) => {
      const issue = this.object(entry);
      return {
        issueType: this.scalar(issue.issueType ?? issue.name, 128),
        severity: this.scalar(issue.severity, 64),
        message: this.scalar(issue.message, 512),
      };
    });
  }
  private boundary() {
    return {
      readOnlyV1: true,
      selectedPropertyRequired: true,
      writesEnabled: false,
      automaticPagination: false,
      rawProviderToolExposure: false,
      serviceAccountsEnabled: false,
      delegationEnabled: false,
      redactionStatus: "private-state-excluded",
    };
  }
  private siteUrl(value: unknown) {
    if (typeof value !== "string" || value.length > 2048)
      throw new GoogleSearchConsoleApiError(
        "provider_validation_error",
        "siteUrl must be the selected Search Console property.",
      );
    if (
      /^sc-domain:[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?$/i.test(value) &&
      !value.includes("..")
    )
      return value.toLowerCase();
    try {
      const url = new URL(value);
      if (
        (url.protocol === "https:" || url.protocol === "http:") &&
        url.hostname &&
        !url.username &&
        !url.password &&
        !url.hash
      )
        return value;
    } catch {}
    throw new GoogleSearchConsoleApiError(
      "provider_validation_error",
      "siteUrl must be an HTTP(S) URL-prefix or sc-domain property.",
    );
  }
  private containedUrl(value: unknown, siteUrl: string, label: string) {
    if (typeof value !== "string" || value.length > 2048)
      throw new GoogleSearchConsoleApiError(
        "provider_validation_error",
        `${label} must be a bounded absolute URL.`,
      );
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new GoogleSearchConsoleApiError(
        "provider_validation_error",
        `${label} must be an absolute HTTP(S) URL.`,
      );
    }
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.hash
    )
      throw new GoogleSearchConsoleApiError(
        "provider_validation_error",
        `${label} must be a safe HTTP(S) URL.`,
      );
    if (siteUrl.startsWith("sc-domain:")) {
      const domain = siteUrl.slice(10).toLowerCase();
      const host = url.hostname.toLowerCase();
      if (host !== domain && !host.endsWith(`.${domain}`))
        throw new GoogleSearchConsoleApiError(
          "provider_validation_error",
          `${label} is outside the selected domain property.`,
        );
    } else if (!value.startsWith(siteUrl))
      throw new GoogleSearchConsoleApiError(
        "provider_validation_error",
        `${label} is outside the selected URL-prefix property.`,
      );
    return value;
  }
  private dateRange(start: unknown, end: unknown) {
    const parse = (value: unknown, label: string) => {
      if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
        throw new GoogleSearchConsoleApiError(
          "provider_validation_error",
          `${label} must use YYYY-MM-DD.`,
        );
      const date = new Date(`${value}T00:00:00Z`);
      if (
        !Number.isFinite(date.getTime()) ||
        date.toISOString().slice(0, 10) !== value
      )
        throw new GoogleSearchConsoleApiError(
          "provider_validation_error",
          `${label} is not a valid date.`,
        );
      return date;
    };
    const a = parse(start, "startDate");
    const b = parse(end, "endDate");
    const days = Math.floor((b.getTime() - a.getTime()) / 86400000) + 1;
    if (days < 1 || days > 28)
      throw new GoogleSearchConsoleApiError(
        "provider_validation_error",
        "Search Analytics date range must contain one to twenty-eight days.",
      );
    return {
      startDate: a.toISOString().slice(0, 10),
      endDate: b.toISOString().slice(0, 10),
    };
  }
  private dimensions(value: unknown) {
    const dimensions =
      value === undefined ? ["query"] : this.strings(value, 5, 32);
    const allowed = new Set([
      "query",
      "page",
      "date",
      "country",
      "device",
      "searchAppearance",
    ]);
    if (
      !dimensions.length ||
      new Set(dimensions).size !== dimensions.length ||
      dimensions.some((item) => !allowed.has(item))
    )
      throw new GoogleSearchConsoleApiError(
        "provider_validation_error",
        "dimensions must contain one to five unique allowlisted values.",
      );
    return dimensions;
  }
  private languageCode(value: unknown) {
    if (
      typeof value !== "string" ||
      !/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(value)
    )
      throw new GoogleSearchConsoleApiError(
        "provider_validation_error",
        "languageCode must be BCP-47 shaped.",
      );
    return value;
  }
  private choice(value: unknown, allowed: string[], fallback: string) {
    if (value === undefined) return fallback;
    if (typeof value !== "string" || !allowed.includes(value))
      throw new GoogleSearchConsoleApiError(
        "provider_validation_error",
        "Search Console query option is not allowlisted.",
      );
    return value;
  }
  private integer(value: unknown, fallback: number, min: number, max: number) {
    const result = value === undefined ? fallback : value;
    if (
      typeof result !== "number" ||
      !Number.isInteger(result) ||
      result < min ||
      result > max
    )
      throw new GoogleSearchConsoleApiError(
        "provider_validation_error",
        `Value must be an integer from ${min} to ${max}.`,
      );
    return result;
  }
  private token(value: string) {
    if (!value || value.length > 8000)
      throw new GoogleSearchConsoleApiError(
        "credential_missing",
        "A Google OAuth access token is required.",
        401,
      );
  }
  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }
  private array(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }
  private strings(value: unknown, count: number, length: number): string[] {
    return this.array(value)
      .slice(0, count)
      .filter(
        (item): item is string =>
          typeof item === "string" && item.length <= length,
      );
  }
  private scalar(
    value: unknown,
    max: number,
  ): string | number | boolean | null {
    if (typeof value === "string" && value.length <= max) return value;
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "boolean") return value;
    return null;
  }
  private number(value: unknown): number | null {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }
}
