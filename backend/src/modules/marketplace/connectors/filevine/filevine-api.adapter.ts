import type { MarketplaceConnectorSafeErrorCode } from "../types";

type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;
export type FilevineCredentials = { accessToken: string };

export class FilevineApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class FilevineApiAdapter {
  static readonly origin = "https://api.filevine.io";
  static readonly apiVersion = "v2";
  constructor(private readonly requester: Requester = fetch) {}

  async health(credentials: FilevineCredentials) {
    await this.getConnectionAuthority(credentials);
    return {
      apiOrigin: FilevineApiAdapter.origin,
      apiRegion: "us",
      apiVersion: FilevineApiAdapter.apiVersion,
    };
  }

  async getConnectionAuthority(credentials: FilevineCredentials) {
    const accessToken = credentials.accessToken.trim();
    if (
      !accessToken ||
      accessToken.length > 30_000 ||
      /[\r\n]/.test(accessToken)
    )
      throw new FilevineApiError(
        "credential_missing",
        "Filevine OAuth access token is missing or invalid.",
      );
    const response = await this.requester(
      new URL("/v2/projects?limit=1", FilevineApiAdapter.origin),
      {
        method: "GET",
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
          "User-Agent": "RelayConsole-Filevine/1.0",
        },
      },
    ).catch(() => {
      throw new FilevineApiError(
        "provider_unavailable",
        "Filevine could not be reached.",
      );
    });
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > 65_536)
      throw new FilevineApiError(
        "provider_validation_error",
        "Filevine response exceeded 64 KB.",
      );
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.length > 65_536)
      throw new FilevineApiError(
        "provider_validation_error",
        "Filevine response exceeded 64 KB.",
      );
    if (!response.ok)
      throw new FilevineApiError(
        this.code(response.status),
        `Filevine returned HTTP ${response.status}.`,
        response.status,
      );
    let body: unknown;
    try {
      body = JSON.parse(raw.toString("utf8"));
    } catch {
      throw new FilevineApiError(
        "provider_validation_error",
        "Filevine returned invalid JSON.",
      );
    }
    const object =
      body && typeof body === "object" && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : {};
    const items =
      Array.isArray(object.items) ||
      Array.isArray(object.data) ||
      Array.isArray(object.projects) ||
      Array.isArray(body);
    if (!items)
      throw new FilevineApiError(
        "provider_validation_error",
        "Filevine returned an invalid projects authority response.",
      );
    return {
      authorized: true,
      apiRegion: "us",
      apiVersion: FilevineApiAdapter.apiVersion,
      redactionStatus:
        "user-firm-project-matter-document-financial-and-legal-practice-data-excluded",
    };
  }

  private code(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403 || status === 404) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
}
