import { Injectable } from "@nestjs/common";
import { createHmac, randomBytes } from "node:crypto";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type HttpClient = (url: string, init: RequestInit) => Promise<Response>;
type Clock = () => number;
type NonceFactory = () => string;

export type NetSuiteCredentials = {
  accountId: string;
  suiteTalkOrigin: string;
  consumerKey: string;
  consumerSecret: string;
  tokenId: string;
  tokenSecret: string;
};

const ACCOUNT_ID = /^[a-z0-9]+(?:_[a-z0-9]+)*$/i;
const RECORD_FIELDS = [
  "id",
  "periodName",
  "startDate",
  "endDate",
  "closed",
  "isAdjust",
  "isInactive",
  "isPosting",
];

export class NetSuiteApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
  }
}

@Injectable()
export class NetSuiteApiAdapter {
  constructor(
    private readonly request: HttpClient = fetch,
    private readonly clock: Clock = () => Math.floor(Date.now() / 1000),
    private readonly nonce: NonceFactory = () =>
      randomBytes(18).toString("hex"),
  ) {}

  async health(credentials: NetSuiteCredentials) {
    const result = await this.listAccountingPeriods(credentials, { limit: 1 });
    return {
      accountId: this.credentials(credentials).accountId,
      reachable: true,
      recordCount: result.periods.length,
    };
  }

  async listAccountingPeriods(
    credentials: NetSuiteCredentials,
    input: JsonObject,
  ) {
    const limit = this.limit(input.limit);
    const query = new URLSearchParams({
      limit: String(limit),
      offset: "0",
      fields: RECORD_FIELDS.join(","),
    });
    const data = await this.send(
      credentials,
      "GET",
      "/services/rest/record/v1/accountingperiod",
      query,
    );
    const rows = Array.isArray(data.items) ? data.items : [];
    return {
      accountId: this.credentials(credentials).accountId,
      periods: rows
        .slice(0, limit)
        .map((value) => this.accountingPeriod(this.object(value))),
      hasMore: data.hasMore === true,
      nextPageFollowed: false,
    };
  }

  async getAccountingPeriod(
    credentials: NetSuiteCredentials,
    input: JsonObject,
  ) {
    const periodId = this.recordId(input.periodId);
    const query = new URLSearchParams({ fields: RECORD_FIELDS.join(",") });
    const data = await this.send(
      credentials,
      "GET",
      `/services/rest/record/v1/accountingperiod/${encodeURIComponent(periodId)}`,
      query,
    );
    const period = this.accountingPeriod(data);
    if (period.periodId !== periodId) {
      throw new NetSuiteApiError(
        "provider_validation_error",
        "NetSuite returned an accounting period outside the requested binding.",
      );
    }
    return {
      accountId: this.credentials(credentials).accountId,
      period,
    };
  }

  private async send(
    credentials: NetSuiteCredentials,
    method: "GET",
    path:
      | "/services/rest/record/v1/accountingperiod"
      | `/services/rest/record/v1/accountingperiod/${string}`,
    query: URLSearchParams,
  ): Promise<JsonObject> {
    const validated = this.credentials(credentials);
    const url = new URL(`${validated.suiteTalkOrigin}${path}`);
    url.search = query.toString();
    let response: Response;
    try {
      response = await this.request(url.toString(), {
        method,
        headers: {
          Accept: "application/json",
          Authorization: this.authorization(validated, method, url),
          "User-Agent": "RelayConsole/1.0 (https://relayconsole.work)",
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new NetSuiteApiError(
        "provider_unavailable",
        "NetSuite is temporarily unavailable.",
        502,
      );
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 2_000_000) {
      throw new NetSuiteApiError(
        "provider_validation_error",
        "NetSuite response exceeded the safe size limit.",
      );
    }
    if (!response.ok) {
      throw new NetSuiteApiError(
        response.status === 401
          ? "credential_missing"
          : response.status === 403
            ? "insufficient_scope"
            : response.status === 429
              ? "provider_rate_limited"
              : response.status >= 500
                ? "provider_unavailable"
                : "provider_validation_error",
        "NetSuite API request failed.",
        response.status,
      );
    }
    try {
      return this.object(raw ? JSON.parse(raw) : {});
    } catch {
      throw new NetSuiteApiError(
        "provider_validation_error",
        "NetSuite returned an invalid response.",
      );
    }
  }

  private authorization(
    credentials: ReturnType<NetSuiteApiAdapter["credentials"]>,
    method: "GET",
    url: URL,
  ) {
    const oauth: Record<string, string> = {
      oauth_consumer_key: credentials.consumerKey,
      oauth_nonce: this.nonce(),
      oauth_signature_method: "HMAC-SHA256",
      oauth_timestamp: String(this.clock()),
      oauth_token: credentials.tokenId,
      oauth_version: "1.0",
    };
    const parameters = [
      ...Array.from(url.searchParams.entries()),
      ...Object.entries(oauth),
    ]
      .map(([key, value]) => [this.encode(key), this.encode(value)] as const)
      .sort(([leftKey, leftValue], [rightKey, rightValue]) =>
        leftKey === rightKey
          ? leftValue.localeCompare(rightValue)
          : leftKey.localeCompare(rightKey),
      )
      .map(([key, value]) => `${key}=${value}`)
      .join("&");
    const baseUrl = `${url.origin}${url.pathname}`;
    const baseString = [
      method,
      this.encode(baseUrl),
      this.encode(parameters),
    ].join("&");
    const key = `${this.encode(credentials.consumerSecret)}&${this.encode(credentials.tokenSecret)}`;
    const signature = createHmac("sha256", key)
      .update(baseString)
      .digest("base64");
    const header = {
      realm: credentials.accountId,
      oauth_token: oauth.oauth_token,
      oauth_consumer_key: oauth.oauth_consumer_key,
      oauth_nonce: oauth.oauth_nonce,
      oauth_timestamp: oauth.oauth_timestamp,
      oauth_signature_method: oauth.oauth_signature_method,
      oauth_version: oauth.oauth_version,
      oauth_signature: signature,
    };
    return `OAuth ${Object.entries(header)
      .map(([name, value]) => `${name}="${this.encode(value)}"`)
      .join(", ")}`;
  }

  private credentials(credentials: NetSuiteCredentials) {
    const accountId = credentials.accountId.trim().toUpperCase();
    if (
      !ACCOUNT_ID.test(accountId) ||
      accountId.length > 64 ||
      !credentials.suiteTalkOrigin.trim()
    ) {
      throw new NetSuiteApiError(
        "provider_validation_error",
        "A valid NetSuite account ID and SuiteTalk origin are required.",
      );
    }
    let origin: URL;
    try {
      origin = new URL(credentials.suiteTalkOrigin.trim());
    } catch {
      throw new NetSuiteApiError(
        "provider_validation_error",
        "NetSuite SuiteTalk origin is invalid.",
      );
    }
    const expectedHost = `${accountId.toLowerCase().replaceAll("_", "-")}.suitetalk.api.netsuite.com`;
    if (
      origin.protocol !== "https:" ||
      origin.hostname !== expectedHost ||
      origin.port ||
      origin.username ||
      origin.password ||
      origin.pathname !== "/" ||
      origin.search ||
      origin.hash
    ) {
      throw new NetSuiteApiError(
        "provider_validation_error",
        "NetSuite SuiteTalk origin does not match the exact account binding.",
      );
    }
    const secrets = [
      credentials.consumerKey,
      credentials.consumerSecret,
      credentials.tokenId,
      credentials.tokenSecret,
    ];
    if (secrets.some((value) => !value.trim() || value.length > 8192)) {
      throw new NetSuiteApiError(
        "credential_missing",
        "NetSuite Token-Based Authentication credentials are missing or invalid.",
      );
    }
    return {
      accountId,
      suiteTalkOrigin: origin.origin,
      consumerKey: credentials.consumerKey,
      consumerSecret: credentials.consumerSecret,
      tokenId: credentials.tokenId,
      tokenSecret: credentials.tokenSecret,
    };
  }

  private accountingPeriod(row: JsonObject) {
    return {
      periodId: this.text(row.id),
      name: this.text(row.periodName ?? row.periodname),
      startDate: this.text(row.startDate ?? row.startdate),
      endDate: this.text(row.endDate ?? row.enddate),
      closed: this.boolean(row.closed),
      adjustment: this.boolean(row.isAdjust ?? row.isadjust),
      inactive: this.boolean(row.isInactive ?? row.isinactive),
      posting: this.boolean(row.isPosting ?? row.isposting),
    };
  }

  private recordId(value: unknown) {
    if (typeof value !== "string" || !/^[1-9][0-9]{0,19}$/.test(value)) {
      throw new NetSuiteApiError(
        "provider_validation_error",
        "A valid NetSuite accounting-period ID is required.",
      );
    }
    return value;
  }

  private limit(value: unknown) {
    if (value === undefined) return 25;
    if (
      !Number.isSafeInteger(value) ||
      Number(value) < 1 ||
      Number(value) > 25
    ) {
      throw new NetSuiteApiError(
        "provider_validation_error",
        "NetSuite result limit is outside the supported range.",
      );
    }
    return Number(value);
  }

  private encode(value: string) {
    return encodeURIComponent(value).replace(
      /[!'()*]/g,
      (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
    );
  }

  private text(value: unknown) {
    return typeof value === "string" ? value.slice(0, 512) : null;
  }

  private boolean(value: unknown) {
    return typeof value === "boolean" ? value : null;
  }

  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }
}
