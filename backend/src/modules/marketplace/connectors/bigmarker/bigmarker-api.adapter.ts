import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type BigMarkerCredentials = { apiKey: string };

export class BigMarkerApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class BigMarkerApiAdapter {
  async health(credentials: BigMarkerCredentials) {
    const result = await this.countFutureConferences(credentials, { limit: 1 });
    return {
      authorized: true,
      reportedTotalEntries: result.reportedTotalEntries,
    };
  }

  async countFutureConferences(
    credentials: BigMarkerCredentials,
    input: JsonObject,
  ) {
    const apiKey = credentials.apiKey?.trim();
    if (!apiKey || apiKey.length > 10_000)
      throw new BigMarkerApiError(
        "credential_missing",
        "BigMarker API key is required.",
        401,
      );
    const limit = this.limit(input.limit);
    const url = new URL("https://www.bigmarker.com/api/v1/conferences/");
    url.searchParams.set("page", "1");
    url.searchParams.set("per_page", String(limit));
    url.searchParams.set("role", "all");
    url.searchParams.set("type", "future");
    if (
      url.origin !== "https://www.bigmarker.com" ||
      url.pathname !== "/api/v1/conferences/" ||
      url.searchParams.get("page") !== "1" ||
      !/^(?:[1-9]|1[0-9]|2[0-5])$/.test(
        url.searchParams.get("per_page") ?? "",
      ) ||
      url.searchParams.get("role") !== "all" ||
      url.searchParams.get("type") !== "future" ||
      [...url.searchParams.keys()].some(
        (key) => !["page", "per_page", "role", "type"].includes(key),
      )
    ) {
      throw new BigMarkerApiError(
        "policy_blocked",
        "BigMarker request left its fixed endpoint boundary.",
        403,
      );
    }
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: "GET",
        headers: { Accept: "application/json", "API-KEY": apiKey },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch (error) {
      throw new BigMarkerApiError(
        "provider_unavailable",
        error instanceof Error && error.name === "TimeoutError"
          ? "BigMarker request timed out."
          : "BigMarker could not be reached.",
      );
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 1_000_000)
      throw new BigMarkerApiError(
        "provider_validation_error",
        "BigMarker returned more than 1 MB.",
      );
    let parsed: unknown;
    try {
      parsed = raw ? JSON.parse(raw) : {};
    } catch {
      parsed = {};
    }
    if (!response.ok)
      throw new BigMarkerApiError(
        this.safeCode(response.status),
        this.safeMessage(response.status),
        response.status,
      );
    const body = this.object(parsed);
    const conferences = Array.isArray(body.conferences)
      ? body.conferences
      : null;
    if (!conferences)
      throw new BigMarkerApiError(
        "provider_validation_error",
        "BigMarker returned an unexpected conference inventory shape.",
      );
    return {
      observedPageCount: Math.min(conferences.length, limit),
      reportedTotalEntries: this.nonNegative(body.total_entries),
      reportedTotalPages: this.nonNegative(body.total_pages),
      currentPage: 1,
      contentExcluded: true,
      completeInventory: this.nonNegative(body.total_pages) === 1,
    };
  }

  private nonNegative(value: unknown) {
    const number = Number(value);
    return Number.isSafeInteger(number) && number >= 0 ? number : null;
  }

  private limit(value: unknown) {
    const number = Number(value ?? 25);
    return Number.isFinite(number)
      ? Math.min(Math.max(Math.floor(number), 1), 25)
      : 25;
  }

  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }

  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "credential_missing";
    if (status === 403) return "insufficient_scope";
    if (status === 404) return "provider_validation_error";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private safeMessage(status: number) {
    if (status === 401)
      return "BigMarker API-key authorization is invalid or expired.";
    if (status === 403)
      return "BigMarker denied conference inventory access for this account.";
    if (status === 429) return "BigMarker rate limited the conference request.";
    if (status >= 500) return "BigMarker is temporarily unavailable.";
    return "BigMarker rejected the conference request.";
  }
}
