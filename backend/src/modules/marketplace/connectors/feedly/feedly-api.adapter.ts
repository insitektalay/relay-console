import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type FeedlyCredentials = { accessToken: string };

export class FeedlyApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class FeedlyApiAdapter {
  profile(credentials: FeedlyCredentials) {
    return this.request(credentials, { method: "GET", path: "/v3/profile" });
  }

  listTeamFolders(credentials: FeedlyCredentials) {
    return this.request(credentials, {
      method: "GET",
      path: "/v3/enterprise/collections",
      query: { includeArchived: false, format: "json" },
    });
  }

  collectArticles(credentials: FeedlyCredentials, input: JsonObject) {
    const streamId = this.requiredString(input.streamId, "streamId", 2_000);
    return this.request(credentials, {
      method: "GET",
      path: "/v3/streams/contents",
      query: {
        streamId,
        count: this.clamp(input.count, 20, 1, 100),
        newerThan: this.optionalInteger(input.newerThan),
        olderThan: this.optionalInteger(input.olderThan),
        continuation: this.optionalString(input.continuation, 2_000),
        includeAiActions: input.includeAiActions === true,
      },
    });
  }

  async request(
    credentials: FeedlyCredentials,
    input: { method: string; path: string; query?: JsonObject; json?: JsonObject },
  ) {
    if (!credentials.accessToken)
      throw new FeedlyApiError("credential_missing", "Feedly API access token is required.", 401);
    const method = input.method.toUpperCase();
    if (!/^(GET|POST|PUT|PATCH|DELETE)$/.test(method))
      throw new FeedlyApiError("provider_validation_error", "Feedly API method is invalid.");
    if (!/^\/v3\/[A-Za-z0-9_./,:-]*$/.test(input.path) || input.path.includes("..") || input.path.includes("//"))
      throw new FeedlyApiError("provider_validation_error", "Feedly API path is invalid.");
    this.rejectCredentialFields(input.query);
    this.rejectCredentialFields(input.json);
    const body = input.json ? JSON.stringify(input.json) : undefined;
    if (body && Buffer.byteLength(body) > 1_000_000)
      throw new FeedlyApiError("provider_validation_error", "Feedly request exceeds 1 MB.");
    const url = new URL(`https://api.feedly.com${input.path}`);
    this.appendQuery(url.searchParams, input.query);
    const response = await safeConnectorFetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${credentials.accessToken}`,
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body,
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    });
    const raw = await response.text();
    if (raw.length > 2_000_000)
      throw new FeedlyApiError("provider_validation_error", "Feedly response exceeds 2 MB.");
    let data: unknown = raw;
    try { data = raw ? JSON.parse(raw) : null; } catch {}
    data = this.redact(data);
    if (!response.ok)
      throw new FeedlyApiError(this.code(response.status), this.safeMessage(data) ?? `Feedly returned HTTP ${response.status}.`, response.status);
    return data;
  }

  private rejectCredentialFields(value?: JsonObject) {
    const walk = (input: unknown, depth = 0) => {
      if (depth > 12) throw new FeedlyApiError("policy_blocked", "Feedly request is too deeply nested.");
      if (Array.isArray(input)) return input.forEach((item) => walk(item, depth + 1));
      if (!input || typeof input !== "object") return;
      for (const [key, child] of Object.entries(input as JsonObject)) {
        if (/(token|secret|authorization|password|cookie|credential|api.?key)/i.test(key))
          throw new FeedlyApiError("policy_blocked", `Credential-bearing field ${key} is not allowed.`);
        walk(child, depth + 1);
      }
    };
    if (value) walk(value);
  }

  private appendQuery(params: URLSearchParams, value?: JsonObject) {
    if (!value) return;
    if (Object.keys(value).length > 50)
      throw new FeedlyApiError("provider_validation_error", "Feedly query has too many fields.");
    for (const [key, child] of Object.entries(value)) {
      if (child === undefined || child === null || child === "") continue;
      params.append(key, typeof child === "object" ? JSON.stringify(child) : String(child));
    }
  }

  private redact(value: unknown, depth = 0): unknown {
    if (depth > 8) return "[truncated]";
    if (typeof value === "string") return value.slice(0, 500_000);
    if (Array.isArray(value)) return value.slice(0, 500).map((item) => this.redact(item, depth + 1));
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(Object.entries(value as JsonObject).slice(0, 500).map(([key, child]) => [key, /(token|secret|authorization|password|cookie|api.?key)/i.test(key) ? "[redacted]" : this.redact(child, depth + 1)]));
  }

  private safeMessage(value: unknown) {
    const object = value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : null;
    return typeof object?.errorMessage === "string" ? object.errorMessage.slice(0, 500) : typeof object?.message === "string" ? object.message.slice(0, 500) : null;
  }

  private code(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "credential_missing";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private clamp(value: unknown, fallback: number, minimum: number, maximum: number) {
    const number = Number(value ?? fallback);
    return Number.isFinite(number) ? Math.min(Math.max(Math.floor(number), minimum), maximum) : fallback;
  }
  private optionalInteger(value: unknown) { const number = Number(value); return Number.isSafeInteger(number) ? number : undefined; }
  private optionalString(value: unknown, maximum: number) { return typeof value === "string" && value.trim() ? value.trim().slice(0, maximum) : undefined; }
  private requiredString(value: unknown, name: string, maximum: number) {
    if (typeof value !== "string" || !value.trim() || value.trim().length > maximum)
      throw new FeedlyApiError("provider_validation_error", `${name} is required and must be at most ${maximum} characters.`);
    return value.trim();
  }
}
