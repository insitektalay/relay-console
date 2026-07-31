import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type VwoCredentials = { apiToken: string };
export const VWO_READ_OPERATIONS = ["projects.list"] as const;

export class VwoApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
  }
}

@Injectable()
export class VwoApiAdapter {
  health(credentials: VwoCredentials) {
    return this.read(credentials, "projects.list");
  }

  read(credentials: VwoCredentials, operation: string) {
    if (!VWO_READ_OPERATIONS.includes(operation as never))
      throw new VwoApiError(
        "policy_blocked",
        "VWO operation is not in Relay's pinned project-list contract.",
        403,
      );
    return this.projects(credentials);
  }

  private async projects(credentials: VwoCredentials) {
    this.requireCredentials(credentials);
    const url = new URL("https://app.vwo.com/api/v2/accounts/current/projects");
    if (
      url.origin !== "https://app.vwo.com" ||
      url.pathname !== "/api/v2/accounts/current/projects" ||
      [...url.searchParams].length
    )
      throw new VwoApiError(
        "policy_blocked",
        "VWO requests must stay on the current-account project-list route.",
        403,
      );
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          token: credentials.apiToken,
          "User-Agent": "RelayConsole/1.0 (https://relayconsole.work)",
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new VwoApiError(
        "provider_unavailable",
        "VWO could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 1_000_000)
      throw this.invalid("VWO response exceeds Relay's 1 MB limit.");
    const data = this.parse(raw);
    if (!response.ok)
      throw new VwoApiError(
        this.safeCode(response.status),
        this.errorMessage(data) ?? `VWO returned HTTP ${response.status}.`,
        response.status,
      );
    const body = this.object(data);
    const rows = Array.isArray(data)
      ? data
      : Array.isArray(body.data)
        ? body.data
        : Array.isArray(body.projects)
          ? body.projects
          : [];
    return {
      projects: rows.slice(0, 100).map((item) => {
        const project = this.object(item);
        return {
          id: this.numberOrString(project.id ?? project.projectId),
          name: this.string(project.name, 500),
        };
      }),
      truncated: rows.length > 100,
    };
  }

  private requireCredentials(credentials: VwoCredentials) {
    if (
      !credentials.apiToken ||
      credentials.apiToken.length > 16_000 ||
      /[\r\n]/.test(credentials.apiToken)
    )
      throw new VwoApiError(
        "credential_missing",
        "A valid VWO API token is required.",
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
    if (status === 401 || status === 403) return "credential_missing";
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
    return new VwoApiError("provider_validation_error", message, 400);
  }
}
