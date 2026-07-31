import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

export type CaptivateFmCredentials = {
  apiKey: string;
  userId: string;
  showId: string;
};
export class CaptivateFmApiError extends Error {
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
const ORIGIN = "https://api.captivate.fm";
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PRIVATE_V4 =
  /^(?:10\.|127\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2[0-9]|3[01])\.)/;
const EPISODE_FIELDS = new Map<string, string>([
  ["title", "title"],
  ["itunesTitle", "itunes_title"],
  ["mediaId", "media_id"],
  ["date", "date"],
  ["status", "status"],
  ["shownotes", "shownotes"],
  ["summary", "summary"],
  ["itunesSubtitle", "itunes_subtitle"],
  ["author", "author"],
  ["episodeArt", "episode_art"],
  ["explicit", "explicit"],
  ["episodeType", "episode_type"],
  ["episodeSeason", "episode_season"],
  ["episodeNumber", "episode_number"],
  ["donationLink", "donation_link"],
  ["donationText", "donation_text"],
  ["link", "link"],
  ["itunesBlock", "itunes_block"],
]);

@Injectable()
export class CaptivateFmApiAdapter {
  constructor(private readonly request: HttpClient = fetch) {}

  async health(credentials: CaptivateFmCredentials) {
    return this.getShow(credentials);
  }
  async getShow(credentials: CaptivateFmCredentials) {
    const token = await this.authenticate(credentials);
    const shows = await this.requestJson(
      token,
      "GET",
      `/users/${credentials.userId}/shows`,
    );
    const list = this.collection(shows);
    if (
      !list.some(
        (item) => String(this.object(item).id ?? "") === credentials.showId,
      )
    )
      throw new CaptivateFmApiError(
        "provider_validation_error",
        "Captivate credentials are not authorized for the connected show.",
      );
    const [show, feed] = await Promise.all([
      this.requestJson(token, "GET", `/shows/${credentials.showId}/`),
      this.requestJson(token, "GET", `/shows/${credentials.showId}/feed`),
    ]);
    return {
      show: this.redact(this.object(show)),
      feed: this.redact(this.object(feed)),
    };
  }
  async listEpisodes(credentials: CaptivateFmCredentials, input: JsonObject) {
    const token = await this.authenticate(credentials);
    const limit = this.integer(input.limit, "limit", 1, 50, 25);
    const suffix = input.scheduledOnly === true ? "/scheduled" : "";
    const body = await this.requestJson(
      token,
      "GET",
      `/shows/${credentials.showId}/episodes${suffix}`,
    );
    const items = this.collection(body)
      .slice(0, limit)
      .map((item) => this.redact(this.object(item)));
    return {
      showId: credentials.showId,
      episodes: items,
      returned: items.length,
      truncated: this.collection(body).length > limit,
    };
  }
  async getEpisode(credentials: CaptivateFmCredentials, input: JsonObject) {
    const episodeId = this.uuid(input.episodeId, "episodeId");
    const token = await this.authenticate(credentials);
    const episode = this.object(
      await this.requestJson(token, "GET", `/episodes/${episodeId}`),
    );
    this.assertShow(episode, credentials.showId);
    return { showId: credentials.showId, episode: this.redact(episode) };
  }
  async listMedia(credentials: CaptivateFmCredentials, input: JsonObject) {
    const token = await this.authenticate(credentials);
    const offset = this.integer(input.offset, "offset", 0, 10000, 0);
    const sort = input.sort === "ASC" ? "ASC" : "DESC";
    const body = await this.requestJson(
      token,
      "GET",
      `/shows/${credentials.showId}/media`,
      { offset: String(offset), order: "created_at", sort },
    );
    return {
      showId: credentials.showId,
      media: this.collection(body)
        .slice(0, 20)
        .map((item) => this.redact(this.object(item))),
      offset,
    };
  }
  async getMedia(credentials: CaptivateFmCredentials, input: JsonObject) {
    const mediaId = this.uuid(input.mediaId, "mediaId");
    const token = await this.authenticate(credentials);
    const media = this.object(
      await this.requestJson(token, "GET", `/media/${mediaId}`),
    );
    this.assertShow(media, credentials.showId);
    return { showId: credentials.showId, media: this.redact(media) };
  }
  async getAnalytics(credentials: CaptivateFmCredentials, input: JsonObject) {
    const token = await this.authenticate(credentials);
    const metric = String(input.metric ?? "");
    let path: string;
    const query: Record<string, string> = {};
    if (metric === "total") path = `/insights/${credentials.showId}/total`;
    else if (metric === "average") {
      path = `/insights/${credentials.showId}/averages`;
      query.intervalDays = String(
        this.integer(input.intervalDays, "intervalDays", 1, 366, 28),
      );
    } else if (metric === "overview") {
      const episodeId =
        input.episodeId === undefined
          ? ""
          : `/${this.uuid(input.episodeId, "episodeId")}`;
      path = `/insights/${credentials.showId}/overview${episodeId}`;
      this.analyticsPeriod(input, query);
      if (!episodeId)
        query.includeTopEpisodes =
          input.includeTopEpisodes === true ? "true" : "false";
    } else
      throw new CaptivateFmApiError(
        "provider_validation_error",
        "Captivate analytics metric is invalid.",
      );
    return {
      showId: credentials.showId,
      metric,
      analytics: this.redact(
        this.object(await this.requestJson(token, "GET", path, query)),
        100_000,
      ),
    };
  }
  async createEpisode(credentials: CaptivateFmCredentials, input: JsonObject) {
    const token = await this.authenticate(credentials);
    const fields = this.episodeFields(input, true);
    fields.set("shows_id", credentials.showId);
    const episode = this.object(
      await this.requestForm(token, "POST", "/episodes", fields),
    );
    this.assertShow(episode, credentials.showId);
    return { showId: credentials.showId, episode: this.redact(episode) };
  }
  async updateEpisode(credentials: CaptivateFmCredentials, input: JsonObject) {
    const id = this.uuid(input.episodeId, "episodeId");
    const token = await this.authenticate(credentials);
    const current = this.object(
      await this.requestJson(token, "GET", `/episodes/${id}`),
    );
    this.assertShow(current, credentials.showId);
    const fields = this.episodeFields(input, false);
    if (!fields.size)
      throw new CaptivateFmApiError(
        "provider_validation_error",
        "Captivate episode update requires at least one supported field.",
      );
    fields.set("shows_id", credentials.showId);
    const episode = this.object(
      await this.requestForm(token, "PUT", `/episodes/${id}`, fields),
    );
    this.assertShow(episode, credentials.showId);
    return { showId: credentials.showId, episode: this.redact(episode) };
  }

  private async authenticate(credentials: CaptivateFmCredentials) {
    this.assertCredentials(credentials);
    const form = new URLSearchParams({
      username: credentials.userId,
      token: credentials.apiKey,
    });
    const response = await this.fetch(`${ORIGIN}/authenticate/token`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "RelayConsole-Captivate/1.0",
      },
      body: form.toString(),
    });
    const body = this.object(await this.parse(response));
    const token = this.string(body.token ?? body.access_token, 8192);
    if (!token)
      throw new CaptivateFmApiError(
        "credential_missing",
        "Captivate did not issue an authenticated token.",
        response.status,
      );
    return token;
  }
  private async requestJson(
    token: string,
    method: "GET",
    path: string,
    query: Record<string, string> = {},
  ) {
    const url = this.url(path, query);
    const response = await this.fetch(url, {
      method,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "User-Agent": "RelayConsole-Captivate/1.0",
      },
    });
    return this.parse(response);
  }
  private async requestForm(
    token: string,
    method: "POST" | "PUT",
    path: string,
    form: URLSearchParams,
  ) {
    const response = await this.fetch(this.url(path), {
      method,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "RelayConsole-Captivate/1.0",
      },
      body: form.toString(),
    });
    return this.parse(response);
  }
  private async fetch(url: string, init: RequestInit) {
    try {
      return await this.request(url, {
        ...init,
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new CaptivateFmApiError(
        "provider_unavailable",
        "Captivate is temporarily unavailable.",
      );
    }
  }
  private async parse(response: Response) {
    const raw = await response.text();
    if (raw.length > 3_000_000)
      throw new CaptivateFmApiError(
        "provider_validation_error",
        "Captivate response exceeded the safe size limit.",
      );
    let body: unknown;
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      throw new CaptivateFmApiError(
        "provider_unavailable",
        "Captivate returned invalid JSON.",
      );
    }
    if (!response.ok)
      throw new CaptivateFmApiError(
        response.status === 401
          ? "credential_missing"
          : response.status === 403
            ? "insufficient_scope"
            : response.status === 429
              ? "provider_rate_limited"
              : response.status >= 500
                ? "provider_unavailable"
                : "provider_validation_error",
        "Captivate API request failed.",
        response.status,
      );
    return body;
  }
  private url(path: string, query: Record<string, string> = {}) {
    const url = new URL(path, ORIGIN);
    if (url.origin !== ORIGIN || path.includes(".."))
      throw new CaptivateFmApiError(
        "policy_blocked",
        "Captivate request path is not allowlisted.",
      );
    for (const [key, value] of Object.entries(query))
      url.searchParams.set(key, value);
    return url.toString();
  }
  private episodeFields(input: JsonObject, creating: boolean) {
    const form = new URLSearchParams();
    for (const [from, to] of EPISODE_FIELDS) {
      if (!(from in input)) continue;
      const value = input[from];
      if (["mediaId"].includes(from)) form.set(to, this.uuid(value, from));
      else if (["episodeSeason", "episodeNumber"].includes(from))
        form.set(to, String(this.integer(value, from, 0, 1_000_000)));
      else if (from === "itunesBlock") {
        if (typeof value !== "boolean") this.invalid(from);
        form.set(to, value ? "true" : "false");
      } else if (["episodeArt", "donationLink", "link"].includes(from)) {
        form.set(to, this.publicHttpsUrl(value, from));
      } else if (from === "status") {
        form.set(to, this.enumValue(value, from, ["Draft", "Published"]));
      } else if (from === "explicit") {
        form.set(to, this.enumValue(value, from, ["clean", "explicit"]));
      } else if (from === "episodeType") {
        form.set(to, this.enumValue(value, from, ["full", "bonus", "trailer"]));
      } else {
        const max = ["shownotes", "summary"].includes(from)
          ? 4000
          : ["episodeArt", "donationLink", "link"].includes(from)
            ? 4096
            : ["itunesSubtitle", "author", "donationText"].includes(from)
              ? 255
              : 500;
        form.set(
          to,
          this.requiredString(value, from, from === "title" ? 1 : 0, max),
        );
      }
    }
    if (creating && !form.has("title")) this.invalid("title");
    return form;
  }
  private analyticsPeriod(input: JsonObject, query: Record<string, string>) {
    if (input.start === undefined && input.end === undefined) return;
    const start = this.date(input.start, "start"),
      end = this.date(input.end, "end");
    if (
      end.getTime() < start.getTime() ||
      end.getTime() - start.getTime() > 366 * 86400000
    )
      throw new CaptivateFmApiError(
        "provider_validation_error",
        "Captivate analytics period must be ordered and at most 366 days.",
      );
    query.start = start.toISOString();
    query.end = end.toISOString();
  }
  private assertCredentials(c: CaptivateFmCredentials) {
    if (!c.apiKey.trim())
      throw new CaptivateFmApiError(
        "credential_missing",
        "Captivate API key is missing.",
      );
    this.uuid(c.userId, "userId");
    this.uuid(c.showId, "showId");
  }
  private assertShow(body: JsonObject, showId: string) {
    const actual = body.shows_id ?? body.show_id ?? this.object(body.show).id;
    if (actual === undefined || String(actual) !== showId)
      throw new CaptivateFmApiError(
        "provider_validation_error",
        "Captivate resource is outside the connected show.",
      );
  }
  private uuid(value: unknown, field: string) {
    if (typeof value !== "string" || !UUID.test(value)) this.invalid(field);
    return String(value);
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
    )
      this.invalid(field);
    return Number(value);
  }
  private requiredString(
    value: unknown,
    field: string,
    min: number,
    max: number,
  ) {
    if (typeof value !== "string" || value.length < min || value.length > max)
      this.invalid(field);
    return String(value);
  }
  private enumValue(value: unknown, field: string, values: string[]) {
    const text = this.requiredString(value, field, 1, 50);
    if (!values.includes(text)) this.invalid(field);
    return text;
  }
  private publicHttpsUrl(value: unknown, field: string) {
    const text = this.requiredString(value, field, 1, 4096);
    let url: URL;
    try {
      url = new URL(text);
    } catch {
      return this.invalid(field);
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
    )
      throw new CaptivateFmApiError(
        "policy_blocked",
        `Captivate ${field} must use a public HTTPS URL without credentials.`,
      );
    return url.toString();
  }
  private date(value: unknown, field: string) {
    if (typeof value !== "string" || !Number.isFinite(Date.parse(value)))
      this.invalid(field);
    return new Date(String(value));
  }
  private invalid(field: string): never {
    throw new CaptivateFmApiError(
      "provider_validation_error",
      `Captivate ${field} is invalid.`,
    );
  }
  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }
  private collection(value: unknown): unknown[] {
    if (Array.isArray(value)) return value;
    const body = this.object(value);
    for (const key of ["data", "episodes", "media", "shows", "results"])
      if (Array.isArray(body[key])) return body[key] as unknown[];
    return [];
  }
  private string(value: unknown, max: number) {
    return typeof value === "string" && value.length <= max ? value : "";
  }
  private redact(value: JsonObject, textLimit = 10_000): JsonObject {
    const out: JsonObject = {};
    for (const [key, item] of Object.entries(value).slice(0, 100)) {
      if (/email|token|key|secret|password|billing|subscriber/i.test(key))
        continue;
      if (typeof item === "string") out[key] = item.slice(0, textLimit);
      else if (
        typeof item === "number" ||
        typeof item === "boolean" ||
        item === null
      )
        out[key] = item;
      else if (Array.isArray(item))
        out[key] = item
          .slice(0, 50)
          .map((entry) =>
            typeof entry === "object" && entry
              ? this.redact(this.object(entry), 2000)
              : entry,
          );
      else if (typeof item === "object" && item)
        out[key] = this.redact(this.object(item), 2000);
    }
    return out;
  }
}
