import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;
export type AgorapulseCredentials = {
  apiKey: string;
  organizationId: string;
  workspaceId: string;
};

export class AgorapulseApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class AgorapulseApiAdapter {
  static readonly apiOrigin = "https://api.agorapulse.com";
  private readonly requestWindows = new Map<string, number[]>();

  constructor(
    private readonly requester: Requester = fetch,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async health(credentials: AgorapulseCredentials) {
    const organizations = this.items(
      await this.get(credentials, "/v1.0/core/organizations"),
    );
    if (
      !organizations.some(
        (value) => this.resourceId(value) === credentials.organizationId,
      )
    )
      throw new AgorapulseApiError(
        "insufficient_scope",
        "Agorapulse API key cannot access the bound organization.",
        403,
      );
    const workspaces = this.items(
      await this.get(
        credentials,
        `/v1.0/core/organizations/${credentials.organizationId}/workspaces`,
      ),
    );
    if (
      !workspaces.some(
        (value) => this.resourceId(value) === credentials.workspaceId,
      )
    )
      throw new AgorapulseApiError(
        "insufficient_scope",
        "Agorapulse API key cannot access the bound workspace.",
        403,
      );
    return {
      apiOrigin: AgorapulseApiAdapter.apiOrigin,
      organizationId: credentials.organizationId,
      workspaceId: credentials.workspaceId,
    };
  }

  async listProfiles(credentials: AgorapulseCredentials) {
    const body = await this.get(
      credentials,
      `/v1.0/core/organizations/${credentials.organizationId}/workspaces/${credentials.workspaceId}/profiles`,
    );
    return {
      organizationId: credentials.organizationId,
      workspaceId: credentials.workspaceId,
      profiles: this.items(body)
        .slice(0, 25)
        .map((value) => this.profile(value))
        .filter((value) => value.profileUid),
      redactionStatus: "identity-and-content-excluded",
    };
  }

  async report(
    credentials: AgorapulseCredentials,
    type: "audience" | "communitymanagement" | "content",
    input: { profileUid: string; since: string; until: string },
  ) {
    const profileUid = this.id(input.profileUid, "profile UID");
    const since = this.instant(input.since, "since");
    const until = this.instant(input.until, "until");
    const span = Date.parse(until) - Date.parse(since);
    if (span < 0 || span > 31 * 24 * 60 * 60 * 1000)
      throw this.validation(
        "Agorapulse report windows must be between zero and thirty-one days.",
      );
    const body = await this.get(
      credentials,
      `/v1.0/report/organizations/${credentials.organizationId}/workspaces/${credentials.workspaceId}/profiles/${profileUid}/insights/${type}`,
      { since, until },
    );
    return {
      profileUid,
      reportType:
        type === "communitymanagement" ? "community_management" : type,
      since,
      until,
      metrics: this.redactMetrics(body, 0),
      redactionStatus: "identity-and-content-excluded",
    };
  }

  private async get(
    credentials: AgorapulseCredentials,
    path: string,
    query: Record<string, string> = {},
  ) {
    this.validateCredentials(credentials);
    if (!/^\/v1\.0\/[A-Za-z0-9_./-]+$/.test(path) || path.includes(".."))
      throw this.validation("Agorapulse API path is invalid.");
    this.enforceRate(credentials.apiKey);
    const url = new URL(path, AgorapulseApiAdapter.apiOrigin);
    for (const [key, value] of Object.entries(query))
      url.searchParams.set(key, value);
    let response: Response;
    try {
      response = await this.requester(url, {
        method: "GET",
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${credentials.apiKey}`,
          "User-Agent": "RelayConsole-Agorapulse/1.0",
        },
      });
    } catch (error) {
      if (error instanceof AgorapulseApiError) throw error;
      throw new AgorapulseApiError(
        "provider_unavailable",
        "Agorapulse could not be reached.",
      );
    }
    return this.response(response);
  }

  private async response(response: Response) {
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > 2_000_000)
      throw this.validation(
        "Agorapulse response exceeds the 2 MB Relay boundary.",
      );
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 2_000_000)
      throw this.validation(
        "Agorapulse response exceeds the 2 MB Relay boundary.",
      );
    let body: unknown = null;
    try {
      body = raw ? JSON.parse(raw) : null;
    } catch {
      throw this.validation(
        "Agorapulse returned invalid JSON.",
        response.status,
      );
    }
    if (!response.ok)
      throw new AgorapulseApiError(
        this.safeCode(response.status),
        `Agorapulse returned HTTP ${response.status}.`,
        response.status,
      );
    return body;
  }

  private validateCredentials(credentials: AgorapulseCredentials) {
    if (
      !credentials.apiKey.trim() ||
      credentials.apiKey.length > 30_000 ||
      /[\r\n]/.test(credentials.apiKey)
    )
      throw new AgorapulseApiError(
        "credential_missing",
        "A valid Agorapulse API key is required.",
        401,
      );
    this.id(credentials.organizationId, "organization ID");
    this.id(credentials.workspaceId, "workspace ID");
  }

  private enforceRate(apiKey: string) {
    const now = this.now().getTime();
    const key = apiKey.slice(-16);
    const recent = (this.requestWindows.get(key) ?? []).filter(
      (timestamp) => now - timestamp < 30 * 60 * 1000,
    );
    if (recent.length >= 500)
      throw new AgorapulseApiError(
        "provider_rate_limited",
        "Agorapulse allows at most 500 requests per thirty minutes.",
        429,
      );
    recent.push(now);
    this.requestWindows.set(key, recent);
  }

  private profile(value: unknown) {
    const item = this.record(value);
    return {
      profileUid:
        this.optionalId(item.uid) ??
        this.optionalId(item.profileUid) ??
        this.optionalId(item.id),
      network:
        this.safeEnum(item.network) ??
        this.safeEnum(item.type) ??
        this.safeEnum(item.service),
      active: typeof item.active === "boolean" ? item.active : null,
    };
  }

  private redactMetrics(value: unknown, depth: number): unknown {
    if (depth > 5) return null;
    if (value === null || typeof value === "boolean") return value;
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (Array.isArray(value))
      return value
        .slice(0, 25)
        .map((entry) => this.redactMetrics(entry, depth + 1));
    if (!value || typeof value !== "object") return null;
    const result: JsonObject = {};
    for (const [key, entry] of Object.entries(value as JsonObject).slice(
      0,
      100,
    )) {
      if (
        /(?:^|_)(?:id|uid|name|username|handle|email|text|message|title|description|url|link|media|image|video|author|owner|profile|post|content|caption|bio)(?:$|_)/i.test(
          key,
        )
      )
        continue;
      const redacted = this.redactMetrics(entry, depth + 1);
      if (redacted !== null) result[key.slice(0, 100)] = redacted;
    }
    return result;
  }

  private items(value: unknown): unknown[] {
    if (Array.isArray(value)) return value;
    const body = this.record(value);
    for (const key of [
      "data",
      "organizations",
      "workspaces",
      "profiles",
      "items",
    ])
      if (Array.isArray(body[key])) return body[key] as unknown[];
    return [];
  }

  private resourceId(value: unknown) {
    const item = this.record(value);
    return (
      this.optionalId(item.id) ??
      this.optionalId(item.uid) ??
      this.optionalId(item.organizationId) ??
      this.optionalId(item.workspaceId)
    );
  }

  private record(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }

  private id(value: unknown, label: string) {
    const text = String(value ?? "").trim();
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(text))
      throw this.validation(`Agorapulse ${label} is invalid.`);
    return text;
  }

  private optionalId(value: unknown) {
    const text =
      typeof value === "string" || typeof value === "number"
        ? String(value)
        : "";
    return /^[A-Za-z0-9_-]{1,128}$/.test(text) ? text : null;
  }

  private safeEnum(value: unknown) {
    return typeof value === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(value)
      ? value
      : null;
  }

  private instant(value: unknown, label: string) {
    if (typeof value !== "string" || Number.isNaN(Date.parse(value)))
      throw this.validation(
        `Agorapulse ${label} must be an RFC3339 timestamp.`,
      );
    return new Date(value).toISOString();
  }

  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403 || status === 404) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private validation(message: string, statusCode?: number) {
    return new AgorapulseApiError(
      "provider_validation_error",
      message,
      statusCode,
    );
  }
}
