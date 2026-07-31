import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type HttpClient = (url: string, init: RequestInit) => Promise<Response>;

export type SageIntacctCredentials = {
  clientId: string;
  clientSecret: string;
  username: string;
};

const API_ORIGIN = "https://api.intacct.com";
const TOKEN_PATH = "/ia/api/v1/oauth2/token";
const REPORTING_PERIOD_PATH =
  "/ia/api/v1/objects/general-ledger/reporting-period";
const OPAQUE_KEY = /^[A-Za-z0-9_-]{1,200}$/;

export class SageIntacctApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
  }
}

@Injectable()
export class SageIntacctApiAdapter {
  constructor(private readonly request: HttpClient = fetch) {}

  async health(credentials: SageIntacctCredentials) {
    const result = await this.listReportingPeriods(credentials, { limit: 1 });
    return {
      reachable: true,
      recordCount: result.periods.length,
    };
  }

  async listReportingPeriods(
    credentials: SageIntacctCredentials,
    input: JsonObject,
  ) {
    const limit = this.limit(input.limit);
    const data = await this.send(credentials, REPORTING_PERIOD_PATH);
    const result = data["ia::result"];
    const rows = Array.isArray(result)
      ? result
      : Array.isArray(data.items)
        ? data.items
        : [];
    return {
      periods: rows
        .slice(0, limit)
        .map((value) => this.reportingPeriod(this.object(value))),
      providerCount: this.number(
        this.objectOrEmpty(data["ia::meta"]).totalCount,
      ),
      nextPageFollowed: false,
    };
  }

  async getReportingPeriod(
    credentials: SageIntacctCredentials,
    input: JsonObject,
  ) {
    const periodKey = this.periodKey(input.periodKey);
    const data = await this.send(
      credentials,
      `${REPORTING_PERIOD_PATH}/${encodeURIComponent(periodKey)}`,
    );
    const period = this.reportingPeriod(
      this.object(data["ia::result"] ?? data),
    );
    if (period.key !== periodKey) {
      throw new SageIntacctApiError(
        "provider_validation_error",
        "Sage Intacct returned a reporting period outside the requested binding.",
      );
    }
    return { period };
  }

  private async send(
    credentials: SageIntacctCredentials,
    path:
      | typeof REPORTING_PERIOD_PATH
      | `${typeof REPORTING_PERIOD_PATH}/${string}`,
  ): Promise<JsonObject> {
    const accessToken = await this.accessToken(credentials);
    let response: Response;
    try {
      response = await this.request(`${API_ORIGIN}${path}`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
          "User-Agent": "RelayConsole/1.0 (https://relayconsole.work)",
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new SageIntacctApiError(
        "provider_unavailable",
        "Sage Intacct is temporarily unavailable.",
        502,
      );
    }
    return this.response(response, "Sage Intacct API request failed.");
  }

  private async accessToken(credentials: SageIntacctCredentials) {
    const validated = this.credentials(credentials);
    let response: Response;
    try {
      response = await this.request(`${API_ORIGIN}${TOKEN_PATH}`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "User-Agent": "RelayConsole/1.0 (https://relayconsole.work)",
        },
        body: JSON.stringify({
          grant_type: "client_credentials",
          client_id: validated.clientId,
          client_secret: validated.clientSecret,
          username: validated.username,
        }),
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new SageIntacctApiError(
        "provider_unavailable",
        "Sage Intacct authentication is temporarily unavailable.",
        502,
      );
    }
    const data = await this.response(
      response,
      "Sage Intacct authentication failed.",
    );
    const accessToken = this.text(data.access_token);
    if (!accessToken || accessToken.length > 16_384) {
      throw new SageIntacctApiError(
        "credential_missing",
        "Sage Intacct did not return a usable access token.",
        401,
      );
    }
    return accessToken;
  }

  private async response(response: Response, message: string) {
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 2_000_000) {
      throw new SageIntacctApiError(
        "provider_validation_error",
        "Sage Intacct response exceeded the safe size limit.",
      );
    }
    if (!response.ok) {
      throw new SageIntacctApiError(
        response.status === 401
          ? "credential_missing"
          : response.status === 403
            ? "insufficient_scope"
            : response.status === 429
              ? "provider_rate_limited"
              : response.status >= 500
                ? "provider_unavailable"
                : "provider_validation_error",
        message,
        response.status,
      );
    }
    try {
      return this.object(raw ? JSON.parse(raw) : {});
    } catch {
      throw new SageIntacctApiError(
        "provider_validation_error",
        "Sage Intacct returned an invalid response.",
      );
    }
  }

  private credentials(credentials: SageIntacctCredentials) {
    const clientId = credentials.clientId.trim();
    const username = credentials.username.trim();
    if (
      !clientId ||
      clientId.length > 512 ||
      /[\r\n]/.test(clientId) ||
      !credentials.clientSecret ||
      credentials.clientSecret.length > 8192 ||
      !username.includes("@") ||
      username.length > 512 ||
      /[\r\n]/.test(username)
    ) {
      throw new SageIntacctApiError(
        "credential_missing",
        "Sage Intacct REST client credentials and exact Web Services username are missing or invalid.",
      );
    }
    return {
      clientId,
      clientSecret: credentials.clientSecret,
      username,
    };
  }

  private reportingPeriod(row: JsonObject) {
    return {
      key: this.text(row.key),
      id: this.text(row.id),
      name: this.text(row.name),
      startDate: this.text(row.startDate ?? row.start_date),
      endDate: this.text(row.endDate ?? row.end_date),
      budgetable: this.boolean(row.budgeting ?? row.budgetable),
      status: this.text(row.status),
    };
  }

  private periodKey(value: unknown) {
    if (typeof value !== "string" || !OPAQUE_KEY.test(value)) {
      throw new SageIntacctApiError(
        "provider_validation_error",
        "A valid Sage Intacct reporting-period key is required.",
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
      throw new SageIntacctApiError(
        "provider_validation_error",
        "Sage Intacct result limit is outside the supported range.",
      );
    }
    return Number(value);
  }

  private object(value: unknown): JsonObject {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new SageIntacctApiError(
        "provider_validation_error",
        "Sage Intacct returned an invalid response shape.",
      );
    }
    return value as JsonObject;
  }

  private objectOrEmpty(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }

  private text(value: unknown) {
    return typeof value === "string" ? value.slice(0, 1_000) : "";
  }

  private boolean(value: unknown) {
    return value === true || value === "true" || value === "T";
  }

  private number(value: unknown) {
    return typeof value === "number" && Number.isSafeInteger(value)
      ? value
      : null;
  }
}
