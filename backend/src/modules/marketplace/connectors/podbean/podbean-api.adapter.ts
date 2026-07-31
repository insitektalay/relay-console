import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";
type JsonObject = Record<string, unknown>;
type Operation = { id: string; method: "GET" | "POST"; path: string };
export const PODBEAN_OPERATIONS: Operation[] = [
  { id: "podcast-get", method: "GET", path: "/podcast" },
  { id: "episodes-list", method: "GET", path: "/episodes" },
  { id: "episode-get", method: "GET", path: "/episodes/:episodeId" },
  { id: "chapters-get", method: "GET", path: "/episodes/:episodeId/chapters" },
  { id: "downloads", method: "GET", path: "/podcastStats/stats" },
  { id: "countries", method: "GET", path: "/podcastStats/countries" },
  { id: "platforms", method: "GET", path: "/podcastStats/platforms" },
  { id: "sources", method: "GET", path: "/podcastStats/sources" },
  { id: "retention", method: "GET", path: "/podcastStats/userRetention" },
  { id: "engagement", method: "GET", path: "/engagementStats/stats" },
  {
    id: "analytic-interactions",
    method: "GET",
    path: "/analytics/podcastAnalyticReports",
  },
  {
    id: "daily-listeners",
    method: "GET",
    path: "/analytics/podcastDailyListener",
  },
  {
    id: "network-daily-listeners",
    method: "GET",
    path: "/analytics/networkDailyListener",
  },
  { id: "download-reports", method: "GET", path: "/analytics/podcastReports" },
  {
    id: "engagement-reports",
    method: "GET",
    path: "/analytics/podcastEngagementReports",
  },
  { id: "episode-create", method: "POST", path: "/episodes" },
  { id: "episode-update", method: "POST", path: "/episodes/:episodeId" },
  { id: "episode-delete", method: "POST", path: "/episodes/:episodeId/delete" },
  {
    id: "chapters-save",
    method: "POST",
    path: "/episodes/:episodeId/saveChapters",
  },
];
export class PodbeanApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}
@Injectable()
export class PodbeanApiAdapter {
  health(token: string) {
    return this.execute(token, "podcast-get", {});
  }
  execute(token: string, id: string, input: JsonObject) {
    const operation = PODBEAN_OPERATIONS.find((item) => item.id === id);
    if (!operation) throw this.invalid("Podbean operation is not pinned.");
    const pathValues = this.object(input.path);
    let path = operation.path;
    for (const name of Array.from(
      path.matchAll(/:([A-Za-z]+)/g),
      (match) => match[1],
    ))
      path = path.replace(
        `:${name}`,
        encodeURIComponent(this.segment(pathValues[name], name)),
      );
    return this.request(
      token,
      operation.method,
      path,
      this.object(input.parameters),
    );
  }
  async upload(token: string, input: JsonObject) {
    this.rejectSecrets(input);
    const base64 = this.text(input.base64, "base64", 35_000_000);
    const bytes = Buffer.from(base64, "base64");
    if (!bytes.length || bytes.byteLength > 25_000_000)
      throw this.invalid("Podbean upload must be between 1 byte and 25 MB.");
    const filename = this.text(input.fileName, "fileName", 250);
    if (/[/\\\r\n]/.test(filename))
      throw this.invalid("Podbean fileName is invalid.");
    const contentType = this.text(input.contentType, "contentType", 100);
    if (
      !/^(audio|video|image)\/[A-Za-z0-9.+-]+$|^(text\/vtt|application\/x-subrip)$/.test(
        contentType,
      )
    )
      throw this.invalid("Podbean upload content type is invalid.");
    const authorization = await this.request(
      token,
      "GET",
      "/files/uploadAuthorize",
      { filename, content_type: contentType, filesize: bytes.byteLength },
    );
    const data = authorization.data as JsonObject;
    const target =
      typeof data.presigned_url === "string"
        ? new URL(data.presigned_url)
        : null;
    const fileKey = typeof data.file_key === "string" ? data.file_key : "";
    if (
      !target ||
      target.protocol !== "https:" ||
      !(
        target.hostname === "s3.amazonaws.com" ||
        target.hostname.endsWith(".amazonaws.com")
      ) ||
      !fileKey
    )
      throw this.invalid("Podbean upload authorization was invalid.");
    const response = await safeConnectorFetch(target, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: new Uint8Array(bytes),
      redirect: "error",
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok)
      throw new PodbeanApiError(
        this.code(response.status),
        `Podbean storage upload returned HTTP ${response.status}.`,
        response.status,
      );
    return { data: { file_key: fileKey }, rateLimit: authorization.rateLimit };
  }
  private async request(
    token: string,
    method: string,
    path: string,
    parameters: JsonObject,
  ) {
    const accessToken = this.credential(token);
    this.rejectSecrets(parameters);
    const url = new URL(
      path.replace(/^\/+/, ""),
      "https://api.podbean.com/v1/",
    );
    url.searchParams.set("access_token", accessToken);
    const fields = this.fields(parameters);
    let body: string | undefined;
    if (method === "GET")
      for (const [key, value] of fields) url.searchParams.append(key, value);
    else {
      body = new URLSearchParams(fields).toString();
      if (Buffer.byteLength(body) > 1_000_000)
        throw this.invalid("Podbean request body exceeds 1 MB.");
    }
    try {
      const response = await safeConnectorFetch(url, {
        method,
        headers: {
          Accept: "application/json",
          ...(body
            ? { "Content-Type": "application/x-www-form-urlencoded" }
            : {}),
        },
        body,
        redirect: "error",
        signal: AbortSignal.timeout(method === "GET" ? 20_000 : 30_000),
        cache: "no-store",
      });
      const raw = Buffer.from(await response.arrayBuffer());
      if (raw.byteLength > 5_000_000)
        throw this.invalid("Podbean response exceeds 5 MB.");
      let data: unknown;
      try {
        data = raw.length ? JSON.parse(raw.toString("utf8")) : null;
      } catch {
        data = { response: raw.toString("utf8").slice(0, 100_000) };
      }
      data = this.redact(data);
      if (!response.ok)
        throw new PodbeanApiError(
          this.code(response.status),
          this.message(data, response.status),
          response.status,
        );
      return {
        data,
        rateLimit: { retryAfter: response.headers.get("retry-after") },
      };
    } catch (error) {
      if (error instanceof PodbeanApiError) throw error;
      throw new PodbeanApiError(
        "provider_unavailable",
        "Podbean could not be reached.",
        502,
      );
    }
  }
  private fields(value: JsonObject): Array<[string, string]> {
    if (Object.keys(value).length > 60)
      throw this.invalid("Podbean request has too many fields.");
    return Object.entries(value).flatMap(([key, raw]) => {
      if (
        !/^[A-Za-z_][A-Za-z0-9_]{0,99}$/.test(key) ||
        typeof raw === "object"
      ) {
        if (key === "chapters" && Array.isArray(raw))
          return [[key, JSON.stringify(raw)] as [string, string]];
        throw this.invalid(`Podbean field ${key} is invalid.`);
      }
      if (raw == null || raw === "") return [];
      const text = String(raw);
      if (
        text.length > 100_000 ||
        /[\r\n]/.test(text) ||
        /^remote_.*_url$/.test(key)
      )
        throw this.invalid(`Podbean field ${key} is invalid.`);
      if (key === "limit" && (Number(text) < 1 || Number(text) > 100))
        throw this.invalid("Podbean limit must be 1 through 100.");
      return [[key, text] as [string, string]];
    });
  }
  private object(value: unknown): JsonObject {
    if (value == null) return {};
    if (typeof value !== "object" || Array.isArray(value))
      throw this.invalid("Podbean input section must be an object.");
    return value as JsonObject;
  }
  private segment(value: unknown, name: string) {
    const text = typeof value === "string" ? value.trim() : "";
    if (!text || !/^[A-Za-z0-9_-]{1,200}$/.test(text))
      throw this.invalid(`Podbean ${name} is invalid.`);
    return text;
  }
  private text(value: unknown, name: string, max: number) {
    const text = typeof value === "string" ? value.trim() : "";
    if (!text || text.length > max)
      throw this.invalid(`Podbean ${name} is invalid.`);
    return text;
  }
  private credential(value: string) {
    const text = value?.trim();
    if (!text || /[\r\n]/.test(text))
      throw new PodbeanApiError(
        "credential_missing",
        "Podbean access token is missing.",
        401,
      );
    return text;
  }
  private rejectSecrets(value: unknown, depth = 0) {
    if (depth > 12)
      throw new PodbeanApiError(
        "policy_blocked",
        "Podbean input is too deeply nested.",
        403,
      );
    if (Array.isArray(value))
      return value.forEach((item) => this.rejectSecrets(item, depth + 1));
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value as JsonObject)) {
      if (
        /(token|secret|authorization|password|cookie|credential|api.?key)/i.test(
          key,
        )
      )
        throw new PodbeanApiError(
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
      return typeof value === "string" ? value.slice(0, 100000) : value;
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .slice(0, 1000)
        .map(([key, child]) => [
          key,
          /(token|secret|authorization|password|cookie|presigned|report_url|download_url)/i.test(
            key,
          )
            ? "[redacted]"
            : this.redact(child, depth + 1),
        ]),
    );
  }
  private message(value: unknown, status: number) {
    if (value && typeof value === "object") {
      const message =
        (value as JsonObject).error_description ??
        (value as JsonObject).error ??
        (value as JsonObject).message;
      if (typeof message === "string") return message.slice(0, 500);
    }
    return `Podbean returned HTTP ${status}.`;
  }
  private code(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
  private invalid(message: string) {
    return new PodbeanApiError("provider_validation_error", message, 400);
  }
}
