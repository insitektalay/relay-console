import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export const OPTIMIZELY_READ_OPERATIONS = ["projects.list"] as const;

export class OptimizelyApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
  }
}

@Injectable()
export class OptimizelyApiAdapter {
  health(accessToken: string) {
    return this.read(accessToken, "projects.list");
  }

  read(accessToken: string, operation: string) {
    if (!OPTIMIZELY_READ_OPERATIONS.includes(operation as never))
      throw new OptimizelyApiError(
        "policy_blocked",
        "Optimizely operation is not in Relay's pinned project-list contract.",
        403,
      );
    return this.projects(accessToken);
  }

  private async projects(accessToken: string) {
    this.requireToken(accessToken);
    const url = new URL("https://api.optimizely.com/v2/projects");
    url.searchParams.set("page", "1");
    url.searchParams.set("per_page", "100");
    if (
      url.origin !== "https://api.optimizely.com" ||
      url.pathname !== "/v2/projects" ||
      url.searchParams.toString() !== "page=1&per_page=100"
    )
      throw new OptimizelyApiError(
        "policy_blocked",
        "Optimizely requests must stay on the bounded project-list route.",
        403,
      );
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
          "User-Agent": "RelayConsole/1.0 (https://relayconsole.work)",
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new OptimizelyApiError(
        "provider_unavailable",
        "Optimizely could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 1_000_000)
      throw this.invalid("Optimizely response exceeds Relay's 1 MB limit.");
    const data = this.parse(raw);
    if (!response.ok)
      throw new OptimizelyApiError(
        this.safeCode(response.status),
        this.errorMessage(data) ??
          `Optimizely returned HTTP ${response.status}.`,
        response.status,
      );
    const rows = Array.isArray(data) ? data : [];
    return {
      projects: rows.slice(0, 100).map((item) => {
        const project = this.object(item);
        return {
          id: this.numberOrString(project.id),
          name: this.string(project.name, 500),
          platform: this.string(project.platform, 100),
          status: this.string(project.status, 100),
        };
      }),
      truncated: rows.length > 100 || response.headers.has("link"),
    };
  }

  private requireToken(accessToken: string) {
    if (
      !accessToken ||
      accessToken.length > 16_000 ||
      /[\r\n]/.test(accessToken)
    )
      throw new OptimizelyApiError(
        "credential_missing",
        "A valid Optimizely OAuth access token is required.",
        401,
      );
  }

  private parse(raw: Buffer): unknown {
    if (!raw.length) return null;
    try {
      return JSON.parse(raw.toString("utf8"));
    } catch {
      return { message: raw.toString("utf8").slice(0, 2_000) };
    }
  }

  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "credential_missing";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private errorMessage(value: unknown) {
    const body = this.object(value);
    const candidate = body.message ?? body.error;
    return typeof candidate === "string" ? candidate.slice(0, 500) : null;
  }

  private numberOrString(value: unknown) {
    return typeof value === "number" && Number.isSafeInteger(value)
      ? String(value)
      : this.string(value, 200);
  }

  private string(value: unknown, max: number) {
    return typeof value === "string" ? value.slice(0, max) : null;
  }

  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }

  private invalid(message: string) {
    return new OptimizelyApiError("provider_validation_error", message, 400);
  }
}
