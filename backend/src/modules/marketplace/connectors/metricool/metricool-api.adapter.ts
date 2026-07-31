import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;

export type MetricoolCredentials = {
  userToken: string;
  userId: string;
  blogId: string;
};

export class MetricoolApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class MetricoolApiAdapter {
  static readonly apiOrigin = "https://app.metricool.com";
  private readonly requestWindows = new Map<string, number[]>();

  constructor(
    private readonly requester: Requester = fetch,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async health(credentials: MetricoolCredentials) {
    const brands = this.items(
      await this.get(credentials, "/api/admin/simpleProfiles"),
    );
    if (!brands.some((value) => this.brandId(value) === credentials.blogId))
      throw new MetricoolApiError(
        "insufficient_scope",
        "Metricool token cannot access the bound brand.",
        403,
      );
    return {
      apiOrigin: `${MetricoolApiAdapter.apiOrigin}/api`,
      userId: credentials.userId,
      blogId: credentials.blogId,
    };
  }

  async listBrands(credentials: MetricoolCredentials) {
    const body = await this.get(credentials, "/api/admin/simpleProfiles");
    return {
      boundBlogId: credentials.blogId,
      brands: this.items(body)
        .slice(0, 25)
        .map((value) => ({ blogId: this.brandId(value) }))
        .filter((value): value is { blogId: string } => Boolean(value.blogId)),
      redactionStatus: "brand-identity-excluded",
    };
  }

  async listConnectedNetworks(credentials: MetricoolCredentials) {
    const body = await this.get(credentials, "/api/admin/blog/profiles");
    const networks: Array<{ network: string; connected: boolean | null }> = [];
    for (const [key, value] of Object.entries(this.record(body)).slice(
      0,
      100,
    )) {
      const network = this.safeNetwork(key);
      if (!network) continue;
      const item = this.record(value);
      const connected =
        typeof value === "boolean"
          ? value
          : typeof item.connected === "boolean"
            ? item.connected
            : typeof item.active === "boolean"
              ? item.active
              : null;
      networks.push({ network, connected });
      if (networks.length === 25) break;
    }
    return {
      blogId: credentials.blogId,
      networks,
      redactionStatus: "network-identity-excluded",
    };
  }

  private async get(credentials: MetricoolCredentials, path: string) {
    this.validateCredentials(credentials);
    if (!/^\/api\/(?:admin\/simpleProfiles|admin\/blog\/profiles)$/.test(path))
      throw this.validation(
        "Metricool API path is outside the Relay allowlist.",
      );
    this.enforceRate(credentials.userToken);
    const url = new URL(path, MetricoolApiAdapter.apiOrigin);
    url.searchParams.set("userId", credentials.userId);
    url.searchParams.set("blogId", credentials.blogId);
    let response: Response;
    try {
      response = await this.requester(url, {
        method: "GET",
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-Mc-Auth": credentials.userToken,
          "User-Agent": "RelayConsole-Metricool/1.0",
        },
      });
    } catch (error) {
      if (error instanceof MetricoolApiError) throw error;
      throw new MetricoolApiError(
        "provider_unavailable",
        "Metricool could not be reached.",
      );
    }
    return this.response(response);
  }

  private async response(response: Response) {
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > 1_000_000)
      throw this.validation(
        "Metricool response exceeds the 1 MB Relay boundary.",
      );
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 1_000_000)
      throw this.validation(
        "Metricool response exceeds the 1 MB Relay boundary.",
      );
    let body: unknown = null;
    try {
      body = raw ? JSON.parse(raw) : null;
    } catch {
      throw this.validation(
        "Metricool returned invalid JSON.",
        response.status,
      );
    }
    if (!response.ok)
      throw new MetricoolApiError(
        this.safeCode(response.status),
        `Metricool returned HTTP ${response.status}.`,
        response.status,
      );
    return body;
  }

  private validateCredentials(credentials: MetricoolCredentials) {
    if (
      !credentials.userToken.trim() ||
      credentials.userToken.length > 30_000 ||
      /[\r\n]/.test(credentials.userToken)
    )
      throw new MetricoolApiError(
        "credential_missing",
        "A valid Metricool user token is required.",
        401,
      );
    this.numericId(credentials.userId, "user ID");
    this.numericId(credentials.blogId, "blog ID");
  }

  private enforceRate(userToken: string) {
    const now = this.now().getTime();
    const key = userToken.slice(-16);
    const recent = (this.requestWindows.get(key) ?? []).filter(
      (timestamp) => now - timestamp < 60_000,
    );
    if (recent.length >= 60)
      throw new MetricoolApiError(
        "provider_rate_limited",
        "Relay limits Metricool to sixty requests per minute.",
        429,
      );
    recent.push(now);
    this.requestWindows.set(key, recent);
  }

  private items(value: unknown): unknown[] {
    if (Array.isArray(value)) return value;
    const body = this.record(value);
    for (const key of ["data", "blogs", "profiles", "items"])
      if (Array.isArray(body[key])) return body[key] as unknown[];
    return [];
  }

  private brandId(value: unknown) {
    const item = this.record(value);
    for (const candidate of [item.blogId, item.id, item.blog_id]) {
      const text =
        typeof candidate === "string" || typeof candidate === "number"
          ? String(candidate)
          : "";
      if (/^[0-9]{1,20}$/.test(text)) return text;
    }
    return null;
  }

  private record(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }

  private numericId(value: unknown, label: string) {
    const text = String(value ?? "").trim();
    if (!/^[0-9]{1,20}$/.test(text))
      throw this.validation(`Metricool ${label} is invalid.`);
    return text;
  }

  private safeNetwork(value: string) {
    return /^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(value) ? value : null;
  }

  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403 || status === 404) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private validation(message: string, statusCode?: number) {
    return new MetricoolApiError(
      "provider_validation_error",
      message,
      statusCode,
    );
  }
}
