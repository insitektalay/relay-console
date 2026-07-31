import { safeConnectorFetch } from "../safe-connector-fetch";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;

export type SynologyDsmCredentials = {
  serverOrigin: string;
  apiName: string;
};

export class SynologyDsmApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class SynologyDsmApiAdapter {
  async health(credentials: SynologyDsmCredentials) {
    return this.getSelectedApiCompatibility(credentials);
  }

  async getSelectedApiCompatibility(credentials: SynologyDsmCredentials) {
    const boundary = this.validate(credentials);
    await this.requirePublicHost(boundary.hostname);
    const url = new URL("/webapi/entry.cgi", boundary.origin);
    url.searchParams.set("api", "SYNO.API.Info");
    url.searchParams.set("version", "1");
    url.searchParams.set("method", "query");
    url.searchParams.set("query", boundary.apiName);
    if (
      url.origin !== boundary.origin ||
      url.pathname !== "/webapi/entry.cgi" ||
      url.hash ||
      url.searchParams.size !== 4
    )
      throw new SynologyDsmApiError(
        "policy_blocked",
        "Synology DSM requests must stay on the approved API-info query.",
        403,
      );
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new SynologyDsmApiError(
        "provider_unavailable",
        "Synology DSM could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 512_000)
      throw new SynologyDsmApiError(
        "policy_blocked",
        "Synology DSM response exceeded the 512-kilobyte Relay bound.",
        403,
      );
    let value: unknown;
    try {
      value = raw.length ? JSON.parse(raw.toString("utf8")) : null;
    } catch {
      value = null;
    }
    if (!response.ok)
      throw new SynologyDsmApiError(
        this.safeCode(response.status),
        `Synology DSM returned HTTP ${response.status}.`,
        response.status,
      );
    const root = this.object(value, "response");
    if (root.success !== true)
      throw new SynologyDsmApiError(
        "provider_validation_error",
        "Synology DSM rejected the selected API-info query.",
        502,
      );
    const data = this.object(root.data, "API information");
    const selected = this.object(
      data[boundary.apiName],
      "selected API information",
    );
    const minVersion = this.version(selected.minVersion);
    const maxVersion = this.version(selected.maxVersion);
    if (minVersion === null || maxVersion === null || maxVersion < minVersion)
      throw new SynologyDsmApiError(
        "provider_validation_error",
        "Synology DSM returned an invalid selected API version range.",
        502,
      );
    return {
      api: {
        apiName: boundary.apiName,
        minVersion,
        maxVersion,
        requestFormat: this.requestFormat(selected.requestFormat),
        providerPathIncluded: false,
        accountOrStorageDataIncluded: false,
      },
    };
  }

  private validate(value: SynologyDsmCredentials) {
    let url: URL;
    try {
      url = new URL(value.serverOrigin);
    } catch {
      throw new SynologyDsmApiError(
        "provider_validation_error",
        "Enter a valid Synology DSM HTTPS origin.",
        400,
      );
    }
    const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      (url.pathname !== "/" && url.pathname !== "") ||
      !hostname ||
      hostname !== url.hostname.toLowerCase()
    )
      throw new SynologyDsmApiError(
        "policy_blocked",
        "Synology DSM requires one exact public HTTPS origin without a path, embedded credentials, query, or fragment.",
        403,
      );
    if (!/^SYNO\.[A-Za-z0-9]+(?:\.[A-Za-z0-9]+){1,7}$/.test(value.apiName))
      throw new SynologyDsmApiError(
        "provider_validation_error",
        "Synology DSM requires one exact safe selected SYNO API name.",
        400,
      );
    return { origin: url.origin, hostname, apiName: value.apiName };
  }

  private async requirePublicHost(hostname: string) {
    let addresses: Array<{ address: string }>;
    try {
      addresses = await lookup(hostname, { all: true, verbatim: true });
    } catch {
      throw new SynologyDsmApiError(
        "provider_unavailable",
        "Synology DSM DNS could not be resolved.",
        502,
      );
    }
    if (
      !addresses.length ||
      addresses.some(({ address }) => !this.publicAddress(address))
    )
      throw new SynologyDsmApiError(
        "policy_blocked",
        "Synology DSM must resolve only to public addresses.",
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

  private object(value: unknown, label: string): JsonObject {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new SynologyDsmApiError(
        "provider_validation_error",
        `Synology DSM returned invalid ${label}.`,
        502,
      );
    return value as JsonObject;
  }

  private version(value: unknown) {
    return typeof value === "number" &&
      Number.isSafeInteger(value) &&
      value >= 1 &&
      value <= 10_000
      ? value
      : null;
  }

  private requestFormat(value: unknown) {
    return value === "JSON" ? "JSON" : null;
  }

  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 404 || status === 400 || status === 422)
      return "provider_validation_error";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500 || status === 408) return "provider_unavailable";
    return "provider_validation_error";
  }
}
