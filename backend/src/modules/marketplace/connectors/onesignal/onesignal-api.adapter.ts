import type { MarketplaceConnectorSafeErrorCode } from "../types";

type Obj = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;
export type OneSignalCredentials = { appId: string; appApiKey: string };

export class OneSignalApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class OneSignalApiAdapter {
  static readonly apiOrigin = "https://api.onesignal.com";
  constructor(private readonly requester: Requester = fetch) {}

  async health(credentials: OneSignalCredentials) {
    await this.listNotificationDeliverySummaries(credentials);
    return {
      apiOrigin: OneSignalApiAdapter.apiOrigin,
      appId: credentials.appId.toLowerCase(),
    };
  }

  async listNotificationDeliverySummaries(credentials: OneSignalCredentials) {
    this.validate(credentials);
    const appId = credentials.appId.toLowerCase();
    const url = new URL("/notifications", OneSignalApiAdapter.apiOrigin);
    url.searchParams.set("app_id", appId);
    url.searchParams.set("limit", "25");
    url.searchParams.set("offset", "0");
    const root = this.object(await this.get(url, credentials));
    const notifications = Array.isArray(root.notifications)
      ? root.notifications
      : [];
    return {
      appId,
      totalCount: this.safeInteger(root.total_count),
      offset: 0,
      limit: 25,
      notifications: notifications.slice(0, 25).map((value) => {
        const item = this.object(value);
        return {
          id: this.uuid(item.id),
          canceled: typeof item.canceled === "boolean" ? item.canceled : null,
          queuedAt: this.safeInteger(item.queued_at),
          completedAt: this.safeInteger(item.completed_at),
          successful: this.safeInteger(item.successful),
          received: this.safeInteger(item.received),
          failed: this.safeInteger(item.failed),
          errored: this.safeInteger(item.errored),
          converted: this.safeInteger(item.converted),
          remaining: this.safeInteger(item.remaining),
        };
      }),
      redactionStatus: "content-targeting-recipient-and-outcome-detail-excluded",
    };
  }

  private async get(url: URL, credentials: OneSignalCredentials) {
    let response: Response;
    try {
      response = await this.requester(url, {
        method: "GET",
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
        cache: "no-store",
        headers: {
          Accept: "application/json",
          Authorization: `Key ${credentials.appApiKey}`,
          "User-Agent": "RelayConsole-OneSignal/1.0",
        },
      });
    } catch (error) {
      if (error instanceof OneSignalApiError) throw error;
      throw new OneSignalApiError(
        "provider_unavailable",
        "OneSignal could not be reached.",
      );
    }
    return this.response(response);
  }

  private async response(response: Response) {
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > 1_000_000)
      throw this.validation("OneSignal response exceeds the 1 MB Relay boundary.");
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 1_000_000)
      throw this.validation("OneSignal response exceeds the 1 MB Relay boundary.");
    let body: unknown;
    try {
      body = raw ? JSON.parse(raw) : null;
    } catch {
      throw this.validation("OneSignal returned invalid JSON.", response.status);
    }
    if (!response.ok)
      throw new OneSignalApiError(
        this.safeCode(response.status),
        `OneSignal returned HTTP ${response.status}.`,
        response.status,
      );
    return body;
  }

  private validate(credentials: OneSignalCredentials) {
    if (!this.uuid(credentials.appId))
      throw this.validation("OneSignal App ID must be a UUID v4.");
    if (
      !credentials.appApiKey.trim() ||
      credentials.appApiKey.length > 4_096 ||
      /[\r\n]/.test(credentials.appApiKey)
    )
      throw new OneSignalApiError(
        "credential_missing",
        "A valid OneSignal App API Key is required.",
        401,
      );
  }

  private uuid(value: unknown) {
    return typeof value === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value,
      )
      ? value.toLowerCase()
      : null;
  }

  private safeInteger(value: unknown) {
    return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
      ? value
      : null;
  }

  private object(value: unknown): Obj {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Obj)
      : {};
  }

  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403 || status === 404) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private validation(message: string, statusCode?: number) {
    return new OneSignalApiError("provider_validation_error", message, statusCode);
  }
}
