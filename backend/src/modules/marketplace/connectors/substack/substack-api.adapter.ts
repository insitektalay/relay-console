import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;
export type SubstackCredentials = {
  apiToken: string;
  validationLinkedInHandle: string;
};

export class SubstackApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class SubstackApiAdapter {
  static readonly apiOrigin = "https://substack.com";
  private readonly lastRequests = new Map<string, number>();
  constructor(
    private readonly requester: Requester = fetch,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async health(credentials: SubstackCredentials) {
    const result = await this.searchProfilesByLinkedIn(
      credentials,
      credentials.validationLinkedInHandle,
    );
    return {
      apiOrigin: SubstackApiAdapter.apiOrigin,
      validationLinkedInHandle: credentials.validationLinkedInHandle,
      resultCount: result.results.length,
    };
  }

  async searchProfilesByLinkedIn(
    credentials: SubstackCredentials,
    linkedinHandle: string,
  ) {
    this.validateCredentials(credentials);
    const handle = this.handle(linkedinHandle);
    this.enforceRate(credentials.apiToken);
    const url = new URL(
      `/profile/search/linkedin/${encodeURIComponent(handle)}`,
      SubstackApiAdapter.apiOrigin,
    );
    const response = await this.requester(url, {
      method: "GET",
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${credentials.apiToken}`,
        "User-Agent": "RelayConsole-Substack/1.0",
      },
    });
    const root = this.record(await this.response(response));
    return {
      linkedinHandle: handle,
      freshness: "at-least-daily",
      results: (Array.isArray(root.results) ? root.results : [])
        .slice(0, 10)
        .map((value) => this.summary(value)),
    };
  }

  private async response(response: Response) {
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > 1_000_000)
      throw this.validation(
        "Substack response exceeds the 1 MB Relay boundary.",
      );
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 1_000_000)
      throw this.validation(
        "Substack response exceeds the 1 MB Relay boundary.",
      );
    let body: unknown;
    try {
      body = raw ? JSON.parse(raw) : null;
    } catch {
      throw this.validation("Substack returned invalid JSON.", response.status);
    }
    if (!response.ok)
      throw new SubstackApiError(
        this.safeCode(response.status),
        `Substack returned HTTP ${response.status}.`,
        response.status,
      );
    return body;
  }

  private summary(value: unknown) {
    const item = this.record(value);
    const leaderboard = this.record(item.leaderboardStatus);
    return {
      identityHandle: this.optionalHandle(item.identityHandle),
      profileUrl: this.profileUrl(item.profileUrl),
      leaderboardRank: this.positive(leaderboard.rank),
      leaderboardLabel: this.text(leaderboard.label, 100),
      leaderboardRanking: this.enumValue(leaderboard.ranking, [
        "paid",
        "trending",
      ]),
      publicationName: this.text(leaderboard.publicationName, 200),
      bestsellerTier: this.text(item.bestsellerTier, 100),
      roughFreeSubscribers: this.nonnegative(item.roughNumFreeSubscribers),
      followerCount: this.nonnegative(item.followerCount),
    };
  }

  private validateCredentials(value: SubstackCredentials) {
    if (!value.apiToken.trim() || value.apiToken.length > 30_000)
      throw new SubstackApiError(
        "credential_missing",
        "Substack Developer API token is missing.",
      );
    this.handle(value.validationLinkedInHandle);
  }
  private handle(value: unknown) {
    const text = String(value ?? "").trim();
    if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,98}[A-Za-z0-9])?$/.test(text))
      throw this.validation("LinkedIn handle is invalid.");
    return text;
  }
  private optionalHandle(value: unknown) {
    return typeof value === "string" && /^@[A-Za-z0-9_-]{1,100}$/.test(value)
      ? value
      : typeof value === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(value)
        ? value
        : null;
  }
  private profileUrl(value: unknown) {
    if (typeof value !== "string") return null;
    try {
      const url = new URL(value);
      return url.protocol === "https:" &&
        (url.hostname === "substack.com" ||
          url.hostname.endsWith(".substack.com"))
        ? url.toString().slice(0, 500)
        : null;
    } catch {
      return null;
    }
  }
  private record(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }
  private text(value: unknown, max: number) {
    return typeof value === "string"
      ? value.trim().slice(0, max) || null
      : null;
  }
  private positive(value: unknown) {
    const number = Number(value);
    return Number.isSafeInteger(number) && number > 0 ? number : null;
  }
  private nonnegative(value: unknown) {
    const number = Number(value);
    return Number.isSafeInteger(number) && number >= 0 ? number : null;
  }
  private enumValue(value: unknown, allowed: string[]) {
    return typeof value === "string" && allowed.includes(value) ? value : null;
  }
  private enforceRate(key: string) {
    const current = this.now().getTime();
    const fingerprint = key.slice(-16);
    const previous = this.lastRequests.get(fingerprint);
    if (previous !== undefined && current - previous < 1_000)
      throw new SubstackApiError(
        "provider_rate_limited",
        "Relay conservatively limits Substack lookups to one request per second.",
        429,
      );
    this.lastRequests.set(fingerprint, current);
  }
  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
  private validation(message: string, statusCode?: number) {
    return new SubstackApiError(
      "provider_validation_error",
      message,
      statusCode,
    );
  }
}
