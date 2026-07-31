import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type ImgixCredentials = { apiKey: string };
type ImgixInput = {
  sourceId?: string;
  originPath?: string;
  sessionId?: string;
  reportId?: string;
  query?: JsonObject;
  attributes?: JsonObject;
  contentBase64?: string;
  contentType?: string;
  overwrite?: boolean;
  url?: string;
  subImage?: boolean;
};

export class ImgixApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class ImgixApiAdapter {
  private static readonly ORIGIN = "https://api.imgix.com";
  private static readonly MAX_JSON_BYTES = 2_000_000;
  private static readonly MAX_UPLOAD_BYTES = 5_000_000;

  async health(credentials: ImgixCredentials) {
    const result = await this.call(credentials, "GET", "/api/v1/sources", {
      query: { "page[limit]": 1 },
    });
    return { verified: true, sourcesPermission: true, result };
  }

  read(credentials: ImgixCredentials, operation: string, input: ImgixInput) {
    const sourceId = () => this.id(input.sourceId, "source ID");
    const originPath = () => this.path(input.originPath);
    const sessionId = () => this.id(input.sessionId, "upload session ID");
    const reportId = () => this.id(input.reportId, "report ID");
    const operations: Record<string, () => Promise<unknown>> = {
      list_sources: () =>
        this.call(credentials, "GET", "/api/v1/sources", {
          query: input.query,
        }),
      get_source: () =>
        this.call(credentials, "GET", `/api/v1/sources/${sourceId()}`),
      list_assets: () =>
        this.call(credentials, "GET", `/api/v1/sources/${sourceId()}/assets`, {
          query: input.query,
        }),
      get_asset: () =>
        this.call(
          credentials,
          "GET",
          `/api/v1/sources/${sourceId()}/assets/${originPath()}`,
        ),
      get_upload_session: () =>
        this.call(
          credentials,
          "GET",
          `/api/v1/sources/${sourceId()}/upload-sessions/status/${sessionId()}`,
        ),
      list_reports: () =>
        this.call(credentials, "GET", "/api/v1/reports", {
          query: input.query,
        }),
      get_report: () =>
        this.call(credentials, "GET", `/api/v1/reports/${reportId()}`),
    };
    const execute = operations[operation];
    if (!execute)
      throw new ImgixApiError(
        "provider_validation_error",
        "Imgix read operation is unsupported.",
      );
    return execute();
  }

  manage(credentials: ImgixCredentials, operation: string, input: ImgixInput) {
    const sourceId = () => this.id(input.sourceId, "source ID");
    const originPath = () => this.path(input.originPath);
    const sessionId = () => this.id(input.sessionId, "upload session ID");
    const attributes = () => this.attributes(input.attributes);
    const data = (type: string, id?: string) => ({
      data: { type, ...(id ? { id } : {}), attributes: attributes() },
    });
    const operations: Record<string, () => Promise<unknown>> = {
      create_source: () =>
        this.call(credentials, "POST", "/api/v1/sources", {
          json: data("sources"),
        }),
      update_source: () => {
        const id = sourceId();
        return this.call(credentials, "PATCH", `/api/v1/sources/${id}`, {
          json: data("sources", id),
        });
      },
      update_asset: () => {
        const id = `${sourceId()}/${this.rawPath(input.originPath)}`;
        return this.call(
          credentials,
          "PATCH",
          `/api/v1/sources/${sourceId()}/assets/${originPath()}`,
          { json: data("assets", id) },
        );
      },
      upload_asset: () =>
        this.upload(credentials, sourceId(), originPath(), input),
      open_upload_session: () =>
        this.call(
          credentials,
          "POST",
          `/api/v1/sources/${sourceId()}/upload-sessions/create/${originPath()}`,
        ),
      close_upload_session: () =>
        this.call(
          credentials,
          "POST",
          `/api/v1/sources/${sourceId()}/upload-sessions/close/${sessionId()}`,
        ),
      cancel_upload_session: () =>
        this.call(
          credentials,
          "DELETE",
          `/api/v1/sources/${sourceId()}/upload-sessions/cancel/${sessionId()}`,
        ),
      add_asset: () =>
        this.call(
          credentials,
          "POST",
          `/api/v1/sources/${sourceId()}/assets/add/${originPath()}`,
          { json: {} },
        ),
      refresh_asset: () =>
        this.call(
          credentials,
          "POST",
          `/api/v1/sources/${sourceId()}/assets/refresh/${originPath()}`,
          { json: {} },
        ),
      unpublish_asset: () => this.publish(credentials, "unpublish", input),
      publish_asset: () => this.publish(credentials, "publish", input),
      purge_asset: () => this.purge(credentials, input),
    };
    const execute = operations[operation];
    if (!execute)
      throw new ImgixApiError(
        "provider_validation_error",
        "Imgix management operation is unsupported.",
      );
    return execute();
  }

  private upload(
    credentials: ImgixCredentials,
    sourceId: string,
    originPath: string,
    input: ImgixInput,
  ) {
    const bytes = this.base64(input.contentBase64);
    const contentType = (
      input.contentType ?? "application/octet-stream"
    ).trim();
    if (!contentType || contentType.length > 200 || /[\r\n]/.test(contentType))
      throw new ImgixApiError(
        "provider_validation_error",
        "Imgix upload content type is invalid.",
      );
    return this.call(
      credentials,
      "POST",
      `/api/v1/sources/${sourceId}/upload/${originPath}`,
      {
        query: input.overwrite ? { overwrite: true } : undefined,
        rawBody: bytes,
        contentType,
      },
    );
  }

  private publish(
    credentials: ImgixCredentials,
    operation: "publish" | "unpublish",
    input: ImgixInput,
  ) {
    const url = this.assetUrl(input.url);
    const sourceId = this.id(input.sourceId, "source ID");
    return this.call(credentials, "POST", `/api/v1/${operation}`, {
      json: {
        data: {
          type: `${operation}es`,
          attributes: { url, source_id: sourceId },
        },
      },
    });
  }

  private purge(credentials: ImgixCredentials, input: ImgixInput) {
    const attributes: JsonObject = { url: this.assetUrl(input.url) };
    if (input.subImage === true) {
      attributes.sub_image = true;
      attributes.source_id = this.id(input.sourceId, "source ID");
    }
    return this.call(credentials, "POST", "/api/v1/purge", {
      json: { data: { type: "purges", attributes } },
    });
  }

  private async call(
    credentials: ImgixCredentials,
    method: string,
    path: string,
    options: {
      query?: JsonObject;
      json?: JsonObject;
      rawBody?: Buffer;
      contentType?: string;
    } = {},
  ) {
    this.credentials(credentials);
    if (
      !path.startsWith("/api/v1/") ||
      path.includes("..") ||
      path.includes("://")
    )
      throw new ImgixApiError(
        "provider_validation_error",
        "Imgix API path is invalid.",
      );
    this.rejectSecrets(options.query);
    this.rejectSecrets(options.json);
    const url = new URL(`${ImgixApiAdapter.ORIGIN}${path}`);
    this.append(url.searchParams, options.query);
    const bodyBytes =
      options.rawBody ??
      (options.json === undefined
        ? undefined
        : Buffer.from(JSON.stringify(options.json)));
    if (bodyBytes && bodyBytes.length > ImgixApiAdapter.MAX_UPLOAD_BYTES)
      throw new ImgixApiError(
        "provider_validation_error",
        "Imgix request payload exceeds five megabytes.",
      );
    const body = bodyBytes ? new Uint8Array(bodyBytes) : undefined;
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${credentials.apiKey}`,
          Accept: "application/vnd.api+json, application/json",
          ...(body
            ? {
                "Content-Type":
                  options.contentType ?? "application/vnd.api+json",
              }
            : {}),
          "User-Agent": "RelayConsole/1.0",
        },
        body,
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      throw new ImgixApiError(
        "provider_unavailable",
        "Imgix could not be reached.",
        502,
      );
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw) > ImgixApiAdapter.MAX_JSON_BYTES)
      throw new ImgixApiError(
        "provider_validation_error",
        "Imgix returned an oversized response.",
        response.status,
      );
    let parsed: unknown = raw;
    try {
      parsed = raw ? JSON.parse(raw) : {};
    } catch {
      parsed = raw.slice(0, 20_000);
    }
    const safe = this.redact(parsed);
    if (!response.ok)
      throw new ImgixApiError(
        this.errorCode(response.status),
        `Imgix returned HTTP ${response.status}.`,
        response.status,
      );
    return {
      status: response.status,
      data: safe,
      rateLimit: {
        limit: response.headers.get("x-ratelimit-limit"),
        remaining: response.headers.get("x-ratelimit-remaining"),
        reset: response.headers.get("x-ratelimit-reset"),
        retryAfter: response.headers.get("retry-after"),
      },
    };
  }

  private attributes(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new ImgixApiError(
        "provider_validation_error",
        "Imgix attributes must be an object.",
      );
    this.rejectSecrets(value);
    if (Buffer.byteLength(JSON.stringify(value)) > 1_000_000)
      throw new ImgixApiError(
        "provider_validation_error",
        "Imgix attributes exceed one megabyte.",
      );
    return value as JsonObject;
  }

  private append(params: URLSearchParams, query?: JsonObject) {
    if (!query) return;
    const entries = Object.entries(query);
    if (entries.length > 50)
      throw new ImgixApiError(
        "provider_validation_error",
        "Imgix query has too many fields.",
      );
    for (const [key, value] of entries) {
      if (
        !/^[A-Za-z0-9_.:[\]-]{1,100}$/.test(key) ||
        (typeof value !== "string" &&
          typeof value !== "number" &&
          typeof value !== "boolean")
      )
        throw new ImgixApiError(
          "provider_validation_error",
          "Imgix query contains an invalid field.",
        );
      params.append(key, String(value).slice(0, 2000));
    }
  }

  private id(value: unknown, label: string) {
    if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value))
      throw new ImgixApiError(
        "provider_validation_error",
        `Imgix ${label} is invalid.`,
      );
    return encodeURIComponent(value);
  }

  private rawPath(value: unknown) {
    if (typeof value !== "string")
      throw new ImgixApiError(
        "provider_validation_error",
        "Imgix origin path is required.",
      );
    const raw = value.replace(/^\/+/, "");
    if (
      !raw ||
      raw.length > 2048 ||
      raw.split("/").some((part) => !part || part === "." || part === "..") ||
      /[?#\u0000-\u001f]/.test(raw)
    )
      throw new ImgixApiError(
        "provider_validation_error",
        "Imgix origin path is invalid.",
      );
    return raw;
  }

  private path(value: unknown) {
    return this.rawPath(value).split("/").map(encodeURIComponent).join("/");
  }

  private assetUrl(value: unknown) {
    if (typeof value !== "string" || value.length > 4096)
      throw new ImgixApiError(
        "provider_validation_error",
        "Imgix asset URL is invalid.",
      );
    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      throw new ImgixApiError(
        "provider_validation_error",
        "Imgix asset URL is invalid.",
      );
    }
    if (parsed.protocol !== "https:" || parsed.username || parsed.password)
      throw new ImgixApiError(
        "provider_validation_error",
        "Imgix asset URL must be HTTPS without embedded credentials.",
      );
    return parsed.toString();
  }

  private base64(value: unknown) {
    if (
      typeof value !== "string" ||
      !value ||
      value.length % 4 !== 0 ||
      !/^[A-Za-z0-9+/]*={0,2}$/.test(value)
    )
      throw new ImgixApiError(
        "provider_validation_error",
        "Imgix upload content must be canonical base64.",
      );
    const bytes = Buffer.from(value, "base64");
    if (
      !bytes.length ||
      bytes.length > ImgixApiAdapter.MAX_UPLOAD_BYTES ||
      bytes.toString("base64") !== value
    )
      throw new ImgixApiError(
        "provider_validation_error",
        "Imgix uploads must contain one byte to five megabytes.",
      );
    return bytes;
  }

  private credentials(credentials: ImgixCredentials) {
    if (!credentials.apiKey || credentials.apiKey.length < 8)
      throw new ImgixApiError(
        "credential_missing",
        "Imgix Management API key is missing.",
        401,
      );
  }

  private rejectSecrets(value: unknown, depth = 0) {
    if (depth > 10)
      throw new ImgixApiError(
        "policy_blocked",
        "Imgix request is too deeply nested.",
        403,
      );
    if (Array.isArray(value))
      return value.forEach((item) => this.rejectSecrets(item, depth + 1));
    if (!value || typeof value !== "object") return;
    for (const [key, item] of Object.entries(value as JsonObject)) {
      if (
        /(api.?key|access.?key|secret|password|credential|authorization|token|sas.?string|signing.?key|handshake)/i.test(
          key,
        )
      )
        throw new ImgixApiError(
          "policy_blocked",
          `Credential-bearing Imgix field ${key} is not allowed in agent arguments.`,
          403,
        );
      this.rejectSecrets(item, depth + 1);
    }
  }

  private redact(value: unknown, depth = 0): unknown {
    if (depth > 8) return "[truncated]";
    if (typeof value === "string") return value.slice(0, 200_000);
    if (Array.isArray(value))
      return value.slice(0, 500).map((item) => this.redact(item, depth + 1));
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .slice(0, 500)
        .map(([key, item]) => [
          key,
          /(api.?key|access.?key|secret|password|credential|authorization|token|secure_url_token|files|download.?url|sas.?string|signing.?key|handshake)/i.test(
            key,
          )
            ? "[redacted]"
            : this.redact(item, depth + 1),
        ]),
    );
  }

  private errorCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "credential_missing";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
}
