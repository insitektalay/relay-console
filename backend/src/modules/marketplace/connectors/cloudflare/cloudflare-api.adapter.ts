export const CLOUDFLARE_API_ORIGIN = "https://api.cloudflare.com/client/v4";

export type CloudflareCredentials = {
  accessToken: string;
  accountId: string;
  zoneId: string;
};

export class CloudflareApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly statusCode = 502,
  ) {
    super(message);
  }
}

type Requester = (url: string, init: RequestInit) => Promise<Response>;

export class CloudflareApiAdapter {
  constructor(private readonly requester: Requester = fetch) {}

  async health(credentials: CloudflareCredentials) {
    const result = await this.getZone(credentials);
    return { ready: true, zoneId: result.zone.id, zoneName: result.zone.name };
  }

  async listZones(
    credentials: CloudflareCredentials,
    input: { limit?: unknown },
  ) {
    const limit = this.limit(input.limit);
    const query = new URLSearchParams({
      "account.id": this.id(credentials.accountId, "account"),
      page: "1",
      per_page: String(Math.max(5, limit)),
      order: "name",
      direction: "asc",
    });
    const body = await this.request(credentials, `/zones?${query.toString()}`);
    const root = this.record(body);
    const zones = this.array(root.result)
      .slice(0, limit)
      .map((value) => this.zone(value, credentials.accountId));
    return {
      zones,
      returnedCount: zones.length,
      more: this.number(this.record(root.result_info).total_pages) > 1,
      automaticPagination: false,
    };
  }

  async getZone(credentials: CloudflareCredentials) {
    const zoneId = this.id(credentials.zoneId, "zone");
    const body = await this.request(credentials, `/zones/${zoneId}`);
    return { zone: this.zone(this.record(body).result, credentials.accountId) };
  }

  async readZoneTraffic(
    credentials: CloudflareCredentials,
    input: { hours?: unknown },
  ) {
    const hours = this.hours(input.hours);
    const end = new Date();
    const start = new Date(end.getTime() - hours * 3_600_000);
    const query =
      "query RelayZoneTraffic($zoneTag: string!, $start: Time!, $end: Time!) { viewer { zones(filter: { zoneTag: $zoneTag }) { httpRequestsAdaptiveGroups(limit: 1000, filter: { datetime_geq: $start, datetime_lt: $end, requestSource: eyeball }) { count sum { edgeResponseBytes visits } } } } }";
    const body = await this.request(credentials, "/graphql", {
      query,
      variables: {
        zoneTag: this.id(credentials.zoneId, "zone"),
        start: start.toISOString(),
        end: end.toISOString(),
      },
    });
    const root = this.record(body);
    if (this.array(root.errors).length)
      throw new CloudflareApiError(
        "cloudflare_graphql_error",
        "Cloudflare rejected the fixed analytics query.",
        400,
      );
    const zones = this.array(this.record(this.record(root.data).viewer).zones);
    const groups = this.array(
      this.record(zones[0]).httpRequestsAdaptiveGroups,
    ).slice(0, 1_000);
    let requests = 0;
    let edgeResponseBytes = 0;
    let visits = 0;
    for (const value of groups) {
      const group = this.record(value);
      const sum = this.record(group.sum);
      requests += this.number(group.count);
      edgeResponseBytes += this.number(sum.edgeResponseBytes);
      visits += this.number(sum.visits);
    }
    return {
      zoneId: credentials.zoneId,
      windowStart: start.toISOString(),
      windowEnd: end.toISOString(),
      windowHours: hours,
      requests,
      edgeResponseBytes,
      visits,
      groupCount: groups.length,
      requestLevelDimensionsReturned: false,
      rawLogsReturned: false,
    };
  }

  private async request(
    credentials: CloudflareCredentials,
    path: string,
    body?: Record<string, unknown>,
  ) {
    if (
      !/^\/(zones(?:\/[a-f0-9]{32})?|graphql)(?:\?[A-Za-z0-9%&.=_+-]+)?$/.test(
        path,
      )
    )
      throw new CloudflareApiError(
        "cloudflare_path_invalid",
        "Cloudflare API path is invalid.",
        400,
      );
    const response = await this.requester(`${CLOUDFLARE_API_ORIGIN}${path}`, {
      method: body ? "POST" : "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${credentials.accessToken}`,
        "User-Agent": "RelayConsole-Cloudflare/1.0",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    if (!response.ok) {
      const code =
        response.status === 401
          ? "cloudflare_token_invalid"
          : response.status === 403
            ? "cloudflare_scope_denied"
            : response.status === 404
              ? "cloudflare_not_found"
              : response.status === 429
                ? "cloudflare_rate_limited"
                : "cloudflare_unavailable";
      throw new CloudflareApiError(
        code,
        "Cloudflare API request failed.",
        response.status,
      );
    }
    const text = await response.text();
    if (Buffer.byteLength(text, "utf8") > 1_000_000)
      throw new CloudflareApiError(
        "cloudflare_response_too_large",
        "Cloudflare response exceeded Relay's limit.",
      );
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new CloudflareApiError(
        "cloudflare_response_invalid",
        "Cloudflare returned an invalid response.",
      );
    }
  }

  private zone(value: unknown, accountId: string) {
    const zone = this.record(value);
    const account = this.record(zone.account);
    if (
      this.text(zone.id) === null ||
      this.text(account.id) !== this.id(accountId, "account")
    )
      throw new CloudflareApiError(
        "cloudflare_account_binding_mismatch",
        "Cloudflare zone account binding changed.",
        403,
      );
    return {
      id: this.text(zone.id),
      name: this.text(zone.name),
      status: this.text(zone.status),
      type: this.text(zone.type),
      account: { id: this.text(account.id), name: this.text(account.name) },
      createdAt: this.text(zone.created_on),
      modifiedAt: this.text(zone.modified_on),
      activatedAt: this.text(zone.activated_on),
      developmentModeSeconds: this.numberOrNull(zone.development_mode),
      nameServers: this.textArray(zone.name_servers, 8),
      metadata: {
        cdnOnly: this.boolean(this.record(zone.meta).cdn_only),
        dnsOnly: this.boolean(this.record(zone.meta).dns_only),
        foundationDns: this.boolean(this.record(zone.meta).foundation_dns),
        phishingDetected: this.boolean(
          this.record(zone.meta).phishing_detected,
        ),
      },
    };
  }

  private id(value: unknown, label: string) {
    if (typeof value !== "string" || !/^[a-f0-9]{32}$/.test(value))
      throw new CloudflareApiError(
        `cloudflare_${label}_id_invalid`,
        `Cloudflare ${label} ID is invalid.`,
        400,
      );
    return value;
  }

  private limit(value: unknown) {
    if (value === undefined) return 10;
    if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 25)
      throw new CloudflareApiError(
        "cloudflare_limit_invalid",
        "Cloudflare result limit must be between 1 and 25.",
        400,
      );
    return Number(value);
  }

  private hours(value: unknown) {
    if (value === undefined) return 24;
    if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 24)
      throw new CloudflareApiError(
        "cloudflare_window_invalid",
        "Cloudflare traffic window must be between 1 and 24 hours.",
        400,
      );
    return Number(value);
  }

  private record(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }
  private array(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }
  private text(value: unknown) {
    return typeof value === "string" ? value.slice(0, 1_000) : null;
  }
  private textArray(value: unknown, limit: number) {
    return this.array(value)
      .slice(0, limit)
      .flatMap((item) =>
        typeof item === "string" ? [item.slice(0, 500)] : [],
      );
  }
  private number(value: unknown) {
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
  }
  private numberOrNull(value: unknown) {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }
  private boolean(value: unknown) {
    return typeof value === "boolean" ? value : null;
  }
}
