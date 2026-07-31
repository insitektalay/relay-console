import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";
import {
  DAMINION_API_OPERATION_COUNT,
  DAMINION_API_OPERATIONS,
} from "./daminion-api.operations";

type JsonObject = Record<string, unknown>;

export type DaminionCredentials = {
  tenant: string;
  username: string;
  password: string;
};

export class DaminionApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

const PARAMETER_SEGMENT = "[A-Za-z0-9._~!$&'()*+,;=:@%-]{1,500}";
const ROUTES = DAMINION_API_OPERATIONS.map(([method, template]) => {
  const source = template
    .split("/")
    .map((segment) =>
      /^\{[^}]+\}$/.test(segment)
        ? PARAMETER_SEGMENT
        : segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    )
    .join("/");
  return [method, new RegExp(`^${source}$`, "i")] as const;
});

export { DAMINION_API_OPERATION_COUNT };

@Injectable()
export class DaminionApiAdapter {
  async health(credentials: DaminionCredentials) {
    const session = await this.authenticate(credentials);
    return this.authorizedRequest(credentials, session, {
      method: "GET",
      path: "/api/Settings/GetLoggedUser",
    });
  }

  async request(
    credentials: DaminionCredentials,
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
      apiArg?: JsonObject;
    },
  ) {
    const session = await this.authenticate(credentials);
    return this.authorizedRequest(credentials, session, input);
  }

  private async authenticate(credentials: DaminionCredentials) {
    const origin = this.origin(credentials.tenant);
    const username = credentials.username?.trim();
    const password = credentials.password;
    if (
      !username ||
      username.length > 500 ||
      !password ||
      password.length > 20_000
    )
      throw new DaminionApiError(
        "credential_missing",
        "Daminion username and password are required.",
        401,
      );
    try {
      const response = await safeConnectorFetch(`${origin}/account/login`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ usernameOrEmailAddress: username, password }),
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
        cache: "no-store",
      });
      const cookie = response.headers
        .get("set-cookie")
        ?.match(/(?:^|[,;]\s*)(\.AspNet\.ApplicationCookie=[^;,]+)/i)?.[1];
      if (!response.ok || !cookie)
        throw new DaminionApiError(
          "credential_missing",
          "Daminion rejected the server login.",
          response.status || 401,
        );
      return cookie;
    } catch (error) {
      if (error instanceof DaminionApiError) throw error;
      throw new DaminionApiError(
        "provider_unavailable",
        "Daminion could not be reached.",
        502,
      );
    }
  }

  private async authorizedRequest(
    credentials: DaminionCredentials,
    session: string,
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
      apiArg?: JsonObject;
    },
  ) {
    const origin = this.origin(credentials.tenant);
    const method = input.method.toUpperCase();
    if (!this.routeAllowed(method, input.path))
      throw new DaminionApiError(
        "provider_validation_error",
        "Daminion method or route is outside the published API help surface.",
      );
    this.assertFixedGuards(input.path, input.query);
    if (
      method === "GET" &&
      (input.json || input.multipartFields || input.contentBase64)
    )
      throw new DaminionApiError(
        "provider_validation_error",
        "Daminion GET requests cannot include a body.",
      );
    if (input.json && (input.multipartFields || input.contentBase64))
      throw new DaminionApiError(
        "provider_validation_error",
        "Daminion requests accept one body format at a time.",
      );
    this.rejectCredentials(input.query);
    this.rejectCredentials(input.json);
    this.rejectCredentials(input.multipartFields);
    this.rejectCredentials(input.apiArg);

    const url = new URL(`${origin}${input.path}`);
    this.appendQuery(url.searchParams, input.query ?? {});
    let body: BodyInit | undefined;
    const headers: Record<string, string> = {
      Accept: "application/json, application/octet-stream;q=0.9, */*;q=0.8",
      Cookie: session,
    };
    let requestSize = 0;
    if (input.json) {
      body = JSON.stringify(input.json);
      requestSize = Buffer.byteLength(body);
      headers["Content-Type"] = "application/json";
    } else if (input.multipartFields) {
      const form = new FormData();
      for (const [key, value] of Object.entries(input.multipartFields)) {
        if (!/^[A-Za-z0-9_.[\]-]{1,150}$/.test(key))
          throw new DaminionApiError(
            "provider_validation_error",
            "Daminion multipart field name is invalid.",
          );
        if (value === undefined || value === null) continue;
        const encoded =
          typeof value === "object" ? JSON.stringify(value) : String(value);
        requestSize += Buffer.byteLength(encoded);
        form.append(key, encoded);
      }
      if (input.contentBase64) {
        const bytes = this.decodeBase64(input.contentBase64);
        const field = input.multipartField?.trim();
        if (!field || !/^[A-Za-z0-9_.[\]-]{1,150}$/.test(field))
          throw new DaminionApiError(
            "provider_validation_error",
            "Daminion multipart file field is required and must be valid.",
          );
        requestSize += bytes.length;
        form.append(
          field,
          new Blob([bytes], { type: this.safeContentType(input.contentType) }),
          this.safeFileName(input.fileName),
        );
      }
      body = form;
    } else if (input.contentBase64) {
      const bytes = this.decodeBase64(input.contentBase64);
      requestSize = bytes.length;
      if (input.multipartField) {
        if (!/^[A-Za-z0-9_.[\]-]{1,150}$/.test(input.multipartField))
          throw new DaminionApiError(
            "provider_validation_error",
            "Daminion multipart file field is invalid.",
          );
        const form = new FormData();
        form.append(
          input.multipartField,
          new Blob([bytes], { type: this.safeContentType(input.contentType) }),
          this.safeFileName(input.fileName),
        );
        body = form;
      } else {
        body = bytes;
        headers["Content-Type"] = this.safeContentType(input.contentType);
        if (input.apiArg)
          headers["Daminion-API-Arg"] = JSON.stringify(input.apiArg);
      }
    } else if (
      input.multipartField ||
      input.fileName ||
      input.contentType ||
      input.apiArg
    ) {
      throw new DaminionApiError(
        "provider_validation_error",
        "Daminion file settings require file content.",
      );
    }
    if (requestSize > 5_000_000)
      throw new DaminionApiError(
        "provider_validation_error",
        "Daminion request exceeds 5 MB.",
      );

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
        throw new DaminionApiError(
          "provider_validation_error",
          "Daminion response exceeds 10 MB.",
        );
      const contentType =
        response.headers.get("content-type") ?? "application/octet-stream";
      let data: unknown;
      if (contentType.includes("json") || contentType.startsWith("text/")) {
        const text = raw.toString("utf8");
        try {
          data = text ? JSON.parse(text) : null;
        } catch {
          data = text;
        }
        data = this.redact(data);
      } else {
        data = {
          contentType: contentType.split(";")[0],
          byteLength: raw.length,
          contentBase64: raw.toString("base64"),
        };
      }
      if (!response.ok)
        throw new DaminionApiError(
          this.safeCode(response.status),
          this.message(data) ?? `Daminion returned HTTP ${response.status}.`,
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
      if (error instanceof DaminionApiError) throw error;
      throw new DaminionApiError(
        "provider_unavailable",
        "Daminion could not be reached.",
        502,
      );
    }
  }

  private origin(value: string) {
    const tenant = value?.trim().toLowerCase();
    if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(tenant))
      throw new DaminionApiError(
        "credential_missing",
        "Daminion cloud tenant subdomain is required.",
        401,
      );
    return `https://${tenant}.daminion.net`;
  }

  private routeAllowed(method: string, path: string) {
    return (
      path.length <= 2_000 &&
      path.startsWith("/api/") &&
      !path.includes("..") &&
      !path.includes("//") &&
      ROUTES.some(
        ([allowedMethod, pattern]) =>
          allowedMethod === method && pattern.test(path),
      )
    );
  }

  private assertFixedGuards(path: string, query: JsonObject | undefined) {
    const normalized = path.toLowerCase().replace(/\/$/, "");
    const alwaysBlocked = [
      "/api/settings/getapikey",
      "/api/settings/setapikey",
      "/api/usermanager/login",
      "/api/usermanager",
      "/api/intranet",
      "/api/mediaitems/getabsolutepath",
      "/api/mediaitems/getabsolutepaths",
      "/api/import/importfiles",
      "/api/download/getassistantsettings",
      "/api/download/getadobe",
    ];
    if (
      normalized === "/api/settings" ||
      normalized.startsWith("/api/intranet/") ||
      alwaysBlocked.includes(normalized) ||
      (normalized === "/api/mediaitems" && query && "id" in query)
    )
      throw new DaminionApiError(
        "policy_blocked",
        "Daminion credential, server-path, or host-control operations are not available to runtime agents.",
        403,
      );
  }

  private appendQuery(params: URLSearchParams, query: JsonObject) {
    for (const [key, value] of Object.entries(query)) {
      if (!/^[A-Za-z0-9_.[\]-]{1,150}$/.test(key))
        throw new DaminionApiError(
          "provider_validation_error",
          "Daminion query name is invalid.",
        );
      if (value === undefined || value === null) continue;
      const values = Array.isArray(value) ? value : [value];
      if (values.length > 100)
        throw new DaminionApiError(
          "provider_validation_error",
          "Daminion query is too large.",
        );
      for (const entry of values) {
        if (!["string", "number", "boolean"].includes(typeof entry))
          throw new DaminionApiError(
            "provider_validation_error",
            "Daminion query values must be scalar.",
          );
        const text = String(entry);
        if (text.length > 10_000)
          throw new DaminionApiError(
            "provider_validation_error",
            "Daminion query value is too long.",
          );
        params.append(key, text);
      }
    }
    if (params.toString().length > 20_000)
      throw new DaminionApiError(
        "provider_validation_error",
        "Daminion query exceeds 20 KB.",
      );
  }

  private rejectCredentials(value: unknown, depth = 0) {
    if (depth > 12 || value === undefined || value === null) return;
    if (Array.isArray(value))
      return value.forEach((entry) => this.rejectCredentials(entry, depth + 1));
    if (typeof value !== "object") return;
    for (const [key, entry] of Object.entries(value as JsonObject)) {
      if (
        /(password|secret|authorization|credential|cookie|api.?key|access.?token)/i.test(
          key,
        )
      )
        throw new DaminionApiError(
          "policy_blocked",
          `Credential-bearing field ${key} is not available to runtime agents.`,
          403,
        );
      this.rejectCredentials(entry, depth + 1);
    }
  }

  private decodeBase64(value: string) {
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(value) || value.length % 4 !== 0)
      throw new DaminionApiError(
        "provider_validation_error",
        "Daminion file content must be valid base64.",
      );
    const bytes = Buffer.from(value, "base64");
    if (bytes.length > 5_000_000)
      throw new DaminionApiError(
        "provider_validation_error",
        "Daminion upload exceeds 5 MB.",
      );
    return bytes;
  }

  private safeFileName(value: string | undefined) {
    const fileName = value?.trim() || "upload.bin";
    if (
      fileName.length > 500 ||
      fileName.includes("/") ||
      fileName.includes("\\") ||
      /[\u0000-\u001f\u007f]/.test(fileName)
    )
      throw new DaminionApiError(
        "provider_validation_error",
        "Daminion upload filename is invalid.",
      );
    return fileName;
  }

  private safeContentType(value: string | undefined) {
    const contentType = value?.trim() || "application/octet-stream";
    if (!/^[A-Za-z0-9!#$&^_.+-]+\/[A-Za-z0-9!#$&^_.+-]+$/.test(contentType))
      throw new DaminionApiError(
        "provider_validation_error",
        "Daminion content type is invalid.",
      );
    return contentType;
  }

  private redact(value: unknown, depth = 0): unknown {
    if (depth > 12) return "[TRUNCATED]";
    if (Array.isArray(value))
      return value
        .slice(0, 1_000)
        .map((entry) => this.redact(entry, depth + 1));
    if (!value || typeof value !== "object") return value;
    const result: JsonObject = {};
    for (const [key, entry] of Object.entries(value as JsonObject).slice(
      0,
      1_000,
    )) {
      result[key] =
        /(password|secret|authorization|credential|cookie|api.?key|access.?token|absolute.?path|physical.?path|server.?path)/i.test(
          key,
        )
          ? "[REDACTED]"
          : this.redact(entry, depth + 1);
    }
    return result;
  }

  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "credential_missing";
    if (status === 403) return "insufficient_scope";
    if (status === 404) return "provider_validation_error";
    if (status === 409) return "provider_validation_error";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private message(value: unknown) {
    if (!value || typeof value !== "object")
      return typeof value === "string" ? value.slice(0, 500) : null;
    const object = value as JsonObject;
    const message = object.message ?? object.error ?? object.errorMessage;
    return typeof message === "string" ? message.slice(0, 500) : null;
  }
}
