import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;

export type AvazaCredentials = {
  personalAccessToken: string;
  projectId: string;
};

export class AvazaApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class AvazaApiAdapter {
  async health(credentials: AvazaCredentials) {
    return this.getSelectedProjectState(credentials);
  }

  async getSelectedProjectState(credentials: AvazaCredentials) {
    const token = this.credential(credentials.personalAccessToken);
    const projectId = this.id(credentials.projectId);
    const body = await this.fetchJson(
      `https://api.avaza.com/api/Project/${projectId}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          "User-Agent": "RelayConsole/1.0",
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      },
    );
    if (String(body.ProjectID) !== projectId)
      throw this.invalid("Avaza returned a different project than selected.");
    return {
      project: {
        projectId,
        statusCode: this.text(
          body.ProjectStatusCode,
          "project status code",
          80,
        ),
        statusName: this.text(
          body.ProjectStatusName,
          "project status name",
          120,
        ),
        archived: this.boolean(body.isArchived, "archive state"),
        notStarted: this.boolean(
          body.ProjectStatusIsNotStarted,
          "not-started state",
        ),
        complete: this.boolean(
          body.ProjectStatusIsComplete,
          "completion state",
        ),
        startDate: this.optionalDate(body.StartDate, "start date"),
        endDate: this.optionalDate(body.EndDate, "end date"),
        createdAt: this.optionalDate(body.DateCreated, "creation date"),
        updatedAt: this.optionalDate(body.DateUpdated, "updated date"),
        titleCompanyNotesIncluded: false,
        sectionsMembersRatesBudgetsTagsIncluded: false,
      },
    };
  }

  private async fetchJson(url: string, init: RequestInit) {
    let response: Response;
    try {
      response = await safeConnectorFetch(url, init);
    } catch {
      throw new AvazaApiError(
        "provider_unavailable",
        "Avaza API could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 262_144)
      throw this.invalid("Avaza response exceeded the 256 KiB Relay bound.");
    let value: unknown;
    try {
      value = raw.length ? JSON.parse(raw.toString("utf8")) : null;
    } catch {
      value = null;
    }
    if (!response.ok)
      throw new AvazaApiError(
        this.safeCode(response.status),
        `Avaza API returned HTTP ${response.status}.`,
        response.status,
      );
    return this.object(value, "API response");
  }

  private credential(value: string) {
    if (
      typeof value !== "string" ||
      value.length < 16 ||
      value.length > 4_096 ||
      !/^[\x21-\x7e]+$/.test(value)
    )
      throw new AvazaApiError(
        "credential_missing",
        "Avaza personal access token is missing or invalid.",
        401,
      );
    return value;
  }

  private id(value: string) {
    if (!/^[1-9][0-9]{0,18}$/.test(value))
      throw this.invalid("Avaza project ID must be one positive integer.", 400);
    return value;
  }

  private object(value: unknown, label: string): JsonObject {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw this.invalid(`Avaza returned an invalid ${label}.`);
    return value as JsonObject;
  }

  private text(value: unknown, label: string, maximum: number) {
    if (typeof value !== "string" || !value.trim() || value.length > maximum)
      throw this.invalid(`Avaza returned an invalid ${label}.`);
    return value;
  }

  private boolean(value: unknown, label: string) {
    if (typeof value !== "boolean")
      throw this.invalid(`Avaza returned an invalid ${label}.`);
    return value;
  }

  private optionalDate(value: unknown, label: string) {
    if (value === null || value === undefined || value === "") return null;
    if (
      typeof value !== "string" ||
      value.length > 40 ||
      Number.isNaN(Date.parse(value))
    )
      throw this.invalid(`Avaza returned an invalid ${label}.`);
    return value;
  }

  private invalid(message: string, statusCode = 502) {
    return new AvazaApiError("provider_validation_error", message, statusCode);
  }

  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500 || status === 408) return "provider_unavailable";
    return "provider_validation_error";
  }
}
