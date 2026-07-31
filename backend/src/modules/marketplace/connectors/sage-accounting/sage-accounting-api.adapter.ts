import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type HttpClient = (url: string, init: RequestInit) => Promise<Response>;

export type SageAccountingCredentials = {
  accessToken: string;
  businessId: string;
  subscriptionKey: string;
};

const RESOURCE_ID = /^[A-Za-z0-9_-]{1,200}$/;

export class SageAccountingApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
  }
}

@Injectable()
export class SageAccountingApiAdapter {
  constructor(private readonly request: HttpClient = fetch) {}

  async health(credentials: SageAccountingCredentials) {
    const business = await this.getBusiness(credentials);
    return {
      businessId: business.business.businessId,
      reachable: true,
    };
  }

  async getBusiness(credentials: SageAccountingCredentials) {
    const validated = this.credentials(credentials);
    const data = await this.get(validated, "/business");
    const business = this.business(this.object(data));
    if (business.businessId !== validated.businessId) {
      throw new SageAccountingApiError(
        "provider_validation_error",
        "Sage Accounting returned a business outside the connected binding.",
      );
    }
    return { business };
  }

  async listLedgerAccountClassifications(
    credentials: SageAccountingCredentials,
    input: JsonObject,
  ) {
    const limit = this.limit(input.limit);
    const query = new URLSearchParams({
      page: "1",
      items_per_page: String(limit),
    });
    const data = await this.get(
      this.credentials(credentials),
      "/ledger_account_classifications",
      query,
    );
    const rows = Array.isArray(data)
      ? data
      : Array.isArray(this.object(data).items)
        ? (this.object(data).items as unknown[])
        : [];
    return {
      businessId: this.credentials(credentials).businessId,
      classifications: rows
        .slice(0, limit)
        .map((value) => this.classification(this.object(value))),
      page: 1,
      nextPageFollowed: false,
    };
  }

  async getLedgerAccountClassification(
    credentials: SageAccountingCredentials,
    input: JsonObject,
  ) {
    const classificationId = this.resourceId(input.classificationId);
    const data = await this.get(
      this.credentials(credentials),
      `/ledger_account_classifications/${encodeURIComponent(classificationId)}`,
    );
    const classification = this.classification(this.object(data));
    if (classification.classificationId !== classificationId) {
      throw new SageAccountingApiError(
        "provider_validation_error",
        "Sage Accounting returned a classification outside the requested binding.",
      );
    }
    return {
      businessId: this.credentials(credentials).businessId,
      classification,
    };
  }

  private async get(
    credentials: ReturnType<SageAccountingApiAdapter["credentials"]>,
    path:
      | "/business"
      | "/ledger_account_classifications"
      | `/ledger_account_classifications/${string}`,
    query = new URLSearchParams(),
  ): Promise<JsonObject | unknown[]> {
    const url = new URL(`https://api.accounting.sage.com/v3.1${path}`);
    url.search = query.toString();
    let response: Response;
    try {
      response = await this.request(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${credentials.accessToken}`,
          "Ocp-Apim-Subscription-Key": credentials.subscriptionKey,
          "X-Business": credentials.businessId,
          "User-Agent": "RelayConsole/1.0 (https://relayconsole.work)",
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new SageAccountingApiError(
        "provider_unavailable",
        "Sage Accounting is temporarily unavailable.",
        502,
      );
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 2_000_000) {
      throw new SageAccountingApiError(
        "provider_validation_error",
        "Sage Accounting response exceeded the safe size limit.",
      );
    }
    if (!response.ok) {
      throw new SageAccountingApiError(
        response.status === 401
          ? "credential_missing"
          : response.status === 403
            ? "insufficient_scope"
            : response.status === 429
              ? "provider_rate_limited"
              : response.status >= 500
                ? "provider_unavailable"
                : "provider_validation_error",
        "Sage Accounting API request failed.",
        response.status,
      );
    }
    try {
      const parsed = raw ? JSON.parse(raw) : {};
      if (Array.isArray(parsed)) return parsed;
      return this.object(parsed);
    } catch {
      throw new SageAccountingApiError(
        "provider_validation_error",
        "Sage Accounting returned an invalid response.",
      );
    }
  }

  private credentials(credentials: SageAccountingCredentials) {
    const businessId = credentials.businessId.trim();
    if (!RESOURCE_ID.test(businessId)) {
      throw new SageAccountingApiError(
        "provider_validation_error",
        "A valid Sage Accounting business binding is required.",
      );
    }
    const accessToken = credentials.accessToken.trim();
    const subscriptionKey = credentials.subscriptionKey.trim();
    if (
      !accessToken ||
      accessToken.length > 16_384 ||
      !subscriptionKey ||
      subscriptionKey.length > 512
    ) {
      throw new SageAccountingApiError(
        "credential_missing",
        "Sage Accounting OAuth or subscription credentials are missing.",
      );
    }
    return { accessToken, businessId, subscriptionKey };
  }

  private business(row: JsonObject) {
    const country = this.object(row.country);
    const subscription = this.object(row.subscription ?? row.subscriptions);
    return {
      businessId: this.text(row.id),
      name: this.text(row.name ?? row.displayed_as),
      country: {
        id: this.text(country.id),
        name: this.text(country.displayed_as ?? country.name),
      },
      demo: row.is_demo === true,
      subscriptionActive: subscription.active === true,
      subscriptionStatus: this.text(subscription.status),
    };
  }

  private classification(row: JsonObject) {
    return {
      classificationId: this.text(row.id),
      name: this.text(row.name ?? row.displayed_as),
      displayedAs: this.text(row.displayed_as),
    };
  }

  private resourceId(value: unknown) {
    if (typeof value !== "string" || !RESOURCE_ID.test(value)) {
      throw new SageAccountingApiError(
        "provider_validation_error",
        "A valid Sage Accounting ledger-classification ID is required.",
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
      throw new SageAccountingApiError(
        "provider_validation_error",
        "Sage Accounting result limit is outside the supported range.",
      );
    }
    return Number(value);
  }

  private text(value: unknown) {
    return typeof value === "string" ? value.slice(0, 512) : null;
  }

  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }
}
