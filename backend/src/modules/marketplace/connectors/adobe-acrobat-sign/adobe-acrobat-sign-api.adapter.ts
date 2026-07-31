import { safeConnectorFetch } from "../safe-connector-fetch";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;

export class AdobeAcrobatSignApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class AdobeAcrobatSignApiAdapter {
  async health(accessToken: string, apiOrigin: string) {
    const value = await this.request(
      accessToken,
      apiOrigin,
      "/api/rest/v6/base_uris",
    );
    const returned = this.apiOrigin(
      this.scalar(value.apiAccessPoint, 500) ?? "",
    );
    if (returned !== this.apiOrigin(apiOrigin))
      throw new AdobeAcrobatSignApiError(
        "provider_validation_error",
        "Adobe Acrobat Sign returned a different API shard.",
      );
    return { shardBound: true, providerRequestCount: 1, writesEnabled: false };
  }

  async listAgreements(
    accessToken: string,
    apiOrigin: string,
    input: JsonObject,
  ) {
    const pageSize = this.pageSize(input.pageSize);
    const value = await this.request(
      accessToken,
      apiOrigin,
      `/api/rest/v6/agreements?pageSize=${pageSize}`,
    );
    const agreements = this.array(value.userAgreementList)
      .slice(0, pageSize)
      .map((entry) => this.summary(this.object(entry)));
    return {
      semanticReadContract: "adobe-acrobat-sign-agreement-list-v1",
      agreements,
      resultCount: agreements.length,
      maxResults: pageSize,
      ...this.boundary(),
      providerRequestCount: 1,
    };
  }

  async getAgreement(
    accessToken: string,
    apiOrigin: string,
    input: JsonObject,
  ) {
    const agreementId = this.agreementId(input.agreementId);
    const value = await this.request(
      accessToken,
      apiOrigin,
      `/api/rest/v6/agreements/${encodeURIComponent(agreementId)}`,
    );
    return {
      semanticReadContract: "adobe-acrobat-sign-agreement-get-v1",
      agreement: this.summary(value),
      ...this.boundary(),
      providerRequestCount: 1,
    };
  }

  apiOrigin(value: string) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw this.validation("Adobe Acrobat Sign API shard is invalid.");
    }
    const hostname = url.hostname.toLowerCase();
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      (url.pathname !== "/" && url.pathname !== "") ||
      url.search ||
      url.hash ||
      !/^api(?:\.[a-z0-9-]{1,32})?\.(?:adobesign|echosign)\.com$/.test(hostname)
    )
      throw new AdobeAcrobatSignApiError(
        "policy_blocked",
        "Adobe Acrobat Sign API shard is outside the documented HTTPS API domains.",
      );
    return `https://${hostname}`;
  }

  private async request(
    accessToken: string,
    apiOriginValue: string,
    target: string,
  ) {
    if (!accessToken || accessToken.length > 10_000)
      throw new AdobeAcrobatSignApiError(
        "credential_missing",
        "Adobe Acrobat Sign access token is missing.",
        401,
      );
    const apiOrigin = this.apiOrigin(apiOriginValue);
    const url = new URL(target, `${apiOrigin}/`);
    const validList =
      url.pathname === "/api/rest/v6/agreements" &&
      [...url.searchParams.keys()].every((key) => key === "pageSize") &&
      url.searchParams.has("pageSize");
    const validGet =
      /^\/api\/rest\/v6\/agreements\/[^/]{1,768}$/.test(url.pathname) &&
      !url.search;
    const validHealth =
      url.pathname === "/api/rest/v6/base_uris" && !url.search;
    if (
      url.origin !== apiOrigin ||
      url.hash ||
      !(validList || validGet || validHealth)
    )
      throw new AdobeAcrobatSignApiError(
        "policy_blocked",
        "Adobe Acrobat Sign request escaped Relay's fixed read-only route allowlist.",
      );
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
        cache: "no-store",
      });
    } catch {
      throw new AdobeAcrobatSignApiError(
        "provider_unavailable",
        "Adobe Acrobat Sign could not be reached.",
        502,
      );
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 1_000_000)
      throw this.validation(
        "Adobe Acrobat Sign response exceeded Relay's 1 MB bound.",
      );
    let value: JsonObject;
    try {
      value = this.object(raw ? JSON.parse(raw) : {});
    } catch {
      throw this.validation("Adobe Acrobat Sign returned invalid JSON.");
    }
    if (!response.ok)
      throw new AdobeAcrobatSignApiError(
        this.errorCode(response.status),
        "Adobe Acrobat Sign rejected the bounded request.",
        response.status,
      );
    return value;
  }

  private summary(value: JsonObject) {
    return {
      agreementId: this.scalar(value.id, 256),
      name: this.scalar(value.name, 512),
      status: this.scalar(value.status, 96),
      type: this.scalar(value.type, 96),
      createdDate: this.date(value.createdDate),
      displayDate: this.date(value.displayDate),
      modifiedDate: this.date(value.modifiedDate),
      latestVersionId: this.scalar(value.latestVersionId, 256),
    };
  }

  private boundary() {
    return {
      selfScopeOnly: true,
      writesEnabled: false,
      participantIdentityReturned: false,
      documentsReturned: false,
      signingUrlsReturned: false,
      auditTrailReturned: false,
      rawProviderToolExposure: false,
      automaticPagination: false,
      automaticRetries: false,
      redactionStatus:
        "participants-documents-signing-audit-writes-broader-authority-raw-excluded",
    };
  }

  private pageSize(value: unknown) {
    if (value === undefined) return 25;
    if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 25)
      throw this.validation("pageSize must be an integer from 1 to 25.");
    return Number(value);
  }

  private agreementId(value: unknown) {
    if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,256}$/.test(value))
      throw this.validation("agreementId is invalid.");
    return value;
  }

  private date(value: unknown) {
    if (
      typeof value !== "string" ||
      value.length > 64 ||
      Number.isNaN(Date.parse(value))
    )
      return null;
    return value;
  }

  private errorCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 404) return "provider_validation_error";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private validation(message: string) {
    return new AdobeAcrobatSignApiError("provider_validation_error", message);
  }

  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }

  private array(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }

  private scalar(value: unknown, max: number) {
    return typeof value === "string" && value ? value.slice(0, max) : null;
  }
}
