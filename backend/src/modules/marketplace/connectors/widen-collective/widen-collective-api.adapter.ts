import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type WidenCollectiveCredentials = {
  collective: string;
  accessToken: string;
};

export class WidenCollectiveApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

const V2_ROUTES: ReadonlyArray<readonly [RegExp, readonly string[]]> = [
  [/^\/user$/, ["GET"]],
  [/^\/analytics\/assets\/(?:downloads|shares|views)$/, ["POST"]],
  [/^\/assets\/(?:search|assetgroups)$/, ["GET"]],
  [/^\/assets\/[A-Za-z0-9_.:@+-]{1,200}$/, ["GET", "DELETE"]],
  [
    /^\/assets\/[A-Za-z0-9_.:@+-]{1,200}\/versions\/[A-Za-z0-9_.:@+-]{1,200}$/,
    ["GET"],
  ],
  [
    /^\/assets\/[A-Za-z0-9_.:@+-]{1,200}\/alternatepreview$/,
    ["POST", "DELETE"],
  ],
  [/^\/assets\/[A-Za-z0-9_.:@+-]{1,200}\/filename$/, ["PUT"]],
  [
    /^\/assets\/[A-Za-z0-9_.:@+-]{1,200}\/(?:metadata|security)$/,
    ["GET", "PUT"],
  ],
  [/^\/attributes$/, ["GET"]],
  [/^\/attributes\/[A-Za-z0-9_.:@+-]{1,200}\/vocabulary$/, ["GET"]],
  [/^\/categories(?:\/.*)?$/, ["GET"]],
  [/^\/channels$/, ["GET"]],
  [/^\/collections$/, ["GET"]],
  [/^\/integrations\/url$/, ["GET"]],
  [/^\/metadata\/fields\/viewable$/, ["GET"]],
  [/^\/metadata\/[A-Za-z0-9_.:@+-]{1,200}\/vocabulary$/, ["GET", "POST"]],
  [
    /^\/metadata\/[A-Za-z0-9_.:@+-]{1,200}\/vocabulary\/[A-Za-z0-9_.:@+%=-]{1,500}$/,
    ["GET", "PUT", "DELETE"],
  ],
  [/^\/product-(?:categories|types)$/, ["GET"]],
  [/^\/products(?:\/search)?$/, ["POST"]],
  [/^\/products\/[A-Za-z0-9_.:@+-]{1,200}$/, ["GET", "DELETE"]],
  [
    /^\/products\/[A-Za-z0-9_.:@+-]{1,200}\/(?:attributes|featured-image|parent-product|product-category|product-type|rename)$/,
    ["PUT"],
  ],
  [/^\/products\/channels\/[A-Za-z0-9_.:@+-]{1,200}$/, ["GET"]],
  [/^\/uploads$/, ["POST"]],
  [/^\/uploads\/profiles$/, ["GET"]],
  [/^\/uploads\/chunks\/(?:start|upload|complete)$/, ["POST"]],
  [/^\/usage\/api$/, ["GET"]],
  [/^\/user\/[A-Za-z0-9_.:@+-]{1,200}$/, ["GET"]],
  [/^\/webhooks\/configurations$/, ["GET", "POST"]],
  [
    /^\/webhooks\/configurations\/[A-Za-z0-9_.:@+-]{1,200}$/,
    ["GET", "PUT", "DELETE"],
  ],
  [/^\/webhooks\/configurations\/[A-Za-z0-9_.:@+-]{1,200}\/ping$/, ["GET"]],
  [/^\/workflow\/webhooks$/, ["GET", "POST", "DELETE"]],
  [/^\/workflow\/projects$/, ["POST"]],
  [/^\/workflow\/projects\/[A-Za-z0-9_.:@+-]{1,200}$/, ["GET", "DELETE"]],
  [/^\/workflow\/projects\/[A-Za-z0-9_.:@+-]{1,200}\/support-files$/, ["GET"]],
  [
    /^\/workflow\/projects\/[A-Za-z0-9_.:@+-]{1,200}\/deliverables$/,
    ["GET", "POST"],
  ],
  [
    /^\/workflow\/projects\/[A-Za-z0-9_.:@+-]{1,200}\/deliverables\/[A-Za-z0-9_.:@+-]{1,200}$/,
    ["GET", "DELETE"],
  ],
  [
    /^\/workflow\/projects\/[A-Za-z0-9_.:@+-]{1,200}\/deliverables\/[A-Za-z0-9_.:@+-]{1,200}\/close$/,
    ["PUT"],
  ],
  [
    /^\/workflow\/projects\/[A-Za-z0-9_.:@+-]{1,200}\/deliverables\/[A-Za-z0-9_.:@+-]{1,200}\/proofs$/,
    ["POST"],
  ],
] as const;

const V1_ROUTES: ReadonlyArray<readonly [RegExp, readonly string[]]> = [
  [
    /^\/asset\/changemetadatatype\/asset\/[A-Za-z0-9_.:@+-]{1,200}\/type\/[A-Za-z0-9_.:@+-]{1,200}$/,
    ["PUT"],
  ],
  [/^\/asset\/uuid\/[A-Za-z0-9_.:@+-]{1,200}\/assetversions$/, ["GET"]],
  [/^\/category$/, ["POST"]],
  [/^\/category\/assets$/, ["POST"]],
  [/^\/category\/categoryTree$/, ["GET"]],
  [/^\/category\/uuid\/[A-Za-z0-9_.:@+-]{1,200}$/, ["PUT"]],
  [/^\/collection$/, ["POST"]],
  [/^\/collection\/assets$/, ["POST"]],
  [/^\/conversion\/order\/profile\/uuid\/[A-Za-z0-9_.:@+-]{1,200}$/, ["POST"]],
  [/^\/fileformats$/, ["GET"]],
  [/^\/integrationlink$/, ["GET", "POST"]],
  [/^\/integrationlink\/[A-Za-z0-9_.:@+-]{1,200}$/, ["DELETE"]],
  [/^\/metadata\/types$/, ["GET"]],
  [/^\/order$/, ["POST"]],
  [/^\/order\/items\/removals$/, ["POST"]],
  [/^\/order\/profile\/internet$/, ["GET"]],
  [/^\/order\/uuid\/[A-Za-z0-9_.:@+-]{1,200}\/zip$/, ["GET", "POST"]],
  [/^\/order\/(?:uuid|seqNum)\/[A-Za-z0-9_.:@+-]{1,200}$/, ["GET"]],
  [/^\/user\/address$/, ["GET"]],
] as const;

export const WIDEN_COLLECTIVE_SDK_OPERATION_COUNT = 94;

@Injectable()
export class WidenCollectiveApiAdapter {
  health(credentials: WidenCollectiveCredentials) {
    return this.request(credentials, {
      apiVersion: "2",
      method: "GET",
      path: "/user",
    });
  }

  async request(
    credentials: WidenCollectiveCredentials,
    input: {
      apiVersion: string;
      method: string;
      path: string;
      query?: JsonObject;
      json?: JsonObject;
      contentBase64?: string;
      contentType?: string;
      multipartFields?: JsonObject;
      multipartField?: string;
      fileName?: string;
    },
  ) {
    const accessToken = credentials.accessToken?.trim();
    if (!accessToken || accessToken.length > 20_000)
      throw new WidenCollectiveApiError(
        "credential_missing",
        "Acquia DAM access token is required.",
        401,
      );
    const collective = credentials.collective?.trim().toLowerCase();
    if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(collective))
      throw new WidenCollectiveApiError(
        "credential_missing",
        "Acquia DAM collective subdomain is required.",
        401,
      );
    const apiVersion =
      input.apiVersion === "1" ? "1" : input.apiVersion === "2" ? "2" : "";
    const method = input.method.toUpperCase();
    if (!apiVersion || !this.routeAllowed(apiVersion, method, input.path))
      throw new WidenCollectiveApiError(
        "provider_validation_error",
        "Acquia DAM method or route is outside the current official SDK surface.",
      );
    if (
      method === "GET" &&
      (input.json || input.contentBase64 || input.multipartFields)
    )
      throw new WidenCollectiveApiError(
        "provider_validation_error",
        "Acquia DAM GET requests cannot include a body.",
      );
    if (input.json && input.multipartFields)
      throw new WidenCollectiveApiError(
        "provider_validation_error",
        "Acquia DAM requests cannot combine JSON and multipart bodies.",
      );
    this.rejectCredentials(input.query);
    this.rejectCredentials(input.json);
    this.rejectCredentials(input.multipartFields);
    const base =
      apiVersion === "2"
        ? "https://api.widencollective.com/v2"
        : `https://${collective}.widencollective.com/api/rest`;
    const url = new URL(`${base}${input.path}`);
    this.appendQuery(url.searchParams, input.query ?? {});
    let body: string | ArrayBuffer | FormData | undefined;
    let contentType: string | undefined;
    let bodySize = 0;
    if (input.multipartFields !== undefined) {
      const form = new FormData();
      for (const [key, value] of Object.entries(input.multipartFields)) {
        if (!/^[A-Za-z0-9_.-]{1,100}$/.test(key))
          throw new WidenCollectiveApiError(
            "provider_validation_error",
            "Acquia DAM multipart field name is invalid.",
          );
        if (value === undefined || value === null) continue;
        const serialized =
          typeof value === "object" ? JSON.stringify(value) : String(value);
        if (serialized.length > 1_000_000)
          throw new WidenCollectiveApiError(
            "provider_validation_error",
            `Acquia DAM multipart field ${key} is too large.`,
          );
        bodySize += Buffer.byteLength(serialized);
        form.append(key, serialized);
      }
      if (input.contentBase64 !== undefined) {
        const bytes = this.decodeBase64(input.contentBase64);
        const field = input.multipartField?.trim() || "file";
        if (!/^[A-Za-z0-9_.-]{1,100}$/.test(field))
          throw new WidenCollectiveApiError(
            "provider_validation_error",
            "Acquia DAM multipart file field name is invalid.",
          );
        const fileName = input.fileName?.trim() || "upload.bin";
        if (
          fileName.length > 500 ||
          fileName.includes("/") ||
          fileName.includes("\\") ||
          /[\u0000-\u001f\u007f]/.test(fileName)
        )
          throw new WidenCollectiveApiError(
            "provider_validation_error",
            "Acquia DAM upload filename is invalid.",
          );
        bodySize += bytes.length;
        form.append(
          field,
          new Blob([bytes], { type: this.safeContentType(input.contentType) }),
          fileName,
        );
      } else if (input.multipartField || input.fileName) {
        throw new WidenCollectiveApiError(
          "provider_validation_error",
          "Acquia DAM multipart file settings require file content.",
        );
      }
      body = form;
    } else if (input.contentBase64 !== undefined) {
      const bytes = this.decodeBase64(input.contentBase64);
      body = Uint8Array.from(bytes).buffer;
      bodySize = bytes.length;
      contentType = this.safeContentType(input.contentType);
    } else if (input.json !== undefined) {
      body = JSON.stringify(input.json);
      bodySize = Buffer.byteLength(body);
      contentType = "application/json";
    }
    if (bodySize > 5_000_000)
      throw new WidenCollectiveApiError(
        "provider_validation_error",
        "Acquia DAM request exceeds 5 MB.",
      );
    try {
      const response = await safeConnectorFetch(url, {
        method,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
          ...(contentType ? { "Content-Type": contentType } : {}),
        },
        body,
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
        cache: "no-store",
      });
      const raw = Buffer.from(await response.arrayBuffer());
      if (raw.length > 10_000_000)
        throw new WidenCollectiveApiError(
          "provider_validation_error",
          "Acquia DAM response exceeds 10 MB.",
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
        throw new WidenCollectiveApiError(
          this.safeCode(response.status),
          this.message(data) ?? `Acquia DAM returned HTTP ${response.status}.`,
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
      if (error instanceof WidenCollectiveApiError) throw error;
      throw new WidenCollectiveApiError(
        "provider_unavailable",
        "Acquia DAM could not be reached.",
        502,
      );
    }
  }

  private routeAllowed(version: "1" | "2", method: string, path: string) {
    if (
      !path.startsWith("/") ||
      path.includes("?") ||
      path.includes("#") ||
      path.includes("..") ||
      path.includes("//") ||
      path.length > 1000
    )
      return false;
    return (version === "2" ? V2_ROUTES : V1_ROUTES).some(
      ([pattern, methods]) =>
        methods.includes(method) && pattern.test(path.replace(/\/$/, "")),
    );
  }

  private appendQuery(params: URLSearchParams, value: JsonObject) {
    if (Object.keys(value).length > 100)
      throw new WidenCollectiveApiError(
        "provider_validation_error",
        "Acquia DAM request has too many query fields.",
      );
    for (const [key, item] of Object.entries(value)) {
      if (item === undefined || item === null || item === "") continue;
      if (!/^[A-Za-z0-9_.\[\]-]{1,100}$/.test(key))
        throw new WidenCollectiveApiError(
          "provider_validation_error",
          "Acquia DAM query key is invalid.",
        );
      for (const entry of Array.isArray(item) ? item.slice(0, 100) : [item]) {
        if (!["string", "number", "boolean"].includes(typeof entry))
          throw new WidenCollectiveApiError(
            "provider_validation_error",
            `Acquia DAM query field ${key} must be scalar.`,
          );
        params.append(key, String(entry).slice(0, 20_000));
      }
    }
  }

  private rejectCredentials(value?: JsonObject) {
    const walk = (item: unknown, depth = 0) => {
      if (depth > 12)
        throw new WidenCollectiveApiError(
          "policy_blocked",
          "Acquia DAM request is too deeply nested.",
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
          throw new WidenCollectiveApiError(
            "policy_blocked",
            `Credential-bearing field ${key} is not allowed.`,
            403,
          );
        walk(entry, depth + 1);
      }
    };
    if (value) walk(value);
  }

  private safeContentType(value?: string) {
    const normalized =
      value?.trim().toLowerCase() ?? "application/octet-stream";
    if (
      !/^(?:application|audio|image|text|video)\/[a-z0-9.+-]{1,80}$/.test(
        normalized,
      )
    )
      throw new WidenCollectiveApiError(
        "provider_validation_error",
        "Acquia DAM content type is invalid.",
      );
    return normalized;
  }

  private decodeBase64(value: string) {
    if (
      !value ||
      value.length > 7_000_000 ||
      !/^[A-Za-z0-9+/]*={0,2}$/.test(value) ||
      value.length % 4 !== 0
    )
      throw new WidenCollectiveApiError(
        "provider_validation_error",
        "Acquia DAM upload content is not valid base64.",
      );
    const bytes = Buffer.from(value, "base64");
    if (!bytes.length || bytes.toString("base64") !== value)
      throw new WidenCollectiveApiError(
        "provider_validation_error",
        "Acquia DAM upload content is not valid base64.",
      );
    return bytes;
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
          /(token|secret|authorization|password|cookie|api.?key|signed.?url|download.?url|integration.?url)/i.test(
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
