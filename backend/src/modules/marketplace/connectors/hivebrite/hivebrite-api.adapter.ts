import { isIP } from "node:net";

import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type HttpClient = (url: string, init: RequestInit) => Promise<Response>;

export type HivebriteCredentials = {
  baseUrl: string;
  adminId: string;
  accessToken: string;
};

export class HivebriteApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export class HivebriteApiAdapter {
  constructor(private readonly request: HttpClient = fetch) {}

  async health(credentials: HivebriteCredentials) {
    const result = await this.getCurrentAdmin(credentials);
    return { tokenValid: true, admin: result.admin };
  }

  async getCurrentAdmin(credentials: HivebriteCredentials) {
    const { body } = await this.send(credentials, "/api/admin/v1/me");
    const admin = this.admin(body);
    if (admin.id !== this.id(credentials.adminId, "admin ID", true))
      throw new HivebriteApiError(
        "policy_blocked",
        "Hivebrite credentials do not represent the exactly configured administrator.",
        403,
      );
    return { admin };
  }

  async listGroups(credentials: HivebriteCredentials, input: JsonObject) {
    return this.list(credentials, "/api/admin/v2/topics", input, (value) =>
      this.group(value),
    );
  }

  async listNewsCategories(
    credentials: HivebriteCredentials,
    input: JsonObject,
  ) {
    const { body } = await this.send(
      credentials,
      "/api/admin/v1/news/categories",
    );
    const limit = this.integer(input.maxResults, 1, 25, 25);
    const values = this.arrayOrEnvelope(body, "categories").slice(0, limit);
    return {
      items: values.map((value) => this.category(value)),
      returned: values.length,
    };
  }

  async listEvents(credentials: HivebriteCredentials, input: JsonObject) {
    return this.list(
      credentials,
      "/api/admin/v2/network_events",
      input,
      (value) => this.event(value),
      { parent: "all", registration_type: "all" },
    );
  }

  async listCompanies(credentials: HivebriteCredentials, input: JsonObject) {
    return this.list(
      credentials,
      "/api/admin/v1/companies",
      input,
      (value) => this.company(value),
      { full_profile: "false" },
    );
  }

  private async list<T>(
    credentials: HivebriteCredentials,
    path: string,
    input: JsonObject,
    map: (value: unknown) => T,
    fixed: Record<string, string> = {},
  ) {
    const page = this.integer(input.page, 1, 10_000, 1);
    const perPage = this.integer(input.maxResults, 1, 25, 25);
    const query = new URLSearchParams({
      ...fixed,
      page: String(page),
      per_page: String(perPage),
    });
    const { body, headers } = await this.send(credentials, `${path}?${query}`);
    const values = this.arrayOrEnvelope(body).slice(0, perPage);
    return {
      items: values.map(map),
      page,
      limit: perPage,
      returned: values.length,
      hasNextPage: /<[^>]+>;\s*rel="next"/i.test(headers.get("link") ?? ""),
    };
  }

  private async send(
    credentials: HivebriteCredentials,
    path: string,
  ): Promise<{ body: unknown; headers: Headers }> {
    const origin = this.origin(credentials.baseUrl);
    this.id(credentials.adminId, "admin ID", true);
    const token = credentials.accessToken.trim();
    if (!token || token.length > 8_192)
      throw new HivebriteApiError(
        "credential_missing",
        "Hivebrite access token is missing or invalid.",
      );
    const url = new URL(path, origin);
    if (url.origin !== origin || !/^\/api\/admin\/v[123]\//.test(url.pathname))
      throw new HivebriteApiError(
        "policy_blocked",
        "Hivebrite request left the exactly configured Admin API boundary.",
        403,
      );
    let response: Response;
    try {
      response = await this.request(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new HivebriteApiError(
        "provider_unavailable",
        "Hivebrite is temporarily unavailable.",
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.length > 2_000_000)
      throw new HivebriteApiError(
        "provider_validation_error",
        "Hivebrite response exceeded the safe size limit.",
      );
    let body: unknown = {};
    try {
      body = raw.length ? JSON.parse(raw.toString("utf8")) : {};
    } catch {
      throw new HivebriteApiError(
        "provider_validation_error",
        "Hivebrite returned an invalid response.",
      );
    }
    if (!response.ok)
      throw new HivebriteApiError(
        response.status === 401
          ? "token_expired"
          : response.status === 403
            ? "insufficient_scope"
            : response.status === 429
              ? "provider_rate_limited"
              : response.status >= 500
                ? "provider_unavailable"
                : "provider_validation_error",
        "Hivebrite API request failed.",
        response.status,
        { retryAfter: response.headers.get("retry-after") },
      );
    return { body, headers: response.headers };
  }

  private origin(value: string) {
    let url: URL;
    try {
      url = new URL(value.trim());
    } catch {
      throw new HivebriteApiError(
        "credential_missing",
        "Hivebrite tenant URL is missing or invalid.",
      );
    }
    const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      (url.pathname !== "/" && url.pathname !== "") ||
      url.search ||
      url.hash ||
      !hostname.includes(".") ||
      isIP(hostname) !== 0 ||
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal")
    )
      throw new HivebriteApiError(
        "credential_missing",
        "Hivebrite tenant URL must be a public HTTPS origin without a path.",
      );
    return url.origin;
  }

  private admin(value: unknown) {
    const item = this.object(value);
    return {
      id: this.scalar(item.id),
      name: this.scalar(item.name),
      adminType: this.scalar(item.admin_type),
      createdAt: this.scalar(item.created_at),
    };
  }

  private group(value: unknown) {
    const item = this.object(value);
    return {
      id: this.scalar(item.id),
      name: this.scalar(item.name),
      public: this.boolean(item.public),
      restrictedAccess: this.boolean(item.restricted_access),
      secret: this.boolean(item.secret),
      published: this.boolean(item.published),
      publishedAt: this.scalar(item.published_at),
      createdAt: this.scalar(item.created_at),
      updatedAt: this.scalar(item.updated_at),
    };
  }

  private category(value: unknown) {
    const item = this.object(value);
    return { id: this.scalar(item.id), name: this.scalar(item.name) };
  }

  private event(value: unknown) {
    const item = this.object(value);
    return {
      id: this.scalar(item.id),
      title: this.scalar(item.title),
      startAt: this.scalar(item.start_date),
      endAt: this.scalar(item.end_date),
      registrationType: this.scalar(item.registration_type),
      publishedAt: this.scalar(item.published_at),
      cancelled: this.boolean(item.cancelled),
      public: this.boolean(item.public),
      createdAt: this.scalar(item.created_at),
      updatedAt: this.scalar(item.updated_at),
    };
  }

  private company(value: unknown) {
    const item = this.object(value);
    return { id: this.scalar(item.id), name: this.scalar(item.name) };
  }

  private id(value: unknown, field: string, credential = false) {
    const id = this.scalar(value);
    if (!id || !/^[1-9][0-9]{0,18}$/.test(id))
      throw new HivebriteApiError(
        credential ? "credential_missing" : "provider_validation_error",
        `Hivebrite ${field} is invalid.`,
      );
    return id;
  }

  private integer(value: unknown, min: number, max: number, fallback: number) {
    if (value == null) return fallback;
    const number = typeof value === "number" ? value : Number(value);
    if (!Number.isSafeInteger(number) || number < min || number > max)
      throw new HivebriteApiError(
        "provider_validation_error",
        "Hivebrite pagination input is invalid.",
      );
    return number;
  }

  private arrayOrEnvelope(value: unknown, preferred?: string): unknown[] {
    if (Array.isArray(value)) return value;
    const item = this.object(value);
    for (const key of [
      preferred,
      "data",
      "items",
      "groups",
      "topics",
      "events",
      "network_events",
      "companies",
    ].filter(Boolean) as string[]) {
      if (Array.isArray(item[key])) return item[key] as unknown[];
    }
    return [];
  }

  private object(value: unknown): JsonObject {
    return value != null && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }

  private scalar(value: unknown): string | null {
    return typeof value === "string" || typeof value === "number"
      ? String(value)
      : null;
  }

  private boolean(value: unknown): boolean | null {
    return typeof value === "boolean"
      ? value
      : value === 1 || value === "1" || value === "true"
        ? true
        : value === 0 || value === "0" || value === "false"
          ? false
          : null;
  }
}
