import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type HttpClient = (url: string, init: RequestInit) => Promise<Response>;
export type StreakCredentials = { apiKey: string };

const API_ORIGIN = "https://api.streak.com";
const KEY = /^[A-Za-z0-9_-]{1,200}$/;

export class StreakApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
  }
}

@Injectable()
export class StreakApiAdapter {
  constructor(private readonly request: HttpClient = fetch) {}

  async health(credentials: StreakCredentials) {
    const user = this.user(
      this.object(await this.send(credentials, "/api/v1/users/me")),
    );
    if (!user.userKey) {
      throw new StreakApiError(
        "provider_validation_error",
        "Streak did not return the API-key-bound user.",
      );
    }
    return { userKey: user.userKey, apiVersion: "v1", reachable: true };
  }

  async getCurrentUser(credentials: StreakCredentials) {
    return {
      user: this.user(
        this.object(await this.send(credentials, "/api/v1/users/me")),
      ),
    };
  }

  async getPipeline(credentials: StreakCredentials, input: JsonObject) {
    const pipelineKey = this.key(input.pipelineKey, "Pipeline");
    const pipeline = this.pipeline(
      this.object(
        await this.send(credentials, `/api/v1/pipelines/${pipelineKey}`),
      ),
    );
    if (pipeline.pipelineKey !== pipelineKey) {
      throw new StreakApiError(
        "provider_validation_error",
        "Streak returned a pipeline outside the requested binding.",
      );
    }
    return { pipeline };
  }

  async listBoxes(credentials: StreakCredentials, input: JsonObject) {
    const pipelineKey = this.key(input.pipelineKey, "Pipeline");
    const limit = this.limit(input.limit);
    const body = await this.send(
      credentials,
      `/api/v1/pipelines/${pipelineKey}/boxes`,
      {
        page: "0",
        limit: String(limit),
        sortBy: "lastUpdatedTimestamp",
      },
    );
    const object = this.object(body);
    return {
      pipelineKey,
      boxes: this.rows(body)
        .slice(0, limit)
        .map((row) => this.box(row)),
      hasMore: object.hasNextPage === true,
    };
  }

  async getBox(credentials: StreakCredentials, input: JsonObject) {
    const boxKey = this.key(input.boxKey, "Box");
    const box = this.box(
      this.object(await this.send(credentials, `/api/v1/boxes/${boxKey}`)),
    );
    if (box.boxKey !== boxKey) {
      throw new StreakApiError(
        "provider_validation_error",
        "Streak returned a box outside the requested binding.",
      );
    }
    return { box };
  }

  private async send(
    credentials: StreakCredentials,
    path:
      | "/api/v1/users/me"
      | `/api/v1/pipelines/${string}`
      | `/api/v1/pipelines/${string}/boxes`
      | `/api/v1/boxes/${string}`,
    query: Record<string, string> = {},
  ) {
    if (!credentials.apiKey.trim() || credentials.apiKey.length > 512) {
      throw new StreakApiError(
        "credential_missing",
        "Streak API key is missing or invalid.",
      );
    }
    const url = new URL(path, API_ORIGIN);
    Object.entries(query).forEach(([key, value]) =>
      url.searchParams.set(key, value),
    );
    let response: Response;
    try {
      response = await this.request(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Basic ${Buffer.from(`${credentials.apiKey}:`).toString("base64")}`,
          "User-Agent": "RelayConsole/1.0 (https://relayconsole.work)",
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new StreakApiError(
        "provider_unavailable",
        "Streak is temporarily unavailable.",
        502,
      );
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 2_000_000) {
      throw new StreakApiError(
        "provider_validation_error",
        "Streak response exceeded the safe size limit.",
      );
    }
    if (!response.ok) {
      throw new StreakApiError(
        response.status === 401
          ? "credential_missing"
          : response.status === 403
            ? "insufficient_scope"
            : response.status === 429
              ? "provider_rate_limited"
              : response.status >= 500
                ? "provider_unavailable"
                : "provider_validation_error",
        "Streak API request failed.",
        response.status,
      );
    }
    try {
      return raw ? (JSON.parse(raw) as unknown) : {};
    } catch {
      throw new StreakApiError(
        "provider_validation_error",
        "Streak returned an invalid response.",
      );
    }
  }

  private user(row: JsonObject) {
    return {
      userKey: this.keyOrNull(row.userKey ?? row.key),
      displayName: this.scalar(row.displayName),
      isOauthComplete: this.scalar(row.isOauthComplete),
      lastSeenTimestamp: this.scalar(row.lastSeenTimestamp),
    };
  }

  private pipeline(row: JsonObject) {
    return {
      pipelineKey: this.keyOrNull(row.pipelineKey ?? row.key),
      name: this.scalar(row.name),
      teamWide: this.scalar(row.teamWide),
      orgWide: this.scalar(row.orgWide),
      creationTimestamp: this.scalar(row.creationTimestamp),
      lastUpdatedTimestamp: this.scalar(row.lastUpdatedTimestamp),
    };
  }

  private box(row: JsonObject) {
    return {
      boxKey: this.keyOrNull(row.boxKey ?? row.key),
      name: this.scalar(row.name),
      pipelineKey: this.keyOrNull(row.pipelineKey),
      stageKey: this.keyOrNull(row.stageKey),
      creationTimestamp: this.scalar(row.creationTimestamp),
      lastUpdatedTimestamp: this.scalar(row.lastUpdatedTimestamp),
    };
  }

  private rows(value: unknown): JsonObject[] {
    if (Array.isArray(value)) return value.map((item) => this.object(item));
    const object = this.object(value);
    const rows = Array.isArray(object.results)
      ? object.results
      : Array.isArray(object.boxes)
        ? object.boxes
        : [];
    return rows.map((item) => this.object(item));
  }

  private key(value: unknown, label: string) {
    if (typeof value !== "string" || !KEY.test(value)) {
      throw new StreakApiError(
        "provider_validation_error",
        `A valid Streak ${label} key is required.`,
      );
    }
    return value;
  }

  private keyOrNull(value: unknown) {
    return typeof value === "string" && KEY.test(value) ? value : null;
  }

  private scalar(value: unknown): string | number | boolean | null {
    if (typeof value === "string") return value.slice(0, 512);
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "boolean") return value;
    return null;
  }

  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }

  private limit(value: unknown) {
    if (value === undefined) return 25;
    if (
      !Number.isSafeInteger(value) ||
      Number(value) < 1 ||
      Number(value) > 25
    ) {
      throw new StreakApiError(
        "provider_validation_error",
        "Streak result limit is outside the supported range.",
      );
    }
    return Number(value);
  }
}
