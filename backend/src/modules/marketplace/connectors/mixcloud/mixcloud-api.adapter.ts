import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;

export class MixcloudApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class MixcloudApiAdapter {
  health(token: string) {
    return this.read(token, "/me/", {});
  }

  read(token: string, key: string, query: JsonObject) {
    return this.request(token, "GET", this.readKey(key), query);
  }

  engage(token: string, key: string, action: string, remove: boolean) {
    const actions = ["follow", "favorite", "repost", "listen-later"];
    if (!actions.includes(action))
      throw this.invalid("Mixcloud engagement action is invalid.");
    const base = this.objectKey(key);
    const parts = base.split("/").filter(Boolean);
    if (action === "follow" ? parts.length !== 1 : parts.length !== 2)
      throw this.invalid("Mixcloud key does not match the engagement action.");
    return this.request(
      token,
      remove ? "DELETE" : "POST",
      `${base}${action}/`,
      {},
    );
  }

  async upload(token: string, input: JsonObject, edit: boolean) {
    const accessToken = this.credential(token);
    this.rejectSecrets(input);
    const base64 = edit
      ? this.optionalText(input.base64, "base64", 35_000_000)
      : this.text(input.base64, "base64", 35_000_000);
    const bytes = base64 ? Buffer.from(base64, "base64") : null;
    if (bytes && (!bytes.length || bytes.byteLength > 25_000_000))
      throw this.invalid("Mixcloud upload must be between 1 byte and 25 MB.");

    const pictureBase64 = this.optionalText(
      input.pictureBase64,
      "pictureBase64",
      14_000_000,
    );
    const picture = pictureBase64 ? Buffer.from(pictureBase64, "base64") : null;
    if (picture && (!picture.length || picture.byteLength > 10_000_000))
      throw this.invalid("Mixcloud picture must be between 1 byte and 10 MB.");

    const key = edit
      ? this.objectKey(this.text(input.key, "key", 300))
      : "/upload/";
    if (edit && key.split("/").filter(Boolean).length !== 2)
      throw this.invalid("Mixcloud edit key must identify one upload.");
    const url = new URL(
      edit ? `/upload${key}edit/` : "/upload/",
      "https://api.mixcloud.com",
    );
    url.searchParams.set("access_token", accessToken);

    const form = new FormData();
    if (bytes)
      form.set(
        "mp3",
        new Blob([new Uint8Array(bytes)], { type: "audio/mpeg" }),
        this.optionalText(input.fileName, "fileName", 250) ?? "upload.mp3",
      );
    if (picture)
      form.set(
        "picture",
        new Blob([new Uint8Array(picture)], { type: "image/jpeg" }),
        this.optionalText(input.pictureFileName, "pictureFileName", 250) ??
          "picture.jpg",
      );

    const fields = input.fields == null ? {} : this.object(input.fields);
    for (const [name, value] of Object.entries(fields)) {
      if (
        !/^(name|description|unlisted|publish_date|disable_comments|hide_stats|publish|unpublish|tags-[0-4]-tag|hosts-[0-1]-username|sections-[0-9]+-(artist|song|chapter|start_time))$/.test(
          name,
        )
      )
        throw this.invalid(`Mixcloud upload field ${name} is invalid.`);
      if (typeof value === "object")
        throw this.invalid(`Mixcloud upload field ${name} must be scalar.`);
      form.set(name, String(value).slice(0, 2_000));
    }
    return this.fetch(url, {
      method: "POST",
      headers: { Accept: "application/json" },
      body: form,
      redirect: "error",
      signal: AbortSignal.timeout(60_000),
    });
  }

  private async request(
    token: string,
    method: "GET" | "POST" | "DELETE",
    path: string,
    input: JsonObject,
  ) {
    const accessToken = this.credential(token);
    this.rejectSecrets(input);
    const url = new URL(path, "https://api.mixcloud.com");
    url.searchParams.set("access_token", accessToken);
    if (method === "GET") this.query(url.searchParams, input);
    return this.fetch(url, {
      method,
      headers: { Accept: "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(method === "GET" ? 20_000 : 30_000),
      cache: "no-store",
    });
  }

  private async fetch(url: URL, init: RequestInit) {
    try {
      const response = await safeConnectorFetch(url, init);
      const raw = Buffer.from(await response.arrayBuffer());
      if (raw.byteLength > 5_000_000)
        throw this.invalid("Mixcloud response exceeds 5 MB.");
      const data = this.redact(this.parse(raw));
      if (!response.ok) {
        const retryAfter = response.headers.get("retry-after");
        const providerType = this.errorType(data);
        const rateLimited =
          response.status === 429 ||
          (response.status === 403 &&
            (Boolean(retryAfter) || /rate.?limit/i.test(providerType ?? "")));
        throw new MixcloudApiError(
          rateLimited ? "provider_rate_limited" : this.code(response.status),
          this.message(data) ?? `Mixcloud returned HTTP ${response.status}.`,
          response.status,
        );
      }
      return {
        data,
        pagination:
          data && typeof data === "object"
            ? ((data as JsonObject).paging ?? null)
            : null,
        rateLimit: { retryAfter: response.headers.get("retry-after") },
      };
    } catch (error) {
      if (error instanceof MixcloudApiError) throw error;
      throw new MixcloudApiError(
        "provider_unavailable",
        "Mixcloud could not be reached.",
        502,
      );
    }
  }

  private readKey(value: string) {
    const key = this.objectKey(value);
    if (
      /\/(follow|favorite|repost|listen-later|edit)\/$/.test(key) ||
      key === "/upload/"
    )
      throw this.invalid("Mixcloud read key is not readable.");
    return key;
  }

  private objectKey(value: string) {
    const text = this.text(value, "key", 300);
    if (!/^\/(?:[A-Za-z0-9_.:+-]+\/){1,4}$/.test(text) || text.includes(".."))
      throw this.invalid("Mixcloud key is invalid.");
    return text;
  }

  private query(params: URLSearchParams, input: JsonObject) {
    if (Object.keys(input).length > 20)
      throw this.invalid("Mixcloud query has too many fields.");
    for (const [key, raw] of Object.entries(input)) {
      if (
        !/^(q|type|limit|offset|since|until|metadata|width|height|color)$/.test(
          key,
        ) ||
        typeof raw === "object"
      )
        throw this.invalid(`Mixcloud query field ${key} is invalid.`);
      const value = String(raw ?? "");
      if (value.length > 2_000 || /[\r\n]/.test(value))
        throw this.invalid(`Mixcloud query field ${key} is invalid.`);
      if (value) params.set(key, value);
    }
    if (params.has("limit")) {
      const limit = Number(params.get("limit"));
      if (!Number.isInteger(limit) || limit < 1 || limit > 100)
        throw this.invalid("Mixcloud limit must be 1 through 100.");
    }
  }

  private credential(value: string) {
    const text = value?.trim();
    if (!text || text.length > 20_000 || /[\r\n]/.test(text))
      throw new MixcloudApiError(
        "credential_missing",
        "Mixcloud access token is missing.",
        401,
      );
    return text;
  }

  private text(value: unknown, name: string, maximum: number) {
    const text = typeof value === "string" ? value.trim() : "";
    if (!text || text.length > maximum)
      throw this.invalid(`Mixcloud ${name} is invalid.`);
    return text;
  }

  private optionalText(value: unknown, name: string, maximum: number) {
    if (value == null || value === "") return null;
    return this.text(value, name, maximum);
  }

  private object(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw this.invalid("Mixcloud fields must be an object.");
    return value as JsonObject;
  }

  private rejectSecrets(value: unknown, depth = 0) {
    if (depth > 10)
      throw new MixcloudApiError(
        "policy_blocked",
        "Mixcloud input is too deeply nested.",
        403,
      );
    if (Array.isArray(value))
      return value.forEach((child) => this.rejectSecrets(child, depth + 1));
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value as JsonObject)) {
      if (/(token|secret|password|cookie|authorization|credential)/i.test(key))
        throw new MixcloudApiError(
          "policy_blocked",
          `Credential-bearing field ${key} is not allowed.`,
          403,
        );
      this.rejectSecrets(child, depth + 1);
    }
  }

  private parse(raw: Buffer): unknown {
    if (!raw.length) return null;
    try {
      return JSON.parse(raw.toString("utf8"));
    } catch {
      return { response: raw.toString("utf8").slice(0, 100_000) };
    }
  }

  private redact(value: unknown, depth = 0): unknown {
    if (depth > 10) return "[truncated]";
    if (Array.isArray(value))
      return value.slice(0, 500).map((child) => this.redact(child, depth + 1));
    if (!value || typeof value !== "object")
      return typeof value === "string" ? value.slice(0, 100_000) : value;
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .slice(0, 1_000)
        .map(([key, child]) => [
          key,
          /(token|secret|password|cookie|authorization)/i.test(key)
            ? "[redacted]"
            : this.redact(child, depth + 1),
        ]),
    );
  }

  private message(value: unknown) {
    const error =
      value && typeof value === "object" ? (value as JsonObject).error : null;
    return error &&
      typeof error === "object" &&
      typeof (error as JsonObject).message === "string"
      ? String((error as JsonObject).message).slice(0, 500)
      : null;
  }

  private errorType(value: unknown) {
    const error =
      value && typeof value === "object" ? (value as JsonObject).error : null;
    return error &&
      typeof error === "object" &&
      typeof (error as JsonObject).type === "string"
      ? String((error as JsonObject).type)
      : null;
  }

  private code(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private invalid(message: string) {
    return new MixcloudApiError("provider_validation_error", message, 400);
  }
}
