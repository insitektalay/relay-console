import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export class AudiusApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class AudiusApiAdapter {
  health(token: string) {
    return this.request(token, "GET", "/me", {}, null);
  }
  read(token: string, path: string, query: JsonObject) {
    return this.request(token, "GET", this.path(path, false), query, null);
  }
  manage(token: string, method: string, path: string, body: JsonObject) {
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(method))
      throw this.invalid("Audius mutation method is invalid.");
    return this.request(token, method, this.path(path, true), {}, body);
  }

  private async request(
    token: string,
    method: string,
    path: string,
    query: JsonObject,
    body: JsonObject | null,
  ) {
    const accessToken = this.credential(token);
    this.rejectSecrets(query);
    this.rejectSecrets(body);
    const url = new URL(path.replace(/^\/+/, ""), "https://api.audius.co/v1/");
    this.query(url.searchParams, query);
    const json = body ? JSON.stringify(body) : undefined;
    if (json && Buffer.byteLength(json) > 1_000_000)
      throw this.invalid("Audius request body exceeds 1 MB.");
    try {
      const response = await safeConnectorFetch(url, {
        method,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
          ...(json ? { "Content-Type": "application/json" } : {}),
        },
        body: json,
        redirect: "error",
        signal: AbortSignal.timeout(method === "GET" ? 20_000 : 30_000),
        cache: "no-store",
      });
      const raw = Buffer.from(await response.arrayBuffer());
      if (raw.byteLength > 5_000_000)
        throw this.invalid("Audius response exceeds 5 MB.");
      let data: unknown;
      try {
        data = raw.length ? JSON.parse(raw.toString("utf8")) : null;
      } catch {
        data = { response: raw.toString("utf8").slice(0, 100_000) };
      }
      data = this.redact(data);
      if (!response.ok)
        throw new AudiusApiError(
          this.code(response.status),
          this.message(data, response.status),
          response.status,
        );
      return {
        data,
        rateLimit: {
          limit: response.headers.get("x-ratelimit-limit"),
          remaining: response.headers.get("x-ratelimit-remaining"),
          retryAfter: response.headers.get("retry-after"),
        },
      };
    } catch (error) {
      if (error instanceof AudiusApiError) throw error;
      throw new AudiusApiError(
        "provider_unavailable",
        "Audius could not be reached.",
        502,
      );
    }
  }

  private path(value: string, mutation: boolean) {
    const text = typeof value === "string" ? value.trim() : "";
    if (!/^\/(?:[A-Za-z0-9._~:+-]+\/?){1,8}$/.test(text) || text.includes(".."))
      throw this.invalid("Audius API path is invalid.");
    const first = text.split("/").filter(Boolean)[0];
    const readRoots = new Set([
      "me",
      "users",
      "tracks",
      "playlists",
      "resolve",
      "comments",
      "explore",
    ]);
    const writeRoots = new Set(["users", "tracks", "playlists", "comments"]);
    if (!(mutation ? writeRoots : readRoots).has(first))
      throw new AudiusApiError(
        "policy_blocked",
        "Audius route is outside the content and social API boundary.",
        403,
      );
    if (
      /\/(?:stream|download|wallet|coins?|tips?|rewards?|prizes?|grants?|authorized_apps|messages?|dms?)(?:\/|$)/i.test(
        text,
      )
    )
      throw new AudiusApiError(
        "policy_blocked",
        "Audius financial, authorization-administration, messaging, and media-transfer routes are blocked.",
        403,
      );
    return text;
  }

  private query(params: URLSearchParams, input: JsonObject) {
    if (Object.keys(input).length > 30)
      throw this.invalid("Audius query has too many fields.");
    for (const [key, raw] of Object.entries(input)) {
      if (
        !/^[A-Za-z_][A-Za-z0-9_-]{0,99}$/.test(key) ||
        typeof raw === "object"
      )
        throw this.invalid(`Audius query field ${key} is invalid.`);
      if (raw == null || raw === "") continue;
      const value = String(raw);
      if (value.length > 2_000 || /[\r\n]/.test(value))
        throw this.invalid(`Audius query field ${key} is invalid.`);
      if (
        (key === "limit" || key === "page_size") &&
        (!/^\d{1,3}$/.test(value) || Number(value) < 1 || Number(value) > 100)
      )
        throw this.invalid("Audius page size must be 1 through 100.");
      params.append(key, value);
    }
  }
  private credential(value: string) {
    const text = value?.trim();
    if (!text || text.length > 20_000 || /[\r\n]/.test(text))
      throw new AudiusApiError(
        "credential_missing",
        "Audius access token is missing.",
        401,
      );
    return text;
  }
  private rejectSecrets(value: unknown, depth = 0) {
    if (depth > 12)
      throw new AudiusApiError(
        "policy_blocked",
        "Audius input is too deeply nested.",
        403,
      );
    if (Array.isArray(value))
      return value.forEach((item) => this.rejectSecrets(item, depth + 1));
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value as JsonObject)) {
      if (
        /(token|secret|authorization|password|cookie|credential|api.?key|wallet|private.?key|seed)/i.test(
          key,
        )
      )
        throw new AudiusApiError(
          "policy_blocked",
          `Credential-bearing field ${key} is not allowed.`,
          403,
        );
      this.rejectSecrets(child, depth + 1);
    }
  }
  private redact(value: unknown, depth = 0): unknown {
    if (depth > 12) return "[truncated]";
    if (Array.isArray(value))
      return value.slice(0, 500).map((item) => this.redact(item, depth + 1));
    if (!value || typeof value !== "object")
      return typeof value === "string" ? value.slice(0, 100_000) : value;
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .slice(0, 1_000)
        .map(([key, child]) => [
          key,
          /(token|secret|authorization|password|cookie|private.?key|seed|wallet)/i.test(
            key,
          )
            ? "[redacted]"
            : this.redact(child, depth + 1),
        ]),
    );
  }
  private message(value: unknown, status: number) {
    if (value && typeof value === "object") {
      const object = value as JsonObject;
      const message =
        object.message ?? object.error_description ?? object.error;
      if (typeof message === "string") return message.slice(0, 500);
    }
    return `Audius returned HTTP ${status}.`;
  }
  private code(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
  private invalid(message: string) {
    return new AudiusApiError("provider_validation_error", message, 400);
  }
}
