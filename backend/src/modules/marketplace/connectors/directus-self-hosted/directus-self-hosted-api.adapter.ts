import { safeConnectorFetch } from "../safe-connector-fetch";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;

export type DirectusSelfHostedCredentials = {
  instanceBaseUrl: string;
  staticToken: string;
  collection: string;
  itemKey: string;
};

export class DirectusSelfHostedApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class DirectusSelfHostedApiAdapter {
  async health(credentials: DirectusSelfHostedCredentials) {
    return this.getSelectedItemState(credentials);
  }

  async getSelectedItemState(credentials: DirectusSelfHostedCredentials) {
    const boundary = this.validate(credentials);
    await this.requirePublicHost(boundary.hostname);
    const path = `${boundary.basePath}/items/${boundary.collection}/${boundary.itemKey}`;
    const url = new URL(path, `${boundary.origin}/`);
    url.searchParams.set("fields", "id,status");
    if (
      url.origin !== boundary.origin ||
      url.pathname !== path ||
      url.search !== "?fields=id%2Cstatus" ||
      url.hash
    )
      throw new DirectusSelfHostedApiError(
        "policy_blocked",
        "Directus requests must stay on the approved selected-item REST route.",
        403,
      );

    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${boundary.staticToken}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new DirectusSelfHostedApiError(
        "provider_unavailable",
        "Directus REST API could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 1_000_000)
      throw new DirectusSelfHostedApiError(
        "policy_blocked",
        "Directus response exceeded the one-megabyte Relay bound.",
        403,
      );
    let value: unknown;
    try {
      value = raw.length ? JSON.parse(raw.toString("utf8")) : null;
    } catch {
      value = null;
    }
    if (!response.ok)
      throw new DirectusSelfHostedApiError(
        this.safeCode(response.status),
        `Directus REST API returned HTTP ${response.status}.`,
        response.status,
      );
    const envelope = this.object(value, "REST response");
    const item = this.object(envelope.data, "selected item");
    const returnedId = this.identifier(item.id, "item ID");
    if (returnedId !== boundary.itemKey)
      throw new DirectusSelfHostedApiError(
        "provider_validation_error",
        "Directus returned a different item than the selected item.",
        502,
      );
    return {
      item: {
        itemId: returnedId,
        status: this.requiredText(item.status, "item status", 40),
        itemContentOrIdentityIncluded: false,
        otherProjectDataIncluded: false,
      },
    };
  }

  private validate(value: DirectusSelfHostedCredentials) {
    let url: URL;
    try {
      url = new URL(value.instanceBaseUrl);
    } catch {
      throw new DirectusSelfHostedApiError(
        "provider_validation_error",
        "Enter a valid Directus HTTPS instance base URL.",
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
      /%2f|%5c/i.test(value.instanceBaseUrl)
    )
      throw new DirectusSelfHostedApiError(
        "policy_blocked",
        "Directus requires one exact public HTTPS instance base URL without embedded credentials, unsafe path segments, query, or fragment.",
        403,
      );
    if (!/^[\x21-\x7e]{32,4096}$/.test(value.staticToken))
      throw new DirectusSelfHostedApiError(
        "credential_missing",
        "Directus requires one valid dedicated least-privilege static token.",
        401,
      );
    if (!/^[A-Za-z][A-Za-z0-9_]{0,127}$/.test(value.collection))
      throw new DirectusSelfHostedApiError(
        "provider_validation_error",
        "Directus requires one exact selected collection name.",
        400,
      );
    if (!/^[A-Za-z0-9][A-Za-z0-9._~-]{0,127}$/.test(value.itemKey))
      throw new DirectusSelfHostedApiError(
        "provider_validation_error",
        "Directus requires one exact selected item key.",
        400,
      );
    return {
      origin: url.origin,
      hostname,
      basePath: normalizedPath,
      staticToken: value.staticToken,
      collection: value.collection,
      itemKey: value.itemKey,
    };
  }

  private async requirePublicHost(hostname: string) {
    let addresses: Array<{ address: string }>;
    try {
      addresses = await lookup(hostname, { all: true, verbatim: true });
    } catch {
      throw new DirectusSelfHostedApiError(
        "provider_unavailable",
        "Directus host DNS could not be resolved.",
        502,
      );
    }
    if (
      !addresses.length ||
      addresses.some(({ address }) => !this.publicAddress(address))
    )
      throw new DirectusSelfHostedApiError(
        "policy_blocked",
        "Directus host must resolve only to public addresses.",
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
      throw new DirectusSelfHostedApiError(
        "provider_validation_error",
        `Directus returned an invalid ${label}.`,
        502,
      );
    return String(value);
  }

  private requiredText(value: unknown, label: string, maximum: number) {
    if (typeof value !== "string" || !value.trim() || value.length > maximum)
      throw new DirectusSelfHostedApiError(
        "provider_validation_error",
        `Directus returned an invalid ${label}.`,
        502,
      );
    return value;
  }

  private object(value: unknown, label: string): JsonObject {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new DirectusSelfHostedApiError(
        "provider_validation_error",
        `Directus returned invalid ${label}.`,
        502,
      );
    return value as JsonObject;
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
