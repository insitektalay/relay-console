import { createHash } from "node:crypto";
import type { MarketplaceConnectorSafeErrorCode } from "../types";
type Obj = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;
export type LaterCredentials = { clientId: string; clientSecret: string };
export class LaterApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}
export class LaterApiAdapter {
  static readonly apiOrigin = "https://reporting.api.later.com";
  static readonly tokenUrl = "https://reporting.api.later.com/oauth/token";
  private readonly tokens = new Map<
    string,
    { value: string; expiresAt: number }
  >();
  private readonly fixedMetrics = ["engagements", "impressions", "reach"];
  constructor(private readonly requester: Requester = fetch) {}
  async health(c: LaterCredentials) {
    const result = await this.instances(c);
    return {
      apiOrigin: LaterApiAdapter.apiOrigin,
      accessibleInstanceCount: result.instanceIds.length,
      tokenLifetimeHours: 12,
    };
  }
  async instances(c: LaterCredentials) {
    const root = await this.get(
      c,
      "/v2/instances",
      new URLSearchParams({ limit: "25" }),
    );
    const data = this.object(root.data);
    return {
      instanceIds: this.array(data.instanceIds)
        .slice(0, 25)
        .map((v) => this.safeId(v))
        .filter((v): v is string => Boolean(v)),
      nextCursorExcluded: true,
    };
  }
  async instancePerformance(
    c: LaterCredentials,
    startDate: string,
    endDate: string,
  ) {
    const dates = this.dates(startDate, endDate),
      query = this.performanceQuery(dates.startDate, dates.endDate);
    const root = await this.get(c, "/v2/instances/performance", query);
    return {
      ...dates,
      metrics: this.metrics(this.object(root.data)),
      freshness: "normally current through the previous day",
    };
  }
  async campaignPerformance(
    c: LaterCredentials,
    instanceId: string,
    startDate: string,
    endDate: string,
  ) {
    const id = this.requiredId(instanceId),
      dates = this.dates(startDate, endDate),
      query = this.performanceQuery(dates.startDate, dates.endDate);
    query.append("instanceIds", id);
    query.set("limit", "25");
    const root = await this.get(c, "/v2/campaigns/performance", query);
    return {
      instanceId: id,
      ...dates,
      campaigns: this.array(root.data)
        .slice(0, 25)
        .map((v) => {
          const o = this.object(v);
          return {
            campaignId: this.safeId(o.campaignId ?? o.id),
            metrics: this.metrics(o),
          };
        })
        .filter((v) => v.campaignId),
      nextCursorExcluded: true,
      freshness: "normally current through the previous day",
    };
  }
  private performanceQuery(startDate: string, endDate: string) {
    const q = new URLSearchParams({
      startDate,
      endDate,
      dateBasis: "performance_date",
    });
    for (const metric of this.fixedMetrics) q.append("metrics", metric);
    return q;
  }
  private async accessToken(c: LaterCredentials) {
    this.requireCredentials(c);
    const key = createHash("sha256")
        .update(`${c.clientId}\0${c.clientSecret}`)
        .digest("hex"),
      cached = this.tokens.get(key);
    if (cached && cached.expiresAt > Date.now() + 60_000) return cached.value;
    const response = await this.requester(LaterApiAdapter.tokenUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        clientId: c.clientId,
        clientSecret: c.clientSecret,
      }),
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    const root = await this.response(response),
      token = this.safeText(root.jwt, 30_000);
    if (!token)
      throw new LaterApiError(
        "token_refresh_failed",
        "Later did not return a usable access token.",
      );
    this.tokens.set(key, {
      value: token,
      expiresAt: Date.now() + 11 * 60 * 60 * 1_000,
    });
    return token;
  }
  private async get(c: LaterCredentials, path: string, query: URLSearchParams) {
    const token = await this.accessToken(c),
      url = new URL(path, LaterApiAdapter.apiOrigin);
    url.search = query.toString();
    if (url.origin !== LaterApiAdapter.apiOrigin)
      throw new LaterApiError(
        "policy_blocked",
        "Later request left its fixed Reporting API origin.",
      );
    return await this.response(
      await this.requester(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          "User-Agent": "RelayConsole-Later/1.0",
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      }),
    );
  }
  private async response(response: Response) {
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.length > 1_000_000)
      throw new LaterApiError(
        "provider_validation_error",
        "Later response exceeded 1 MB.",
      );
    let root: Obj;
    try {
      root = this.object(raw.length ? JSON.parse(raw.toString("utf8")) : {});
    } catch {
      throw new LaterApiError(
        "provider_validation_error",
        "Later returned invalid JSON.",
        response.status,
      );
    }
    if (!response.ok)
      throw new LaterApiError(
        this.code(response.status),
        "Later Reporting API request failed.",
        response.status,
      );
    return root;
  }
  private dates(start: string, end: string) {
    const pattern = /^\d{4}-\d{2}-\d{2}$/,
      a = new Date(`${start}T00:00:00Z`),
      b = new Date(`${end}T00:00:00Z`);
    if (
      !pattern.test(start) ||
      !pattern.test(end) ||
      Number.isNaN(a.valueOf()) ||
      Number.isNaN(b.valueOf()) ||
      a.toISOString().slice(0, 10) !== start ||
      b.toISOString().slice(0, 10) !== end ||
      b < a ||
      b.valueOf() - a.valueOf() > 30 * 86_400_000
    )
      throw new LaterApiError(
        "provider_validation_error",
        "Later date window must be valid, ordered, and at most 31 inclusive days.",
      );
    return { startDate: start, endDate: end };
  }
  private metrics(o: Obj) {
    const out: Record<string, number | null> = {};
    for (const key of this.fixedMetrics)
      out[key] =
        typeof o[key] === "number" && Number.isFinite(o[key])
          ? (o[key] as number)
          : null;
    return out;
  }
  private requireCredentials(c: LaterCredentials) {
    if (!c.clientId.trim() || !c.clientSecret.trim())
      throw new LaterApiError(
        "credential_missing",
        "Later client credentials are missing.",
      );
    if (c.clientId.length > 500 || c.clientSecret.length > 30_000)
      throw new LaterApiError(
        "provider_validation_error",
        "Later client credentials are invalid.",
      );
  }
  private requiredId(v: string) {
    const id = this.safeId(v);
    if (!id)
      throw new LaterApiError(
        "provider_validation_error",
        "Later instance ID is invalid.",
      );
    return id;
  }
  private safeId(v: unknown) {
    return typeof v === "string" && /^[A-Za-z0-9_-]{1,200}$/.test(v) ? v : null;
  }
  private safeText(v: unknown, max: number) {
    return typeof v === "string" ? v.trim().slice(0, max) || null : null;
  }
  private object(v: unknown): Obj {
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {};
  }
  private array(v: unknown): unknown[] {
    return Array.isArray(v) ? v : [];
  }
  private code(s: number): MarketplaceConnectorSafeErrorCode {
    if (s === 401) return "token_expired";
    if (s === 403) return "insufficient_scope";
    if (s === 429) return "provider_rate_limited";
    if (s >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
}
