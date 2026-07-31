import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";
import {
  KONTAINER_OPENAPI_OPERATION_COUNT,
  KONTAINER_OPENAPI_OPERATIONS,
} from "./kontainer-openapi.operations";

type JsonObject = Record<string, unknown>;

export type KontainerCredentials = {
  tenant: string;
  accessToken: string;
};

export class KontainerApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

const PARAMETER_SEGMENT = "[A-Za-z0-9._~!$&'()*+,;=:@%-]{1,500}";
const ROUTES = KONTAINER_OPENAPI_OPERATIONS.map(([method, template]) => {
  const source = template
    .split("/")
    .map((segment) =>
      /^\{[^}]+\}$/.test(segment)
        ? PARAMETER_SEGMENT
        : segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    )
    .join("/");
  return [method, new RegExp(`^${source}$`)] as const;
});

export { KONTAINER_OPENAPI_OPERATION_COUNT };

@Injectable()
export class KontainerApiAdapter {
  health(credentials: KontainerCredentials) {
    return this.request(credentials, { method: "GET", path: "/meta" });
  }

  async request(
    credentials: KontainerCredentials,
    input: {
      method: string;
      path: string;
      query?: JsonObject;
      json?: JsonObject;
      multipartFields?: JsonObject;
      multipartField?: string;
      fileName?: string;
      contentType?: string;
      contentBase64?: string;
    },
  ) {
    const tenant = credentials.tenant?.trim().toLowerCase();
    if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(tenant))
      throw new KontainerApiError(
        "credential_missing",
        "Kontainer tenant subdomain is required.",
        401,
      );
    const accessToken = credentials.accessToken?.trim();
    if (!accessToken || accessToken.length > 20_000)
      throw new KontainerApiError(
        "credential_missing",
        "Kontainer API access token is required.",
        401,
      );
    const method = input.method.toUpperCase();
    if (!this.routeAllowed(method, input.path))
      throw new KontainerApiError(
        "provider_validation_error",
        "Kontainer method or route is outside the published OpenAPI surface.",
      );
    if (
      method === "GET" &&
      (input.json || input.multipartFields || input.contentBase64)
    )
      throw new KontainerApiError(
        "provider_validation_error",
        "Kontainer GET requests cannot include a body.",
      );
    if (input.json && input.multipartFields)
      throw new KontainerApiError(
        "provider_validation_error",
        "Kontainer requests cannot combine JSON and multipart bodies.",
      );
    if (input.contentBase64 && !input.multipartFields)
      throw new KontainerApiError(
        "provider_validation_error",
        "Kontainer file content requires a multipart body.",
      );
    this.rejectCredentials(input.query);
    this.rejectCredentials(input.json);
    this.rejectCredentials(input.multipartFields);

    const url = new URL(
      `https://${tenant}.kontainer.com/jsonapi/v2${input.path}`,
    );
    this.appendQuery(url.searchParams, input.query ?? {});
    let body: string | FormData | undefined;
    let requestContentType: string | undefined;
    let requestSize = 0;
    if (input.multipartFields) {
      const form = new FormData();
      for (const [key, value] of Object.entries(input.multipartFields)) {
        if (!/^[A-Za-z0-9_.\[\]-]{1,150}$/.test(key))
          throw new KontainerApiError(
            "provider_validation_error",
            "Kontainer multipart field name is invalid.",
          );
        if (value === undefined || value === null) continue;
        const serialized =
          typeof value === "object" ? JSON.stringify(value) : String(value);
        if (serialized.length > 1_000_000)
          throw new KontainerApiError(
            "provider_validation_error",
            `Kontainer multipart field ${key} is too large.`,
          );
        requestSize += Buffer.byteLength(serialized);
        form.append(key, serialized);
      }
      if (input.contentBase64) {
        const bytes = this.decodeBase64(input.contentBase64);
        const field = input.multipartField?.trim();
        if (!field || !/^[A-Za-z0-9_.\[\]-]{1,150}$/.test(field))
          throw new KontainerApiError(
            "provider_validation_error",
            "Kontainer multipart file field is required and must be valid.",
          );
        const fileName = input.fileName?.trim();
        if (
          !fileName ||
          fileName.length > 500 ||
          fileName.includes("/") ||
          fileName.includes("\\") ||
          /[\u0000-\u001f\u007f]/.test(fileName)
        )
          throw new KontainerApiError(
            "provider_validation_error",
            "Kontainer upload filename is required and must be valid.",
          );
        requestSize += bytes.length;
        form.append(
          field,
          new Blob([bytes], { type: this.safeContentType(input.contentType) }),
          fileName,
        );
      } else if (input.multipartField || input.fileName || input.contentType) {
        throw new KontainerApiError(
          "provider_validation_error",
          "Kontainer multipart file settings require file content.",
        );
      }
      body = form;
    } else if (input.json) {
      body = JSON.stringify(input.json);
      requestSize = Buffer.byteLength(body);
      requestContentType = "application/vnd.api+json";
    }
    if (requestSize > 5_000_000)
      throw new KontainerApiError(
        "provider_validation_error",
        "Kontainer request exceeds 5 MB.",
      );

    try {
      const response = await safeConnectorFetch(url, {
        method,
        headers: {
          Accept: "application/vnd.api+json",
          Authorization: `Bearer ${accessToken}`,
          ...(requestContentType ? { "Content-Type": requestContentType } : {}),
        },
        body,
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
        cache: "no-store",
      });
      const raw = Buffer.from(await response.arrayBuffer());
      if (raw.length > 10_000_000)
        throw new KontainerApiError(
          "provider_validation_error",
          "Kontainer response exceeds 10 MB.",
        );
      const responseContentType =
        response.headers.get("content-type")?.split(";")[0].trim() ||
        "application/octet-stream";
      let data: unknown;
      if (
        responseContentType.includes("json") ||
        responseContentType.startsWith("text/")
      ) {
        const text = raw.toString("utf8");
        try {
          data = text ? JSON.parse(text) : null;
        } catch {
          data = text;
        }
        data = this.redact(data);
      } else {
        data = {
          contentType: responseContentType,
          contentBase64: raw.toString("base64"),
        };
      }
      if (!response.ok)
        throw new KontainerApiError(
          this.safeCode(response.status),
          this.message(data) ?? `Kontainer returned HTTP ${response.status}.`,
          response.status,
        );
      return {
        status: response.status,
        data,
        rateLimit: {
          limit: response.headers.get("x-ratelimit-limit"),
          remaining: response.headers.get("x-ratelimit-remaining"),
          reset: response.headers.get("x-ratelimit-reset"),
          retryAfter: response.headers.get("retry-after"),
        },
      };
    } catch (error) {
      if (error instanceof KontainerApiError) throw error;
      throw new KontainerApiError(
        "provider_unavailable",
        "Kontainer could not be reached.",
        502,
      );
    }
  }

  private routeAllowed(method: string, path: string) {
    if (
      !path.startsWith("/") ||
      path.includes("?") ||
      path.includes("#") ||
      path.includes("..") ||
      path.includes("//") ||
      path.length > 2_000
    )
      return false;
    const normalized = path.length > 1 ? path.replace(/\/$/, "") : path;
    return ROUTES.some(
      ([allowedMethod, pattern]) =>
        method === allowedMethod && pattern.test(normalized),
    );
  }

  private appendQuery(params: URLSearchParams, value: JsonObject) {
    if (Object.keys(value).length > 100)
      throw new KontainerApiError(
        "provider_validation_error",
        "Kontainer request has too many query fields.",
      );
    for (const [key, item] of Object.entries(value)) {
      if (item === undefined || item === null || item === "") continue;
      if (!/^[A-Za-z0-9_.\[\]-]{1,150}$/.test(key))
        throw new KontainerApiError(
          "provider_validation_error",
          "Kontainer query key is invalid.",
        );
      for (const entry of Array.isArray(item) ? item.slice(0, 100) : [item]) {
        if (!["string", "number", "boolean"].includes(typeof entry))
          throw new KontainerApiError(
            "provider_validation_error",
            `Kontainer query field ${key} must be scalar.`,
          );
        params.append(key, String(entry).slice(0, 20_000));
      }
    }
  }

  private rejectCredentials(value?: JsonObject) {
    const walk = (item: unknown, depth = 0) => {
      if (depth > 12)
        throw new KontainerApiError(
          "policy_blocked",
          "Kontainer request is too deeply nested.",
          403,
        );
      if (Array.isArray(item))
        return item.slice(0, 1000).forEach((entry) => walk(entry, depth + 1));
      if (!item || typeof item !== "object") return;
      for (const [key, entry] of Object.entries(item as JsonObject)) {
        if (
          /(token|secret|authorization|password|cookie|credential|api.?key)/i.test(
            key,
          )
        )
          throw new KontainerApiError(
            "policy_blocked",
            `Credential-bearing field ${key} is not allowed.`,
            403,
          );
        walk(entry, depth + 1);
      }
    };
    if (value) walk(value);
  }

  private decodeBase64(value: string) {
    if (
      value.length > 7_000_000 ||
      !/^[A-Za-z0-9+/]*={0,2}$/.test(value) ||
      value.length % 4 !== 0
    )
      throw new KontainerApiError(
        "provider_validation_error",
        "Kontainer upload content is not valid base64.",
      );
    const bytes = Buffer.from(value, "base64");
    if (!bytes.length || bytes.toString("base64") !== value)
      throw new KontainerApiError(
        "provider_validation_error",
        "Kontainer upload content is not valid base64.",
      );
    return bytes;
  }

  private safeContentType(value?: string) {
    const normalized =
      value?.trim().toLowerCase() ?? "application/octet-stream";
    if (
      !/^(?:application|audio|image|text|video)\/[a-z0-9.+-]{1,80}$/.test(
        normalized,
      )
    )
      throw new KontainerApiError(
        "provider_validation_error",
        "Kontainer content type is invalid.",
      );
    return normalized;
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
          /(token|secret|authorization|password|cookie|api.?key|invite.?url|login.?url)/i.test(
            key,
          )
            ? "[redacted]"
            : this.redact(item, depth + 1),
        ]),
    );
  }

  private message(value: unknown) {
    const body =
      value && typeof value === "object" && !Array.isArray(value)
        ? (value as JsonObject)
        : null;
    const errors = Array.isArray(body?.errors) ? body?.errors : [];
    const first = errors[0] as JsonObject | undefined;
    const candidate =
      first?.detail ?? first?.title ?? body?.error ?? body?.message;
    return typeof candidate === "string" ? candidate.slice(0, 500) : null;
  }

  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "credential_missing";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
}
