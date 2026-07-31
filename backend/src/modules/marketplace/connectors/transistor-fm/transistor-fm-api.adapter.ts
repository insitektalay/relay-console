import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

export type TransistorFmCredentials = { apiKey: string; showId: string };
export class TransistorFmApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}
type HttpClient = (url: string, init: RequestInit) => Promise<Response>;
type JsonObject = Record<string, unknown>;
const ORIGIN = "https://api.transistor.fm";
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9_-]{0,199}$/;

@Injectable()
export class TransistorFmApiAdapter {
  constructor(private readonly request: HttpClient = fetch) {}

  async health(credentials: TransistorFmCredentials) {
    return this.getShow(credentials);
  }

  async getShow(credentials: TransistorFmCredentials) {
    this.assertCredentials(credentials);
    const resource = this.resource(
      await this.get(
        credentials,
        `/v1/shows/${encodeURIComponent(credentials.showId)}`,
      ),
    );
    if (
      resource.id !== credentials.showId &&
      this.string(this.object(resource.attributes).slug, 200) !==
        credentials.showId
    )
      this.invalid("show binding");
    return { show: this.show(resource) };
  }

  async listEpisodes(credentials: TransistorFmCredentials, input: JsonObject) {
    this.assertCredentials(credentials);
    const page = this.integer(input.page, "page", 1, 1000, 1),
      per = this.integer(input.perPage, "perPage", 1, 50, 25);
    const query: Record<string, string> = {
      show_id: credentials.showId,
      "pagination[page]": String(page),
      "pagination[per]": String(per),
      order: input.order === "asc" ? "asc" : "desc",
    };
    if (input.status !== undefined)
      query.status = this.enumValue(input.status, "status", [
        "published",
        "scheduled",
        "draft",
      ]);
    const body = this.object(
      await this.get(credentials, "/v1/episodes", query),
    );
    const data = Array.isArray(body.data)
      ? body.data.slice(0, per).map((item) => this.episode(this.resource(item)))
      : [];
    return {
      showId: credentials.showId,
      episodes: data,
      page,
      perPage: per,
      meta: this.safeObject(body.meta, 20),
    };
  }

  async getEpisode(credentials: TransistorFmCredentials, input: JsonObject) {
    const id = this.identifier(input.episodeId, "episodeId");
    const resource = await this.boundEpisode(credentials, id);
    return { showId: credentials.showId, episode: this.episode(resource) };
  }

  async getAnalytics(credentials: TransistorFmCredentials, input: JsonObject) {
    this.assertCredentials(credentials);
    const scope = this.enumValue(input.scope, "scope", [
      "show",
      "episodes",
      "episode",
    ]);
    const query = this.analyticsDates(input);
    let path = `/v1/analytics/${encodeURIComponent(credentials.showId)}`;
    if (scope === "episodes") path += "/episodes";
    if (scope === "episode") {
      const episodeId = this.identifier(input.episodeId, "episodeId");
      await this.boundEpisode(credentials, episodeId);
      path = `/v1/analytics/episodes/${encodeURIComponent(episodeId)}`;
    }
    const body = this.resource(await this.get(credentials, path, query));
    return {
      showId: credentials.showId,
      scope,
      analytics: this.safeObject(body.attributes, 500),
    };
  }

  private async boundEpisode(
    credentials: TransistorFmCredentials,
    episodeId: string,
  ) {
    this.assertCredentials(credentials);
    const body = this.object(
      await this.get(
        credentials,
        `/v1/episodes/${encodeURIComponent(episodeId)}`,
        { "include[]": "show", "fields[show][]": "title" },
      ),
    );
    const resource = this.resource(body);
    const relationship = this.object(
      this.object(this.object(resource.relationships).show).data,
    );
    if (String(relationship.id ?? "") !== credentials.showId)
      this.invalid("episode show binding");
    return resource;
  }

  private async get(
    credentials: TransistorFmCredentials,
    path: string,
    query: Record<string, string> = {},
  ) {
    const url = new URL(path, ORIGIN);
    if (
      url.origin !== ORIGIN ||
      !url.pathname.startsWith("/v1/") ||
      path.includes("..")
    )
      throw new TransistorFmApiError(
        "policy_blocked",
        "Transistor request path is not allowlisted.",
      );
    for (const [key, value] of Object.entries(query))
      url.searchParams.set(key, value);
    let response: Response;
    try {
      response = await this.request(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
          "x-api-key": credentials.apiKey,
          "User-Agent": "RelayConsole-Transistor/1.0",
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new TransistorFmApiError(
        "provider_unavailable",
        "Transistor is temporarily unavailable.",
      );
    }
    const raw = await response.text();
    if (raw.length > 3_000_000)
      throw new TransistorFmApiError(
        "provider_validation_error",
        "Transistor response exceeded the safe size limit.",
      );
    let body: unknown;
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      throw new TransistorFmApiError(
        "provider_unavailable",
        "Transistor returned invalid JSON.",
      );
    }
    if (!response.ok)
      throw new TransistorFmApiError(
        response.status === 401
          ? "credential_missing"
          : response.status === 403
            ? "insufficient_scope"
            : response.status === 404
              ? "provider_validation_error"
              : response.status === 429
                ? "provider_rate_limited"
                : response.status >= 500
                  ? "provider_unavailable"
                  : "provider_validation_error",
        "Transistor API request failed.",
        response.status,
      );
    return body;
  }

  private show(resource: JsonObject) {
    const attributes = this.safeObject(resource.attributes, 100);
    const isPrivate = attributes.private === true;
    delete attributes.owner_email;
    delete attributes.email_notifications;
    if (isPrivate) delete attributes.feed_url;
    return { id: this.string(resource.id, 200), ...attributes };
  }
  private episode(resource: JsonObject) {
    const attributes = this.safeObject(resource.attributes, 100);
    for (const key of [
      "embed_html",
      "embed_html_dark",
      "transcript_text",
      "email_notifications",
    ])
      delete attributes[key];
    return { id: this.string(resource.id, 200), ...attributes };
  }
  private resource(value: unknown): JsonObject {
    const body = this.object(value),
      data =
        body.data && typeof body.data === "object"
          ? this.object(body.data)
          : body;
    return {
      ...data,
      attributes: this.object(data.attributes),
      relationships: this.object(data.relationships),
    };
  }
  private analyticsDates(input: JsonObject) {
    if (input.startDate === undefined && input.endDate === undefined) return {};
    const start = this.date(input.startDate, "startDate"),
      end = this.date(input.endDate, "endDate");
    if (
      end.getTime() < start.getTime() ||
      end.getTime() - start.getTime() > 366 * 86400000
    )
      this.invalid("analytics date range");
    return {
      start_date: this.string(input.startDate, 10),
      end_date: this.string(input.endDate, 10),
    };
  }
  private date(value: unknown, field: string) {
    if (typeof value !== "string" || !/^\d{2}-\d{2}-\d{4}$/.test(value))
      this.invalid(field);
    const [day, month, year] = String(value).split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    )
      this.invalid(field);
    return date;
  }
  private assertCredentials(value: TransistorFmCredentials) {
    if (!value.apiKey.trim())
      throw new TransistorFmApiError(
        "credential_missing",
        "Transistor API key is missing.",
      );
    this.identifier(value.showId, "showId");
  }
  private identifier(value: unknown, field: string) {
    if (typeof value !== "string" || !IDENTIFIER.test(value))
      this.invalid(field);
    return String(value);
  }
  private integer(
    value: unknown,
    field: string,
    min: number,
    max: number,
    fallback: number,
  ) {
    if (value === undefined) return fallback;
    if (
      !Number.isSafeInteger(value) ||
      Number(value) < min ||
      Number(value) > max
    )
      this.invalid(field);
    return Number(value);
  }
  private enumValue(value: unknown, field: string, allowed: string[]) {
    if (typeof value !== "string" || !allowed.includes(value))
      this.invalid(field);
    return String(value);
  }
  private invalid(field: string): never {
    throw new TransistorFmApiError(
      "provider_validation_error",
      `Transistor ${field} is invalid.`,
    );
  }
  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }
  private string(value: unknown, max: number) {
    return typeof value === "string" ? value.slice(0, max) : "";
  }
  private safeObject(value: unknown, maxKeys: number): JsonObject {
    const out: JsonObject = {};
    for (const [key, item] of Object.entries(this.object(value)).slice(
      0,
      maxKeys,
    )) {
      if (/email|token|secret|password|subscriber|subscribe_url/i.test(key))
        continue;
      if (typeof item === "string") out[key] = item.slice(0, 20_000);
      else if (
        typeof item === "number" ||
        typeof item === "boolean" ||
        item === null
      )
        out[key] = item;
      else if (Array.isArray(item))
        out[key] = item
          .slice(0, 500)
          .map((entry) =>
            typeof entry === "object" && entry
              ? this.safeObject(entry, 30)
              : entry,
          );
      else if (item && typeof item === "object")
        out[key] = this.safeObject(item, 30);
    }
    return out;
  }
}
