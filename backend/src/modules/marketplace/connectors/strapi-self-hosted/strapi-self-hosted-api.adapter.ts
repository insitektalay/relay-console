import { safeConnectorFetch } from "../safe-connector-fetch";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;

export type StrapiSelfHostedCredentials = {
  projectBaseUrl: string;
  apiToken: string;
  contentTypeRoute: string;
  documentId: string;
};

export class StrapiSelfHostedApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class StrapiSelfHostedApiAdapter {
  async health(credentials: StrapiSelfHostedCredentials) {
    return this.getSelectedDocumentLifecycle(credentials);
  }

  async getSelectedDocumentLifecycle(credentials: StrapiSelfHostedCredentials) {
    const boundary = this.validate(credentials);
    await this.requirePublicHost(boundary.hostname);
    const path = `${boundary.basePath}/api/${boundary.contentTypeRoute}/${boundary.documentId}`;
    const url = new URL(path, `${boundary.origin}/`);
    url.searchParams.set("fields[0]", "createdAt");
    url.searchParams.set("fields[1]", "updatedAt");
    url.searchParams.set("fields[2]", "publishedAt");
    url.searchParams.set("status", "published");
    const expectedSearch =
      "?fields%5B0%5D=createdAt&fields%5B1%5D=updatedAt&fields%5B2%5D=publishedAt&status=published";
    if (
      url.origin !== boundary.origin ||
      url.pathname !== path ||
      url.search !== expectedSearch ||
      url.hash
    )
      throw new StrapiSelfHostedApiError(
        "policy_blocked",
        "Strapi requests must stay on the approved published selected-document REST route.",
        403,
      );

    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${boundary.apiToken}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new StrapiSelfHostedApiError(
        "provider_unavailable",
        "Strapi Content API could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 1_000_000)
      throw new StrapiSelfHostedApiError(
        "policy_blocked",
        "Strapi response exceeded the one-megabyte Relay bound.",
        403,
      );
    let value: unknown;
    try {
      value = raw.length ? JSON.parse(raw.toString("utf8")) : null;
    } catch {
      value = null;
    }
    if (!response.ok)
      throw new StrapiSelfHostedApiError(
        this.safeCode(response.status),
        `Strapi Content API returned HTTP ${response.status}.`,
        response.status,
      );
    const envelope = this.object(value, "REST response");
    const document = this.object(envelope.data, "selected document");
    if (document.documentId !== boundary.documentId)
      throw new StrapiSelfHostedApiError(
        "provider_validation_error",
        "Strapi returned a different document than the selected document.",
        502,
      );
    return {
      document: {
        documentId: boundary.documentId,
        createdAt: this.requiredText(
          document.createdAt,
          "created-at value",
          100,
        ),
        updatedAt: this.requiredText(
          document.updatedAt,
          "updated-at value",
          100,
        ),
        publishedAt: this.requiredText(
          document.publishedAt,
          "published-at value",
          100,
        ),
        documentContentOrIdentityIncluded: false,
        otherProjectDataIncluded: false,
      },
    };
  }

  private validate(value: StrapiSelfHostedCredentials) {
    let url: URL;
    try {
      url = new URL(value.projectBaseUrl);
    } catch {
      throw new StrapiSelfHostedApiError(
        "provider_validation_error",
        "Enter a valid Strapi HTTPS project base URL.",
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
      throw new StrapiSelfHostedApiError(
        "policy_blocked",
        "Strapi requires one exact public HTTPS project base URL without embedded credentials, unsafe path segments, query, or fragment.",
        403,
      );
    if (!/^[\x21-\x7e]{32,4096}$/.test(value.apiToken))
      throw new StrapiSelfHostedApiError(
        "credential_missing",
        "Strapi requires one valid dedicated custom read-only API token.",
        401,
      );
    if (!/^[a-z][a-z0-9_-]{0,127}$/.test(value.contentTypeRoute))
      throw new StrapiSelfHostedApiError(
        "provider_validation_error",
        "Strapi requires one exact selected content-type plural route.",
        400,
      );
    if (!/^[a-z0-9]{16,64}$/.test(value.documentId))
      throw new StrapiSelfHostedApiError(
        "provider_validation_error",
        "Strapi requires one exact lowercase Strapi 5 document ID.",
        400,
      );
    return {
      origin: url.origin,
      hostname,
      basePath: normalizedPath,
      apiToken: value.apiToken,
      contentTypeRoute: value.contentTypeRoute,
      documentId: value.documentId,
    };
  }

  private async requirePublicHost(hostname: string) {
    let addresses: Array<{ address: string }>;
    try {
      addresses = await lookup(hostname, { all: true, verbatim: true });
    } catch {
      throw new StrapiSelfHostedApiError(
        "provider_unavailable",
        "Strapi host DNS could not be resolved.",
        502,
      );
    }
    if (
      !addresses.length ||
      addresses.some(({ address }) => !this.publicAddress(address))
    )
      throw new StrapiSelfHostedApiError(
        "policy_blocked",
        "Strapi host must resolve only to public addresses.",
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

  private requiredText(value: unknown, label: string, maximum: number) {
    if (typeof value !== "string" || !value.trim() || value.length > maximum)
      throw new StrapiSelfHostedApiError(
        "provider_validation_error",
        `Strapi returned an invalid ${label}.`,
        502,
      );
    return value;
  }

  private object(value: unknown, label: string): JsonObject {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new StrapiSelfHostedApiError(
        "provider_validation_error",
        `Strapi returned invalid ${label}.`,
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
