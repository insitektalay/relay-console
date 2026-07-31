import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;

export type PublerCredentials = { apiKey: string; workspaceId: string };

export class PublerApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class PublerApiAdapter {
  static readonly apiOrigin = "https://app.publer.com";
  private readonly requestWindows = new Map<string, number[]>();

  constructor(
    private readonly requester: Requester = fetch,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async health(credentials: PublerCredentials) {
    const workspaces = this.items(
      await this.get(credentials, "/api/v1/workspaces", false),
    );
    if (
      !workspaces.some(
        (value) => this.resourceId(value) === credentials.workspaceId,
      )
    )
      throw new PublerApiError(
        "insufficient_scope",
        "Publer API key cannot access the bound workspace.",
        403,
      );
    return {
      apiOrigin: `${PublerApiAdapter.apiOrigin}/api/v1`,
      workspaceId: credentials.workspaceId,
    };
  }

  async listWorkspaces(credentials: PublerCredentials) {
    const body = await this.get(credentials, "/api/v1/workspaces", false);
    return {
      boundWorkspaceId: credentials.workspaceId,
      workspaces: this.items(body)
        .slice(0, 25)
        .map((value) => ({ workspaceId: this.resourceId(value) }))
        .filter((value): value is { workspaceId: string } =>
          Boolean(value.workspaceId),
        ),
      redactionStatus: "workspace-identity-excluded",
    };
  }

  async listAccounts(credentials: PublerCredentials) {
    const body = await this.get(credentials, "/api/v1/accounts", true);
    return {
      workspaceId: credentials.workspaceId,
      accounts: this.items(body)
        .slice(0, 25)
        .map((value) => this.account(value))
        .filter((value) => value.accountId),
      redactionStatus: "account-identity-and-content-excluded",
    };
  }

  private async get(
    credentials: PublerCredentials,
    path: string,
    workspaceHeader: boolean,
  ) {
    this.validateCredentials(credentials);
    if (!/^\/api\/v1\/(?:workspaces|accounts)$/.test(path))
      throw this.validation("Publer API path is outside the Relay allowlist.");
    this.enforceRate(credentials.apiKey);
    const headers: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer-API ${credentials.apiKey}`,
      "User-Agent": "RelayConsole-Publer/1.0",
    };
    if (workspaceHeader)
      headers["Publer-Workspace-Id"] = credentials.workspaceId;
    let response: Response;
    try {
      response = await this.requester(
        new URL(path, PublerApiAdapter.apiOrigin),
        {
          method: "GET",
          redirect: "error",
          signal: AbortSignal.timeout(20_000),
          cache: "no-store",
          headers,
        },
      );
    } catch (error) {
      if (error instanceof PublerApiError) throw error;
      throw new PublerApiError(
        "provider_unavailable",
        "Publer could not be reached.",
      );
    }
    return this.response(response);
  }

  private async response(response: Response) {
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > 1_000_000)
      throw this.validation("Publer response exceeds the 1 MB Relay boundary.");
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 1_000_000)
      throw this.validation("Publer response exceeds the 1 MB Relay boundary.");
    let body: unknown = null;
    try {
      body = raw ? JSON.parse(raw) : null;
    } catch {
      throw this.validation("Publer returned invalid JSON.", response.status);
    }
    if (!response.ok)
      throw new PublerApiError(
        this.safeCode(response.status),
        `Publer returned HTTP ${response.status}.`,
        response.status,
      );
    return body;
  }

  private validateCredentials(credentials: PublerCredentials) {
    if (
      !credentials.apiKey.trim() ||
      credentials.apiKey.length > 30_000 ||
      /[\r\n]/.test(credentials.apiKey)
    )
      throw new PublerApiError(
        "credential_missing",
        "A valid Publer API key is required.",
        401,
      );
    this.id(credentials.workspaceId, "workspace ID");
  }

  private enforceRate(apiKey: string) {
    const now = this.now().getTime();
    const key = apiKey.slice(-16);
    const recent = (this.requestWindows.get(key) ?? []).filter(
      (timestamp) => now - timestamp < 2 * 60_000,
    );
    if (recent.length >= 100)
      throw new PublerApiError(
        "provider_rate_limited",
        "Publer allows at most one hundred requests per two minutes per user.",
        429,
      );
    recent.push(now);
    this.requestWindows.set(key, recent);
  }

  private account(value: unknown) {
    const item = this.record(value);
    return {
      accountId: this.resourceId(item),
      provider: this.safeEnum(item.provider),
      type: this.safeEnum(item.type),
    };
  }

  private items(value: unknown): unknown[] {
    if (Array.isArray(value)) return value;
    const body = this.record(value);
    for (const key of ["data", "workspaces", "accounts", "items"])
      if (Array.isArray(body[key])) return body[key] as unknown[];
    return [];
  }

  private resourceId(value: unknown) {
    const item = this.record(value);
    for (const candidate of [item.id, item.workspaceId, item.accountId]) {
      const text = typeof candidate === "string" ? candidate : "";
      if (/^[A-Za-z0-9_-]{1,128}$/.test(text)) return text;
    }
    return null;
  }

  private record(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }

  private id(value: unknown, label: string) {
    const text = String(value ?? "").trim();
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(text))
      throw this.validation(`Publer ${label} is invalid.`);
    return text;
  }

  private safeEnum(value: unknown) {
    return typeof value === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(value)
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
    return new PublerApiError("provider_validation_error", message, statusCode);
  }
}
