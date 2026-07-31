import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Method = "GET" | "POST" | "PUT" | "DELETE";
type Operation = { method: Method; path: string };

export const FIGMA_READ_OPERATIONS: readonly Operation[] = [
  { method: "GET", path: "/v1/me" },
  { method: "GET", path: "/v1/files/{fileKey}" },
  { method: "GET", path: "/v1/files/{fileKey}/nodes" },
  { method: "GET", path: "/v1/images/{fileKey}" },
  { method: "GET", path: "/v1/files/{fileKey}/images" },
  { method: "GET", path: "/v1/files/{fileKey}/meta" },
  { method: "GET", path: "/v1/files/{fileKey}/comments" },
  { method: "GET", path: "/v1/files/{fileKey}/comments/{commentId}/reactions" },
  { method: "GET", path: "/v1/files/{fileKey}/versions" },
  { method: "GET", path: "/v1/teams/{teamId}/projects" },
  { method: "GET", path: "/v1/projects/{projectId}/files" },
  { method: "GET", path: "/v1/files/{fileKey}/components" },
  { method: "GET", path: "/v1/files/{fileKey}/component_sets" },
  { method: "GET", path: "/v1/files/{fileKey}/styles" },
  { method: "GET", path: "/v1/teams/{teamId}/components" },
  { method: "GET", path: "/v1/teams/{teamId}/component_sets" },
  { method: "GET", path: "/v1/teams/{teamId}/styles" },
  { method: "GET", path: "/v1/components/{key}" },
  { method: "GET", path: "/v1/component_sets/{key}" },
  { method: "GET", path: "/v1/styles/{key}" },
  { method: "GET", path: "/v1/files/{fileKey}/dev_resources" },
  { method: "GET", path: "/v1/files/{fileKey}/variables/local" },
  { method: "GET", path: "/v1/files/{fileKey}/variables/published" },
  { method: "GET", path: "/v1/files/{fileKey}/selections" },
  { method: "GET", path: "/v2/webhooks" },
  { method: "GET", path: "/v2/webhooks/{webhookId}" },
  { method: "GET", path: "/v2/webhooks/{webhookId}/requests" },
];

export const FIGMA_WRITE_OPERATIONS: readonly Operation[] = [
  { method: "POST", path: "/v1/files/{fileKey}/comments" },
  { method: "DELETE", path: "/v1/files/{fileKey}/comments/{commentId}" },
  {
    method: "POST",
    path: "/v1/files/{fileKey}/comments/{commentId}/reactions",
  },
  {
    method: "DELETE",
    path: "/v1/files/{fileKey}/comments/{commentId}/reactions",
  },
  { method: "POST", path: "/v1/files/{fileKey}/dev_resources" },
  { method: "PUT", path: "/v1/files/{fileKey}/dev_resources" },
  {
    method: "DELETE",
    path: "/v1/files/{fileKey}/dev_resources/{devResourceId}",
  },
  { method: "POST", path: "/v1/files/{fileKey}/variables" },
  { method: "POST", path: "/v2/webhooks" },
  { method: "PUT", path: "/v2/webhooks/{webhookId}" },
  { method: "DELETE", path: "/v2/webhooks/{webhookId}" },
];

export class FigmaApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class FigmaApiAdapter {
  health(accessToken: string) {
    return this.callRead(accessToken, { path: "/v1/me" });
  }

  async callRead(accessToken: string, input: JsonObject) {
    return await this.request(accessToken, "GET", input, FIGMA_READ_OPERATIONS);
  }

  async callWrite(accessToken: string, input: JsonObject) {
    const method = this.method(input.method);
    return await this.request(
      accessToken,
      method,
      input,
      FIGMA_WRITE_OPERATIONS,
    );
  }

  private async request(
    accessToken: string,
    method: Method,
    input: JsonObject,
    allowed: readonly Operation[],
  ) {
    if (!accessToken?.trim() || accessToken.length > 10_000)
      throw new FigmaApiError(
        "credential_missing",
        "Figma OAuth access token is required.",
        401,
      );
    const path = this.path(input.path);
    if (
      !allowed.some(
        (operation) =>
          operation.method === method && this.matches(operation.path, path),
      )
    ) {
      throw new FigmaApiError(
        "provider_validation_error",
        "Figma method or path is outside the supported REST boundary.",
      );
    }
    const query = this.object(input.query);
    const json = input.json === undefined ? undefined : this.object(input.json);
    this.rejectCredentials(query);
    this.rejectCredentials(json);
    const url = new URL(`https://api.figma.com${path}`);
    this.appendQuery(url.searchParams, query);
    const body = json === undefined ? undefined : JSON.stringify(json);
    if (body && Buffer.byteLength(body) > 1_000_000)
      throw new FigmaApiError(
        "provider_validation_error",
        "Figma request exceeds 1 MB.",
      );
    try {
      const response = await safeConnectorFetch(url, {
        method,
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
      if (raw.length > 12_000_000)
        throw new FigmaApiError(
          "provider_validation_error",
          "Figma response exceeds 12 MB.",
        );
      let data: unknown;
      try {
        data = raw.length ? JSON.parse(raw.toString("utf8")) : null;
      } catch {
        data = { content: raw.toString("utf8").slice(0, 1_000_000) };
      }
      data = this.redact(data);
      if (!response.ok)
        throw new FigmaApiError(
          this.safeCode(response.status),
          this.message(data) ?? `Figma returned HTTP ${response.status}.`,
          response.status,
        );
      return data;
    } catch (error) {
      if (error instanceof FigmaApiError) throw error;
      throw new FigmaApiError(
        "provider_unavailable",
        "Figma could not be reached.",
        502,
      );
    }
  }

  private path(value: unknown) {
    if (
      typeof value !== "string" ||
      !/^\/v[12]\//.test(value) ||
      value.includes("..") ||
      value.includes("//") ||
      value.includes("?") ||
      value.includes("#") ||
      value.length > 2_000
    ) {
      throw new FigmaApiError(
        "provider_validation_error",
        "Figma path is invalid.",
      );
    }
    return value;
  }

  private method(value: unknown): "POST" | "PUT" | "DELETE" {
    const method = typeof value === "string" ? value.toUpperCase() : "";
    if (method !== "POST" && method !== "PUT" && method !== "DELETE")
      throw new FigmaApiError(
        "provider_validation_error",
        "Figma write method must be POST, PUT, or DELETE.",
      );
    return method;
  }

  private matches(template: string, path: string) {
    const pattern = template
      .split("/")
      .map((segment) =>
        segment.startsWith("{")
          ? "[A-Za-z0-9._:@%+=~-]{1,300}"
          : segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      )
      .join("/");
    return new RegExp(`^${pattern}$`).test(path);
  }

  private appendQuery(params: URLSearchParams, value: JsonObject) {
    if (Object.keys(value).length > 50)
      throw new FigmaApiError(
        "provider_validation_error",
        "Figma request has too many query fields.",
      );
    for (const [key, item] of Object.entries(value)) {
      if (item === undefined || item === null || item === "") continue;
      if (!/^[A-Za-z0-9_.\[\]-]{1,100}$/.test(key))
        throw new FigmaApiError(
          "provider_validation_error",
          "Figma query key is invalid.",
        );
      for (const entry of Array.isArray(item) ? item.slice(0, 100) : [item]) {
        if (!["string", "number", "boolean"].includes(typeof entry))
          throw new FigmaApiError(
            "provider_validation_error",
            `Figma query field ${key} must be scalar.`,
          );
        params.append(key, String(entry));
      }
    }
  }

  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }

  private rejectCredentials(value: unknown, depth = 0) {
    if (!value || typeof value !== "object") return;
    if (depth > 12)
      throw new FigmaApiError(
        "policy_blocked",
        "Figma request is too deeply nested.",
        403,
      );
    for (const [key, item] of Object.entries(value as JsonObject)) {
      if (
        /(authorization|access.?token|refresh.?token|client.?secret|api.?key|password|cookie)/i.test(
          key,
        )
      )
        throw new FigmaApiError(
          "policy_blocked",
          `Credential-bearing field ${key} is not allowed.`,
          403,
        );
      if (Array.isArray(item))
        item
          .slice(0, 1000)
          .forEach((entry) => this.rejectCredentials(entry, depth + 1));
      else this.rejectCredentials(item, depth + 1);
    }
  }

  private redact(value: unknown, depth = 0): unknown {
    if (depth > 20) return "[truncated]";
    if (Array.isArray(value))
      return value.slice(0, 5000).map((entry) => this.redact(entry, depth + 1));
    if (!value || typeof value !== "object") return value;
    const output: JsonObject = {};
    for (const [key, item] of Object.entries(value as JsonObject).slice(
      0,
      10_000,
    ))
      output[key] =
        /(token|secret|password|passcode|authorization|cookie)/i.test(key)
          ? "[redacted]"
          : this.redact(item, depth + 1);
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
    if (!value || typeof value !== "object" || Array.isArray(value))
      return null;
    const object = value as JsonObject;
    return typeof object.message === "string"
      ? object.message.slice(0, 500)
      : typeof object.err === "string"
        ? object.err.slice(0, 500)
        : null;
  }
}
