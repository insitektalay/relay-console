import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type HttpClient = (url: string, init: RequestInit) => Promise<Response>;
type JsonObject = Record<string, unknown>;

const ORIGIN = "https://api.restream.io";
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FORBIDDEN_PATH =
  /(?:stream-key|srt-stream-keys|chat\/url|streaming-updates)/i;
const SECRET_KEY =
  /^(?:access_?token|refresh_?token|client_?secret|stream_?key|rtmp_?password|password|credential)$/i;

export class RestreamApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class RestreamApiAdapter {
  constructor(private readonly http: HttpClient = fetch) {}

  async health(accessToken: string) {
    return this.getProfile(accessToken);
  }

  async getProfile(accessToken: string) {
    return {
      profile: this.safeValue(
        await this.json(accessToken, "GET", "/v2/user/profile"),
      ),
    };
  }

  async listChannels(accessToken: string) {
    const body = this.object(
      await this.json(accessToken, "GET", "/v2/user/channels"),
    );
    return {
      channels: this.safeValue(
        Array.isArray(body.channels) ? body.channels.slice(0, 500) : [],
      ),
    };
  }

  async listEvents(accessToken: string, input: JsonObject) {
    const kind = this.enumValue(input.kind, "kind", [
      "upcoming",
      "in-progress",
      "history",
    ]);
    const query: Record<string, string> = {};
    if (kind === "history") {
      query.page = String(this.integer(input.page, "page", 1, 10_000, 1));
      query.limit = String(this.integer(input.limit, "limit", 1, 100, 25));
    } else {
      if (input.source !== undefined)
        query.source = String(this.integer(input.source, "source", 1, 3, 1));
      if (typeof input.scheduled === "boolean")
        query.scheduled = String(input.scheduled);
    }
    const value = await this.json(
      accessToken,
      "GET",
      `/v2/user/events/${kind}`,
      query,
    );
    return { kind, result: this.bounded(value, 100) };
  }

  async getEvent(accessToken: string, input: JsonObject) {
    const eventId = this.uuid(input.eventId, "eventId");
    return {
      event: this.safeValue(
        await this.json(
          accessToken,
          "GET",
          `/v2/user/events/${encodeURIComponent(eventId)}`,
        ),
      ),
    };
  }

  async getEventChatHistory(accessToken: string, input: JsonObject) {
    const eventId = this.uuid(input.eventId, "eventId");
    const query: Record<string, string> = {
      pageSize: String(this.integer(input.pageSize, "pageSize", 1, 100, 100)),
    };
    if (input.pageToken !== undefined)
      query.pageToken = this.string(input.pageToken, "pageToken", 2_000);
    if (input.timestamp !== undefined)
      query.timestamp = String(
        this.integer(input.timestamp, "timestamp", 0, 9_999_999_999, 0),
      );
    if (query.pageToken && query.timestamp)
      this.invalid("pageToken and timestamp are mutually exclusive");
    return {
      eventId,
      history: this.bounded(
        await this.json(
          accessToken,
          "GET",
          `/v2/user/events/${encodeURIComponent(eventId)}/chat/history`,
          query,
        ),
        100,
      ),
    };
  }

  async getEventAnalytics(accessToken: string, input: JsonObject) {
    const eventId = this.uuid(input.eventId, "eventId");
    const kind = this.enumValue(input.kind, "kind", ["viewers", "messages"]);
    return {
      eventId,
      kind,
      analytics: this.bounded(
        await this.json(
          accessToken,
          "GET",
          `/v2/user/events/${encodeURIComponent(eventId)}/analytics/${kind}`,
        ),
        2_000,
      ),
    };
  }

  async listStorageFiles(accessToken: string) {
    return {
      storage: this.bounded(
        await this.json(accessToken, "GET", "/v2/user/storage/files"),
        500,
      ),
    };
  }

  async listClipProjects(accessToken: string, input: JsonObject) {
    const query: Record<string, string> = {
      limit: String(this.integer(input.limit, "limit", 1, 100, 25)),
      sortBy:
        input.sortBy === undefined
          ? "CreatedAt"
          : this.enumValue(input.sortBy, "sortBy", [
              "CreatedAt",
              "LastActivity",
            ]),
    };
    if (input.cursor !== undefined)
      query.cursor = this.string(input.cursor, "cursor", 2_000);
    return {
      projects: this.bounded(
        await this.json(accessToken, "GET", "/v2/user/clips/projects", query),
        100,
      ),
    };
  }

  async getClipProject(accessToken: string, input: JsonObject) {
    const projectId = this.identifier(input.projectId, "projectId");
    return {
      project: this.bounded(
        await this.json(
          accessToken,
          "GET",
          `/v2/user/clips/projects/${encodeURIComponent(projectId)}`,
        ),
        500,
      ),
    };
  }

  async listStudioAssets(accessToken: string, input: JsonObject) {
    const kind = this.enumValue(input.kind, "kind", [
      "countdown-music",
      "audio-backgrounds",
      "brands",
      "captions",
      "fonts",
      "qr-codes",
      "tickers",
    ]);
    const paths: Record<string, string> = {
      "countdown-music": "/v2/user/studio/audio/countdown-music",
      "audio-backgrounds": "/v2/user/studio/audio/backgrounds",
      brands: "/v2/user/studio/brands",
      captions: "/v2/user/studio/captions",
      fonts: "/v2/user/studio/fonts",
      "qr-codes": "/v2/user/studio/qr-codes",
      tickers: "/v2/user/studio/tickers",
    };
    const query: Record<string, string> = {};
    if (input.brandId !== undefined)
      query.brandId = this.uuid(input.brandId, "brandId");
    return {
      kind,
      assets: this.bounded(
        await this.json(accessToken, "GET", paths[kind], query),
        500,
      ),
    };
  }

  async requestDocumented(accessToken: string, input: JsonObject) {
    const method = this.enumValue(input.method, "method", [
      "GET",
      "POST",
      "PATCH",
      "DELETE",
    ]);
    const path = this.path(input.path, method);
    const query = this.query(input.query);
    const body =
      input.json === undefined ? undefined : this.requestBody(input.json);
    return {
      method,
      path,
      result: this.bounded(
        await this.json(accessToken, method, path, query, body),
        2_000,
      ),
    };
  }

  private path(value: unknown, method: string) {
    const path = this.string(value, "path", 1_000);
    if (
      !path.startsWith("/v2/user/") ||
      path.includes("..") ||
      path.includes("?") ||
      path.includes("#") ||
      FORBIDDEN_PATH.test(path)
    )
      throw new RestreamApiError(
        "policy_blocked",
        "Restream path is outside the documented bounded HTTP allowlist.",
      );
    if (method === "POST" && path === "/v2/user/channels")
      throw new RestreamApiError(
        "policy_blocked",
        "Restream channel creation requires destination stream credentials and is not agent-callable.",
      );
    return path;
  }

  private query(value: unknown) {
    if (value === undefined) return {};
    const query = this.objectStrict(value, "query");
    const entries = Object.entries(query);
    if (entries.length > 20) this.invalid("query");
    const result: Record<string, string> = {};
    for (const [key, item] of entries) {
      if (!/^[A-Za-z][A-Za-z0-9_.-]{0,99}$/.test(key)) this.invalid("query");
      if (typeof item === "boolean" || typeof item === "number")
        result[key] = String(item);
      else result[key] = this.string(item, `query.${key}`, 2_000);
    }
    return result;
  }

  private requestBody(value: unknown) {
    const body = this.objectStrict(value, "json");
    this.assertBody(body, 0);
    return body;
  }

  private assertBody(value: unknown, depth: number): void {
    if (depth > 8) this.invalid("json");
    if (Array.isArray(value)) {
      if (value.length > 500) this.invalid("json");
      for (const item of value) this.assertBody(item, depth + 1);
      return;
    }
    if (value && typeof value === "object") {
      const entries = Object.entries(value as JsonObject);
      if (entries.length > 100) this.invalid("json");
      for (const [key, item] of entries) {
        if (SECRET_KEY.test(key))
          throw new RestreamApiError(
            "policy_blocked",
            "Restream credential-bearing request fields are not agent-callable.",
          );
        this.assertBody(item, depth + 1);
      }
      return;
    }
    if (typeof value === "string" && value.length > 100_000)
      this.invalid("json");
    if (
      value !== null &&
      value !== undefined &&
      !["string", "number", "boolean"].includes(typeof value)
    )
      this.invalid("json");
  }

  private async json(
    accessToken: string,
    method: string,
    path: string,
    query: Record<string, string> = {},
    body?: JsonObject,
  ) {
    if (!accessToken || accessToken.length > 10_000)
      throw new RestreamApiError(
        "provider_validation_error",
        "Restream access token is unavailable.",
      );
    const url = new URL(path, ORIGIN);
    if (url.origin !== ORIGIN || !url.pathname.startsWith("/v2/user/"))
      throw new RestreamApiError(
        "policy_blocked",
        "Restream origin is not allowlisted.",
      );
    for (const [key, value] of Object.entries(query))
      url.searchParams.set(key, value);
    let response: Response;
    try {
      response = await this.http(url.toString(), {
        method,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
    } catch (error) {
      throw new RestreamApiError(
        "provider_unavailable",
        error instanceof Error && error.name === "TimeoutError"
          ? "Restream request timed out."
          : "Restream request failed.",
      );
    }
    const raw = await response.text();
    if (raw.length > 3_000_000)
      throw new RestreamApiError(
        "provider_validation_error",
        "Restream response exceeded the safe size limit.",
      );
    let parsed: unknown = {};
    if (raw) {
      try {
        parsed = JSON.parse(raw);
      } catch {
        throw new RestreamApiError(
          "provider_unavailable",
          "Restream returned invalid JSON.",
          response.status,
        );
      }
    }
    if (!response.ok)
      throw new RestreamApiError(
        this.errorCode(response.status),
        `Restream request failed with ${response.status}.`,
        response.status,
      );
    return parsed;
  }

  private bounded(value: unknown, arrayLimit: number) {
    return this.safeValue(value, arrayLimit);
  }

  private safeValue(value: unknown, arrayLimit = 500, depth = 0): unknown {
    if (depth > 12) return "[TRUNCATED]";
    if (Array.isArray(value))
      return value
        .slice(0, arrayLimit)
        .map((item) => this.safeValue(item, arrayLimit, depth + 1));
    if (value && typeof value === "object") {
      const result: JsonObject = {};
      for (const [key, item] of Object.entries(value as JsonObject).slice(
        0,
        500,
      ))
        result[key] = SECRET_KEY.test(key)
          ? "[REDACTED]"
          : this.safeValue(item, arrayLimit, depth + 1);
      return result;
    }
    if (typeof value === "string") return value.slice(0, 1_000_000);
    return value;
  }

  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }

  private objectStrict(value: unknown, field: string): JsonObject {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      this.invalid(field);
    }
    return value as JsonObject;
  }

  private identifier(value: unknown, field: string) {
    const text = this.string(value, field, 200);
    if (!IDENTIFIER.test(text)) this.invalid(field);
    return text;
  }

  private uuid(value: unknown, field: string) {
    const text = this.string(value, field, 36);
    if (!UUID.test(text)) this.invalid(field);
    return text;
  }

  private string(value: unknown, field: string, maxLength: number) {
    if (typeof value !== "string" || !value.trim() || value.length > maxLength)
      this.invalid(field);
    return value.trim();
  }

  private integer(
    value: unknown,
    field: string,
    minimum: number,
    maximum: number,
    fallback: number,
  ) {
    if (value === undefined) return fallback;
    if (
      !Number.isSafeInteger(value) ||
      (value as number) < minimum ||
      (value as number) > maximum
    )
      this.invalid(field);
    return value as number;
  }

  private enumValue<T extends string>(
    value: unknown,
    field: string,
    values: T[],
  ) {
    if (typeof value !== "string" || !values.includes(value as T))
      this.invalid(field);
    return value as T;
  }

  private invalid(field: string): never {
    throw new RestreamApiError(
      "provider_validation_error",
      `Invalid Restream ${field}.`,
    );
  }

  private errorCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
}
