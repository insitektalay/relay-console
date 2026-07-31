import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Operation = { method: "GET" | "POST" | "PUT" | "DELETE"; path: string };

export const FIGJAM_READ_OPERATIONS: readonly Operation[] = [
  { method: "GET", path: "/v1/me" },
  { method: "GET", path: "/v1/files/{fileKey}" },
  { method: "GET", path: "/v1/files/{fileKey}/nodes" },
  { method: "GET", path: "/v1/images/{fileKey}" },
  { method: "GET", path: "/v1/files/{fileKey}/images" },
  { method: "GET", path: "/v1/files/{fileKey}/meta" },
  { method: "GET", path: "/v1/files/{fileKey}/comments" },
  { method: "GET", path: "/v1/files/{fileKey}/comments/{commentId}/reactions" },
  { method: "GET", path: "/v1/files/{fileKey}/versions" },
  { method: "GET", path: "/v2/webhooks" },
  { method: "GET", path: "/v2/webhooks/{webhookId}" },
  { method: "GET", path: "/v2/webhooks/{webhookId}/requests" },
];

export const FIGJAM_WRITE_OPERATIONS: readonly Operation[] = [
  { method: "POST", path: "/v1/files/{fileKey}/comments" },
  { method: "DELETE", path: "/v1/files/{fileKey}/comments/{commentId}" },
  { method: "POST", path: "/v1/files/{fileKey}/comments/{commentId}/reactions" },
  { method: "DELETE", path: "/v1/files/{fileKey}/comments/{commentId}/reactions" },
  { method: "POST", path: "/v2/webhooks" },
  { method: "PUT", path: "/v2/webhooks/{webhookId}" },
  { method: "DELETE", path: "/v2/webhooks/{webhookId}" },
];

export class FigJamApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class FigJamApiAdapter {
  health(accessToken: string) {
    return this.callRead(accessToken, { path: "/v1/me" });
  }

  async callRead(accessToken: string, input: JsonObject) {
    return await this.request(accessToken, {
      method: "GET",
      path: this.requiredPath(input.path),
      query: this.object(input.query),
    }, FIGJAM_READ_OPERATIONS);
  }

  async callWrite(accessToken: string, input: JsonObject) {
    const method = this.requiredMethod(input.method);
    return await this.request(accessToken, {
      method,
      path: this.requiredPath(input.path),
      query: this.object(input.query),
      json: input.json === undefined ? undefined : this.object(input.json),
    }, FIGJAM_WRITE_OPERATIONS);
  }

  private async request(
    accessToken: string,
    input: { method: Operation["method"]; path: string; query?: JsonObject; json?: JsonObject },
    allowed: readonly Operation[],
  ) {
    if (!accessToken?.trim() || accessToken.length > 10_000) {
      throw new FigJamApiError("credential_missing", "FigJam OAuth access token is required.", 401);
    }
    if (!allowed.some((operation) => operation.method === input.method && this.matches(operation.path, input.path))) {
      throw new FigJamApiError("provider_validation_error", "FigJam method or path is outside the supported Figma REST boundary.");
    }
    this.rejectCredentials(input.query);
    this.rejectCredentials(input.json);
    await this.assertFigJamContext(accessToken, input);
    const url = new URL(`https://api.figma.com${input.path}`);
    this.appendQuery(url.searchParams, input.query ?? {});
    const body = input.json === undefined ? undefined : JSON.stringify(input.json);
    if (body && Buffer.byteLength(body) > 1_000_000) {
      throw new FigJamApiError("provider_validation_error", "FigJam request exceeds 1 MB.");
    }
    try {
      const response = await safeConnectorFetch(url, {
        method: input.method,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body,
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
      });
      const raw = Buffer.from(await response.arrayBuffer());
      if (raw.length > 12_000_000) {
        throw new FigJamApiError("provider_validation_error", "FigJam response exceeds 12 MB.");
      }
      let data: unknown;
      try {
        data = raw.length ? JSON.parse(raw.toString("utf8")) : null;
      } catch {
        data = { content: raw.toString("utf8").slice(0, 1_000_000) };
      }
      data = this.redact(data);
      if (!response.ok) {
        throw new FigJamApiError(this.safeCode(response.status), this.message(data) ?? `Figma returned HTTP ${response.status}.`, response.status);
      }
      if (input.path !== "/v1/me" && input.path.includes("/files/") && input.method === "GET") {
        const editorType = this.editorType(data);
        if (editorType && editorType !== "figjam") {
          throw new FigJamApiError("provider_validation_error", "The requested file is not a FigJam board.", 422);
        }
      }
      await this.assertWebhookResponse(accessToken, input, data);
      return data;
    } catch (error) {
      if (error instanceof FigJamApiError) throw error;
      throw new FigJamApiError("provider_unavailable", "Figma could not be reached.", 502);
    }
  }

  private async assertFigJamContext(
    accessToken: string,
    input: { method: Operation["method"]; path: string; query?: JsonObject; json?: JsonObject },
  ) {
    const fileMatch = input.path.match(/^\/v1\/(?:files|images)\/([^/]+)/);
    const directFileRead = /^\/v1\/files\/[^/]+(?:\/meta)?$/.test(input.path) && input.method === "GET";
    if (fileMatch && !directFileRead) await this.assertFigJamFile(accessToken, decodeURIComponent(fileMatch[1]));

    if (input.path === "/v2/webhooks") {
      const source = input.method === "GET" ? input.query ?? {} : input.json ?? {};
      if (source.context !== "file" || typeof source.context_id !== "string" || !source.context_id.trim()) {
        throw new FigJamApiError("provider_validation_error", "FigJam webhooks must be bound to one explicit file.");
      }
      await this.assertFigJamFile(accessToken, source.context_id.trim());
    } else if (/^\/v2\/webhooks\/[^/]+(?:\/requests)?$/.test(input.path) && input.method !== "GET") {
      const webhookId = input.path.split("/")[3];
      const webhook = await this.fetchJson(accessToken, `https://api.figma.com/v2/webhooks/${encodeURIComponent(webhookId)}`);
      await this.assertWebhookFile(accessToken, webhook);
    }
  }

  private async assertWebhookResponse(
    accessToken: string,
    input: { method: Operation["method"]; path: string },
    data: unknown,
  ) {
    if (/^\/v2\/webhooks\/[^/]+$/.test(input.path) && input.method === "GET") {
      await this.assertWebhookFile(accessToken, data);
    }
    if (input.path === "/v2/webhooks" && input.method === "GET" && data && typeof data === "object" && !Array.isArray(data)) {
      const webhooks = (data as JsonObject).webhooks;
      if (Array.isArray(webhooks)) {
        for (const webhook of webhooks.slice(0, 100)) await this.assertWebhookFile(accessToken, webhook);
      }
    }
  }

  private async assertWebhookFile(accessToken: string, value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new FigJamApiError("provider_validation_error", "Figma webhook context is unavailable.");
    const webhook = value as JsonObject;
    if (webhook.context !== "file" || typeof webhook.context_id !== "string" || !webhook.context_id.trim()) {
      throw new FigJamApiError("provider_validation_error", "The requested webhook is not bound to a FigJam file.");
    }
    await this.assertFigJamFile(accessToken, webhook.context_id.trim());
  }

  private async assertFigJamFile(accessToken: string, fileKey: string) {
    if (!/^[A-Za-z0-9._:@%+=~-]{1,300}$/.test(fileKey)) throw new FigJamApiError("provider_validation_error", "FigJam file key is invalid.");
    const metadata = await this.fetchJson(accessToken, `https://api.figma.com/v1/files/${encodeURIComponent(fileKey)}/meta`);
    if (this.editorType(metadata) !== "figjam") throw new FigJamApiError("provider_validation_error", "The requested file is not a FigJam board.", 422);
  }

  private async fetchJson(accessToken: string, url: string) {
    const response = await safeConnectorFetch(url, {
      headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}` },
      redirect: "error",
      signal: AbortSignal.timeout(30_000),
    });
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.length > 2_000_000) throw new FigJamApiError("provider_validation_error", "Figma validation response exceeds 2 MB.");
    const data = raw.length ? JSON.parse(raw.toString("utf8")) as unknown : null;
    if (!response.ok) throw new FigJamApiError(this.safeCode(response.status), this.message(data) ?? `Figma returned HTTP ${response.status}.`, response.status);
    return data;
  }

  private editorType(value: unknown): string | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const object = value as JsonObject;
    if (typeof object.editorType === "string") return object.editorType.toLowerCase();
    if (object.file && typeof object.file === "object" && !Array.isArray(object.file)) {
      const nested = (object.file as JsonObject).editorType;
      return typeof nested === "string" ? nested.toLowerCase() : null;
    }
    return null;
  }

  private matches(template: string, path: string) {
    const pattern = template.split("/").map((segment) => segment.startsWith("{") ? "[A-Za-z0-9._:@%+=~-]{1,300}" : segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("/");
    return new RegExp(`^${pattern}$`).test(path);
  }

  private requiredPath(value: unknown) {
    if (typeof value !== "string" || !/^\/v[12]\//.test(value) || value.includes("..") || value.includes("//") || value.includes("?") || value.includes("#") || value.length > 2_000) {
      throw new FigJamApiError("provider_validation_error", "FigJam path is invalid.");
    }
    return value;
  }

  private requiredMethod(value: unknown): "POST" | "PUT" | "DELETE" {
    const method = typeof value === "string" ? value.toUpperCase() : "";
    if (method !== "POST" && method !== "PUT" && method !== "DELETE") {
      throw new FigJamApiError("provider_validation_error", "FigJam write method must be POST, PUT, or DELETE.");
    }
    return method;
  }

  private appendQuery(params: URLSearchParams, value: JsonObject) {
    if (Object.keys(value).length > 50) throw new FigJamApiError("provider_validation_error", "FigJam request has too many query fields.");
    for (const [key, item] of Object.entries(value)) {
      if (item === undefined || item === null || item === "") continue;
      if (!/^[A-Za-z0-9_.\[\]-]{1,100}$/.test(key)) throw new FigJamApiError("provider_validation_error", "FigJam query key is invalid.");
      for (const entry of Array.isArray(item) ? item.slice(0, 100) : [item]) {
        if (!["string", "number", "boolean"].includes(typeof entry)) throw new FigJamApiError("provider_validation_error", `FigJam query field ${key} must be scalar.`);
        params.append(key, String(entry));
      }
    }
  }

  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
  }

  private rejectCredentials(value: unknown, depth = 0) {
    if (!value || typeof value !== "object") return;
    if (depth > 12) throw new FigJamApiError("policy_blocked", "FigJam request is too deeply nested.", 403);
    for (const [key, item] of Object.entries(value as JsonObject)) {
      if (/(authorization|access.?token|refresh.?token|client.?secret|api.?key|password|cookie)/i.test(key)) {
        throw new FigJamApiError("policy_blocked", `Credential-bearing field ${key} is not allowed.`, 403);
      }
      if (Array.isArray(item)) item.slice(0, 1000).forEach((entry) => this.rejectCredentials(entry, depth + 1));
      else this.rejectCredentials(item, depth + 1);
    }
  }

  private redact(value: unknown, depth = 0): unknown {
    if (depth > 20) return "[truncated]";
    if (Array.isArray(value)) return value.slice(0, 5000).map((entry) => this.redact(entry, depth + 1));
    if (!value || typeof value !== "object") return value;
    const output: JsonObject = {};
    for (const [key, item] of Object.entries(value as JsonObject).slice(0, 10_000)) {
      output[key] = /(token|secret|password|passcode|authorization|cookie)/i.test(key) ? "[redacted]" : this.redact(item, depth + 1);
    }
    return output;
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
    return typeof object.message === "string" ? object.message.slice(0, 500) : typeof object.err === "string" ? object.err.slice(0, 500) : null;
  }
}
