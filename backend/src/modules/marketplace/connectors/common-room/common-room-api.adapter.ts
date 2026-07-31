import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type CommonRoomCredentials = { apiToken: string };

export class CommonRoomApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class CommonRoomApiAdapter {
  tokenStatus(credentials: CommonRoomCredentials) {
    return this.request(credentials, {
      method: "GET",
      path: "/api/v2/api-token-status",
    });
  }

  listSegments(credentials: CommonRoomCredentials, input: JsonObject) {
    return this.request(credentials, {
      method: "GET",
      path: "/api/v2/segments",
      query: {
        limit: this.clamp(input.limit, 25, 1, 100),
        query: this.shortString(input.query, 200),
      },
    });
  }

  listProviders(credentials: CommonRoomCredentials, input: JsonObject) {
    return this.request(credentials, {
      method: "GET",
      path: "/api/v2/providers",
      query: { limit: this.clamp(input.limit, 25, 1, 100) },
    });
  }

  async request(
    credentials: CommonRoomCredentials,
    input: {
      method: string;
      path: string;
      query?: JsonObject;
      json?: JsonObject;
    },
  ) {
    if (!credentials.apiToken)
      throw new CommonRoomApiError(
        "credential_missing",
        "Common Room API token is required.",
        401,
      );
    const method = input.method.toUpperCase();
    const validV2 = /^\/api\/v2\/[A-Za-z0-9_./-]*$/.test(input.path);
    if (
      !/^(GET|POST|PATCH|DELETE)$/.test(method) ||
      !validV2 ||
      input.path.includes("..") ||
      input.path.includes("//")
    )
      throw new CommonRoomApiError(
        "provider_validation_error",
        "Common Room method or path is invalid.",
      );
    this.rejectCredentialFields(input.query);
    this.rejectCredentialFields(input.json);
    const body = input.json ? JSON.stringify(input.json) : undefined;
    if (body && Buffer.byteLength(body) > 1_000_000)
      throw new CommonRoomApiError(
        "provider_validation_error",
        "Common Room request exceeds 1 MB.",
      );
    const url = new URL(`https://api.commonroom.io${input.path}`);
    this.appendQuery(url.searchParams, input.query);
    const response = await safeConnectorFetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${credentials.apiToken}`,
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body,
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    });
    const raw = await response.text();
    if (raw.length > 2_000_000)
      throw new CommonRoomApiError(
        "provider_validation_error",
        "Common Room response exceeds 2 MB.",
      );
    let data: unknown = raw;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {}
    data = this.redact(data);
    if (!response.ok)
      throw new CommonRoomApiError(
        this.safeCode(response.status),
        this.providerMessage(data) ??
          `Common Room returned HTTP ${response.status}.`,
        response.status,
      );
    return data;
  }

  private rejectCredentialFields(value?: JsonObject) {
    const walk = (current: unknown, depth = 0) => {
      if (depth > 12)
        throw new CommonRoomApiError(
          "policy_blocked",
          "Common Room request is too deeply nested.",
        );
      if (Array.isArray(current))
        return current.forEach((item) => walk(item, depth + 1));
      if (!current || typeof current !== "object") return;
      for (const [key, child] of Object.entries(current as JsonObject)) {
        if (
          /(token|secret|authorization|password|cookie|credential|api.?key)/i.test(
            key,
          )
        )
          throw new CommonRoomApiError(
            "policy_blocked",
            `Credential-bearing field ${key} is not allowed.`,
          );
        walk(child, depth + 1);
      }
    };
    if (value) walk(value);
  }

  private appendQuery(params: URLSearchParams, value?: JsonObject) {
    if (!value) return;
    if (Object.keys(value).length > 50)
      throw new CommonRoomApiError(
        "provider_validation_error",
        "Common Room query has too many fields.",
      );
    for (const [key, current] of Object.entries(value))
      if (current !== undefined && current !== null && current !== "")
        params.append(key, String(current));
  }

  private redact(value: unknown, depth = 0): unknown {
    if (depth > 8) return "[truncated]";
    if (typeof value === "string") return value.slice(0, 500_000);
    if (Array.isArray(value))
      return value.slice(0, 500).map((item) => this.redact(item, depth + 1));
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .slice(0, 500)
        .map(([key, child]) => [
          key,
          /(token|secret|authorization|password|cookie|credential|email|phone)/i.test(
            key,
          )
            ? "[redacted]"
            : this.redact(child, depth + 1),
        ]),
    );
  }

  private providerMessage(value: unknown) {
    const object =
      value && typeof value === "object" && !Array.isArray(value)
        ? (value as JsonObject)
        : null;
    return typeof object?.message === "string"
      ? object.message.slice(0, 500)
      : typeof object?.reason === "string"
        ? object.reason.slice(0, 500)
        : null;
  }

  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "credential_missing";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
  private clamp(value: unknown, fallback: number, min: number, max: number) {
    const number = Number(value ?? fallback);
    return Number.isFinite(number)
      ? Math.min(Math.max(Math.floor(number), min), max)
      : fallback;
  }
  private shortString(value: unknown, max: number) {
    return typeof value === "string" && value.trim()
      ? value.trim().slice(0, max)
      : undefined;
  }
}
