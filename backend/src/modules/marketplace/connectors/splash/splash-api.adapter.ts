import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;
export type SplashCredentials = {
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
};

export class SplashApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class SplashApiAdapter {
  private readonly apiOrigin = "https://api.splashthat.com";
  constructor(private readonly requester: Requester = fetch) {}

  async health(credentials: SplashCredentials) {
    await this.listEvents(credentials, { limit: 1 });
    return { apiOrigin: this.apiOrigin, username: credentials.username };
  }

  async listEvents(
    credentials: SplashCredentials,
    input: { limit?: number } = {},
  ) {
    const token = await this.token(credentials);
    const limit = this.limit(input.limit);
    const body = this.object(
      await this.get(token, `/events?limit=${limit}&page=1`),
    );
    const data = Array.isArray(body.data) ? body.data : [];
    return {
      events: data.slice(0, limit).map((item) => this.event(item)),
      page: 1,
      pageBound: limit,
      automaticPagination: false,
    };
  }

  async getEvent(credentials: SplashCredentials, input: { eventId: string }) {
    const token = await this.token(credentials);
    const eventId = this.identifier(input.eventId, "event ID");
    const body = this.object(await this.get(token, `/events/${eventId}`));
    return { event: this.event(body.data ?? body) };
  }

  private async token(credentials: SplashCredentials) {
    this.required(credentials.clientId, "client ID", 1_000);
    this.required(credentials.clientSecret, "client secret", 4_096);
    this.email(credentials.username);
    this.required(credentials.password, "API user password", 4_096);
    const form = new URLSearchParams({
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      grant_type: "password",
      scope: "user",
      username: credentials.username,
      password: credentials.password,
    });
    const body = this.object(
      await this.call(`${this.apiOrigin}/oauth/v2/token`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
      }),
    );
    const token = this.text(
      body.access_token ?? this.object(body.data).access_token,
      4_096,
    );
    if (!token)
      throw new SplashApiError(
        "credential_missing",
        "Splash did not issue an access token.",
        401,
      );
    return token;
  }

  private get(token: string, path: string) {
    if (!/^\/events(?:\/[0-9]+)?(?:\?limit=[0-9]+&page=1)?$/.test(path))
      throw new SplashApiError(
        "provider_validation_error",
        "Splash API path is invalid.",
      );
    return this.call(`${this.apiOrigin}${path}`, {
      method: "GET",
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    });
  }

  private async call(url: string, init: RequestInit) {
    let response: Response;
    try {
      response = await this.requester(url, {
        ...init,
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch (error) {
      if (error instanceof SplashApiError) throw error;
      throw new SplashApiError(
        "provider_unavailable",
        "Splash could not be reached.",
        502,
      );
    }
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > 2_000_000)
      throw new SplashApiError(
        "provider_validation_error",
        "Splash response exceeds 2 MB.",
      );
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 2_000_000)
      throw new SplashApiError(
        "provider_validation_error",
        "Splash response exceeds 2 MB.",
      );
    let body: unknown;
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      throw new SplashApiError(
        "provider_validation_error",
        "Splash returned invalid JSON.",
        response.status,
      );
    }
    if (!response.ok)
      throw new SplashApiError(
        this.safeCode(response.status),
        `Splash returned HTTP ${response.status}.`,
        response.status,
      );
    return body;
  }

  private event(value: unknown) {
    const item = this.object(value);
    return {
      eventId: this.identifier(item.id ?? item.event_id, "returned event ID"),
      name: this.required(item.title ?? item.name, "event title", 500),
      status: this.text(item.status, 100),
      type: this.text(item.type ?? item.event_type, 100),
      startsAt: this.date(item.start_time ?? item.event_start),
      endsAt: this.date(item.end_time ?? item.event_end),
      timezone: this.text(item.timezone, 100),
      publicUrl: this.httpsUrl(item.domain ?? item.url),
    };
  }
  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }
  private required(value: unknown, label: string, max: number) {
    const text = this.text(value, max);
    if (!text)
      throw new SplashApiError(
        "credential_missing",
        `Splash ${label} is required.`,
        401,
      );
    return text;
  }
  private email(value: unknown) {
    const text = this.required(value, "API username", 320);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text))
      throw new SplashApiError(
        "provider_validation_error",
        "Splash API username must be an email address.",
      );
    return text;
  }
  private identifier(value: unknown, label: string) {
    const text =
      typeof value === "number" && Number.isSafeInteger(value)
        ? String(value)
        : this.text(value, 20);
    if (!text || !/^[1-9][0-9]{0,19}$/.test(text))
      throw new SplashApiError(
        "provider_validation_error",
        `Splash ${label} is invalid.`,
      );
    return text;
  }
  private text(value: unknown, max: number) {
    return typeof value === "string" && value.trim()
      ? value.trim().slice(0, max)
      : null;
  }
  private date(value: unknown) {
    const text = this.text(value, 100);
    return text && !Number.isNaN(Date.parse(text)) ? text : null;
  }
  private httpsUrl(value: unknown) {
    const text = this.text(value, 2_000);
    if (!text) return null;
    try {
      const url = new URL(text.startsWith("http") ? text : `https://${text}`);
      return url.protocol === "https:" ? url.toString() : null;
    } catch {
      return null;
    }
  }
  private limit(value?: number) {
    return Number.isInteger(value) && value! >= 1 && value! <= 25 ? value! : 25;
  }
  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    return status >= 500 ? "provider_unavailable" : "provider_validation_error";
  }
}
