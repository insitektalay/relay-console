import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;

export type KantataOxCredentials = {
  oauthToken: string;
  workspaceId: string;
};

export class KantataOxApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class KantataOxApiAdapter {
  private readonly origin = "https://api.mavenlink.com/api/v1";

  async health(credentials: KantataOxCredentials) {
    return this.getSelectedWorkspaceState(credentials);
  }

  async getSelectedWorkspaceState(credentials: KantataOxCredentials) {
    const token = this.token(credentials.oauthToken);
    const workspaceId = this.id(credentials.workspaceId, "workspace");
    const path = `/workspaces/${workspaceId}.json?include_archived=true`;
    let response: Response;
    try {
      response = await safeConnectorFetch(`${this.origin}${path}`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          "User-Agent": "RelayConsole/1.0",
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new KantataOxApiError(
        "provider_unavailable",
        "Kantata OX API could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 262_144)
      throw new KantataOxApiError(
        "policy_blocked",
        "Kantata OX response exceeded the 256 KiB Relay bound.",
        403,
      );
    let value: unknown;
    try {
      value = raw.length ? JSON.parse(raw.toString("utf8")) : null;
    } catch {
      value = null;
    }
    if (!response.ok)
      throw new KantataOxApiError(
        this.safeCode(response.status),
        `Kantata OX API returned HTTP ${response.status}.`,
        response.status,
      );
    const envelope = this.object(value, "API response");
    const results = envelope.results;
    if (!Array.isArray(results) || results.length !== 1)
      throw this.invalid(
        "Kantata OX must return exactly the selected project.",
      );
    const result = this.object(results[0], "result reference");
    if (result.key !== "workspaces" || String(result.id) !== workspaceId)
      throw this.invalid(
        "Kantata OX returned a different project than the selected project.",
      );
    const workspaces = this.object(envelope.workspaces, "workspace map");
    const workspace = this.object(
      workspaces[workspaceId],
      "selected workspace",
    );
    if (String(workspace.id) !== workspaceId)
      throw this.invalid(
        "Kantata OX returned a mismatched selected-project object.",
      );
    return {
      workspace: {
        workspaceId,
        stage: this.requiredText(workspace.stage, "project stage", 40),
        archived: this.boolean(workspace.archived, "archived state"),
        startsOn: this.optionalDate(workspace.start_date, "start date"),
        dueOn: this.optionalDate(workspace.due_date, "due date"),
        titleOrDescriptionIncluded: false,
        financialsOrIdentitiesIncluded: false,
      },
    };
  }

  private token(value: string) {
    if (!/^[\x21-\x7e]{32,4096}$/.test(value))
      throw new KantataOxApiError(
        "credential_missing",
        "Kantata OX requires one valid customer-generated OAuth bearer token.",
        401,
      );
    return value;
  }

  private id(value: string, label: string) {
    if (!/^[1-9][0-9]{0,18}$/.test(value))
      throw this.invalid(
        `Kantata OX ${label} ID must be one positive integer.`,
        400,
      );
    return value;
  }

  private object(value: unknown, label: string): JsonObject {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw this.invalid(`Kantata OX returned an invalid ${label}.`);
    return value as JsonObject;
  }

  private requiredText(value: unknown, label: string, maximum: number) {
    if (typeof value !== "string" || !value.trim() || value.length > maximum)
      throw this.invalid(`Kantata OX returned an invalid ${label}.`);
    return value;
  }

  private boolean(value: unknown, label: string) {
    if (typeof value !== "boolean")
      throw this.invalid(`Kantata OX returned an invalid ${label}.`);
    return value;
  }

  private optionalDate(value: unknown, label: string) {
    if (value === null || value === undefined) return null;
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
      throw this.invalid(`Kantata OX returned an invalid ${label}.`);
    return value;
  }

  private invalid(message: string, statusCode = 502) {
    return new KantataOxApiError(
      "provider_validation_error",
      message,
      statusCode,
    );
  }

  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 400 || status === 404 || status === 422)
      return "provider_validation_error";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500 || status === 408) return "provider_unavailable";
    return "provider_validation_error";
  }
}
