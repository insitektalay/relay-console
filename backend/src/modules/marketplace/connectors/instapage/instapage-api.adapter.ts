import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type InstapageCredentials = { apiToken: string };
export const INSTAPAGE_READ_OPERATIONS = ["workspaces.list"] as const;

export class InstapageApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
  }
}

@Injectable()
export class InstapageApiAdapter {
  health(credentials: InstapageCredentials) {
    return this.read(credentials, "workspaces.list");
  }

  read(credentials: InstapageCredentials, operation: string) {
    if (!INSTAPAGE_READ_OPERATIONS.includes(operation as never))
      throw new InstapageApiError(
        "policy_blocked",
        "Instapage operation is not in Relay's pinned workspace-list contract.",
        403,
      );
    return this.workspaces(credentials);
  }

  private async workspaces(credentials: InstapageCredentials) {
    this.requireCredentials(credentials);
    const url = new URL("https://api.instapage.com/v1/workspaces");
    url.searchParams.set("page", "1");
    if (
      url.origin !== "https://api.instapage.com" ||
      url.pathname !== "/v1/workspaces" ||
      url.searchParams.toString() !== "page=1"
    )
      throw new InstapageApiError(
        "policy_blocked",
        "Instapage requests must stay on the first workspace-list page.",
        403,
      );
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${credentials.apiToken}`,
          "User-Agent": "RelayConsole/1.0 (https://relayconsole.work)",
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new InstapageApiError(
        "provider_unavailable",
        "Instapage could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 1_000_000)
      throw this.invalid("Instapage response exceeds Relay's 1 MB limit.");
    const data = this.parse(raw);
    if (!response.ok)
      throw new InstapageApiError(
        this.safeCode(response.status),
        this.errorMessage(data) ??
          `Instapage returned HTTP ${response.status}.`,
        response.status,
      );
    return this.workspaceSummaries(data);
  }

  private workspaceSummaries(value: unknown) {
    const body = this.object(value);
    const rows = Array.isArray(body.data) ? body.data : [];
    const pagination = this.object(this.object(body.meta).pagination);
    return {
      workspaces: rows.slice(0, 100).map((item) => {
        const workspace = this.object(item);
        return {
          id: this.numberOrString(workspace.workspaceId),
          name: this.string(workspace.workspaceName, 500),
          accessLevel: this.accessLevel(workspace.accessLevel),
        };
      }),
      truncated:
        rows.length > 100 ||
        (typeof pagination.totalPagesCount === "number" &&
          pagination.totalPagesCount > 1),
    };
  }

  private requireCredentials(credentials: InstapageCredentials) {
    if (
      !credentials.apiToken ||
      credentials.apiToken.length > 16_000 ||
      /[\r\n]/.test(credentials.apiToken)
    )
      throw new InstapageApiError(
        "credential_missing",
        "A valid Instapage personal API token is required.",
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

  private accessLevel(value: unknown) {
    return ["owner", "editor", "manager", "viewer"].includes(String(value))
      ? String(value)
      : null;
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
    return new InstapageApiError("provider_validation_error", message, 400);
  }
}
