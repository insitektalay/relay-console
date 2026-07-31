import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Operation = { method: "GET" | "POST" | "PATCH" | "DELETE"; path: string };

export const MURAL_READ_OPERATIONS: readonly Operation[] = [
  { method: "GET", path: "/murals/{muralId}" },
  { method: "GET", path: "/murals/{muralId}/chat" },
  { method: "GET", path: "/murals/{muralId}/exports/{exportId}" },
  { method: "GET", path: "/murals/{muralId}/private-mode" },
  { method: "GET", path: "/murals/{muralId}/tags" },
  { method: "GET", path: "/murals/{muralId}/tags/{tagId}" },
  { method: "GET", path: "/murals/{muralId}/timer" },
  { method: "GET", path: "/murals/{muralId}/users" },
  { method: "GET", path: "/murals/{muralId}/voting-sessions" },
  { method: "GET", path: "/murals/{muralId}/voting-sessions/{votingSessionId}" },
  { method: "GET", path: "/murals/{muralId}/voting-sessions/{votingSessionId}/results" },
  { method: "GET", path: "/murals/{muralId}/widgets" },
  { method: "GET", path: "/murals/{muralId}/widgets/files" },
  { method: "GET", path: "/murals/{muralId}/widgets/{widgetId}" },
  { method: "GET", path: "/rooms/{roomId}" },
  { method: "GET", path: "/rooms/{roomId}/folders" },
  { method: "GET", path: "/rooms/{roomId}/murals" },
  { method: "GET", path: "/rooms/{roomId}/users" },
  { method: "GET", path: "/search/{workspaceId}/murals" },
  { method: "GET", path: "/search/{workspaceId}/rooms" },
  { method: "GET", path: "/search/{workspaceId}/templates" },
  { method: "GET", path: "/templates" },
  { method: "GET", path: "/users/me" },
  { method: "GET", path: "/workspaces" },
  { method: "GET", path: "/workspaces/{workspaceId}" },
  { method: "GET", path: "/workspaces/{workspaceId}/murals" },
  { method: "GET", path: "/workspaces/{workspaceId}/murals/recent" },
  { method: "GET", path: "/workspaces/{workspaceId}/rooms" },
  { method: "GET", path: "/workspaces/{workspaceId}/rooms/open" },
  { method: "GET", path: "/workspaces/{workspaceId}/templates" },
  { method: "GET", path: "/workspaces/{workspaceId}/templates/recent" },
];

export const MURAL_WRITE_OPERATIONS: readonly Operation[] = [
  { method: "POST", path: "/murals" },
  { method: "DELETE", path: "/murals/{muralId}" },
  { method: "PATCH", path: "/murals/{muralId}" },
  { method: "POST", path: "/murals/{muralId}/access-info" },
  { method: "POST", path: "/murals/{muralId}/assets" },
  { method: "POST", path: "/murals/{muralId}/duplicate" },
  { method: "POST", path: "/murals/{muralId}/export" },
  { method: "POST", path: "/murals/{muralId}/private-mode/start" },
  { method: "POST", path: "/murals/{muralId}/private-mode/end" },
  { method: "POST", path: "/murals/{muralId}/send-request-access" },
  { method: "POST", path: "/murals/{muralId}/tags" },
  { method: "PATCH", path: "/murals/{muralId}/tags/{tagId}" },
  { method: "DELETE", path: "/murals/{muralId}/tags/{tagId}" },
  { method: "PATCH", path: "/murals/{muralId}/timer" },
  { method: "POST", path: "/murals/{muralId}/timer/start" },
  { method: "POST", path: "/murals/{muralId}/timer/end" },
  { method: "PATCH", path: "/murals/{muralId}/users/{userId}/permissions" },
  { method: "POST", path: "/murals/{muralId}/users/invite" },
  { method: "POST", path: "/murals/{muralId}/users/remove" },
  { method: "DELETE", path: "/murals/{muralId}/voting-sessions/{votingSessionId}" },
  { method: "POST", path: "/murals/{muralId}/voting-sessions/vote/{widgetId}" },
  { method: "POST", path: "/murals/{muralId}/voting-sessions/start" },
  { method: "POST", path: "/murals/{muralId}/voting-sessions/end" },
  { method: "DELETE", path: "/murals/{muralId}/widgets/{widgetId}" },
  { method: "POST", path: "/murals/{muralId}/widgets/area" },
  { method: "PATCH", path: "/murals/{muralId}/widgets/area/{widgetId}" },
  { method: "POST", path: "/murals/{muralId}/widgets/arrow" },
  { method: "PATCH", path: "/murals/{muralId}/widgets/arrow/{widgetId}" },
  { method: "POST", path: "/murals/{muralId}/widgets/comment" },
  { method: "PATCH", path: "/murals/{muralId}/widgets/comment/{widgetId}" },
  { method: "POST", path: "/murals/{muralId}/widgets/file" },
  { method: "PATCH", path: "/murals/{muralId}/widgets/file/{widgetId}" },
  { method: "POST", path: "/murals/{muralId}/widgets/image" },
  { method: "PATCH", path: "/murals/{muralId}/widgets/image/{widgetId}" },
  { method: "POST", path: "/murals/{muralId}/widgets/shape" },
  { method: "PATCH", path: "/murals/{muralId}/widgets/shape/{widgetId}" },
  { method: "POST", path: "/murals/{muralId}/widgets/sticky-note" },
  { method: "PATCH", path: "/murals/{muralId}/widgets/sticky-note/{widgetId}" },
  { method: "POST", path: "/murals/{muralId}/widgets/table" },
  { method: "POST", path: "/murals/{muralId}/widgets/textbox" },
  { method: "PATCH", path: "/murals/{muralId}/widgets/textbox/{widgetId}" },
  { method: "POST", path: "/murals/{muralId}/widgets/title" },
  { method: "PATCH", path: "/murals/{muralId}/widgets/title/{widgetId}" },
  { method: "PATCH", path: "/murals/{muralId}/visitor-settings" },
  { method: "POST", path: "/murals/{muralId}/visitor-settings/reset-link" },
  { method: "POST", path: "/rooms" },
  { method: "DELETE", path: "/rooms/{roomId}" },
  { method: "PATCH", path: "/rooms/{roomId}" },
  { method: "POST", path: "/rooms/{roomId}/folders" },
  { method: "DELETE", path: "/rooms/{roomId}/folders/{folderId}" },
  { method: "PATCH", path: "/rooms/{roomId}/users/permissions" },
  { method: "POST", path: "/rooms/{roomId}/users/invite" },
  { method: "POST", path: "/rooms/{roomId}/users/remove" },
  { method: "POST", path: "/templates" },
  { method: "DELETE", path: "/templates/{templateId}" },
  { method: "POST", path: "/templates/{templateId}/murals" },
  { method: "POST", path: "/workspaces/{workspaceId}/users/invite" },
];

export class MuralApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class MuralApiAdapter {
  health(accessToken: string) {
    return this.callRead(accessToken, { path: "/users/me" });
  }

  async callRead(accessToken: string, input: JsonObject) {
    return await this.request(accessToken, {
      method: "GET",
      path: this.requiredPath(input.path),
      query: this.object(input.query),
    }, MURAL_READ_OPERATIONS);
  }

  async callWrite(accessToken: string, input: JsonObject) {
    const method = this.requiredMethod(input.method);
    return await this.request(accessToken, {
      method,
      path: this.requiredPath(input.path),
      query: this.object(input.query),
      json: input.json === undefined ? undefined : this.object(input.json),
    }, MURAL_WRITE_OPERATIONS);
  }

  private async request(
    accessToken: string,
    input: { method: Operation["method"]; path: string; query?: JsonObject; json?: JsonObject },
    allowed: readonly Operation[],
  ) {
    if (!accessToken?.trim() || accessToken.length > 10_000) {
      throw new MuralApiError("credential_missing", "Mural OAuth access token is required.", 401);
    }
    if (!allowed.some((operation) => operation.method === input.method && this.matches(operation.path, input.path))) {
      throw new MuralApiError("provider_validation_error", "Mural method or path is outside the documented public API boundary.");
    }
    this.rejectCredentials(input.query);
    this.rejectCredentials(input.json);
    const url = new URL(`https://app.mural.co/api/public/v1${input.path}`);
    this.appendQuery(url.searchParams, input.query ?? {});
    const body = input.json === undefined ? undefined : JSON.stringify(input.json);
    if (body && Buffer.byteLength(body) > 2_000_000) {
      throw new MuralApiError("provider_validation_error", "Mural request exceeds 2 MB.");
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
      if (raw.length > 10_000_000) {
        throw new MuralApiError("provider_validation_error", "Mural response exceeds 10 MB.");
      }
      let data: unknown;
      try {
        data = raw.length ? JSON.parse(raw.toString("utf8")) : null;
      } catch {
        data = { content: raw.toString("utf8").slice(0, 1_000_000) };
      }
      data = this.redact(data);
      if (!response.ok) {
        throw new MuralApiError(
          this.safeCode(response.status),
          this.message(data) ?? `Mural returned HTTP ${response.status}.`,
          response.status,
        );
      }
      return data;
    } catch (error) {
      if (error instanceof MuralApiError) throw error;
      throw new MuralApiError("provider_unavailable", "Mural could not be reached.", 502);
    }
  }

  private matches(template: string, path: string) {
    const pattern = template
      .split("/")
      .map((segment) => segment.startsWith("{") ? "[A-Za-z0-9._:@%+=~-]{1,300}" : segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("/");
    return new RegExp(`^${pattern}$`).test(path);
  }

  private requiredPath(value: unknown) {
    if (typeof value !== "string" || !value.startsWith("/") || value.includes("..") || value.includes("//") || value.includes("?") || value.includes("#") || value.length > 2_000) {
      throw new MuralApiError("provider_validation_error", "Mural path is invalid.");
    }
    return value;
  }

  private requiredMethod(value: unknown): "POST" | "PATCH" | "DELETE" {
    const method = typeof value === "string" ? value.toUpperCase() : "";
    if (method !== "POST" && method !== "PATCH" && method !== "DELETE") {
      throw new MuralApiError("provider_validation_error", "Mural write method must be POST, PATCH, or DELETE.");
    }
    return method;
  }

  private appendQuery(params: URLSearchParams, value: JsonObject) {
    if (Object.keys(value).length > 100) throw new MuralApiError("provider_validation_error", "Mural request has too many query fields.");
    for (const [key, item] of Object.entries(value)) {
      if (item === undefined || item === null || item === "") continue;
      if (!/^[A-Za-z0-9_.\[\]-]{1,100}$/.test(key)) throw new MuralApiError("provider_validation_error", "Mural query key is invalid.");
      for (const entry of Array.isArray(item) ? item.slice(0, 100) : [item]) {
        if (!["string", "number", "boolean"].includes(typeof entry)) throw new MuralApiError("provider_validation_error", `Mural query field ${key} must be scalar.`);
        params.append(key, String(entry).slice(0, 20_000));
      }
    }
  }

  private rejectCredentials(value?: JsonObject) {
    const walk = (item: unknown, depth = 0) => {
      if (depth > 12) throw new MuralApiError("policy_blocked", "Mural request is too deeply nested.", 403);
      if (Array.isArray(item)) return item.slice(0, 1_000).forEach((entry) => walk(entry, depth + 1));
      if (!item || typeof item !== "object") return;
      for (const [key, entry] of Object.entries(item as JsonObject)) {
        if (/(access.?token|refresh.?token|client.?secret|authorization|password|cookie|credential|api.?key)/i.test(key)) {
          throw new MuralApiError("policy_blocked", `Credential-bearing field ${key} is not allowed.`, 403);
        }
        walk(entry, depth + 1);
      }
    };
    if (value) walk(value);
  }

  private redact(value: unknown, depth = 0): unknown {
    if (depth > 10) return "[truncated]";
    if (typeof value === "string") return value.slice(0, 2_000_000);
    if (Array.isArray(value)) return value.slice(0, 2_000).map((item) => this.redact(item, depth + 1));
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(Object.entries(value as JsonObject).slice(0, 2_000).map(([key, item]) => [key, /(token|secret|authorization|password|cookie|api.?key)/i.test(key) ? "[redacted]" : this.redact(item, depth + 1)]));
  }

  private message(value: unknown) {
    const body = value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : null;
    const candidate = body?.error_description ?? body?.error ?? body?.message;
    return typeof candidate === "string" ? candidate.slice(0, 500) : null;
  }

  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "credential_missing";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
  }
}
