import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;
export type AirmeetCredentials = {
  accessKey: string;
  secretKey: string;
  region: "default" | "eu" | "us";
};

export class AirmeetApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class AirmeetApiAdapter {
  constructor(private readonly requester: Requester = fetch) {}

  async health(credentials: AirmeetCredentials) {
    await this.listEvents(credentials, { limit: 1 });
    return {
      apiOrigin: this.origin(credentials.region),
      region: credentials.region,
    };
  }

  async listEvents(
    credentials: AirmeetCredentials,
    input: { limit?: number } = {},
  ) {
    const token = await this.token(credentials);
    const limit = this.limit(input.limit);
    const body = this.object(
      await this.get(credentials, token, `/airmeets?size=${limit}`),
    );
    const data = Array.isArray(body.data) ? body.data : [];
    return {
      events: data.slice(0, limit).map((item) => this.event(item)),
      pageBound: limit,
      automaticPagination: false,
    };
  }

  async listSessions(
    credentials: AirmeetCredentials,
    input: { eventId: string; limit?: number },
  ) {
    const token = await this.token(credentials);
    const eventId = this.identifier(input.eventId, "event ID");
    const limit = this.limit(input.limit);
    const body = this.object(
      await this.get(credentials, token, `/airmeet/${eventId}/info`),
    );
    const sessions = Array.isArray(body.sessions) ? body.sessions : [];
    return {
      eventId,
      sessions: sessions.slice(0, limit).map((item) => this.session(item)),
      pageBound: limit,
    };
  }

  private async token(credentials: AirmeetCredentials) {
    this.key(credentials.accessKey, "access key");
    this.key(credentials.secretKey, "secret key");
    const response = await this.call(
      `${this.origin(credentials.region)}/auth`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-Airmeet-Access-Key": credentials.accessKey,
          "X-Airmeet-Secret-Key": credentials.secretKey,
        },
      },
    );
    const body = this.object(response);
    const data = this.object(body.data);
    const token = this.text(data.token, 4_096);
    if (!token)
      throw new AirmeetApiError(
        "credential_missing",
        "Airmeet did not issue an access token.",
        401,
      );
    return token;
  }

  private get(credentials: AirmeetCredentials, token: string, path: string) {
    if (
      !/^\/[A-Za-z0-9_/?=&.-]+$/.test(path) ||
      path.includes("..") ||
      path.includes("//")
    )
      throw new AirmeetApiError(
        "provider_validation_error",
        "Airmeet API path is invalid.",
      );
    return this.call(`${this.origin(credentials.region)}${path}`, {
      method: "GET",
      headers: { Accept: "application/json", "X-Airmeet-Access-Token": token },
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
      if (error instanceof AirmeetApiError) throw error;
      throw new AirmeetApiError(
        "provider_unavailable",
        "Airmeet could not be reached.",
        502,
      );
    }
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > 2_000_000)
      throw new AirmeetApiError(
        "provider_validation_error",
        "Airmeet response exceeds 2 MB.",
      );
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 2_000_000)
      throw new AirmeetApiError(
        "provider_validation_error",
        "Airmeet response exceeds 2 MB.",
      );
    let body: unknown;
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      throw new AirmeetApiError(
        "provider_validation_error",
        "Airmeet returned invalid JSON.",
        response.status,
      );
    }
    if (!response.ok)
      throw new AirmeetApiError(
        this.safeCode(response.status),
        `Airmeet returned HTTP ${response.status}.`,
        response.status,
      );
    return body;
  }

  private origin(region: AirmeetCredentials["region"]) {
    if (region === "eu") return "https://api-gateway-prod.eu.airmeet.com/prod";
    if (region === "us") return "https://api-gateway-prod.us.airmeet.com/prod";
    if (region === "default") return "https://api-gateway.airmeet.com/prod";
    throw new AirmeetApiError(
      "provider_validation_error",
      "Airmeet region is invalid.",
    );
  }
  private event(value: unknown) {
    const item = this.object(value);
    return {
      eventId: this.identifier(item.uid, "returned event ID"),
      name: this.requiredText(item.name, "event name", 500),
      status: this.text(item.status, 100),
      timezone: this.text(item.timezone, 100),
      startsAt: this.date(item.startTime),
      endsAt: this.date(item.endTime),
    };
  }
  private session(value: unknown) {
    const item = this.object(value);
    return {
      sessionId: this.identifier(item.sessionid, "returned session ID"),
      name: this.requiredText(item.name, "session name", 500),
      status: this.text(item.status, 100),
      type: this.text(item.type, 100),
      startsAt: this.date(item.start_time),
      durationMinutes:
        typeof item.duration === "number" && Number.isFinite(item.duration)
          ? item.duration
          : null,
      summary: this.text(item.summary, 1_000),
    };
  }
  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }
  private key(value: unknown, label: string) {
    if (typeof value !== "string" || !value.trim() || value.length > 4_096)
      throw new AirmeetApiError(
        "credential_missing",
        `Airmeet ${label} is required.`,
        401,
      );
  }
  private identifier(value: unknown, label: string) {
    const text = this.text(value, 128);
    if (!text || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(text))
      throw new AirmeetApiError(
        "provider_validation_error",
        `Airmeet ${label} is invalid.`,
      );
    return text;
  }
  private requiredText(value: unknown, label: string, max: number) {
    const text = this.text(value, max);
    if (!text)
      throw new AirmeetApiError(
        "provider_validation_error",
        `Airmeet ${label} is missing.`,
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
  private limit(value?: number) {
    return Number.isInteger(value) && value! >= 1 && value! <= 25 ? value! : 25;
  }
  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 400 || status === 401 || status === 412)
      return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    return status >= 500 ? "provider_unavailable" : "provider_validation_error";
  }
}
