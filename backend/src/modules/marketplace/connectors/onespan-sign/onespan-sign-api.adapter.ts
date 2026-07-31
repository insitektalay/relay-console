import { createHash } from "node:crypto";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type HttpClient = (url: string, init: RequestInit) => Promise<Response>;

export type OneSpanSignCredentials = {
  clientId: string;
  clientSecret: string;
  environment: string;
};

const ENVIRONMENTS: Record<string, string> = {
  "us2-sandbox": "https://sandbox.esignlive.com",
  "us1-sandbox": "https://sandbox.e-signlive.com",
  "us2-production": "https://apps.esignlive.com",
  "us1-production": "https://apps.e-signlive.com",
  "eu-production": "https://apps.esignlive.eu",
  "canada-sandbox": "https://sandbox.e-signlive.ca",
  "canada-production": "https://apps.e-signlive.ca",
  "australia-production": "https://apps.esignlive.com.au",
};

export class OneSpanSignApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class OneSpanSignApiAdapter {
  private readonly tokens = new Map<
    string,
    { accessToken: string; expiresAt: number }
  >();
  constructor(private readonly request: HttpClient = fetch) {}

  async health(credentials: OneSpanSignCredentials) {
    await this.listTransactions(credentials, {
      status: "SENT",
      resultLimit: 1,
    });
    return {
      clientCredentialsVerified: true,
      providerRequestCount: 2,
      refreshTokensSupported: false,
      oauthScopesAvailable: false,
    };
  }

  async listTransactions(
    credentials: OneSpanSignCredentials,
    input: JsonObject,
  ) {
    const status = this.status(input.status);
    const limit = this.limit(input.resultLimit);
    const query = new URLSearchParams({
      from: "1",
      to: String(limit),
      query: status,
    });
    const value = await this.get(credentials, `/api/packages?${query}`);
    const transactions = this.array(value.results)
      .slice(0, limit)
      .map((entry) => this.summary(this.object(entry)));
    return {
      semanticReadContract: "onespan-sign-transaction-list-v1",
      transactions,
      resultCount: transactions.length,
      maxResults: limit,
      status,
      ...this.boundary(),
      providerRequestCount: 2,
    };
  }

  async getTransaction(credentials: OneSpanSignCredentials, input: JsonObject) {
    const id = this.id(input.transactionId);
    const value = await this.get(
      credentials,
      `/api/packages/${encodeURIComponent(id)}`,
    );
    return {
      semanticReadContract: "onespan-sign-transaction-get-v1",
      transaction: this.summary(value),
      ...this.boundary(),
      providerRequestCount: 2,
    };
  }

  private async get(credentials: OneSpanSignCredentials, target: string) {
    const origin = this.origin(credentials.environment);
    const url = new URL(target, `${origin}/`);
    const listAllowed =
      url.pathname === "/api/packages" &&
      [...url.searchParams.keys()].every((key) =>
        ["from", "to", "query"].includes(key),
      );
    const getAllowed =
      /^\/api\/packages\/[A-Za-z0-9_-]+(?:%3D){0,2}$/i.test(url.pathname) &&
      !url.search;
    if (url.origin !== origin || url.hash || (!listAllowed && !getAllowed))
      throw new OneSpanSignApiError(
        "policy_blocked",
        "OneSpan Sign request escaped Relay's fixed read-only route allowlist.",
      );
    const token = await this.accessToken(credentials, origin);
    return await this.fetchJson(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      redirect: "error",
      signal: AbortSignal.timeout(30_000),
      cache: "no-store",
    });
  }

  private async accessToken(
    credentials: OneSpanSignCredentials,
    origin: string,
  ) {
    this.requireCredentials(credentials);
    const key = createHash("sha256")
      .update(`${origin}\0${credentials.clientId}\0${credentials.clientSecret}`)
      .digest("hex");
    const cached = this.tokens.get(key);
    if (cached && cached.expiresAt > Date.now() + 30_000)
      return cached.accessToken;
    const authorization = Buffer.from(
      `${credentials.clientId}:${credentials.clientSecret}`,
      "utf8",
    ).toString("base64");
    const value = await this.fetchJson(`${origin}/oauth2/token`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Basic ${authorization}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    const accessToken = this.string(value.access_token);
    const expiresIn = this.number(value.expires_in);
    if (!accessToken || !expiresIn || expiresIn < 1)
      throw new OneSpanSignApiError(
        "token_refresh_failed",
        "OneSpan Sign did not return a usable short-lived access token.",
      );
    this.tokens.set(key, {
      accessToken,
      expiresAt: Date.now() + Math.min(expiresIn, 300) * 1_000,
    });
    return accessToken;
  }

  private async fetchJson(url: string, init: RequestInit) {
    let response: Response;
    try {
      response = await this.request(url, init);
    } catch {
      throw new OneSpanSignApiError(
        "provider_unavailable",
        "OneSpan Sign could not be reached.",
        502,
      );
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 1_000_000)
      throw this.validation(
        "OneSpan Sign response exceeded Relay's 1 MB bound.",
      );
    let value: JsonObject;
    try {
      value = this.object(raw ? JSON.parse(raw) : {});
    } catch {
      throw this.validation("OneSpan Sign returned invalid JSON.");
    }
    if (!response.ok)
      throw new OneSpanSignApiError(
        this.errorCode(response.status),
        "OneSpan Sign rejected the bounded request.",
        response.status,
      );
    return value;
  }

  private summary(value: JsonObject) {
    return {
      transactionId: this.scalar(value.id, 128),
      name: this.scalar(value.name, 512),
      status: this.scalar(value.status, 64),
      type: this.scalar(value.type, 64),
      createdAt: this.timestamp(value.created),
      updatedAt: this.timestamp(value.updated),
      completedAt: this.timestamp(value.completed),
      dueAt: this.timestamp(value.due),
      trashed: typeof value.trashed === "boolean" ? value.trashed : null,
    };
  }
  private boundary() {
    return {
      customerOwnedClientCredentials: true,
      oauthScopesAvailable: false,
      refreshTokensSupported: false,
      writesEnabled: false,
      peopleReturned: false,
      documentsReturned: false,
      signingUrlsReturned: false,
      evidenceReturned: false,
      rawProviderToolExposure: false,
      automaticPagination: false,
      automaticRetries: false,
      redactionStatus:
        "people-documents-signing-evidence-writes-broad-authority-raw-excluded",
    };
  }
  private requireCredentials(value: OneSpanSignCredentials) {
    if (
      !value.clientId ||
      !value.clientSecret ||
      value.clientId.length > 500 ||
      value.clientSecret.length > 2_000
    )
      throw new OneSpanSignApiError(
        "credential_missing",
        "OneSpan Sign client credentials are missing.",
        401,
      );
  }
  private origin(value: string) {
    const origin = ENVIRONMENTS[value];
    if (!origin) throw this.validation("OneSpan Sign environment is invalid.");
    return origin;
  }
  private status(value: unknown) {
    if (
      typeof value !== "string" ||
      !new Set([
        "DRAFT",
        "SENT",
        "COMPLETED",
        "ARCHIVED",
        "DECLINED",
        "OPTED_OUT",
        "EXPIRED",
      ]).has(value)
    )
      throw this.validation("status is invalid.");
    return value;
  }
  private limit(value: unknown) {
    if (value === undefined) return 25;
    if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 25)
      throw this.validation("resultLimit must be an integer from 1 to 25.");
    return Number(value);
  }
  private id(value: unknown) {
    if (
      typeof value !== "string" ||
      !/^[A-Za-z0-9_-]+={0,2}$/.test(value) ||
      value.length > 128
    )
      throw this.validation("transactionId is invalid.");
    return value;
  }
  private scalar(value: unknown, max: number) {
    return typeof value === "string" && value ? value.slice(0, max) : null;
  }
  private timestamp(value: unknown) {
    return (typeof value === "string" && value.length <= 64) ||
      (typeof value === "number" && Number.isFinite(value))
      ? value
      : null;
  }
  private string(value: unknown) {
    return typeof value === "string" && value ? value : null;
  }
  private number(value: unknown) {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }
  private errorCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
  private validation(message: string) {
    return new OneSpanSignApiError("provider_validation_error", message);
  }
  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }
  private array(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }
}
