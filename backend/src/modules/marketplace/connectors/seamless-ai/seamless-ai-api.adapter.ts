import { Injectable, Optional } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;
export type SeamlessAiCredentials = { apiKey: string };

export class SeamlessAiApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class SeamlessAiApiAdapter {
  private readonly endpoint =
    "https://api.seamless.ai/api/client/v1/search/companies";
  private readonly maxResponseBytes = 256 * 1024;

  constructor(@Optional() private readonly requester: Requester = fetch) {}

  async health(credentials: SeamlessAiCredentials) {
    await this.searchCompanies(credentials, {
      companyDomain: "seamless.ai",
      matchType: "exact",
      limit: 1,
    });
    return { apiOrigin: "https://api.seamless.ai", apiKeyValidated: true };
  }

  async searchCompanies(credentials: SeamlessAiCredentials, input: JsonObject) {
    const apiKey = this.credential(credentials?.apiKey);
    const companyName = this.optionalQuery(input.companyName, "companyName");
    const companyDomain = this.optionalDomain(input.companyDomain);
    if (!companyName && !companyDomain)
      throw this.invalid("companyName or companyDomain is required");
    const matchType =
      this.optionalEnum(input.matchType, "matchType", [
        "default",
        "related",
        "exact",
      ]) ?? "exact";
    const limit = this.integer(input.limit ?? 5, "limit", 1, 5);
    const allowedKeys = new Set([
      "companyName",
      "companyDomain",
      "matchType",
      "limit",
    ]);
    if (Object.keys(input).some((key) => !allowedKeys.has(key)))
      throw this.invalid(
        "Seamless.AI company search received unsupported input",
      );

    const payload: JsonObject = { limit };
    if (companyName) {
      payload.companyName = [companyName];
      payload.companyNameSearchType = matchType;
    }
    if (companyDomain) payload.companyDomain = [companyDomain];
    const response = await this.request(apiKey, payload);
    const root = this.object(response.body, "response");
    const data = this.array(root.data, "data", limit);
    return {
      companies: data.map((value, index) =>
        this.company(value, `data[${index}]`),
      ),
      resultCount: data.length,
      researchCreditsRemaining: response.creditsRemaining,
    };
  }

  private async request(apiKey: string, body: JsonObject) {
    let response: Response;
    try {
      response = await this.requester(this.endpoint, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Token: apiKey,
          "User-Agent": "RelayConsole-SeamlessAI/1.0",
        },
        body: JSON.stringify(body),
        redirect: "error",
        signal: AbortSignal.timeout(25_000),
        cache: "no-store",
      });
    } catch {
      throw new SeamlessAiApiError(
        "provider_unavailable",
        "Seamless.AI could not be reached",
        502,
      );
    }
    const parsed = await this.safeBody(response);
    if (!response.ok)
      throw new SeamlessAiApiError(
        this.errorCode(response.status),
        `Seamless.AI returned HTTP ${response.status}`,
        response.status,
      );
    const creditsHeader = response.headers.get("x-publicapi-credits");
    const creditsRemaining =
      creditsHeader === null
        ? null
        : this.integer(
            Number(creditsHeader),
            "X-PublicAPI-Credits",
            0,
            1_000_000_000,
          );
    return { body: parsed, creditsRemaining };
  }

  private company(value: unknown, field: string) {
    const item = this.object(value, field);
    return {
      searchResultId: this.boundedString(
        item.searchResultId,
        `${field}.searchResultId`,
        160,
      ),
      name: this.boundedString(item.name, `${field}.name`, 240),
      domain: this.optionalBoundedString(item.domain, `${field}.domain`, 253),
      city: this.optionalBoundedString(item.city, `${field}.city`, 120),
      state: this.optionalBoundedString(item.state, `${field}.state`, 120),
      country: this.optionalBoundedString(
        item.country,
        `${field}.country`,
        120,
      ),
      description: this.optionalBoundedString(
        item.description,
        `${field}.description`,
        2_000,
      ),
      industries: this.optionalStringArray(
        item.industries,
        `${field}.industries`,
        10,
        160,
      ),
      staffCountRange: this.optionalBoundedString(
        item.staffCountRange,
        `${field}.staffCountRange`,
        80,
      ),
      companyType: this.optionalBoundedString(
        item.companyType,
        `${field}.companyType`,
        80,
      ),
      stockTicker: this.optionalBoundedString(
        item.stockTicker,
        `${field}.stockTicker`,
        32,
      ),
    };
  }

  private credential(value: unknown) {
    const apiKey = typeof value === "string" ? value.trim() : "";
    if (
      apiKey.length < 16 ||
      apiKey.length > 2_048 ||
      /[\s\u0000-\u001f\u007f]/.test(apiKey)
    )
      throw new SeamlessAiApiError(
        "credential_missing",
        "A valid customer-owned Seamless.AI API key is required",
        401,
      );
    return apiKey;
  }

  private optionalQuery(value: unknown, field: string) {
    if (value === undefined || value === null || value === "") return null;
    const text = this.boundedString(value, field, 160).trim();
    if (text.length < 2) throw this.invalid(`${field} is too short`);
    return text;
  }

  private optionalDomain(value: unknown) {
    if (value === undefined || value === null || value === "") return null;
    const domain = this.boundedString(value, "companyDomain", 253)
      .trim()
      .toLowerCase();
    if (
      !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(
        domain,
      )
    )
      throw this.invalid("companyDomain must be a root domain without a URL");
    return domain;
  }

  private optionalEnum(value: unknown, field: string, values: string[]) {
    if (value === undefined || value === null || value === "") return null;
    const text = this.boundedString(value, field, 40);
    if (!values.includes(text)) throw this.invalid(`${field} is invalid`);
    return text;
  }

  private integer(
    value: unknown,
    field: string,
    minimum: number,
    maximum: number,
  ) {
    if (
      !Number.isSafeInteger(value) ||
      (value as number) < minimum ||
      (value as number) > maximum
    )
      throw this.invalid(`${field} is invalid`);
    return value as number;
  }

  private object(value: unknown, field: string): JsonObject {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw this.invalid(`Seamless.AI returned invalid ${field}`);
    return value as JsonObject;
  }

  private array(value: unknown, field: string, maxLength: number) {
    if (!Array.isArray(value) || value.length > maxLength)
      throw this.invalid(`Seamless.AI returned invalid ${field}`);
    return value;
  }

  private boundedString(value: unknown, field: string, maxLength: number) {
    if (
      typeof value !== "string" ||
      !value.length ||
      value.length > maxLength ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)
    )
      throw this.invalid(`Seamless.AI returned invalid ${field}`);
    return value;
  }

  private optionalBoundedString(
    value: unknown,
    field: string,
    maxLength: number,
  ) {
    if (value === undefined || value === null || value === "") return null;
    return this.boundedString(value, field, maxLength);
  }

  private optionalStringArray(
    value: unknown,
    field: string,
    maxLength: number,
    maxItemLength: number,
  ) {
    if (value === undefined || value === null) return [];
    return this.array(value, field, maxLength).map((item, index) =>
      this.boundedString(item, `${field}[${index}]`, maxItemLength),
    );
  }

  private async safeBody(response: Response) {
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > this.maxResponseBytes)
      throw this.invalid("Seamless.AI response exceeded the allowed size");
    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(await response.arrayBuffer());
    } catch {
      throw new SeamlessAiApiError(
        "provider_unavailable",
        "Seamless.AI response could not be read",
        502,
      );
    }
    if (bytes.byteLength > this.maxResponseBytes)
      throw this.invalid("Seamless.AI response exceeded the allowed size");
    if (!bytes.byteLength)
      throw this.invalid("Seamless.AI returned an empty response");
    try {
      return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    } catch {
      if (response.ok) throw this.invalid("Seamless.AI returned invalid JSON");
      return {};
    }
  }

  private errorCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403 || status === 422) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private invalid(message: string) {
    return new SeamlessAiApiError("provider_validation_error", message, 400);
  }
}
