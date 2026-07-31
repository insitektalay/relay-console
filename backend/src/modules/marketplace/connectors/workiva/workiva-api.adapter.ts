import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type WorkivaCredentials = {
  region: string;
  clientId: string;
  clientSecret: string;
};
export const WORKIVA_OPERATIONS = ["files.list"] as const;

export class WorkivaApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
  }
}

@Injectable()
export class WorkivaApiAdapter {
  private readonly version = "2026-01-01";

  async health(credentials: WorkivaCredentials) {
    const result = await this.read(credentials, {
      operation: "files.list",
      maxPageSize: 1,
    });
    return {
      region: this.region(credentials.region),
      clientCredentialsVerified: true,
      exactScopeVerified: "file:read",
      fileDirectoryVerified: true,
      visibleCountAtLeast: result.files.length,
    };
  }

  async read(credentials: WorkivaCredentials, input: JsonObject) {
    if (input.operation !== "files.list")
      throw new WorkivaApiError(
        "policy_blocked",
        "Workiva operation is outside Relay's pinned file directory read.",
        403,
      );
    const maxPageSize = this.integer(input.maxPageSize, 1, 20, 20);
    const region = this.region(credentials.region);
    const origin = this.origin(region);
    const token = await this.token(credentials, origin);
    const url = new URL("/files", origin);
    url.searchParams.set("$maxpagesize", String(maxPageSize));
    const response = await this.request(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "X-Version": this.version,
      },
    });
    const body = await this.body(response);
    if (!response.ok) throw this.httpError(response.status, "API");
    if (!Array.isArray(body.data))
      throw new WorkivaApiError(
        "provider_validation_error",
        "Workiva returned an invalid file directory.",
        502,
      );
    return {
      files: body.data
        .slice(0, maxPageSize)
        .map((entry) => this.object(entry))
        .map((file) => {
          const modified = this.object(file.modified);
          return {
            id: this.requiredText(file.id, 512),
            name: this.requiredText(file.name, 500),
            kind: this.text(file.kind, 100),
            state: this.text(file.state, 100),
            template: typeof file.template === "boolean" ? file.template : null,
            type: this.text(file.type, 200),
            modifiedAt: this.text(modified.dateTime, 100),
          };
        })
        .filter((file) => file.id && file.name),
      region,
      maxPageSize,
      hasMore:
        typeof body["@nextLink"] === "string" && body["@nextLink"].length > 0,
    };
  }

  private async token(credentials: WorkivaCredentials, origin: string) {
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: this.credential(credentials.clientId, "client ID"),
      client_secret: this.credential(credentials.clientSecret, "client secret"),
      scope: "file:read",
    });
    const response = await this.request(new URL("/oauth2/token", origin), {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Version": this.version,
      },
      body,
    });
    const data = await this.body(response, 100_000);
    if (!response.ok) throw this.httpError(response.status, "token service");
    const accessToken = this.text(data.access_token, 20_000);
    const scopes = new Set(
      (this.text(data.scope, 1_000) ?? "").split(/\s+/).filter(Boolean),
    );
    if (!accessToken || /[\r\n]/.test(accessToken))
      throw new WorkivaApiError(
        "credential_missing",
        "Workiva did not return a valid access token.",
        401,
      );
    if (scopes.size !== 1 || !scopes.has("file:read"))
      throw new WorkivaApiError(
        "policy_blocked",
        "Workiva token must be limited to the exact file:read scope.",
        403,
      );
    return accessToken;
  }

  private origin(region: "us" | "eu" | "apac") {
    return region === "us"
      ? "https://api.app.wdesk.com"
      : `https://api.${region}.wdesk.com`;
  }

  private region(value: string): "us" | "eu" | "apac" {
    const region = value.trim().toLowerCase();
    if (region !== "us" && region !== "eu" && region !== "apac")
      throw new WorkivaApiError(
        "provider_validation_error",
        "Workiva region must be us, eu, or apac.",
      );
    return region;
  }

  private async request(url: URL, init: RequestInit) {
    try {
      return await safeConnectorFetch(url, {
        ...init,
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new WorkivaApiError(
        "provider_unavailable",
        "Workiva API could not be reached.",
        502,
      );
    }
  }

  private httpError(status: number, service: string) {
    return new WorkivaApiError(
      status === 429
        ? "provider_rate_limited"
        : status >= 500
          ? "provider_unavailable"
          : status === 401 || status === 403
            ? "credential_missing"
            : "provider_validation_error",
      `Workiva ${service} returned HTTP ${status}.`,
      status || 400,
    );
  }

  private credential(value: string, label: string) {
    if (!value || value.length > 4_000 || /[\r\n]/.test(value))
      throw new WorkivaApiError(
        "credential_missing",
        `A valid Workiva ${label} is required.`,
        401,
      );
    return value;
  }

  private integer(value: unknown, min: number, max: number, fallback: number) {
    if (value === undefined) return fallback;
    if (!Number.isInteger(value) || Number(value) < min || Number(value) > max)
      throw new WorkivaApiError(
        "provider_validation_error",
        `Integer must be between ${min} and ${max}.`,
      );
    return Number(value);
  }

  private async body(response: Response, max = 500_000) {
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > max)
      throw new WorkivaApiError(
        "provider_validation_error",
        "Workiva response exceeds Relay's size limit.",
      );
    try {
      return this.object(JSON.parse(raw.toString("utf8")));
    } catch {
      return {};
    }
  }

  private requiredText(value: unknown, max: number) {
    return typeof value === "string" && value.length > 0
      ? value.slice(0, max)
      : null;
  }

  private text(value: unknown, max: number) {
    return typeof value === "string" ? value.slice(0, max) : null;
  }

  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }
}
