import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;

export type BrandwatchCredentials = {
  accessToken: string;
  projectId: string;
};

export class BrandwatchApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class BrandwatchApiAdapter {
  static readonly apiOrigin = "https://api.brandwatch.com";
  private readonly requestWindows = new Map<string, number[]>();

  constructor(
    private readonly requester: Requester = fetch,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async health(credentials: BrandwatchCredentials) {
    const projects = this.items(
      await this.get(credentials, "/projects/summary"),
    );
    if (
      !projects.some(
        (value) => this.resourceId(value) === credentials.projectId,
      )
    )
      throw new BrandwatchApiError(
        "insufficient_scope",
        "Brandwatch token cannot access the bound project.",
        403,
      );
    return {
      apiOrigin: BrandwatchApiAdapter.apiOrigin,
      projectId: credentials.projectId,
    };
  }

  async listProjects(credentials: BrandwatchCredentials) {
    const body = await this.get(credentials, "/projects/summary");
    return {
      boundProjectId: credentials.projectId,
      projects: this.items(body)
        .slice(0, 25)
        .map((value) => this.project(value))
        .filter((value) => value.projectId),
      redactionStatus: "project-and-client-identity-excluded",
    };
  }

  async listQueries(credentials: BrandwatchCredentials) {
    const body = await this.get(
      credentials,
      `/projects/${credentials.projectId}/queries/summary`,
    );
    return {
      projectId: credentials.projectId,
      queries: this.items(body)
        .slice(0, 25)
        .map((value) => this.query(value))
        .filter((value) => value.queryId),
      redactionStatus: "query-identity-and-content-excluded",
    };
  }

  private async get(credentials: BrandwatchCredentials, path: string) {
    this.validateCredentials(credentials);
    if (
      path !== "/projects/summary" &&
      path !== `/projects/${credentials.projectId}/queries/summary`
    )
      throw this.validation(
        "Brandwatch API path is outside the Relay allowlist.",
      );
    this.enforceRate(credentials.accessToken);
    let response: Response;
    try {
      response = await this.requester(
        new URL(path, BrandwatchApiAdapter.apiOrigin),
        {
          method: "GET",
          redirect: "error",
          signal: AbortSignal.timeout(20_000),
          cache: "no-store",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${credentials.accessToken}`,
            "User-Agent": "RelayConsole-Brandwatch/1.0",
          },
        },
      );
    } catch (error) {
      if (error instanceof BrandwatchApiError) throw error;
      throw new BrandwatchApiError(
        "provider_unavailable",
        "Brandwatch could not be reached.",
      );
    }
    return this.response(response);
  }

  private async response(response: Response) {
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > 1_000_000)
      throw this.validation(
        "Brandwatch response exceeds the 1 MB Relay boundary.",
      );
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 1_000_000)
      throw this.validation(
        "Brandwatch response exceeds the 1 MB Relay boundary.",
      );
    let body: unknown = null;
    try {
      body = raw ? JSON.parse(raw) : null;
    } catch {
      throw this.validation(
        "Brandwatch returned invalid JSON.",
        response.status,
      );
    }
    if (!response.ok)
      throw new BrandwatchApiError(
        this.safeCode(response.status),
        `Brandwatch returned HTTP ${response.status}.`,
        response.status,
      );
    return body;
  }

  private validateCredentials(credentials: BrandwatchCredentials) {
    if (
      !credentials.accessToken.trim() ||
      credentials.accessToken.length > 30_000 ||
      /[\r\n]/.test(credentials.accessToken)
    )
      throw new BrandwatchApiError(
        "credential_missing",
        "A valid Brandwatch API access token is required.",
        401,
      );
    this.id(credentials.projectId, "project ID");
  }

  private enforceRate(accessToken: string) {
    const now = this.now().getTime();
    const key = accessToken.slice(-16);
    const recent = (this.requestWindows.get(key) ?? []).filter(
      (timestamp) => now - timestamp < 10 * 60_000,
    );
    if (recent.length >= 30)
      throw new BrandwatchApiError(
        "provider_rate_limited",
        "Brandwatch allows at most thirty requests per ten minutes per API Client.",
        429,
      );
    recent.push(now);
    this.requestWindows.set(key, recent);
  }

  private project(value: unknown) {
    const item = this.record(value);
    return {
      projectId: this.resourceId(item),
      timezone: this.safeTimezone(item.timezone),
    };
  }

  private query(value: unknown) {
    const item = this.record(value);
    return {
      queryId: this.resourceId(item),
      type: this.safeEnum(item.type),
    };
  }

  private items(value: unknown): unknown[] {
    if (Array.isArray(value)) return value;
    const body = this.record(value);
    return Array.isArray(body.results) ? body.results : [];
  }

  private resourceId(value: unknown) {
    const item = this.record(value);
    const candidate = item.id;
    if (typeof candidate === "number" && Number.isSafeInteger(candidate))
      return String(candidate);
    const text = typeof candidate === "string" ? candidate : "";
    return /^[1-9][0-9]{0,19}$/.test(text) ? text : null;
  }

  private record(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }

  private id(value: unknown, label: string) {
    const text = String(value ?? "").trim();
    if (!/^[1-9][0-9]{0,19}$/.test(text))
      throw this.validation(`Brandwatch ${label} is invalid.`);
    return text;
  }

  private safeEnum(value: unknown) {
    return typeof value === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(value)
      ? value
      : null;
  }

  private safeTimezone(value: unknown) {
    return typeof value === "string" && /^[A-Za-z0-9_+./-]{1,64}$/.test(value)
      ? value
      : null;
  }

  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403 || status === 404) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private validation(message: string, statusCode?: number) {
    return new BrandwatchApiError(
      "provider_validation_error",
      message,
      statusCode,
    );
  }
}
