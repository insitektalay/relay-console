import { createHash } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

export type BuzzsproutCredentials = {
  apiToken: string;
  podcastId: string;
};

export class BuzzsproutApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

type HttpClient = (url: string, init: RequestInit) => Promise<Response>;
type JsonObject = Record<string, unknown>;
type CacheEntry = {
  etag: string | null;
  lastModified: string | null;
  body: unknown;
};

const API_ORIGIN = "https://www.buzzsprout.com";
const PODCAST_ID = /^[1-9][0-9]{0,15}$/;
const PRIVATE_V4 =
  /^(?:10\.|127\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2[0-9]|3[01])\.)/;
const WRITABLE_FIELDS = new Map<string, string>([
  ["title", "title"],
  ["description", "description"],
  ["summary", "summary"],
  ["artist", "artist"],
  ["tags", "tags"],
  ["publishedAt", "published_at"],
  ["duration", "duration"],
  ["guid", "guid"],
  ["inactiveAt", "inactive_at"],
  ["episodeNumber", "episode_number"],
  ["seasonNumber", "season_number"],
  ["explicit", "explicit"],
  ["private", "private"],
  ["emailUserAfterAudioProcessed", "email_user_after_audio_processed"],
  ["audioUrl", "audio_url"],
  ["artworkUrl", "artwork_url"],
]);

@Injectable()
export class BuzzsproutApiAdapter {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(private readonly request: HttpClient = fetch) {}

  async health(credentials: BuzzsproutCredentials) {
    return this.getPodcast(credentials);
  }

  async getPodcast(credentials: BuzzsproutCredentials) {
    this.assertCredentials(credentials);
    const values = await this.getArray(
      credentials,
      "/api/podcasts.json",
      `podcasts:${this.tokenFingerprint(credentials.apiToken)}`,
    );
    const podcast = values
      .map((value) => this.object(value))
      .find((value) => String(value.id ?? "") === credentials.podcastId);
    if (!podcast) {
      throw new BuzzsproutApiError(
        "provider_validation_error",
        "Buzzsprout token is not authorized for the connected podcast.",
      );
    }
    return { podcast: this.podcast(podcast) };
  }

  async listEpisodes(credentials: BuzzsproutCredentials, input: JsonObject) {
    this.assertCredentials(credentials);
    const limit = this.integer(input.limit, "limit", 1, 50, 25);
    const includePrivate = input.includePrivate === true;
    const includeInactive = input.includeInactive === true;
    const values = await this.getArray(
      credentials,
      `/api/${credentials.podcastId}/episodes.json`,
      `episodes:${this.tokenFingerprint(credentials.apiToken)}:${credentials.podcastId}`,
    );
    const filtered = values
      .map((value) => this.object(value))
      .filter((value) => includePrivate || value.private !== true)
      .filter((value) => includeInactive || value.inactive_at == null);
    return {
      podcastId: credentials.podcastId,
      episodes: filtered.slice(0, limit).map((value) => this.episode(value)),
      returned: Math.min(filtered.length, limit),
      matched: filtered.length,
      truncated: filtered.length > limit,
    };
  }

  async getEpisode(credentials: BuzzsproutCredentials, input: JsonObject) {
    this.assertCredentials(credentials);
    const episodeId = this.episodeId(input.episodeId);
    const body = await this.requestJson(
      credentials,
      "GET",
      `/api/${credentials.podcastId}/episodes/${episodeId}.json`,
      undefined,
      `episode:${this.tokenFingerprint(credentials.apiToken)}:${credentials.podcastId}:${episodeId}`,
    );
    return {
      podcastId: credentials.podcastId,
      episode: this.episode(this.object(body)),
    };
  }

  async createEpisode(credentials: BuzzsproutCredentials, input: JsonObject) {
    this.assertCredentials(credentials);
    const payload = this.episodePayload(input, true);
    const body = await this.requestJson(
      credentials,
      "POST",
      `/api/${credentials.podcastId}/episodes.json`,
      payload,
    );
    this.invalidateEpisodes(credentials);
    return {
      podcastId: credentials.podcastId,
      episode: this.episode(this.object(body)),
    };
  }

  async updateEpisode(credentials: BuzzsproutCredentials, input: JsonObject) {
    this.assertCredentials(credentials);
    const episodeId = this.episodeId(input.episodeId);
    const payload = this.episodePayload(input, false);
    if (Object.keys(payload).length === 0) {
      throw new BuzzsproutApiError(
        "provider_validation_error",
        "Buzzsprout episode update requires at least one supported field.",
      );
    }
    const body = await this.requestJson(
      credentials,
      "PUT",
      `/api/${credentials.podcastId}/episodes/${episodeId}.json`,
      payload,
    );
    this.invalidateEpisodes(credentials);
    return {
      podcastId: credentials.podcastId,
      episode: this.episode(this.object(body)),
    };
  }

  private async getArray(
    credentials: BuzzsproutCredentials,
    path: string,
    cacheKey: string,
  ) {
    const body = await this.requestJson(
      credentials,
      "GET",
      path,
      undefined,
      cacheKey,
    );
    if (!Array.isArray(body)) {
      throw new BuzzsproutApiError(
        "provider_unavailable",
        "Buzzsprout returned an invalid collection response.",
      );
    }
    return body;
  }

  private async requestJson(
    credentials: BuzzsproutCredentials,
    method: "GET" | "POST" | "PUT",
    path: string,
    body?: JsonObject,
    cacheKey?: string,
  ): Promise<unknown> {
    this.assertCredentials(credentials);
    const url = new URL(path, API_ORIGIN);
    if (url.origin !== API_ORIGIN || !url.pathname.endsWith(".json")) {
      throw new BuzzsproutApiError(
        "policy_blocked",
        "Buzzsprout request path is not allowlisted.",
      );
    }
    const cached = cacheKey ? this.cache.get(cacheKey) : undefined;
    const headers: Record<string, string> = {
      Accept: "application/json",
      Authorization: `Token token=${credentials.apiToken}`,
      "User-Agent": "RelayConsole-Buzzsprout/1.0",
    };
    if (body !== undefined)
      headers["Content-Type"] = "application/json; charset=utf-8";
    if (cached?.etag) headers["If-None-Match"] = cached.etag;
    if (cached?.lastModified)
      headers["If-Modified-Since"] = cached.lastModified;
    let response: Response;
    try {
      response = await this.request(url.toString(), {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new BuzzsproutApiError(
        "provider_unavailable",
        "Buzzsprout is temporarily unavailable.",
      );
    }
    if (response.status === 304 && cached) return cached.body;
    const raw = await response.text();
    if (raw.length > 3_000_000) {
      throw new BuzzsproutApiError(
        "provider_validation_error",
        "Buzzsprout response exceeded the safe size limit.",
      );
    }
    let parsed: unknown = {};
    try {
      parsed = raw ? JSON.parse(raw) : {};
    } catch {
      throw new BuzzsproutApiError(
        "provider_unavailable",
        "Buzzsprout returned invalid JSON.",
      );
    }
    if (!response.ok) {
      throw new BuzzsproutApiError(
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
        "Buzzsprout API request failed.",
        response.status,
        { retryAfter: response.headers.get("retry-after") },
      );
    }
    if (cacheKey && method === "GET") {
      this.cache.set(cacheKey, {
        etag: response.headers.get("etag"),
        lastModified: response.headers.get("last-modified"),
        body: parsed,
      });
    }
    return parsed;
  }

  private episodePayload(input: JsonObject, creating: boolean) {
    const payload: JsonObject = {};
    for (const [inputName, providerName] of WRITABLE_FIELDS) {
      if (!(inputName in input)) continue;
      const value = input[inputName];
      if (inputName === "audioUrl" || inputName === "artworkUrl") {
        payload[providerName] = this.publicHttpsUrl(value, inputName);
      } else if (inputName === "publishedAt" || inputName === "inactiveAt") {
        payload[providerName] =
          value === null ? null : this.dateTime(value, inputName);
      } else if (inputName === "title") {
        payload[providerName] = this.boundedString(value, inputName, 1, 500);
      } else if (
        ["description", "summary", "artist", "tags", "guid"].includes(inputName)
      ) {
        const max =
          inputName === "description"
            ? 50_000
            : inputName === "summary"
              ? 10_000
              : inputName === "tags"
                ? 5_000
                : 500;
        payload[providerName] = this.boundedString(
          value,
          inputName,
          inputName === "guid" ? 1 : 0,
          max,
        );
      } else if (
        ["duration", "episodeNumber", "seasonNumber"].includes(inputName)
      ) {
        if (value === null && inputName !== "duration")
          payload[providerName] = null;
        else
          payload[providerName] = this.integer(
            value,
            inputName,
            0,
            inputName === "duration" ? 604_800_000 : 1_000_000,
          );
      } else if (typeof value === "boolean") {
        payload[providerName] = value;
      } else {
        throw new BuzzsproutApiError(
          "provider_validation_error",
          `Buzzsprout ${inputName} is invalid.`,
        );
      }
    }
    if (creating && !("title" in payload)) {
      throw new BuzzsproutApiError(
        "provider_validation_error",
        "Buzzsprout episode title is required.",
      );
    }
    return payload;
  }

  private podcast(body: JsonObject) {
    return {
      id: this.scalar(body.id),
      title: this.scalar(body.title),
      author: this.scalar(body.author),
      description: this.text(body.description, 10_000),
      websiteAddress: this.safePublicUrl(body.website_address),
      keywords: this.text(body.keywords, 2_000),
      explicit: this.boolean(body.explicit),
      mainCategory: this.scalar(body.main_category),
      subCategory: this.scalar(body.sub_category),
      language: this.scalar(body.language),
      timezone: this.scalar(body.timezone),
      artworkUrl: this.safePublicUrl(body.artwork_url),
      backgroundUrl: this.safePublicUrl(body.background_url),
    };
  }

  private episode(body: JsonObject) {
    return {
      id: this.scalar(body.id),
      title: this.text(body.title, 500),
      audioUrl: this.safePublicUrl(body.audio_url),
      artworkUrl: this.safePublicUrl(body.artwork_url),
      description: this.text(body.description, 10_000),
      summary: this.text(body.summary, 5_000),
      artist: this.text(body.artist, 500),
      tags: this.text(body.tags, 2_000),
      publishedAt: this.scalar(body.published_at),
      duration: this.number(body.duration),
      hq: this.boolean(body.hq),
      magicMastering: this.boolean(body.magic_mastering),
      guid: this.text(body.guid, 500),
      inactiveAt: this.scalar(body.inactive_at),
      episodeNumber: this.number(body.episode_number),
      seasonNumber: this.number(body.season_number),
      explicit: this.boolean(body.explicit),
      private: this.boolean(body.private),
      totalPlays: this.number(body.total_plays),
    };
  }

  private assertCredentials(credentials: BuzzsproutCredentials) {
    if (!credentials.apiToken.trim()) {
      throw new BuzzsproutApiError(
        "credential_missing",
        "Buzzsprout API token is missing.",
      );
    }
    if (!PODCAST_ID.test(credentials.podcastId)) {
      throw new BuzzsproutApiError(
        "provider_validation_error",
        "Buzzsprout connection is not bound to a valid podcast ID.",
      );
    }
  }

  private episodeId(value: unknown) {
    const id = this.integer(value, "episodeId", 1, Number.MAX_SAFE_INTEGER);
    return String(id);
  }

  private publicHttpsUrl(value: unknown, field: string) {
    if (typeof value !== "string" || value.length > 4096) {
      throw new BuzzsproutApiError(
        "provider_validation_error",
        `Buzzsprout ${field} must be a bounded public HTTPS URL.`,
      );
    }
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new BuzzsproutApiError(
        "provider_validation_error",
        `Buzzsprout ${field} is invalid.`,
      );
    }
    const host = url.hostname.toLowerCase();
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      host === "localhost" ||
      host.endsWith(".localhost") ||
      host.endsWith(".local") ||
      host === "::1" ||
      PRIVATE_V4.test(host)
    ) {
      throw new BuzzsproutApiError(
        "policy_blocked",
        `Buzzsprout ${field} must use a public HTTPS origin without credentials.`,
      );
    }
    return url.toString();
  }

  private safePublicUrl(value: unknown) {
    if (typeof value !== "string") return null;
    try {
      const url = new URL(value);
      return ["https:", "http:"].includes(url.protocol) &&
        !url.username &&
        !url.password
        ? url.toString().slice(0, 4096)
        : null;
    } catch {
      return null;
    }
  }

  private dateTime(value: unknown, field: string) {
    if (
      typeof value !== "string" ||
      value.length > 100 ||
      !Number.isFinite(Date.parse(value))
    ) {
      throw new BuzzsproutApiError(
        "provider_validation_error",
        `Buzzsprout ${field} must be an ISO-8601 date-time.`,
      );
    }
    return value;
  }

  private boundedString(
    value: unknown,
    field: string,
    min: number,
    max: number,
  ) {
    if (typeof value !== "string" || value.length < min || value.length > max) {
      throw new BuzzsproutApiError(
        "provider_validation_error",
        `Buzzsprout ${field} is outside the supported length.`,
      );
    }
    return value;
  }

  private integer(
    value: unknown,
    field: string,
    min: number,
    max: number,
    fallback?: number,
  ) {
    if (value === undefined && fallback !== undefined) return fallback;
    if (
      !Number.isSafeInteger(value) ||
      Number(value) < min ||
      Number(value) > max
    ) {
      throw new BuzzsproutApiError(
        "provider_validation_error",
        `Buzzsprout ${field} is outside the supported range.`,
      );
    }
    return Number(value);
  }

  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }

  private scalar(value: unknown): string | number | boolean | null {
    if (typeof value === "string") return value.slice(0, 1_000);
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "boolean") return value;
    return null;
  }

  private text(value: unknown, max: number) {
    return typeof value === "string" ? value.slice(0, max) : null;
  }

  private number(value: unknown) {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }

  private boolean(value: unknown) {
    return typeof value === "boolean" ? value : null;
  }

  private tokenFingerprint(token: string) {
    return createHash("sha256").update(token).digest("hex").slice(0, 16);
  }

  private invalidateEpisodes(credentials: BuzzsproutCredentials) {
    const token = this.tokenFingerprint(credentials.apiToken);
    const episodeList = `episodes:${token}:${credentials.podcastId}`;
    const episodePrefix = `episode:${token}:${credentials.podcastId}:`;
    for (const key of this.cache.keys()) {
      if (key === episodeList || key.startsWith(episodePrefix)) {
        this.cache.delete(key);
      }
    }
  }
}
