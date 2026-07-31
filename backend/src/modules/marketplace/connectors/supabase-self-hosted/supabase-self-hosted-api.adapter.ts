import { safeConnectorFetch } from "../safe-connector-fetch";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;

export type SupabaseSelfHostedCredentials = {
  projectBaseUrl: string;
  publishableKey: string;
  table: string;
  rowId: string;
};

export class SupabaseSelfHostedApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class SupabaseSelfHostedApiAdapter {
  async health(credentials: SupabaseSelfHostedCredentials) {
    return this.getSelectedRowState(credentials);
  }

  async getSelectedRowState(credentials: SupabaseSelfHostedCredentials) {
    const boundary = this.validate(credentials);
    await this.requirePublicHost(boundary.hostname);
    const path = `${boundary.basePath}/rest/v1/${boundary.table}`;
    const url = new URL(path, `${boundary.origin}/`);
    url.searchParams.set("select", "id,status");
    url.searchParams.set("id", `eq.${boundary.rowId}`);
    url.searchParams.set("limit", "1");
    const expectedSearch = new URLSearchParams({
      select: "id,status",
      id: `eq.${boundary.rowId}`,
      limit: "1",
    }).toString();
    if (
      url.origin !== boundary.origin ||
      url.pathname !== path ||
      url.search !== `?${expectedSearch}` ||
      url.hash
    )
      throw new SupabaseSelfHostedApiError(
        "policy_blocked",
        "Supabase requests must stay on the approved selected-row PostgREST route.",
        403,
      );

    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          apikey: boundary.publishableKey,
          Authorization: `Bearer ${boundary.publishableKey}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new SupabaseSelfHostedApiError(
        "provider_unavailable",
        "Supabase Data API could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 1_000_000)
      throw new SupabaseSelfHostedApiError(
        "policy_blocked",
        "Supabase response exceeded the one-megabyte Relay bound.",
        403,
      );
    let value: unknown;
    try {
      value = raw.length ? JSON.parse(raw.toString("utf8")) : null;
    } catch {
      value = null;
    }
    if (!response.ok)
      throw new SupabaseSelfHostedApiError(
        this.safeCode(response.status),
        `Supabase Data API returned HTTP ${response.status}.`,
        response.status,
      );
    if (!Array.isArray(value) || value.length !== 1)
      throw new SupabaseSelfHostedApiError(
        "provider_validation_error",
        "Supabase must return exactly the selected row.",
        502,
      );
    const row = this.object(value[0], "selected row");
    const returnedId = this.identifier(row.id, "row ID");
    if (returnedId !== boundary.rowId)
      throw new SupabaseSelfHostedApiError(
        "provider_validation_error",
        "Supabase returned a different row than the selected row.",
        502,
      );
    return {
      row: {
        rowId: returnedId,
        status: this.requiredText(row.status, "row status", 80),
        rowContentOrIdentityIncluded: false,
        otherProjectDataIncluded: false,
      },
    };
  }

  private validate(value: SupabaseSelfHostedCredentials) {
    let url: URL;
    try {
      url = new URL(value.projectBaseUrl);
    } catch {
      throw new SupabaseSelfHostedApiError(
        "provider_validation_error",
        "Enter a valid Supabase HTTPS project base URL.",
        400,
      );
    }
    const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
    const rawPath = url.pathname;
    const normalizedPath = rawPath === "/" ? "" : rawPath.replace(/\/$/, "");
    const safePath =
      normalizedPath === "" ||
      (/^\/(?:[A-Za-z0-9._~-]+)(?:\/[A-Za-z0-9._~-]+)*$/.test(normalizedPath) &&
        !normalizedPath
          .split("/")
          .some((part) => part === "." || part === ".."));
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !hostname ||
      hostname !== url.hostname.toLowerCase() ||
      !safePath ||
      /%2f|%5c/i.test(value.projectBaseUrl)
    )
      throw new SupabaseSelfHostedApiError(
        "policy_blocked",
        "Supabase requires one exact public HTTPS project base URL without embedded credentials, unsafe path segments, query, or fragment.",
        403,
      );
    if (
      !/^sb_publishable_[A-Za-z0-9_-]{22}_[A-Za-z0-9_-]{8}$/.test(
        value.publishableKey,
      )
    )
      throw new SupabaseSelfHostedApiError(
        "credential_missing",
        "Supabase requires one valid self-hosted publishable key; secret and legacy service-role keys are blocked.",
        401,
      );
    if (!/^[a-z][a-z0-9_]{0,62}$/.test(value.table))
      throw new SupabaseSelfHostedApiError(
        "provider_validation_error",
        "Supabase requires one exact selected public table name.",
        400,
      );
    if (!/^[A-Za-z0-9][A-Za-z0-9._~-]{0,127}$/.test(value.rowId))
      throw new SupabaseSelfHostedApiError(
        "provider_validation_error",
        "Supabase requires one exact selected row ID.",
        400,
      );
    return {
      origin: url.origin,
      hostname,
      basePath: normalizedPath,
      publishableKey: value.publishableKey,
      table: value.table,
      rowId: value.rowId,
    };
  }

  private async requirePublicHost(hostname: string) {
    let addresses: Array<{ address: string }>;
    try {
      addresses = await lookup(hostname, { all: true, verbatim: true });
    } catch {
      throw new SupabaseSelfHostedApiError(
        "provider_unavailable",
        "Supabase host DNS could not be resolved.",
        502,
      );
    }
    if (
      !addresses.length ||
      addresses.some(({ address }) => !this.publicAddress(address))
    )
      throw new SupabaseSelfHostedApiError(
        "policy_blocked",
        "Supabase host must resolve only to public addresses.",
        403,
      );
  }

  private publicAddress(value: string) {
    if (isIP(value) === 4) {
      const [a, b, c] = value.split(".").map(Number);
      return !(
        a === 0 ||
        a === 10 ||
        a === 127 ||
        a >= 224 ||
        (a === 100 && b >= 64 && b <= 127) ||
        (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 0 && (c === 0 || c === 2)) ||
        (a === 192 && b === 88 && c === 99) ||
        (a === 192 && b === 168) ||
        (a === 198 && (b === 18 || b === 19)) ||
        (a === 198 && b === 51 && c === 100) ||
        (a === 203 && b === 0 && c === 113)
      );
    }
    if (isIP(value) === 6) {
      const normalized = value.toLowerCase();
      return !(
        normalized === "::" ||
        normalized === "::1" ||
        normalized.startsWith("fe8") ||
        normalized.startsWith("fe9") ||
        normalized.startsWith("fea") ||
        normalized.startsWith("feb") ||
        normalized.startsWith("fc") ||
        normalized.startsWith("fd") ||
        normalized.startsWith("ff") ||
        normalized.startsWith("2001:db8:") ||
        normalized.startsWith("::ffff:")
      );
    }
    return false;
  }

  private identifier(value: unknown, label: string) {
    if (
      (typeof value !== "string" && typeof value !== "number") ||
      !String(value).match(/^[A-Za-z0-9][A-Za-z0-9._~-]{0,127}$/)
    )
      throw new SupabaseSelfHostedApiError(
        "provider_validation_error",
        `Supabase returned an invalid ${label}.`,
        502,
      );
    return String(value);
  }

  private requiredText(value: unknown, label: string, maximum: number) {
    if (typeof value !== "string" || !value.trim() || value.length > maximum)
      throw new SupabaseSelfHostedApiError(
        "provider_validation_error",
        `Supabase returned an invalid ${label}.`,
        502,
      );
    return value;
  }

  private object(value: unknown, label: string): JsonObject {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new SupabaseSelfHostedApiError(
        "provider_validation_error",
        `Supabase returned invalid ${label}.`,
        502,
      );
    return value as JsonObject;
  }

  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 400 || status === 404 || status === 406 || status === 422)
      return "provider_validation_error";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500 || status === 408) return "provider_unavailable";
    return "provider_validation_error";
  }
}
