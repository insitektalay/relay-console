import { safeConnectorFetch } from "../safe-connector-fetch";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export const GOOGLE_MERCHANT_CENTER_FIXED_REPORT_BODY = {
  query:
    "SELECT product_view.id, product_view.title, product_view.aggregated_reporting_context_status, product_view.item_issues FROM product_view LIMIT 50",
  pageSize: 50,
};

export class GoogleMerchantCenterApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class GoogleMerchantCenterApiAdapter {
  private readonly origin = "https://merchantapi.googleapis.com";
  health(token: string) {
    this.token(token);
    return {
      stableV1Only: true,
      readOnlyV1: true,
      explicitAccountOnly: true,
      providerScopeCanWrite: true,
      writesEnabled: false,
      providerRequestCount: 0,
    };
  }

  async listAccounts(token: string) {
    const value = await this.request(
      token,
      "GET",
      `${this.origin}/accounts/v1/accounts?pageSize=50`,
    );
    const all = this.array(value.accounts);
    return {
      semanticReadContract: "google-merchant-center-accounts-v1",
      accounts: all.slice(0, 50).map((item) => this.account(item)),
      resultCount: Math.min(all.length, 50),
      truncated: Boolean(value.nextPageToken) || all.length > 50,
      nextPageFollowed: false,
      ...this.boundary(),
      providerRequestCount: 1,
    };
  }

  async listProducts(token: string, input: JsonObject) {
    const accountName = this.accountName(input.accountName);
    const value = await this.request(
      token,
      "GET",
      `${this.origin}/products/v1/${accountName}/products?pageSize=50`,
    );
    const all = this.array(value.products);
    return {
      semanticReadContract: "google-merchant-center-products-v1",
      accountName,
      products: all.slice(0, 50).map((item) => this.product(item)),
      resultCount: Math.min(all.length, 50),
      truncated: Boolean(value.nextPageToken) || all.length > 50,
      nextPageFollowed: false,
      ...this.boundary(),
      providerRequestCount: 1,
    };
  }

  async getProduct(token: string, input: JsonObject) {
    const accountName = this.accountName(input.accountName);
    const productName = this.productName(input.productName, accountName);
    const value = await this.request(
      token,
      "GET",
      `${this.origin}/products/v1/${productName}`,
    );
    return {
      semanticReadContract: "google-merchant-center-product-v1",
      accountName,
      product: this.product(value),
      ...this.boundary(),
      providerRequestCount: 1,
    };
  }

  async reviewProductIssues(token: string, input: JsonObject) {
    const accountName = this.accountName(input.accountName);
    const value = await this.request(
      token,
      "POST",
      `${this.origin}/reports/v1/${accountName}/reports:search`,
      GOOGLE_MERCHANT_CENTER_FIXED_REPORT_BODY,
    );
    const all = this.array(value.results);
    return {
      semanticReadContract: "google-merchant-center-fixed-product-issues-v1",
      accountName,
      rows: all.slice(0, 50).map((item) => this.issueRow(item)),
      resultCount: Math.min(all.length, 50),
      queryMode: "fixed_product_issues_v1",
      truncated: Boolean(value.nextPageToken) || all.length > 50,
      nextPageFollowed: false,
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
    const safeAccounts =
      method === "GET" &&
      url.pathname === "/accounts/v1/accounts" &&
      url.searchParams.get("pageSize") === "50" &&
      [...url.searchParams].length === 1;
    const safeProducts =
      method === "GET" &&
      /^\/products\/v1\/accounts\/[0-9]+\/products(?:\/[^/]+)?$/.test(
        url.pathname,
      ) &&
      (url.search === "" ||
        (url.searchParams.get("pageSize") === "50" &&
          [...url.searchParams].length === 1));
    const safeReport =
      method === "POST" &&
      /^\/reports\/v1\/accounts\/[0-9]+\/reports:search$/.test(url.pathname) &&
      !url.search &&
      JSON.stringify(body) ===
        JSON.stringify(GOOGLE_MERCHANT_CENTER_FIXED_REPORT_BODY);
    if (
      url.protocol !== "https:" ||
      url.hostname !== "merchantapi.googleapis.com" ||
      url.pathname.includes("v1beta") ||
      url.pathname.includes("content/") ||
      url.searchParams.has("pageToken") ||
      (!safeAccounts && !safeProducts && !safeReport)
    )
      throw new GoogleMerchantCenterApiError(
        "provider_validation_error",
        "Merchant API URL or query is outside the stable-v1 allowlist.",
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
        signal: AbortSignal.timeout(30000),
      });
    } catch {
      throw new GoogleMerchantCenterApiError(
        "provider_unavailable",
        "Merchant API could not be reached.",
        502,
      );
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 1000000)
      throw new GoogleMerchantCenterApiError(
        "provider_validation_error",
        "Merchant API response exceeded Relay's 1 MB bound.",
      );
    if (!response.ok)
      throw new GoogleMerchantCenterApiError(
        response.status === 401
          ? "token_expired"
          : response.status === 403
            ? "insufficient_scope"
            : response.status === 429
              ? "provider_rate_limited"
              : response.status >= 500
                ? "provider_unavailable"
                : "provider_validation_error",
        "Merchant API rejected the bounded read request.",
        response.status,
      );
    try {
      return this.object(raw ? JSON.parse(raw) : {});
    } catch {
      throw new GoogleMerchantCenterApiError(
        "provider_validation_error",
        "Merchant API returned invalid JSON.",
      );
    }
  }

  private account(value: unknown) {
    const item = this.object(value);
    return {
      name: this.scalar(item.name, 64),
      accountName: this.scalar(item.accountName, 256),
      timeZone: this.timeZone(item.timeZone),
      languageCode: this.scalar(item.languageCode, 16),
      accountIdReturned: false,
      testAccountReturned: false,
      adultContentReturned: false,
      redactionStatus: "private-state-excluded",
    };
  }
  private product(value: unknown) {
    const item = this.object(value);
    const attributes = this.object(item.productAttributes);
    const status = this.object(item.productStatus);
    return {
      name: this.scalar(item.name, 512),
      offerId: this.scalar(item.offerId, 128),
      contentLanguage: this.scalar(item.contentLanguage, 8),
      feedLabel: this.scalar(item.feedLabel, 20),
      dataSource: this.scalar(item.dataSource, 512),
      title: this.scalar(attributes.title, 512),
      link: this.scalar(attributes.link, 2048),
      imageLink: this.scalar(attributes.imageLink, 2048),
      availability: this.scalar(attributes.availability, 64),
      price: this.price(attributes.price),
      brand: this.scalar(attributes.brand, 128),
      gtin: this.strings(attributes.gtin, 20, 128),
      mpn: this.scalar(attributes.mpn, 128),
      destinationStatuses: this.array(status.destinationStatuses)
        .slice(0, 20)
        .map((entry) => this.destinationStatus(entry)),
      itemLevelIssues: this.array(status.itemLevelIssues)
        .slice(0, 20)
        .map((entry) => this.itemIssue(entry)),
      customAttributesReturned: false,
      automatedDiscountsReturned: false,
      versionNumberReturned: false,
      redactionStatus: "private-state-excluded",
    };
  }
  private issueRow(value: unknown) {
    const item = this.object(value);
    const view = this.object(item.productView);
    return {
      offerId: this.scalar(view.id ?? view.offerId, 128),
      title: this.scalar(view.title, 512),
      aggregatedStatus: this.scalar(view.aggregatedReportingContextStatus, 64),
      itemIssues: this.array(view.itemIssues)
        .slice(0, 20)
        .map((entry) => this.itemIssue(entry)),
      redactionStatus: "private-state-excluded",
    };
  }
  private destinationStatus(value: unknown) {
    const item = this.object(value);
    return {
      reportingContext: this.scalar(item.reportingContext, 64),
      approvedCountries: this.strings(item.approvedCountries, 50, 2),
      pendingCountries: this.strings(item.pendingCountries, 50, 2),
      disapprovedCountries: this.strings(item.disapprovedCountries, 50, 2),
    };
  }
  private itemIssue(value: unknown) {
    const item = this.object(value);
    const type = this.object(item.type);
    return {
      code: this.scalar(item.code ?? type.code, 128),
      severity: this.scalar(item.severity ?? item.aggregatedSeverity, 64),
      resolution: this.scalar(item.resolution, 64),
      attribute: this.scalar(item.attribute, 128),
      reportingContext: this.scalar(item.reportingContext, 64),
      description: this.scalar(item.description, 512),
      detail: this.scalar(item.detail, 1024),
      documentation: this.scalar(item.documentation, 2048),
      applicableCountries: this.strings(item.applicableCountries, 50, 2),
    };
  }
  private price(value: unknown) {
    const item = this.object(value);
    return {
      amountMicros: this.intString(item.amountMicros),
      currencyCode: this.scalar(item.currencyCode, 3),
    };
  }
  private timeZone(value: unknown) {
    if (typeof value === "string") return value.slice(0, 64);
    const item = this.object(value);
    return {
      id: this.scalar(item.id, 64),
      version: this.scalar(item.version, 32),
    };
  }
  private boundary() {
    return {
      stableV1Only: true,
      readOnlyV1: true,
      explicitAccountOnly: true,
      fixedReportsOnly: true,
      maxRows: 50,
      providerScopeCanWrite: true,
      writesEnabled: false,
      arbitraryQueryEnabled: false,
      automaticPagination: false,
      rawProviderToolExposure: false,
      serviceAccountEnabled: false,
      v1BetaEnabled: false,
      contentApiEnabled: false,
      redactionStatus:
        "mutations-admin-arbitrary-query-pagination-raw-service-account-legacy-excluded",
    };
  }
  private accountName(value: unknown) {
    if (typeof value !== "string" || !/^accounts\/[0-9]{1,32}$/.test(value))
      throw new GoogleMerchantCenterApiError(
        "provider_validation_error",
        "accountName must use accounts/{numeric id}.",
      );
    return value;
  }
  private productName(value: unknown, account: string) {
    if (
      typeof value !== "string" ||
      value.length > 512 ||
      !value.startsWith(`${account}/products/`) ||
      !/^accounts\/[0-9]+\/products\/[^/?]+$/.test(value) ||
      value.includes("..")
    )
      throw new GoogleMerchantCenterApiError(
        "provider_validation_error",
        "productName must identify one product under the bound account.",
      );
    return value;
  }
  private token(value: string) {
    if (!value || value.length > 8000)
      throw new GoogleMerchantCenterApiError(
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
  private strings(value: unknown, count: number, max: number): string[] {
    return this.array(value)
      .slice(0, count)
      .filter(
        (entry): entry is string =>
          typeof entry === "string" && entry.length <= max,
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
  private intString(value: unknown) {
    return typeof value === "string" && /^-?\d{1,20}$/.test(value)
      ? value
      : null;
  }
}
