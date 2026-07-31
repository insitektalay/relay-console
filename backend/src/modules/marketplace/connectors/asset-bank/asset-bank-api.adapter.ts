import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type RequestInput = {
  method: string;
  path: string;
  query?: JsonObject;
  json?: unknown;
  contentBase64?: string;
  contentType?: string;
  multipartField?: string;
};

export class AssetBankApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class AssetBankApiAdapter {
  health(token: string, baseUrl: string) {
    return this.request(token, baseUrl, {
      method: "GET",
      path: "/rest/authenticated-user",
    });
  }

  async request(token: string, baseUrl: string, input: RequestInput) {
    if (!token?.trim() || token.length > 20_000)
      throw new AssetBankApiError(
        "credential_missing",
        "Asset Bank access token is required.",
        401,
      );
    const site = this.siteBase(baseUrl);
    const method = input.method.toUpperCase();
    if (!this.allowed(method, input.path))
      throw new AssetBankApiError(
        "provider_validation_error",
        "Asset Bank method or path is outside the documented REST API boundary.",
      );
    if (input.path.replace(/\/$/, "") === "/rest/sign-url")
      throw new AssetBankApiError(
        "policy_blocked",
        "Asset Bank signed URL creation is not available to runtime agents.",
        403,
      );
    if (method === "GET" && (input.json !== undefined || input.contentBase64))
      throw new AssetBankApiError(
        "provider_validation_error",
        "Asset Bank GET requests cannot include a body.",
      );
    if (input.json !== undefined && input.contentBase64)
      throw new AssetBankApiError(
        "provider_validation_error",
        "Asset Bank requests accept JSON or file content, not both.",
      );
    this.rejectCredentials(input.query);
    this.rejectCredentials(input.json);
    const url = new URL(`${site.pathname}${input.path}`, site.origin);
    this.appendQuery(url.searchParams, input.query ?? {});
    let body: BodyInit | undefined;
    const headers: Record<string, string> = {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    };
    if (input.json !== undefined) {
      const encoded = JSON.stringify(input.json);
      if (Buffer.byteLength(encoded) > 5_000_000)
        throw new AssetBankApiError(
          "provider_validation_error",
          "Asset Bank request exceeds 5 MB.",
        );
      body = encoded;
      headers["Content-Type"] = "application/json";
    } else if (input.contentBase64) {
      const file = this.decodeBase64(input.contentBase64);
      if (input.multipartField !== undefined) {
        if (!/^[A-Za-z0-9_.-]{0,100}$/.test(input.multipartField))
          throw new AssetBankApiError(
            "provider_validation_error",
            "Asset Bank multipart field is invalid.",
          );
        const form = new FormData();
        form.append(
          input.multipartField || "file",
          new Blob([file], {
            type: input.contentType || "application/octet-stream",
          }),
          "upload.bin",
        );
        body = form;
      } else {
        body = file;
        headers["Content-Type"] =
          input.contentType || "application/octet-stream";
      }
    }
    try {
      const response = await safeConnectorFetch(url, {
        method,
        headers,
        body,
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
        cache: "no-store",
      });
      const raw = Buffer.from(await response.arrayBuffer());
      if (raw.length > 10_000_000)
        throw new AssetBankApiError(
          "provider_validation_error",
          "Asset Bank response exceeds 10 MB.",
        );
      const contentType =
        response.headers.get("content-type") ?? "application/octet-stream";
      let data: unknown;
      if (contentType.includes("json")) {
        try {
          data = raw.length ? JSON.parse(raw.toString("utf8")) : null;
        } catch {
          throw new AssetBankApiError(
            "provider_unavailable",
            "Asset Bank returned invalid JSON.",
            response.status,
          );
        }
        data = this.redact(data);
      } else if (contentType.startsWith("text/"))
        data = raw.toString("utf8").slice(0, 2_000_000);
      else
        data = {
          contentType,
          byteLength: raw.length,
          contentBase64: raw.toString("base64"),
        };
      if (!response.ok)
        throw new AssetBankApiError(
          this.safeCode(response.status),
          this.message(data) ?? `Asset Bank returned HTTP ${response.status}.`,
          response.status,
        );
      return {
        status: response.status,
        data,
        rateLimit: {
          limit: response.headers.get("x-ratelimit-limit"),
          remaining: response.headers.get("x-ratelimit-remaining"),
          retryAfter: response.headers.get("retry-after"),
        },
      };
    } catch (error) {
      if (error instanceof AssetBankApiError) throw error;
      throw new AssetBankApiError(
        "provider_unavailable",
        "Asset Bank could not be reached.",
        502,
      );
    }
  }

  private siteBase(value: string) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new AssetBankApiError(
        "provider_validation_error",
        "Asset Bank site authority is invalid.",
      );
    }
    const hostAllowed =
      /^(?:[a-z0-9-]+\.)+assetbank\.app$/i.test(url.hostname) ||
      /^(?:[a-z0-9-]+\.)+assetbank-server\.com$/i.test(url.hostname);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      url.search ||
      url.hash ||
      !hostAllowed ||
      !/^\/[A-Za-z0-9._~-]{1,120}\/?$/.test(url.pathname)
    )
      throw new AssetBankApiError(
        "provider_validation_error",
        "Asset Bank site must be a supported hosted HTTPS URL with one site path.",
      );
    return new URL(`${url.origin}${url.pathname.replace(/\/$/, "")}`);
  }

  private allowed(method: string, path: string) {
    const routes: Array<[RegExp, string[]]> = [
      [/^\/rest\/?$/, ["GET"]],
      [/^\/rest\/access-levels\/?$/, ["GET", "POST"]],
      [/^\/rest\/access-levels\/\d+\/?$/, ["GET", "PUT", "DELETE"]],
      [/^\/rest\/access-levels\/\d+\/image\/?$/, ["GET", "PUT", "DELETE"]],
      [/^\/rest\/access-level-search\/?$/, ["GET"]],
      [/^\/rest\/assets\/?$/, ["POST"]],
      [/^\/rest\/assets\/\d+\/?$/, ["GET", "PUT", "DELETE"]],
      [/^\/rest\/assets\/\d+\/content\/?$/, ["GET", "PUT"]],
      [/^\/rest\/assets\/\d+\/content\/url\/?$/, ["GET"]],
      [/^\/rest\/assets\/\d+\/conversion\/?$/, ["GET"]],
      [
        /^\/rest\/(?:asset-search|asset-types|attributes|authenticated-user|categories|category-search|display-attribute-groups|embedded-data-mappings|pending-upload-approvals|users|user-search)\/?$/,
        ["GET"],
      ],
      [/^\/rest\/asset-types\/\d+\/?$/, ["GET"]],
      [/^\/rest\/attributes\/\d+\/?$/, ["GET"]],
      [/^\/rest\/attributes\/\d+\/keywords\/?$/, ["GET"]],
      [/^\/rest\/attributes\/\d+\/keywords\/\d+\/?$/, ["GET"]],
      [/^\/rest\/attributes\/\d+\/list-attribute-values\/?$/, ["GET", "POST"]],
      [/^\/rest\/list-attribute-values\/\d+\/?$/, ["GET", "DELETE"]],
      [
        /^\/rest\/(?:categories|display-attribute-groups|embedded-data-mappings)\/\d+\/?$/,
        ["GET"],
      ],
      [/^\/rest\/users\/\d+\/lightboxes\/?$/, ["GET", "POST"]],
      [/^\/rest\/users\/\d+\/lightboxes\/\d+\/?$/, ["GET", "DELETE"]],
      [/^\/rest\/users\/\d+\/lightboxes\/\d+\/contents\/?$/, ["GET", "POST"]],
      [
        /^\/rest\/users\/\d+\/lightboxes\/\d+\/contents\/\d+\/?$/,
        ["GET", "DELETE"],
      ],
      [/^\/rest\/publishing-actions\/?$/, ["POST"]],
      [/^\/rest\/publishing-actions\/\d+\/?$/, ["GET"]],
      [/^\/rest\/publishing-actions\/\d+\/log\/?$/, ["GET"]],
      [/^\/rest\/sign-url\/?$/, ["POST"]],
      [/^\/rest\/users\/?$/, ["POST"]],
      [/^\/rest\/users\/\d+\/?$/, ["GET", "PUT", "DELETE"]],
      [/^\/rest\/temp-chunked-files\/?$/, ["POST"]],
      [/^\/rest\/temp-chunked-files\/[0-9a-f-]{36}\/?$/i, ["GET", "DELETE"]],
      [/^\/rest\/temp-chunked-files\/[0-9a-f-]{36}\/\d+\/?$/i, ["PUT"]],
    ];
    return (
      path.length <= 500 &&
      !path.includes("..") &&
      !path.includes("//") &&
      routes.some(
        ([pattern, methods]) => pattern.test(path) && methods.includes(method),
      )
    );
  }

  private decodeBase64(value: string) {
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(value) || value.length % 4 !== 0)
      throw new AssetBankApiError(
        "provider_validation_error",
        "Asset Bank file content must be valid base64.",
      );
    const buffer = Buffer.from(value, "base64");
    if (buffer.length > 5_000_000)
      throw new AssetBankApiError(
        "provider_validation_error",
        "Asset Bank upload chunk exceeds 5 MB.",
      );
    return buffer;
  }
  private appendQuery(params: URLSearchParams, value: JsonObject) {
    if (Object.keys(value).length > 100)
      throw new AssetBankApiError(
        "provider_validation_error",
        "Asset Bank request has too many query fields.",
      );
    for (const [key, item] of Object.entries(value)) {
      if (item == null || item === "") continue;
      if (!/^[A-Za-z0-9_.$\[\]-]{1,100}$/.test(key))
        throw new AssetBankApiError(
          "provider_validation_error",
          "Asset Bank query key is invalid.",
        );
      for (const entry of Array.isArray(item) ? item.slice(0, 100) : [item]) {
        if (!["string", "number", "boolean"].includes(typeof entry))
          throw new AssetBankApiError(
            "provider_validation_error",
            `Asset Bank query field ${key} must be scalar.`,
          );
        params.append(key, String(entry).slice(0, 20_000));
      }
    }
  }
  private rejectCredentials(value: unknown, depth = 0) {
    if (depth > 12)
      throw new AssetBankApiError(
        "policy_blocked",
        "Asset Bank request is too deeply nested.",
        403,
      );
    if (Array.isArray(value))
      return value
        .slice(0, 1000)
        .forEach((entry) => this.rejectCredentials(entry, depth + 1));
    if (!value || typeof value !== "object") return;
    for (const [key, entry] of Object.entries(value as JsonObject)) {
      if (
        /(access.?token|refresh.?token|client.?secret|authorization|password|cookie|credential|api.?key)/i.test(
          key,
        )
      )
        throw new AssetBankApiError(
          "policy_blocked",
          `Credential-bearing field ${key} is not allowed.`,
          403,
        );
      this.rejectCredentials(entry, depth + 1);
    }
  }
  private redact(value: unknown, depth = 0): unknown {
    if (depth > 10) return "[truncated]";
    if (typeof value === "string") return value.slice(0, 2_000_000);
    if (Array.isArray(value))
      return value.slice(0, 2000).map((item) => this.redact(item, depth + 1));
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .slice(0, 2000)
        .map(([key, item]) => [
          key,
          /(token|secret|authorization|password|cookie|api.?key|content.?url|signed.?url)/i.test(
            key,
          )
            ? "[redacted]"
            : this.redact(item, depth + 1),
        ]),
    );
  }
  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "credential_missing";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
  private message(value: unknown) {
    if (!value || typeof value !== "object") return null;
    const object = value as JsonObject;
    for (const key of ["message", "error_description", "error"])
      if (typeof object[key] === "string")
        return String(object[key]).slice(0, 500);
    return null;
  }
}
