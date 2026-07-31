import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Operation = { method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; path: string };

export const LUCIDCHART_READ_OPERATIONS: readonly Operation[] = [
  { method: "GET", path: "/v1/users/me/profile" },
  { method: "POST", path: "/v1/documents/search" },
  { method: "GET", path: "/v1/documents/{documentId}" },
  { method: "GET", path: "/v1/documents/{documentId}/contents" },
  { method: "GET", path: "/v1/documents/{documentId}/threads" },
  { method: "GET", path: "/v1/documents/{documentId}/threads/{threadId}/comments" },
  { method: "GET", path: "/v1/documents/{documentId}/shares/shareLinks/{shareLinkId}" },
  { method: "GET", path: "/v1/documents/{documentId}/shares/users" },
  { method: "GET", path: "/v1/documents/{documentId}/shares/users/{userId}" },
  { method: "GET", path: "/v1/documents/{documentId}/shares/teams/{teamId}" },
  { method: "GET", path: "/v1/folders/{folderId}" },
  { method: "POST", path: "/v1/folders/search" },
  { method: "GET", path: "/v1/folders/{folderId}/contents" },
  { method: "GET", path: "/v1/folders/root/contents" },
  { method: "GET", path: "/v1/folders/app/contents" },
];

export const LUCIDCHART_WRITE_OPERATIONS: readonly Operation[] = [
  { method: "POST", path: "/v1/documents" },
  { method: "POST", path: "/v1/documents/copy" },
  { method: "PATCH", path: "/v1/documents/{documentId}" },
  { method: "POST", path: "/v1/documents/{documentId}/trash" },
  { method: "POST", path: "/v1/documents/{documentId}/threads/{threadId}/comments" },
  { method: "POST", path: "/v1/documents/{documentId}/shares/shareLinks" },
  { method: "PATCH", path: "/v1/documents/{documentId}/shares/shareLinks/{shareLinkId}" },
  { method: "DELETE", path: "/v1/documents/{documentId}/shares/shareLinks/{shareLinkId}" },
  { method: "PUT", path: "/v1/documents/{documentId}/shares/users/{userId}" },
  { method: "DELETE", path: "/v1/documents/{documentId}/shares/users/{userId}" },
  { method: "PUT", path: "/v1/documents/{documentId}/shares/teams/{teamId}" },
  { method: "DELETE", path: "/v1/documents/{documentId}/shares/teams/{teamId}" },
  { method: "POST", path: "/v1/folders" },
  { method: "PATCH", path: "/v1/folders/{folderId}" },
  { method: "POST", path: "/v1/folders/{folderId}/trash" },
  { method: "POST", path: "/v1/folders/{folderId}/restore" },
];

export class LucidchartApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}
@Injectable()
export class LucidchartApiAdapter {
  health(accessToken: string) {
    return this.callRead(accessToken, { path: "/v1/users/me/profile" });
  }

  async callRead(accessToken: string, input: JsonObject) {
    const path = this.requiredPath(input.path);
    const method = path === "/v1/documents/search" || path === "/v1/folders/search"
      ? "POST"
      : this.readMethod(input.method);
    let json = input.json === undefined ? undefined : this.object(input.json);
    if (path === "/v1/documents/search") {
      (json ??= {}).product = ["lucidchart"];
    }
    return await this.request(accessToken, {
      method,
      path,
      query: this.object(input.query),
      json,
      accept: this.accept(input.accept),
    }, LUCIDCHART_READ_OPERATIONS);
  }

  async callWrite(accessToken: string, input: JsonObject) {
    const path = this.requiredPath(input.path);
    let json = input.json === undefined ? undefined : this.object(input.json);
    if (path === "/v1/documents") (json ??= {}).product = "lucidchart";
    return await this.request(accessToken, {
      method: this.writeMethod(input.method),
      path,
      query: this.object(input.query),
      json,
      accept: "application/json",
    }, LUCIDCHART_WRITE_OPERATIONS);
  }

  private async request(
    accessToken: string,
    input: { method: Operation["method"]; path: string; query?: JsonObject; json?: JsonObject; accept: string },
    allowed: readonly Operation[],
  ) {
    if (!accessToken?.trim() || accessToken.length > 10_000) {
      throw new LucidchartApiError("credential_missing", "Lucidchart OAuth access token is required.", 401);
    }
    if (!allowed.some((operation) => operation.method === input.method && this.matches(operation.path, input.path))) {
      throw new LucidchartApiError("provider_validation_error", "Lucidchart method or path is outside the supported Lucid REST boundary.");
    }
    this.rejectCredentials(input.query);
    this.rejectCredentials(input.json);
    await this.assertLucidchartContext(accessToken, input);
    const url = new URL(`https://api.lucid.co${input.path}`);
    this.appendQuery(url.searchParams, input.query ?? {});
    const body = input.json === undefined ? undefined : JSON.stringify(input.json);
    if (body && Buffer.byteLength(body) > 4_000_000) {
      throw new LucidchartApiError("provider_validation_error", "Lucidchart request exceeds 4 MB.");
    }
    try {
      const response = await safeConnectorFetch(url, {
        method: input.method,
        headers: {
          Accept: input.accept,
          Authorization: `Bearer ${accessToken}`,
          "Lucid-Api-Version": "1",
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body,
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
      });
      const raw = Buffer.from(await response.arrayBuffer());
      if (raw.length > 16_000_000) throw new LucidchartApiError("provider_validation_error", "Lucidchart response exceeds 16 MB.");
      const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
      let data: unknown;
      if (contentType.startsWith("image/")) {
        data = { contentType: contentType.split(";")[0], dataBase64: raw.toString("base64") };
      } else {
        try {
          data = raw.length ? JSON.parse(raw.toString("utf8")) : null;
        } catch {
          data = { content: raw.toString("utf8").slice(0, 1_000_000) };
        }
      }
      data = this.redact(data);
      if (!response.ok) {
        throw new LucidchartApiError(this.safeCode(response.status), this.message(data) ?? `Lucid returned HTTP ${response.status}.`, response.status);
      }
      if ((/^\/v1\/documents\/[^/]+$/.test(input.path) && input.path !== "/v1/documents/search") || input.path === "/v1/documents" || input.path === "/v1/documents/copy") {
        this.assertProduct(data);
      }
      return this.filterLucidchart(data);
    } catch (error) {
      if (error instanceof LucidchartApiError) throw error;
      throw new LucidchartApiError("provider_unavailable", "Lucid could not be reached.", 502);
    }
  }

  private async assertLucidchartContext(
    accessToken: string,
    input: { method: Operation["method"]; path: string; json?: JsonObject },
  ) {
    if (input.path === "/v1/documents") {
      if (input.json?.product !== "lucidchart") throw new LucidchartApiError("provider_validation_error", "Lucidchart creation must use the lucidchart product.");
      return;
    }
    if (input.path === "/v1/documents/search") {
      if (!Array.isArray(input.json?.product) || input.json?.product.length !== 1 || input.json.product[0] !== "lucidchart") {
        throw new LucidchartApiError("provider_validation_error", "Lucidchart search must be restricted to Lucidchart diagrams.");
      }
      return;
    }
    if (input.path === "/v1/documents/copy") {
      const template = typeof input.json?.template === "string" ? input.json.template.trim() : "";
      if (!template) throw new LucidchartApiError("provider_validation_error", "Lucidchart copy requires a template diagram ID.");
      await this.assertDocument(accessToken, template);
      return;
    }
    const match = input.path.match(/^\/v1\/documents\/([^/]+)/);
    const directGet = /^\/v1\/documents\/[^/]+$/.test(input.path) && input.method === "GET";
    if (match && !directGet) await this.assertDocument(accessToken, decodeURIComponent(match[1]));
  }

  private async assertDocument(accessToken: string, id: string) {
    if (!/^[A-Za-z0-9._:@%+=~-]{1,300}$/.test(id)) throw new LucidchartApiError("provider_validation_error", "Lucidchart diagram ID is invalid.");
    const response = await safeConnectorFetch(`https://api.lucid.co/v1/documents/${encodeURIComponent(id)}`, {
      headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}`, "Lucid-Api-Version": "1" },
      redirect: "error",
      signal: AbortSignal.timeout(30_000),
    });
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.length > 2_000_000) throw new LucidchartApiError("provider_validation_error", "Lucid validation response exceeds 2 MB.");
    const data = raw.length ? JSON.parse(raw.toString("utf8")) as unknown : null;
    if (!response.ok) throw new LucidchartApiError(this.safeCode(response.status), this.message(data) ?? `Lucid returned HTTP ${response.status}.`, response.status);
    this.assertProduct(data);
  }

  private assertProduct(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value) || (value as JsonObject).product !== "lucidchart") {
      throw new LucidchartApiError("provider_validation_error", "The requested Lucid document is not a Lucidchart diagram.", 422);
    }
  }

  private filterLucidchart(value: unknown, depth = 0): unknown {
    if (depth > 20) return "[truncated]";
    if (Array.isArray(value)) return value.map((entry) => this.filterLucidchart(entry, depth + 1)).filter((entry) => entry !== undefined);
    if (!value || typeof value !== "object") return value;
    const object = value as JsonObject;
    if (typeof object.product === "string" && object.product !== "lucidchart") return undefined;
    return Object.fromEntries(Object.entries(object).map(([key, item]) => [key, this.filterLucidchart(item, depth + 1)]));
  }

  private matches(template: string, path: string) {
    const pattern = template.split("/").map((segment) => segment.startsWith("{") ? "[A-Za-z0-9._:@%+=~-]{1,300}" : segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("/");
    return new RegExp(`^${pattern}$`).test(path);
  }

  private requiredPath(value: unknown) {
    if (typeof value !== "string" || !value.startsWith("/v1/") || value.includes("..") || value.includes("//") || value.includes("?") || value.includes("#") || value.length > 2_000) {
      throw new LucidchartApiError("provider_validation_error", "Lucidchart path is invalid.");
    }
    return value;
  }

  private readMethod(value: unknown): "GET" | "POST" {
    const method = typeof value === "string" ? value.toUpperCase() : "GET";
    if (method !== "GET" && method !== "POST") throw new LucidchartApiError("provider_validation_error", "Lucidchart read method must be GET or POST.");
    return method;
  }

  private writeMethod(value: unknown): "POST" | "PUT" | "PATCH" | "DELETE" {
    const method = typeof value === "string" ? value.toUpperCase() : "";
    if (method !== "POST" && method !== "PUT" && method !== "PATCH" && method !== "DELETE") {
      throw new LucidchartApiError("provider_validation_error", "Lucidchart write method must be POST, PUT, PATCH, or DELETE.");
    }
    return method;
  }

  private accept(value: unknown) {
    const accept = typeof value === "string" ? value.toLowerCase() : "application/json";
    if (!["application/json", "image/png", "image/jpeg"].includes(accept)) throw new LucidchartApiError("provider_validation_error", "Lucidchart response type is not supported.");
    return accept;
  }

  private appendQuery(params: URLSearchParams, value: JsonObject) {
    if (Object.keys(value).length > 50) throw new LucidchartApiError("provider_validation_error", "Lucidchart request has too many query fields.");
    for (const [key, item] of Object.entries(value)) {
      if (item === undefined || item === null || item === "") continue;
      if (!/^[A-Za-z0-9_.\[\]-]{1,100}$/.test(key)) throw new LucidchartApiError("provider_validation_error", "Lucidchart query key is invalid.");
      for (const entry of Array.isArray(item) ? item.slice(0, 100) : [item]) {
        if (!["string", "number", "boolean"].includes(typeof entry)) throw new LucidchartApiError("provider_validation_error", `Lucidchart query field ${key} must be scalar.`);
        params.append(key, String(entry).slice(0, 20_000));
      }
    }
  }

  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
  }

  private rejectCredentials(value: unknown, depth = 0) {
    if (!value || typeof value !== "object") return;
    if (depth > 12) throw new LucidchartApiError("policy_blocked", "Lucidchart request is too deeply nested.", 403);
    for (const [key, item] of Object.entries(value as JsonObject)) {
      if (/(authorization|access.?token|refresh.?token|client.?secret|api.?key|password|cookie|credential)/i.test(key)) throw new LucidchartApiError("policy_blocked", `Credential-bearing field ${key} is not allowed.`, 403);
      if (Array.isArray(item)) item.slice(0, 1000).forEach((entry) => this.rejectCredentials(entry, depth + 1));
      else this.rejectCredentials(item, depth + 1);
    }
  }

  private redact(value: unknown, depth = 0): unknown {
    if (depth > 20) return "[truncated]";
    if (typeof value === "string") return value.slice(0, 4_000_000);
    if (Array.isArray(value)) return value.slice(0, 5000).map((entry) => this.redact(entry, depth + 1));
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(Object.entries(value as JsonObject).slice(0, 10_000).map(([key, item]) => [key, /(token|secret|password|authorization|cookie|credential)/i.test(key) ? "[redacted]" : this.redact(item, depth + 1)]));
  }

  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private message(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const object = value as JsonObject;
    const candidate = object.message ?? object.error_description ?? object.error;
    return typeof candidate === "string" ? candidate.slice(0, 500) : null;
  }
}
