import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type BrandfolderCredentials = { apiKey: string };

export class BrandfolderApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export const BRANDFOLDER_ROUTE_METHODS: ReadonlyArray<
  readonly [string, readonly string[]]
> = [
  ["/brandfolders", ["GET"]],
  ["/brandfolders/{id}", ["GET", "PUT"]],
  ["/brandfolders/{id}/collections", ["GET", "POST"]],
  ["/brandfolders/{id}/custom_field_keys", ["GET", "POST"]],
  ["/organizations", ["GET"]],
  ["/organizations/{id}", ["GET"]],
  ["/organizations/{id}/brandfolders", ["POST"]],
  ["/collections", ["GET"]],
  ["/collections/{id}", ["GET", "PUT", "DELETE"]],
  ["/collections/{id}/assets", ["GET", "POST"]],
  ["/collections/{id}/tags", ["GET"]],
  ["/brandfolders/{id}/sections", ["GET", "POST"]],
  ["/sections/{id}", ["GET"]],
  ["/sections/{id}/assets", ["GET"]],
  ["/brandfolders/{id}/assets", ["GET", "POST"]],
  ["/assets/{id}", ["GET", "PUT", "DELETE"]],
  ["/assets/{id}/tags", ["GET", "POST"]],
  ["/assets/{id}/custom_field_values", ["GET"]],
  ["/custom_field_keys/{id}/custom_field_values", ["POST"]],
  ["/attachments/{id}", ["GET", "PUT", "DELETE"]],
  ["/brandfolders/{id}/tags", ["GET"]],
  ["/tags/{id}", ["PUT"]],
  ["/async/tags/assets/{id}", ["DELETE"]],
  ["/custom_field_keys/{id}", ["PUT", "DELETE"]],
  ["/custom_field_values/{id}", ["PUT", "DELETE"]],
  ["/brandfolders/{id}/labels", ["GET", "POST"]],
  ["/labels/{id}", ["GET", "PUT", "DELETE"]],
  ["/labels/{id}/assets", ["GET"]],
  ["/labels/{id}/move", ["PUT"]],
  ["/brandfolders/{id}/invitations", ["GET", "POST"]],
  ["/organizations/{id}/invitations", ["GET", "POST"]],
  ["/collections/{id}/invitations", ["GET", "POST"]],
  ["/portals/{id}/invitations", ["GET", "POST"]],
  ["/brandguides/{id}/invitations", ["GET", "POST"]],
  ["/invitations/{id}", ["GET", "DELETE"]],
  ["/organizations/{id}/user_permissions", ["GET"]],
  ["/brandfolders/{id}/user_permissions", ["GET"]],
  ["/collections/{id}/user_permissions", ["GET"]],
  ["/user_permissions/{id}", ["GET", "DELETE"]],
  ["/webhooks/send", ["POST"]],
  ["/webhooks", ["GET", "POST"]],
  ["/webhooks/{id}", ["GET", "DELETE"]],
] as const;

export const BRANDFOLDER_OPENAPI_OPERATION_COUNT =
  BRANDFOLDER_ROUTE_METHODS.reduce(
    (count, [, methods]) => count + methods.length,
    0,
  ) + 4;

@Injectable()
export class BrandfolderApiAdapter {
  health(credentials: BrandfolderCredentials) {
    return this.request(credentials, {
      method: "GET",
      path: "/organizations",
    });
  }

  async uploadAsset(
    credentials: BrandfolderCredentials,
    input: {
      destinationType: "brandfolder" | "collection";
      destinationId: string;
      sectionId: string;
      name: string;
      description?: string;
      fileName: string;
      contentBase64: string;
      contentType?: string;
    },
  ) {
    const apiKey = credentials.apiKey?.trim();
    if (!apiKey || apiKey.length > 20_000)
      throw new BrandfolderApiError(
        "credential_missing",
        "Brandfolder API key is required.",
        401,
      );
    const destinationId = this.identifier(
      input.destinationId,
      "destination ID",
    );
    const sectionId = this.identifier(input.sectionId, "section ID");
    const name = this.text(input.name, "asset name", 1000, true);
    const description = this.text(
      input.description,
      "asset description",
      10_000,
      false,
    );
    const fileName = this.fileName(input.fileName);
    const contentType = this.safeContentType(input.contentType);
    const bytes = Buffer.from(input.contentBase64, "base64");
    if (!bytes.length || bytes.length > 5_000_000)
      throw new BrandfolderApiError(
        "provider_validation_error",
        "Brandfolder upload must contain between 1 byte and 5 MB.",
      );

    let ticketResponse: Response;
    try {
      ticketResponse = await safeConnectorFetch(
        "https://brandfolder.com/api/v4/upload_requests",
        {
          method: "GET",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          redirect: "error",
          signal: AbortSignal.timeout(30_000),
          cache: "no-store",
        },
      );
    } catch {
      throw new BrandfolderApiError(
        "provider_unavailable",
        "Brandfolder could not create an upload request.",
        502,
      );
    }
    const ticketRaw = await ticketResponse.text();
    let ticket: JsonObject;
    try {
      ticket = JSON.parse(ticketRaw) as JsonObject;
    } catch {
      throw new BrandfolderApiError(
        "provider_unavailable",
        "Brandfolder returned an invalid upload request.",
        ticketResponse.status,
      );
    }
    if (!ticketResponse.ok)
      throw new BrandfolderApiError(
        this.safeCode(ticketResponse.status),
        this.message(ticket) ??
          `Brandfolder returned HTTP ${ticketResponse.status}.`,
        ticketResponse.status,
      );
    const uploadUrl = this.signedStorageUrl(ticket.upload_url, "upload URL");
    const objectUrl = this.signedStorageUrl(ticket.object_url, "object URL");
    let uploadResponse: Response;
    try {
      uploadResponse = await safeConnectorFetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: bytes,
        redirect: "error",
        signal: AbortSignal.timeout(60_000),
        cache: "no-store",
      });
    } catch {
      throw new BrandfolderApiError(
        "provider_unavailable",
        "Brandfolder's signed storage upload could not be reached.",
        502,
      );
    }
    if (!uploadResponse.ok)
      throw new BrandfolderApiError(
        this.safeCode(uploadResponse.status),
        `Brandfolder's signed storage upload returned HTTP ${uploadResponse.status}.`,
        uploadResponse.status,
      );
    const path = `/${input.destinationType === "collection" ? "collections" : "brandfolders"}/${destinationId}/assets`;
    return this.request(credentials, {
      method: "POST",
      path,
      json: {
        data: {
          attributes: [
            {
              name,
              ...(description ? { description } : {}),
              attachments: [{ url: objectUrl.toString(), filename: fileName }],
            },
          ],
        },
        section_key: sectionId,
      },
    });
  }

  async request(
    credentials: BrandfolderCredentials,
    input: {
      method: string;
      path: string;
      query?: JsonObject;
      json?: JsonObject;
      contentBase64?: string;
      contentType?: string;
      headers?: JsonObject;
    },
  ) {
    const apiKey = credentials.apiKey?.trim();
    if (!apiKey || apiKey.length > 20_000)
      throw new BrandfolderApiError(
        "credential_missing",
        "Brandfolder API key is required.",
        401,
      );
    const method = input.method.toUpperCase();
    if (!this.routeAllowed(method, input.path))
      throw new BrandfolderApiError(
        "provider_validation_error",
        "Brandfolder method or route is outside the current V4 OpenAPI surface.",
      );
    if (method === "GET" && (input.json || input.contentBase64))
      throw new BrandfolderApiError(
        "provider_validation_error",
        "Brandfolder GET requests cannot include a body.",
      );
    this.rejectCredentials(input.query);
    this.rejectCredentials(input.json);
    const headers = this.safeHeaders(input.headers);
    const url = new URL(`https://brandfolder.com/api/v4${input.path}`);
    this.appendQuery(url.searchParams, input.query ?? {});
    let body: string | ArrayBuffer | undefined;
    let contentType: string | undefined;
    if (input.contentBase64 !== undefined) {
      body = Uint8Array.from(Buffer.from(input.contentBase64, "base64")).buffer;
      contentType = this.safeContentType(input.contentType);
    } else if (input.json !== undefined) {
      body = JSON.stringify(input.json);
      contentType = "application/json";
    }
    if (body && Buffer.byteLength(body) > 5_000_000)
      throw new BrandfolderApiError(
        "provider_validation_error",
        "Brandfolder request exceeds 5 MB.",
      );
    try {
      const response = await safeConnectorFetch(url, {
        method,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${apiKey}`,
          ...(contentType ? { "Content-Type": contentType } : {}),
          ...headers,
        },
        body,
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
        cache: "no-store",
      });
      const raw = Buffer.from(await response.arrayBuffer());
      if (raw.length > 10_000_000)
        throw new BrandfolderApiError(
          "provider_validation_error",
          "Brandfolder response exceeds 10 MB.",
        );
      const text = raw.toString("utf8");
      let data: unknown = text;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = text;
      }
      data = this.redact(data);
      if (!response.ok)
        throw new BrandfolderApiError(
          this.safeCode(response.status),
          this.message(data) ?? `Brandfolder returned HTTP ${response.status}.`,
          response.status,
        );
      return {
        status: response.status,
        data,
        pagination: this.pagination(data),
        rateLimit: {
          limit: response.headers.get("x-ratelimit-limit"),
          remaining: response.headers.get("x-ratelimit-remaining"),
          reset: response.headers.get("x-ratelimit-reset"),
          retryAfter: response.headers.get("retry-after"),
        },
      };
    } catch (error) {
      if (error instanceof BrandfolderApiError) throw error;
      throw new BrandfolderApiError(
        "provider_unavailable",
        "Brandfolder could not be reached.",
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
      path.length > 1000
    )
      return false;
    const actual = path.replace(/\/$/, "").split("/").slice(1);
    return BRANDFOLDER_ROUTE_METHODS.some(([template, methods]) => {
      if (!methods.includes(method)) return false;
      const expected = template.split("/").slice(1);
      return (
        expected.length === actual.length &&
        expected.every((part, index) =>
          part === "{id}"
            ? /^[A-Za-z0-9_-]{1,200}$/.test(actual[index] ?? "")
            : part === actual[index],
        )
      );
    });
  }

  private identifier(value: string, label: string) {
    const normalized = value?.trim();
    if (!/^[A-Za-z0-9_-]{1,200}$/.test(normalized))
      throw new BrandfolderApiError(
        "provider_validation_error",
        `Brandfolder ${label} is invalid.`,
      );
    return normalized;
  }

  private text(
    value: string | undefined,
    label: string,
    limit: number,
    required: boolean,
  ) {
    const normalized = value?.trim() ?? "";
    if ((required && !normalized) || normalized.length > limit)
      throw new BrandfolderApiError(
        "provider_validation_error",
        `Brandfolder ${label} is invalid.`,
      );
    return normalized;
  }

  private fileName(value: string) {
    const normalized = value?.trim();
    if (
      !normalized ||
      normalized.length > 500 ||
      normalized.includes("/") ||
      normalized.includes("\\") ||
      normalized.includes("..") ||
      /[\r\n\0]/.test(normalized)
    )
      throw new BrandfolderApiError(
        "provider_validation_error",
        "Brandfolder file name is invalid.",
      );
    return normalized;
  }

  private signedStorageUrl(value: unknown, label: string) {
    if (typeof value !== "string" || value.length > 20_000)
      throw new BrandfolderApiError(
        "provider_unavailable",
        `Brandfolder returned an invalid ${label}.`,
        502,
      );
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new BrandfolderApiError(
        "provider_unavailable",
        `Brandfolder returned an invalid ${label}.`,
        502,
      );
    }
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      !(
        url.hostname === "storage.googleapis.com" ||
        url.hostname.endsWith(".storage.googleapis.com")
      )
    )
      throw new BrandfolderApiError(
        "policy_blocked",
        `Brandfolder returned an untrusted ${label} authority.`,
        403,
      );
    return url;
  }

  private appendQuery(params: URLSearchParams, value: JsonObject) {
    if (Object.keys(value).length > 100)
      throw new BrandfolderApiError(
        "provider_validation_error",
        "Brandfolder request has too many query fields.",
      );
    for (const [key, item] of Object.entries(value)) {
      if (item === undefined || item === null || item === "") continue;
      if (!/^[A-Za-z0-9_.\[\]-]{1,100}$/.test(key))
        throw new BrandfolderApiError(
          "provider_validation_error",
          "Brandfolder query key is invalid.",
        );
      for (const entry of Array.isArray(item) ? item.slice(0, 100) : [item]) {
        if (!["string", "number", "boolean"].includes(typeof entry))
          throw new BrandfolderApiError(
            "provider_validation_error",
            `Brandfolder query field ${key} must be scalar.`,
          );
        params.append(key, String(entry).slice(0, 20_000));
      }
    }
  }

  private safeHeaders(value?: JsonObject) {
    if (!value) return {};
    const output: Record<string, string> = {};
    for (const [name, item] of Object.entries(value)) {
      const normalized = name.toLowerCase();
      if (!new Set(["x-goog-resumable", "content-range"]).has(normalized))
        throw new BrandfolderApiError(
          "policy_blocked",
          `Brandfolder request header ${name} is not allowed.`,
          403,
        );
      if (typeof item !== "string" || /[\r\n]/.test(item) || item.length > 500)
        throw new BrandfolderApiError(
          "provider_validation_error",
          `Brandfolder request header ${name} is invalid.`,
        );
      if (normalized === "x-goog-resumable" && item !== "start")
        throw new BrandfolderApiError(
          "provider_validation_error",
          "x-goog-resumable must be start.",
        );
      output[name] = item;
    }
    return output;
  }

  private safeContentType(value?: string) {
    const normalized =
      value?.trim().toLowerCase() ?? "application/octet-stream";
    if (
      !/^(?:application|audio|image|text|video)\/[a-z0-9.+-]{1,80}$/.test(
        normalized,
      )
    )
      throw new BrandfolderApiError(
        "provider_validation_error",
        "Brandfolder content type is invalid.",
      );
    return normalized;
  }

  private rejectCredentials(value?: JsonObject) {
    const walk = (item: unknown, depth = 0) => {
      if (depth > 12)
        throw new BrandfolderApiError(
          "policy_blocked",
          "Brandfolder request is too deeply nested.",
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
          throw new BrandfolderApiError(
            "policy_blocked",
            `Credential-bearing field ${key} is not allowed.`,
            403,
          );
        walk(entry, depth + 1);
      }
    };
    if (value) walk(value);
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
          /(token|secret|authorization|password|cookie|api.?key|upload_url|resumable_upload_url|object_url)/i.test(
            key,
          )
            ? "[redacted]"
            : this.redact(item, depth + 1),
        ]),
    );
  }

  private pagination(value: unknown) {
    const object =
      value && typeof value === "object" && !Array.isArray(value)
        ? (value as JsonObject)
        : null;
    const meta =
      object?.meta &&
      typeof object.meta === "object" &&
      !Array.isArray(object.meta)
        ? (object.meta as JsonObject)
        : null;
    return meta
      ? {
          currentPage: meta.current_page ?? null,
          nextPage: meta.next_page ?? null,
          totalCount: meta.total_count ?? null,
        }
      : null;
  }

  private message(value: unknown) {
    const body =
      value && typeof value === "object" && !Array.isArray(value)
        ? (value as JsonObject)
        : null;
    const candidate =
      body?.error_description ?? body?.error ?? body?.message ?? body?.detail;
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
