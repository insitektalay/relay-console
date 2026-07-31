import { Injectable } from "@nestjs/common";

export type SegmentCredentials = {
  apiOrigin: string;
  publicApiToken: string;
  workspaceId: string;
};

export class SegmentApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode?: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

type HttpClient = (url: string, init: RequestInit) => Promise<Response>;
const API_ORIGINS = new Set([
  "https://api.segmentapis.com",
  "https://eu1.api.segmentapis.com",
]);
const ID = /^[A-Za-z0-9_-]{1,255}$/;

@Injectable()
export class SegmentApiAdapter {
  constructor(private readonly request: HttpClient = fetch) {}

  async health(credentials: SegmentCredentials) {
    const binding = await this.workspaceBinding(credentials);
    return { ...binding, apiVersion: "v1", reachable: true };
  }

  async workspaceBinding(credentials: SegmentCredentials) {
    const workspaceId = this.requiredId(
      credentials.workspaceId,
      "segment_workspace_identifier_invalid",
      "A valid exact Segment Workspace ID is required.",
    );
    const data = this.object(
      this.object(await this.send(credentials, "/")).data,
    );
    const workspace = this.object(data.workspace);
    if (this.id(workspace.id) !== workspaceId)
      throw new SegmentApiError(
        "segment_workspace_mismatch",
        "Segment Public API token is not bound to the configured Workspace ID.",
      );
    return { apiOrigin: this.origin(credentials.apiOrigin), workspaceId };
  }

  async listSources(credentials: SegmentCredentials) {
    const data = this.object(
      this.object(await this.send(credentials, "/sources?pagination.count=25"))
        .data,
    );
    return {
      sources: this.rows(data.sources)
        .slice(0, 25)
        .map((row) => {
          const metadata = this.object(row.metadata);
          return {
            sourceId: this.id(row.id),
            workspaceId: this.id(row.workspaceId),
            enabled: this.scalar(row.enabled),
            sourceType: this.scalar(metadata.slug),
            sourceStatus: this.scalar(metadata.status),
            partnerOwned: this.scalar(metadata.partnerOwned),
          };
        }),
    };
  }

  async listDestinations(credentials: SegmentCredentials) {
    const data = this.object(
      this.object(
        await this.send(credentials, "/destinations?pagination.count=25"),
      ).data,
    );
    return {
      destinations: this.rows(data.destinations)
        .slice(0, 25)
        .map((row) => {
          const metadata = this.object(row.metadata);
          return {
            destinationId: this.id(row.id),
            sourceId: this.id(row.sourceId),
            enabled: this.scalar(row.enabled),
            destinationType: this.scalar(metadata.slug),
            destinationStatus: this.scalar(metadata.status),
            partnerOwned: this.scalar(metadata.partnerOwned),
          };
        }),
    };
  }

  async getAudienceReadinessSummary(credentials: SegmentCredentials) {
    const spaceId = this.requiredId(
      credentials.workspaceId,
      "segment_space_identifier_invalid",
      "A valid exact Segment Space ID is required.",
    );
    const root = this.object(
      await this.send(
        credentials,
        `/spaces/${encodeURIComponent(spaceId)}/audiences?pagination.count=25`,
      ),
    );
    const data = this.object(root.data);
    const audiences = this.rows(data.audiences).slice(0, 25);
    const pagination = this.object(data.pagination);
    let enabledCount = 0;
    let liveCount = 0;
    let userAudienceCount = 0;
    let accountAudienceCount = 0;
    let linkedAudienceCount = 0;
    let realtimeCount = 0;
    let batchCount = 0;
    for (const row of audiences) {
      const status = String(row.status ?? "").toUpperCase();
      const kind = String(row.audienceType ?? "").toUpperCase();
      const cadence = String(
        this.object(row.computeCadence).type ?? "",
      ).toUpperCase();
      if (row.enabled === true) enabledCount += 1;
      if (status === "LIVE") liveCount += 1;
      if (kind === "USERS") userAudienceCount += 1;
      if (kind === "ACCOUNTS") accountAudienceCount += 1;
      if (kind === "LINKED") linkedAudienceCount += 1;
      if (cadence === "REALTIME") realtimeCount += 1;
      if (cadence === "BATCH") batchCount += 1;
    }
    const totalEntries = pagination.totalEntries;
    return {
      returnedCount: audiences.length,
      totalEntries:
        typeof totalEntries === "number" &&
        Number.isSafeInteger(totalEntries) &&
        totalEntries >= 0
          ? totalEntries
          : null,
      nextPageAvailable:
        typeof pagination.next === "string" && pagination.next.length > 0,
      enabledCount,
      liveCount,
      userAudienceCount,
      accountAudienceCount,
      linkedAudienceCount,
      realtimeCount,
      batchCount,
      redactionStatus:
        "audience-ids-names-keys-definitions-sizes-members-identifiers-schedules-destinations-and-creators-excluded",
    };
  }

  private async send(credentials: SegmentCredentials, path: string) {
    const origin = this.origin(credentials.apiOrigin);
    const token = credentials.publicApiToken.trim();
    if (token.length < 8 || token.length > 4096)
      throw new SegmentApiError(
        "segment_public_api_token_invalid",
        "Segment Public API token is missing or invalid.",
      );
    const url = new URL(path, origin);
    if (
      url.origin !== origin ||
      (!["/", "/sources", "/destinations"].includes(url.pathname) &&
        !(
          url.pathname ===
            `/spaces/${encodeURIComponent(credentials.workspaceId)}/audiences` &&
          url.search === "?pagination.count=25"
        ))
    )
      throw new SegmentApiError(
        "segment_request_invalid",
        "Segment request escaped the fixed Public API boundary.",
      );
    let response: Response;
    try {
      response = await this.request(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/vnd.segment.v1+json",
          Authorization: `Bearer ${token}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new SegmentApiError(
        "segment_unavailable",
        "Segment is temporarily unavailable.",
      );
    }
    const raw = await response.text();
    if (raw.length > 2_000_000)
      throw new SegmentApiError(
        "segment_response_too_large",
        "Segment response exceeded the safe size limit.",
      );
    let body: unknown = {};
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      throw new SegmentApiError(
        "segment_response_invalid",
        "Segment returned an invalid response.",
      );
    }
    if (!response.ok)
      throw new SegmentApiError(
        response.status === 401
          ? "segment_public_api_token_invalid"
          : response.status === 403
            ? "segment_permission_denied"
            : response.status === 429
              ? "segment_rate_limited"
              : "segment_http_error",
        "Segment Public API request failed.",
        response.status,
        { retryAfter: response.headers.get("retry-after") },
      );
    return body;
  }

  private origin(raw: string) {
    let url: URL;
    try {
      url = new URL(raw.trim());
    } catch {
      throw new SegmentApiError(
        "segment_api_origin_invalid",
        "Segment Public API origin is invalid.",
      );
    }
    if (
      !API_ORIGINS.has(url.origin) ||
      url.protocol !== "https:" ||
      url.port ||
      (url.pathname !== "/" && url.pathname !== "") ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new SegmentApiError(
        "segment_api_origin_invalid",
        "Segment connection is not bound to the official US or EU Public API origin.",
      );
    return url.origin;
  }

  private rows(value: unknown) {
    return Array.isArray(value) ? value.map((item) => this.object(item)) : [];
  }
  private object(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }
  private scalar(value: unknown): string | number | boolean | null {
    if (typeof value === "string") return value.slice(0, 512);
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "boolean") return value;
    return null;
  }
  private id(value: unknown) {
    return typeof value === "string" && ID.test(value) ? value : null;
  }
  private requiredId(value: unknown, code: string, message: string) {
    const id = this.id(value);
    if (!id) throw new SegmentApiError(code, message);
    return id;
  }
}
