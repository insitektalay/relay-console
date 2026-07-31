import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

const DEFAULT_DATAFORSEO_BASE_URL = "https://api.dataforseo.com";

type JsonObject = Record<string, unknown>;

type DataForSeoTaskResult<T> = {
  status_code?: number;
  status_message?: string;
  result?: T[];
};

type DataForSeoResponse<T> = {
  status_code?: number;
  status_message?: string;
  tasks?: Array<DataForSeoTaskResult<T>>;
};

type DataForSeoLocation = {
  location_code?: number;
  location_name?: string;
  country_iso_code?: string;
  location_type?: string;
};

export type DataForSeoCredentials = {
  login: string;
  password: string;
  baseUrl?: string | null;
};

export class DataForSeoApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
    public readonly responseBody?: unknown,
  ) {
    super(message);
  }
}

@Injectable()
export class DataForSeoApiAdapter {
  private readonly googleLocationCodeCache = new Map<string, Promise<number>>();

  async googleOrganicSerp(credentials: DataForSeoCredentials, input: JsonObject) {
    const { languageCode, countryCode } = this.parseLocale(this.string(input.locale) ?? "en-us");
    const locationCode = await this.resolveGoogleLocationCode(credentials, countryCode);
    const depth = this.clampNumber(input.depth, 20, 1, 50);
    const payload = await this.requestTask<JsonObject>(
      credentials,
      "/v3/serp/google/organic/live/advanced",
      {
        method: "POST",
        body: [
          {
            keyword: this.requiredString(input.query, "query"),
            language_code: languageCode,
            location_code: locationCode,
            device: this.enumString(input.device, ["desktop", "mobile"], "desktop"),
            depth,
            tag: this.string(input.tag) ?? `clawchat:${Date.now()}`,
          },
        ],
      },
      "Google organic live SERP",
    );
    return payload.result?.[0] ?? {};
  }

  async backlinksSummary(credentials: DataForSeoCredentials, input: JsonObject) {
    return this.requestTask<JsonObject>(
      credentials,
      "/v3/backlinks/summary/live",
      {
        method: "POST",
        body: [this.targetBody(input)],
      },
      "backlinks summary",
    );
  }

  async findBacklinks(credentials: DataForSeoCredentials, input: JsonObject) {
    return this.requestTask<JsonObject>(
      credentials,
      "/v3/backlinks/backlinks/live",
      {
        method: "POST",
        body: [
          {
            ...this.targetBody(input),
            limit: this.clampNumber(input.limit, 10, 1, 50),
            offset: this.clampNumber(input.offset, 0, 0, 1000),
            ...(this.stringArray(input.orderBy, 3).length
              ? { order_by: this.stringArray(input.orderBy, 3) }
              : {}),
          },
        ],
      },
      "backlinks lookup",
    );
  }

  async inspectPage(credentials: DataForSeoCredentials, input: JsonObject) {
    return this.requestTask<JsonObject>(
      credentials,
      "/v3/on_page/instant_pages",
      {
        method: "POST",
        body: [
          {
            url: this.requiredString(input.url, "url"),
            enable_javascript: input.enableJavascript === true,
            load_resources: input.loadResources === true,
          },
        ],
      },
      "instant page inspection",
    );
  }

  async health(credentials: DataForSeoCredentials) {
    return this.requestTask<DataForSeoLocation>(
      credentials,
      "/v3/serp/google/locations/us",
      { method: "GET" },
      "Google locations lookup for US",
    );
  }

  private async resolveGoogleLocationCode(credentials: DataForSeoCredentials, countryCode: string) {
    const normalized = countryCode.trim().toUpperCase();
    const cached = this.googleLocationCodeCache.get(normalized);
    if (cached) return cached;
    const pending = (async () => {
      const task = await this.requestTask<DataForSeoLocation>(
        credentials,
        `/v3/serp/google/locations/${encodeURIComponent(normalized.toLowerCase())}`,
        { method: "GET" },
        `Google locations lookup for ${normalized}`,
      );
      const locations = task.result ?? [];
      const location =
        locations.find(
          (entry) =>
            entry.country_iso_code?.toUpperCase() === normalized &&
            entry.location_type === "Country",
        ) ??
        locations.find((entry) => entry.country_iso_code?.toUpperCase() === normalized) ??
        locations[0];
      if (!location?.location_code) {
        throw new DataForSeoApiError(
          "provider_validation_error",
          `DataForSEO did not return a usable Google location code for ${normalized}.`,
        );
      }
      return location.location_code;
    })();
    this.googleLocationCodeCache.set(normalized, pending);
    try {
      return await pending;
    } catch (error) {
      this.googleLocationCodeCache.delete(normalized);
      throw error;
    }
  }

  private async requestTask<T>(
    credentials: DataForSeoCredentials,
    path: string,
    init: { method: "GET" | "POST"; body?: unknown },
    context: string,
  ): Promise<DataForSeoTaskResult<T>> {
    const payload = await this.request<DataForSeoResponse<T>>(credentials, path, init);
    const task = payload.tasks?.[0];
    if (!task) {
      throw new DataForSeoApiError("provider_unavailable", `DataForSEO returned no tasks for ${context}.`);
    }
    if (task.status_code !== 20000) {
      throw new DataForSeoApiError(
        this.errorCodeForTask(task.status_code),
        `DataForSEO ${context} failed with ${task.status_code ?? "unknown"}: ${task.status_message ?? "Unknown error."}`,
        400,
        { status_code: task.status_code, status_message: task.status_message },
      );
    }
    return task;
  }

  private async request<T>(
    credentials: DataForSeoCredentials,
    path: string,
    init: { method: "GET" | "POST"; body?: unknown },
  ): Promise<T> {
    const login = this.string(credentials.login);
    const password = this.string(credentials.password);
    if (!login || !password) {
      throw new DataForSeoApiError("credential_missing", "DataForSEO API login and password are required.");
    }
    const baseUrl = (this.string(credentials.baseUrl) ?? DEFAULT_DATAFORSEO_BASE_URL).replace(/\/+$/, "");
    const response = await safeConnectorFetch(`${baseUrl}${path}`, {
      method: init.method,
      headers: {
        Authorization: `Basic ${Buffer.from(`${login}:${password}`, "utf8").toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: init.method === "GET" || init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    const body = await this.safeBody(response);
    if (!response.ok) {
      throw new DataForSeoApiError(
        this.errorCodeForStatus(response.status),
        this.safeMessage(body) ?? `DataForSEO request failed with ${response.status}`,
        response.status,
        body,
      );
    }
    return body as T;
  }

  private targetBody(input: JsonObject) {
    const targetType = this.enumString(input.targetType, ["domain", "url"], "domain");
    return {
      target: this.requiredString(input.target, "target"),
      target_type: targetType === "url" ? "page" : "domain",
    };
  }

  private parseLocale(locale: string) {
    const normalized = locale.trim().toLowerCase().replace(/_/g, "-") || "en-us";
    const [languageCode = "en", rawCountryCode = "us"] = normalized.split("-");
    return { languageCode, countryCode: rawCountryCode.toUpperCase() };
  }

  private async safeBody(response: Response) {
    const text = await response.text();
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch {
      return { text };
    }
  }

  private safeMessage(body: unknown) {
    if (!body || typeof body !== "object" || Array.isArray(body)) return null;
    const object = body as Record<string, unknown>;
    return this.string(object.status_message) ?? this.string(object.message) ?? this.string(object.error);
  }

  private errorCodeForStatus(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401 || status === 403) return "credential_missing";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    if (status >= 400) return "provider_validation_error";
    return "provider_unavailable";
  }

  private errorCodeForTask(statusCode?: number): MarketplaceConnectorSafeErrorCode {
    if (statusCode === 40100 || statusCode === 40200) return "credential_missing";
    if (statusCode === 40203 || statusCode === 40205) return "provider_rate_limited";
    if (statusCode && statusCode >= 50000) return "provider_unavailable";
    return "provider_validation_error";
  }

  private requiredString(value: unknown, field: string) {
    const stringValue = this.string(value);
    if (!stringValue) {
      throw new DataForSeoApiError("provider_validation_error", `${field} is required`);
    }
    return stringValue;
  }

  private string(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }

  private enumString<T extends string>(value: unknown, allowed: T[], fallback: T) {
    const stringValue = this.string(value);
    return stringValue && allowed.includes(stringValue as T) ? (stringValue as T) : fallback;
  }

  private stringArray(value: unknown, maxItems: number) {
    return Array.isArray(value)
      ? value.map((entry) => this.string(entry)).filter((entry): entry is string => Boolean(entry)).slice(0, maxItems)
      : [];
  }

  private clampNumber(value: unknown, fallback: number, min: number, max: number) {
    const number = Number(value ?? fallback);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(Math.max(Math.floor(number), min), max);
  }
}
