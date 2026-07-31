import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type HttpClient = (url: string, init: RequestInit) => Promise<Response>;
type Bitrix24Binding = {
  origin: string;
  portalHost: string;
  userId: string;
  basePath: string;
};

export type Bitrix24Credentials = { webhookUrl: string };

const ID = /^[1-9][0-9]{0,19}$/;
const WEBHOOK_PATH = /^\/rest\/([1-9][0-9]{0,19})\/([A-Za-z0-9_-]{8,256})\/?$/;
const CLOUD_ZONES = [
  "bitrix24.com",
  "bitrix24.ae",
  "bitrix24.eu",
  "bitrix24.de",
  "bitrix24.it",
  "bitrix24.pl",
  "bitrix24.fr",
  "bitrix24.uk",
  "bitrix24.com.tr",
  "bitrix24.com.br",
  "bitrix24.es",
  "bitrix24.mx",
  "bitrix24.co",
  "bitrix24.cn",
  "bitrix24.in",
  "bitrix24.id",
  "bitrix24.jp",
  "bitrix24.vn",
] as const;

const DEAL_FIELDS = [
  "id",
  "title",
  "stageId",
  "categoryId",
  "opportunity",
  "currencyId",
  "probability",
  "isManualOpportunity",
  "sourceId",
  "assignedById",
  "opened",
  "beginDate",
  "closeDate",
  "createdTime",
  "updatedTime",
  "movedTime",
] as const;

export class Bitrix24ApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
  }
}

@Injectable()
export class Bitrix24ApiAdapter {
  constructor(private readonly request: HttpClient = fetch) {}

  async health(credentials: Bitrix24Credentials) {
    const binding = this.binding(credentials);
    const profile = await this.profile(credentials, binding);
    const method = this.object(
      this.object(
        await this.send(credentials, "method.get", {
          name: "crm.item.list",
        }),
      ).result,
    );
    if (method.isExisting !== true || method.isAvailable !== true) {
      throw new Bitrix24ApiError(
        "insufficient_scope",
        "Bitrix24 incoming webhook does not grant the required CRM method.",
        403,
      );
    }
    return {
      portalHost: binding.portalHost,
      userId: profile.userId,
      admin: profile.admin,
      crmScopeRequired: true,
      reachable: true,
    };
  }

  async getProfile(credentials: Bitrix24Credentials) {
    const binding = this.binding(credentials);
    return {
      portalHost: binding.portalHost,
      profile: await this.profile(credentials, binding),
    };
  }

  async listDeals(credentials: Bitrix24Credentials, input: JsonObject) {
    const binding = this.binding(credentials);
    const limit = this.limit(input.limit);
    const body = this.object(
      await this.send(credentials, "crm.item.list", {
        entityTypeId: 2,
        select: [...DEAL_FIELDS],
        order: { updatedTime: "DESC" },
        start: 0,
      }),
    );
    const result = this.object(body.result);
    const items = Array.isArray(result.items) ? result.items : [];
    return {
      portalHost: binding.portalHost,
      deals: items.slice(0, limit).map((item) => this.deal(this.object(item))),
      hasMore: items.length > limit || body.next !== undefined,
    };
  }

  async getDeal(credentials: Bitrix24Credentials, input: JsonObject) {
    const binding = this.binding(credentials);
    const dealId = this.dealId(input.dealId);
    const body = this.object(
      await this.send(credentials, "crm.item.list", {
        entityTypeId: 2,
        select: [...DEAL_FIELDS],
        filter: { id: Number(dealId) },
        start: 0,
      }),
    );
    const result = this.object(body.result);
    const row = Array.isArray(result.items) ? result.items[0] : undefined;
    if (!row) {
      throw new Bitrix24ApiError(
        "provider_validation_error",
        "Bitrix24 deal was not found or is not visible to the webhook owner.",
        404,
      );
    }
    const deal = this.deal(this.object(row));
    if (deal.dealId !== dealId) {
      throw new Bitrix24ApiError(
        "provider_validation_error",
        "Bitrix24 returned a deal outside the requested binding.",
      );
    }
    return { portalHost: binding.portalHost, deal };
  }

  private async profile(
    credentials: Bitrix24Credentials,
    binding: Bitrix24Binding,
  ) {
    const body = this.object(await this.send(credentials, "profile", {}));
    const result = this.object(body.result);
    const userId = this.id(result.ID);
    if (userId !== binding.userId) {
      throw new Bitrix24ApiError(
        "provider_validation_error",
        "Bitrix24 webhook user binding changed.",
      );
    }
    return {
      userId,
      admin: result.ADMIN === true,
      firstName: this.scalar(result.NAME),
      lastName: this.scalar(result.LAST_NAME),
      timeZone: this.scalar(result.TIME_ZONE),
    };
  }

  private async send(
    credentials: Bitrix24Credentials,
    method: "profile" | "method.get" | "crm.item.list",
    json: JsonObject,
  ) {
    const binding = this.binding(credentials);
    const url = `${binding.origin}${binding.basePath}/${method}.json`;
    let response: Response;
    try {
      response = await this.request(url, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "User-Agent": "RelayConsole/1.0 (https://relayconsole.work)",
        },
        body: JSON.stringify(json),
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new Bitrix24ApiError(
        "provider_unavailable",
        "Bitrix24 is temporarily unavailable.",
        502,
      );
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 2_000_000) {
      throw new Bitrix24ApiError(
        "provider_validation_error",
        "Bitrix24 response exceeded the safe size limit.",
      );
    }
    let body: unknown = {};
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      throw new Bitrix24ApiError(
        "provider_validation_error",
        "Bitrix24 returned an invalid response.",
      );
    }
    const object = this.object(body);
    const providerCode = this.scalar(object.error);
    if (!response.ok || providerCode) {
      const code = String(providerCode ?? "");
      const authError = ["NO_AUTH_FOUND", "expired_token"].includes(code);
      const scopeError = [
        "ACCESS_DENIED",
        "INVALID_CREDENTIALS",
        "insufficient_scope",
        "user_access_error",
      ].includes(code);
      const rateError = ["QUERY_LIMIT_EXCEEDED", "OVERLOAD_LIMIT"].includes(
        code,
      );
      throw new Bitrix24ApiError(
        authError
          ? "credential_missing"
          : scopeError
            ? "insufficient_scope"
            : rateError || response.status === 429
              ? "provider_rate_limited"
              : response.status >= 500
                ? "provider_unavailable"
                : "provider_validation_error",
        authError
          ? "Bitrix24 rejected the incoming webhook credential."
          : scopeError
            ? "Bitrix24 denied the required CRM permission."
            : rateError
              ? "Bitrix24 temporarily limited REST API requests."
              : "Bitrix24 API request failed.",
        authError
          ? 401
          : scopeError
            ? 403
            : rateError
              ? 429
              : response.ok
                ? 400
                : response.status,
      );
    }
    return object;
  }

  private binding(credentials: Bitrix24Credentials): Bitrix24Binding {
    let url: URL;
    try {
      url = new URL(credentials.webhookUrl.trim());
    } catch {
      throw new Bitrix24ApiError(
        "credential_missing",
        "A valid Bitrix24 incoming webhook URL is required.",
        401,
      );
    }
    const match = WEBHOOK_PATH.exec(url.pathname);
    const host = url.hostname.toLowerCase();
    const cloudHost = CLOUD_ZONES.some(
      (zone) => host !== zone && host.endsWith(`.${zone}`),
    );
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      url.search ||
      url.hash ||
      !cloudHost ||
      !match
    ) {
      throw new Bitrix24ApiError(
        "credential_missing",
        "Bitrix24 requires an exact HTTPS cloud incoming webhook URL without query parameters.",
        401,
      );
    }
    return {
      origin: url.origin,
      portalHost: host,
      userId: match[1],
      basePath: url.pathname.replace(/\/$/, ""),
    };
  }

  private deal(row: JsonObject) {
    return {
      dealId: this.id(row.id),
      title: this.scalar(row.title),
      stageId: this.scalar(row.stageId),
      categoryId: this.scalar(row.categoryId),
      opportunity: this.scalar(row.opportunity),
      currencyId: this.scalar(row.currencyId),
      probability: this.scalar(row.probability),
      manualOpportunity: this.scalar(row.isManualOpportunity),
      sourceId: this.scalar(row.sourceId),
      assignedById: this.scalar(row.assignedById),
      opened: this.scalar(row.opened),
      beginDate: this.scalar(row.beginDate),
      closeDate: this.scalar(row.closeDate),
      createdAt: this.scalar(row.createdTime),
      updatedAt: this.scalar(row.updatedTime),
      movedAt: this.scalar(row.movedTime),
    };
  }

  private dealId(value: unknown) {
    if (typeof value !== "string" || !ID.test(value)) {
      throw new Bitrix24ApiError(
        "provider_validation_error",
        "A positive numeric Bitrix24 deal ID is required.",
      );
    }
    return value;
  }

  private id(value: unknown) {
    const result = String(value ?? "");
    if (!ID.test(result)) {
      throw new Bitrix24ApiError(
        "provider_validation_error",
        "Bitrix24 returned an invalid identifier.",
      );
    }
    return result;
  }

  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }

  private scalar(value: unknown): string | number | boolean | null {
    if (typeof value === "string") return value.slice(0, 512);
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "boolean") return value;
    return null;
  }

  private limit(value: unknown) {
    if (value === undefined) return 25;
    if (
      !Number.isSafeInteger(value) ||
      Number(value) < 1 ||
      Number(value) > 25
    ) {
      throw new Bitrix24ApiError(
        "provider_validation_error",
        "Bitrix24 deal limit must be between 1 and 25.",
      );
    }
    return Number(value);
  }
}
