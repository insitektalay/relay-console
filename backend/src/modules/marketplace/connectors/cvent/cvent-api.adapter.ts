import type { MarketplaceConnectorSafeErrorCode } from "../types";
type JsonObject = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;
export type CventCredentials = {
  clientId: string;
  clientSecret: string;
  region: "us" | "emea";
};

export class CventApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class CventApiAdapter {
  constructor(private readonly requester: Requester = fetch) {}
  async health(credentials: CventCredentials) {
    await this.listEvents(credentials, { limit: 1 });
    return {
      apiOrigin: this.origin(credentials.region),
      region: credentials.region,
    };
  }
  async listEvents(
    credentials: CventCredentials,
    input: { limit?: number } = {},
  ) {
    const token = await this.token(credentials);
    const limit = this.limit(input.limit);
    const body = this.object(
      await this.get(credentials, token, `/ea/events?limit=${limit}`),
    );
    const items = Array.isArray(body.data)
      ? body.data
      : Array.isArray(body.events)
        ? body.events
        : [];
    return {
      events: items.slice(0, limit).map((item) => this.event(item)),
      pageBound: limit,
      automaticPagination: false,
    };
  }
  async getEvent(credentials: CventCredentials, input: { eventId: string }) {
    const token = await this.token(credentials);
    const eventId = this.identifier(input.eventId, "event ID");
    const body = this.object(
      await this.get(credentials, token, `/ea/events/${eventId}`),
    );
    return { event: this.event(body.data ?? body) };
  }
  private async token(credentials: CventCredentials) {
    this.required(credentials.clientId, "client ID", 1_000);
    this.required(credentials.clientSecret, "client secret", 4_096);
    const basic = Buffer.from(
      `${credentials.clientId}:${credentials.clientSecret}`,
      "utf8",
    ).toString("base64");
    const body = this.object(
      await this.call(`${this.origin(credentials.region)}/ea/oauth2/token`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Basic ${basic}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: credentials.clientId,
          scope: "event/events:read",
        }).toString(),
      }),
    );
    const token = this.text(body.access_token, 4_096);
    if (!token)
      throw new CventApiError(
        "credential_missing",
        "Cvent did not issue an access token.",
        401,
      );
    return token;
  }
  private get(credentials: CventCredentials, token: string, path: string) {
    if (!/^\/ea\/events(?:\/[A-Za-z0-9-]+)?(?:\?limit=[0-9]+)?$/.test(path))
      throw new CventApiError(
        "provider_validation_error",
        "Cvent API path is invalid.",
      );
    return this.call(`${this.origin(credentials.region)}${path}`, {
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
      if (error instanceof CventApiError) throw error;
      throw new CventApiError(
        "provider_unavailable",
        "Cvent could not be reached.",
        502,
      );
    }
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > 2_000_000)
      throw new CventApiError(
        "provider_validation_error",
        "Cvent response exceeds 2 MB.",
      );
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 2_000_000)
      throw new CventApiError(
        "provider_validation_error",
        "Cvent response exceeds 2 MB.",
      );
    let body: unknown;
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      throw new CventApiError(
        "provider_validation_error",
        "Cvent returned invalid JSON.",
        response.status,
      );
    }
    if (!response.ok)
      throw new CventApiError(
        this.safeCode(response.status),
        `Cvent returned HTTP ${response.status}.`,
        response.status,
      );
    return body;
  }
  private origin(region: CventCredentials["region"]) {
    if (region === "us") return "https://api-platform.cvent.com";
    if (region === "emea") return "https://api-platform-eur.cvent.com";
    throw new CventApiError(
      "provider_validation_error",
      "Cvent region is invalid.",
    );
  }
  private event(value: unknown) {
    const item = this.object(value);
    return {
      eventId: this.identifier(item.id ?? item.eventId, "returned event ID"),
      name: this.required(item.title ?? item.name, "event name", 500),
      status: this.text(item.status, 100),
      type: this.text(item.type ?? item.eventType, 100),
      startsAt: this.date(item.start ?? item.startDate ?? item.eventStart),
      endsAt: this.date(item.end ?? item.endDate ?? item.eventEnd),
      timezone: this.text(item.timezone ?? item.timeZone, 100),
      publicUrl: this.httpsUrl(item.webLink ?? item.url),
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
      throw new CventApiError(
        "credential_missing",
        `Cvent ${label} is required.`,
        401,
      );
    return text;
  }
  private identifier(value: unknown, label: string) {
    const text = this.text(value, 128);
    if (!text || !/^[A-Za-z0-9][A-Za-z0-9-]{0,127}$/.test(text))
      throw new CventApiError(
        "provider_validation_error",
        `Cvent ${label} is invalid.`,
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
      const url = new URL(text);
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
