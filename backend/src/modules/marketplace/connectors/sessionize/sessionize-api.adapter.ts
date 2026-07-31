import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;
export type SessionizeCredentials = { endpointId: string };

export class SessionizeApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class SessionizeApiAdapter {
  constructor(private readonly requester: Requester = fetch) {}
  async health(credentials: SessionizeCredentials) {
    await this.listSessions(credentials, { limit: 1 });
    return { apiOrigin: "https://sessionize.com" };
  }
  async listSessions(
    credentials: SessionizeCredentials,
    input: { limit?: number } = {},
  ) {
    const limit =
      Number.isInteger(input.limit) && input.limit! >= 1 && input.limit! <= 25
        ? input.limit!
        : 25;
    const sessions = (await this.sessions(credentials))
      .slice(0, limit)
      .map((item) => this.summary(item));
    return { sessions, resultBound: limit, automaticPagination: false };
  }
  async getSession(
    credentials: SessionizeCredentials,
    input: { sessionId: string },
  ) {
    const sessionId = this.identifier(input.sessionId, "session ID");
    const item = (await this.sessions(credentials)).find(
      (candidate) => String(candidate.id) === sessionId,
    );
    if (!item)
      throw new SessionizeApiError(
        "provider_validation_error",
        "Sessionize session was not found.",
        404,
      );
    return { session: this.summary(item) };
  }
  private async sessions(
    credentials: SessionizeCredentials,
  ): Promise<JsonObject[]> {
    const endpointId = credentials.endpointId?.trim();
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(endpointId))
      throw new SessionizeApiError(
        "credential_missing",
        "A valid Sessionize endpoint ID is required.",
        401,
      );
    let response: Response;
    try {
      response = await this.requester(
        `https://sessionize.com/api/v2/${encodeURIComponent(endpointId)}/view/Sessions`,
        {
          method: "GET",
          redirect: "error",
          signal: AbortSignal.timeout(20_000),
          cache: "no-store",
          headers: {
            Accept: "application/json",
            "User-Agent": "RelayConsole-sessionize/1.0",
          },
        },
      );
    } catch {
      throw new SessionizeApiError(
        "provider_unavailable",
        "Sessionize could not be reached.",
        502,
      );
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 2_000_000)
      throw new SessionizeApiError(
        "provider_validation_error",
        "Sessionize response exceeds Relay's 2 MB boundary.",
      );
    let body: unknown;
    try {
      body = raw ? JSON.parse(raw) : [];
    } catch {
      throw new SessionizeApiError(
        "provider_validation_error",
        "Sessionize returned invalid JSON.",
        response.status,
      );
    }
    if (!response.ok)
      throw new SessionizeApiError(
        response.status === 404
          ? "provider_validation_error"
          : response.status === 429
            ? "provider_rate_limited"
            : "provider_unavailable",
        `Sessionize returned HTTP ${response.status}.`,
        response.status,
      );
    if (!Array.isArray(body))
      throw new SessionizeApiError(
        "provider_validation_error",
        "Sessionize returned an invalid session list.",
      );
    return body
      .flatMap((group) => {
        const sessions = this.object(group).sessions;
        return Array.isArray(sessions) ? sessions : [];
      })
      .filter((item): item is JsonObject =>
        Boolean(item && typeof item === "object" && !Array.isArray(item)),
      )
      .slice(0, 500);
  }
  private summary(item: JsonObject) {
    const id = this.identifier(String(item.id ?? ""), "returned session ID");
    const title =
      typeof item.title === "string" ? item.title.trim().slice(0, 500) : "";
    if (!title)
      throw new SessionizeApiError(
        "provider_validation_error",
        "Sessionize returned an incomplete session.",
      );
    const speakers = Array.isArray(item.speakers)
      ? item.speakers
          .slice(0, 10)
          .map((speaker) => this.object(speaker).name)
          .filter(
            (name): name is string =>
              typeof name === "string" && Boolean(name.trim()),
          )
          .map((name) => name.trim().slice(0, 200))
      : [];
    return {
      sessionId: id,
      title,
      status: this.text(item.status, 100),
      startsAt: this.date(item.startsAt),
      endsAt: this.date(item.endsAt),
      room: this.text(item.room, 200),
      speakers,
    };
  }
  private identifier(value: string, label: string) {
    const text = value.trim();
    if (!/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(text))
      throw new SessionizeApiError(
        "provider_validation_error",
        `Sessionize ${label} is invalid.`,
      );
    return text;
  }
  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
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
}
